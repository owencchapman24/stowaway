import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Alert, AppState, FlatList, Linking, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StoryContentsEntry, StorySummary } from '../domain/types';
import type { ImportProgress, UpdateResult } from '../importing/import-story';
import { updateNativeStory } from '../importing/native';
import { describeUpdate } from '../importing/update-summary';
import { Control } from '../reader/controls';
import { screenStyles as styles } from '../reader/screen-styles';
import { useStorage } from '../storage/context';
import { downloadNativeImages } from '../images/native';
import { describeImages } from '../images/summary';
import type { ImageProgress, ImageResult } from '../images/download';
import type { ImageSummary } from '../images/types';
import { failureContext } from '../importing/failure-presentation';
import { acquireStory, ImportFailure, isStoryBusy, subscribeStoryOperations, withLocalStoryWrite } from '../importing/ownership';
import { CLEANUP_WARNING, type ManagementAction } from '../storage/management';
import { cleanupNativeStoryFiles, manageNativeStory } from '../storage/management-native';

export default function StoryContents() {
  const params = useLocalSearchParams<{ story?: string }>();
  const id = typeof params.story === 'string' ? params.story : '';
  // A route change creates new state/ownership; late results cannot attach to another story.
  return <Contents key={id} id={id} />;
}

function Contents({ id }: { id: string }) {
  const { repository } = useStorage();
  const [story, setStory] = useState<StorySummary | null>(null);
  const [entries, setEntries] = useState<StoryContentsEntry[]>([]);
  const [saved, setSaved] = useState<StoryContentsEntry[]>([]);
  const displayedEntries = useRef<StoryContentsEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [outcome, setOutcome] = useState<UpdateResult | null>(null);
  const [imageSummary, setImageSummary] = useState<ImageSummary | null>(null);
  const [imageProgress, setImageProgress] = useState<ImageProgress | null>(null);
  const [imageOutcome, setImageOutcome] = useState<ImageResult | null>(null);
  const [operation, setOperation] = useState<'update' | 'images' | null>(null);
  const [running, setRunning] = useState(false);
  const [savingRead, setSavingRead] = useState(false);
  const [managing, setManaging] = useState(false);
  const [managementStatus, setManagementStatus] = useState<string | null>(null);
  const [cleanupWarning, setCleanupWarning] = useState<string | null>(null);
  const management = useRef<{ phase: 'first' | 'final' | 'running'; story: { id: string }; action: ManagementAction } | null>(null);
  const readWrite = useRef<object | null>(null);
  const ownedElsewhere = useSyncExternalStore(subscribeStoryOperations, () => isStoryBusy(id));
  const busy = running || savingRead || managing || ownedElsewhere;
  const abort = useRef<AbortController | null>(null);
  // Cancellation does not settle a transaction whose COMMIT is already underway.
  usePreventRemove(busy, () => {});
  const focused = useRef(false);
  const focusVersion = useRef(0);
  const readVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++readVersion.current;
    try {
      const [next, current, unlisted, images] = await Promise.all([
        repository.getStory(id), repository.listContents(id), repository.listSavedUnlisted(id),
        repository.getImageSummary(id),
      ]);
      if (focused.current && version === readVersion.current) {
        displayedEntries.current = [...current, ...unlisted];
        setStory(next); setEntries(current); setSaved(unlisted); setImageSummary(images);
        setError(next ? null : 'Story is not in the local library.');
        return 'applied' as const;
      }
    } catch {
      if (focused.current && version === readVersion.current) {
        displayedEntries.current = [];
        setStory(null); setEntries([]); setSaved([]); setImageSummary(null);
        setError('storage: Could not read local story contents.');
        return 'failed' as const;
      }
    }
    return 'stale' as const;
  }, [id, repository]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    setRunning(!!abort.current); setProgress(null); setOutcome(null); setImageProgress(null); setImageOutcome(null);
    setSavingRead(!!readWrite.current); setManaging(!!management.current);
    void refresh();
    return () => {
      focused.current = false; focusVersion.current++; readVersion.current++; abort.current?.abort();
      if (management.current?.phase !== 'running') management.current = null;
    };
  }, [refresh]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') abort.current?.abort(); });
    return () => subscription.remove();
  }, []);

  async function runOperation(images = false) {
    if (!focused.current || abort.current || readWrite.current || management.current || isStoryBusy(id) || story?.id !== id || story.source !== 'spacebattles') return;
    const controller = new AbortController(); abort.current = controller;
    const focus = focusVersion.current;
    readVersion.current++;
    setRunning(true); setOperation(images ? 'images' : 'update'); setOutcome(null); setError(null); setProgress(null);
    setImageProgress(null); setImageOutcome(null);
    const owned = () => focused.current && focusVersion.current === focus && abort.current === controller;
    let unexpectedFailure = false;
    const refreshed: { value: Awaited<ReturnType<typeof refresh>> } = { value: 'stale' };
    const onSettled = async () => {
      while (focused.current && refreshed.value === 'stale') refreshed.value = await refresh();
    };
    try {
      if (images) {
        const result = await downloadNativeImages(id, repository, { signal: controller.signal, onSettled,
          onProgress: (next) => { if (owned()) setImageProgress(next); } });
        if (result.storyId !== id) throw new Error('Image result belongs to a different story.');
        if (owned()) setImageOutcome(result);
      } else {
        const result = await updateNativeStory(story, repository, { signal: controller.signal, onSettled,
          onProgress: (next) => { if (owned() && (!next.storyId || next.storyId === id)) setProgress(next); } });
        if (result.story && result.story.id !== id) throw new Error('Update result belongs to a different story.');
        if (owned()) setOutcome(result);
      }
    } catch {
      unexpectedFailure = true;
    } finally {
      if (abort.current === controller) {
        // Keep every exit blocked through settlement AND the authoritative read,
        // including a blur/refocus while an unavoidable COMMIT finishes.
        // Fallback for unexpected errors before the service's settlement callback.
        await onSettled();
        if (owned() && refreshed.value === 'applied' && unexpectedFailure) setError('Local operation failed; earlier committed text and local images are retained. Reopen contents and retry.');
        abort.current = null;
        if (focused.current) { setRunning(false); setOperation(null); }
      }
    }
  }
  async function toggleRead(entry: StoryContentsEntry) {
    if (!focused.current || abort.current || readWrite.current || management.current || isStoryBusy(id) || story?.id !== id) return;
    // Resolve the latest displayed entry, including for handlers retained across refreshes.
    const current = displayedEntries.current.find((row) => row.postId === entry.postId);
    if (!current) return;
    const token = {}; readWrite.current = token;
    readVersion.current++; setSavingRead(true); setError(null);
    let failed = false;
    // Preserve the action's explicit intent: a retained Mark Read stays idempotent.
    await withLocalStoryWrite(id, async () => {
      try { await repository.setEntryRead(id, current.postId, !entry.isRead); }
      catch { failed = true; }
      finally {
        if (readWrite.current === token) {
          const refreshed: { value: Awaited<ReturnType<typeof refresh>> } = { value: 'stale' };
          while (focused.current && refreshed.value === 'stale') refreshed.value = await refresh();
          if (focused.current && failed && refreshed.value === 'applied') {
            setError('storage: Could not change Read/Unread state. The previous state is retained; please retry.');
          }
          readWrite.current = null;
          if (focused.current) setSavingRead(false);
        }
      }
    }).catch(() => {
      readWrite.current = null;
      if (focused.current) { setSavingRead(false); setError('Another story operation is settling; retry the Read/Unread change.'); }
    });
  }

  function confirmManagement(action: ManagementAction) {
    if (!focused.current || abort.current || readWrite.current || management.current || isStoryBusy(id) || story?.id !== id || story.source !== 'spacebattles') return;
    const token = { phase: 'first' as 'first' | 'final' | 'running', story, action };
    management.current = token; setManaging(true);
    const valid = () => focused.current && management.current === token && token.story.id === id;
    const cancel = () => { if (management.current === token && token.phase !== 'running') { management.current = null; setManaging(false); } };
    const perform = async () => {
      if (!valid() || token.phase !== 'final') return;
      token.phase = 'running'; readVersion.current++;
      setError(null); setOutcome(null); setProgress(null); setImageOutcome(null); setImageProgress(null); setManagementStatus(null);
      const refreshed: { value: Awaited<ReturnType<typeof refresh>> } = { value: 'stale' };
      try {
        const result = await manageNativeStory(token.story, action, repository, async () => {
          while (focused.current && refreshed.value === 'stale') refreshed.value = await refresh();
        });
        if (valid()) {
          setCleanupWarning(result.warning);
          if (refreshed.value === 'applied') setError(null);
          setManagementStatus(action === 'downloads' ? 'Downloads removed. Story metadata, Read/Unread state, positions and update history retained. Use Resume Download for current chapters.' : 'Story removed from this device. Return to Library to continue.');
        }
      } catch (failure) {
        if (valid()) setError(failure instanceof ImportFailure ? failure.message : 'Local removal could not finish. Reopen contents to check the saved state before retrying.');
      } finally {
        if (management.current === token) { management.current = null; if (focused.current) setManaging(false); }
      }
    };
    if (action === 'downloads') {
      token.phase = 'final';
      Alert.alert(`Remove downloads for ${story.title}?`, 'Remove downloaded text and local story images from this device. Keep this story in your Library, including Threadmarks metadata, Read/Unread state, saved reading positions and update history. Current chapters can be downloaded again with Resume Download.',
        [{ text: 'Cancel', style: 'cancel', onPress: cancel }, { text: 'Remove Downloads', style: 'destructive', onPress: () => { void perform(); } }], { cancelable: true, onDismiss: cancel });
    } else {
      Alert.alert(`Remove ${story.title}?`, 'Remove this story and all of its Stowaway data from this device, including text/images, Read/Unread state, reading positions, Threadmark metadata and update history.',
        [{ text: 'Cancel', style: 'cancel', onPress: cancel }, { text: 'Continue', onPress: () => {
          if (!valid() || token.phase !== 'first') return;
          token.phase = 'final';
          Alert.alert(`Confirm removal of ${token.story.title}`, 'This removes all local state for this story. Importing it again starts fresh with Unread chapters. This cannot be undone.',
            [{ text: 'Cancel', style: 'cancel', onPress: cancel }, { text: 'Remove Story', style: 'destructive', onPress: () => { void perform(); } }], { cancelable: true, onDismiss: cancel });
        } }], { cancelable: true, onDismiss: () => { if (token.phase === 'first') cancel(); } });
    }
  }

  async function retryCleanup() {
    if (!focused.current || abort.current || readWrite.current || management.current || isStoryBusy(id)) return;
    // This explicit retry can also run after full deletion; it never recreates metadata.
    let release: (() => void) | null = null;
    const token = { phase: 'running' as const, story: { id }, action: 'downloads' as const };
    management.current = token; setManaging(true);
    try {
      release = acquireStory(id);
      await cleanupNativeStoryFiles(id, repository);
      if (focused.current && management.current === token) setCleanupWarning(null);
    } catch { if (focused.current && management.current === token) setCleanupWarning(CLEANUP_WARNING); }
    finally {
      try {
        const refreshed: { value: Awaited<ReturnType<typeof refresh>> } = { value: 'stale' };
        while (focused.current && refreshed.value === 'stale') refreshed.value = await refresh();
        if (refreshed.value === 'applied') setError(null);
      } finally {
        release?.();
        if (management.current === token) { management.current = null; if (focused.current) setManaging(false); }
      }
    }
  }
  const status = progress ? {
    validating: 'Starting manual update check', manifest: `Checking complete primary manifest: ${progress.total} entries discovered`,
    saving: 'Saving complete primary manifest', reconciling: 'Reconciling complete primary manifest',
    downloading: `Downloading text: ${progress.downloaded} / ${progress.total}${progress.title ? ` · ${progress.title}` : ''}`,
    images: `Downloading eligible images${progress.title ? ` · ${progress.title}` : ''}. Text is already saved.`,
    completed: 'Check finished.', cancelled: 'Cancelled. Committed text is retained.', failed: 'Update stopped.',
  }[progress.phase] : null;
  const imageStatus = imageProgress ? {
    discovering: `Scanning images${imageProgress.title ? ` · ${imageProgress.title}` : ''}`,
    downloading: `Images: ${imageProgress.completed} / ${imageProgress.total} processed${imageProgress.title ? ` · ${imageProgress.title}` : ''}${imageProgress.slot ? ` · slot ${imageProgress.slot}` : ''}`,
    completed: 'Image work finished. See local, omitted and pending counts.',
    cancelled: 'Image work cancelled. Text and completed local images retained.', failed: 'Image work stopped. Text is retained.',
  }[imageProgress.phase] : null;
  const imageAction = imageSummary?.local || imageSummary?.mimeRetryable ? 'Retry Images' : 'Download Images';
  const rows = [...entries.map((entry) => ({ ...entry, saved: false })), ...saved.map((entry) => ({ ...entry, saved: true }))];
  return <SafeAreaView style={styles.page}>
    <Stack.Screen options={{ gestureEnabled: !busy }} />
    <FlatList data={rows} keyExtractor={(entry) => entry.id}
    contentContainerStyle={styles.content} ListHeaderComponent={<View style={styles.section}>
      <Control label="Return to Library" text="Library" disabled={busy}
        onPress={() => { if (!abort.current && !readWrite.current && !management.current && !isStoryBusy(id)) router.replace('/'); }} />
      <Text accessibilityRole="header" style={styles.heading}>{story?.title ?? 'Story contents'}</Text>
      {story && <><Text>{story.author ?? 'Author unavailable'}</Text>
        <Text>{story.downloaded} / {story.total} text chapters downloaded</Text>
        <Text>{story.unread} unread</Text>
        {story.source === 'spacebattles' && <>
          <Text>Text and images have separate download states. Only primary Threadmarks are included.</Text>
          {imageSummary && <Text>{describeImages(imageSummary)}</Text>}
          {!!imageSummary && (imageSummary.unknown > 0 || imageSummary.pending > 0 || imageSummary.local > 0 || !!imageSummary.mimeRetryable) &&
            <Control label={imageAction} text={imageAction} disabled={busy} onPress={() => { void runOperation(true); }} />}
          <Control label="Check for Updates" text="Check for Updates" disabled={busy} onPress={() => { void runOperation(); }} />
          {story.lastUpdateAttemptAt !== null && <Text>Last update attempt: {new Date(story.lastUpdateAttemptAt).toLocaleString()}</Text>}
          {story.lastUpdateSuccessAt !== null && <Text>Last complete check: {new Date(story.lastUpdateSuccessAt).toLocaleString()}</Text>}
        </>}
        {!!story.sourceUrl && <Control label="Open story source in browser" text="View source" disabled={busy}
          onPress={() => { if (!abort.current && !readWrite.current && !management.current && !isStoryBusy(id)) void Linking.openURL(story.sourceUrl).catch(() => setError('Could not open the source in your browser.')); }} />}
        {story.source === 'spacebattles' && story.downloaded < story.total && <Control label="Resume Download" text="Resume Download" disabled={busy}
          onPress={() => { if (!abort.current && !readWrite.current && !management.current && !isStoryBusy(id)) router.push({ pathname: '/add-story', params: { story: id } }); }} />}</>}
      {savingRead && <Text accessibilityLiveRegion="polite">Saving Read/Unread state locally…</Text>}
      {ownedElsewhere && !running && !savingRead && !managing && <Text accessibilityLiveRegion="polite">Another operation for this story is finishing. Local controls will be available when it settles.</Text>}
      {running && <Control label={operation === 'images' ? 'Cancel images' : 'Cancel update'} text="Cancel" onPress={() => abort.current?.abort()} />}
      {status && <Text accessibilityLiveRegion="polite">{status}</Text>}
      {outcome && <Text accessibilityLiveRegion="polite">{describeUpdate(outcome)}</Text>}
      {outcome?.failure && <><Text accessibilityRole="alert">{outcome.failure.code}: {outcome.failure.message}</Text><Text>{failureContext(outcome.failure)}</Text></>}
      {imageStatus && <Text accessibilityLiveRegion="polite">{imageStatus}</Text>}
      {imageOutcome?.failure && <><Text accessibilityRole="alert">{imageOutcome.failure.code}: {imageOutcome.failure.message}</Text><Text>{failureContext(imageOutcome.failure)}</Text></>}
      {__DEV__ && imageOutcome?.mimeDiagnostics?.map((diagnostic) => <Text selectable key={`${diagnostic.chapterId}:${diagnostic.slot}`}>
        {`Image MIME (dev): ${diagnostic.chapterId} · slot ${diagnostic.slot + 1} · received ${diagnostic.receivedMime ?? '(missing)'} · detected ${diagnostic.detectedFormat} · ${diagnostic.accepted ? 'validated' : 'rejected'}`}
      </Text>)}
      {error && <Text accessibilityRole="alert">{error}</Text>}
      {managing && <Text accessibilityLiveRegion="polite">Library management is awaiting confirmation or finishing locally…</Text>}
      {managementStatus && <Text accessibilityLiveRegion="polite">{managementStatus}</Text>}
      {cleanupWarning && <><Text accessibilityRole="alert">{cleanupWarning}</Text>
        <Control label="Retry local cleanup" text="Retry local cleanup" disabled={busy} onPress={() => { void retryCleanup(); }} /></>}
      <Text accessibilityRole="header">Primary Threadmarks</Text>
    </View>} renderItem={({ item }) => <View style={styles.section}>
      {item.saved && item.id === saved[0]?.id && <Text accessibilityRole="header">Saved chapters no longer listed</Text>}
      <Control label={`Read ${item.title}`} text={item.saved ? item.title : `${item.position + 1}. ${item.title}`} disabled={busy || !item.downloaded}
        onPress={() => { if (item.downloaded && !abort.current && !readWrite.current && !management.current && !isStoryBusy(id)) router.push({ pathname: '/reader', params: { chapter: item.id } }); }} />
      <Text>{item.downloaded ? 'Text downloaded' : 'Not downloaded'}</Text>
      <Text>{item.isRead ? 'Read' : 'Unread'}</Text>
      <Control label={`Mark ${item.title} as ${item.isRead ? 'unread' : 'read'}`} text={item.isRead ? 'Mark Unread' : 'Mark Read'}
        disabled={busy} onPress={() => { void toggleRead(item); }} />
      {__DEV__ && <Text selectable>Post ID: {item.postId}</Text>}
    </View>} ListFooterComponent={story?.source === 'spacebattles' ? <View style={[styles.section, { marginTop: 32 }]}>
      <Text accessibilityRole="header">Manage this story</Text>
      <Text>These actions remove local data. Each requires confirmation.</Text>
      <Control label={`Remove downloads for ${story.title}`} text="Remove Downloads" destructive disabled={busy}
        onPress={() => confirmManagement('downloads')} />
      <View style={{ marginTop: 20 }}><Control label={`Remove story ${story.title} and all local state`} text="Remove Story and All Local State" destructive disabled={busy}
        onPress={() => confirmManagement('story')} /></View>
    </View> : null} /></SafeAreaView>;
}
