import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Alert, AppState, FlatList, Linking, View } from 'react-native';
import type { ContinueReadingTarget, StoryContentsEntry, StorySummary } from '../domain/types';
import type { ImportProgress, UpdateResult } from '../importing/import-story';
import { updateNativeStory } from '../importing/native';
import { describeUpdate } from '../importing/update-summary';
import { AppScreen, AppText, Button, ChapterRow, InlineBanner, LoadingState, OperationPanel, ScreenHeader, SectionHeader, storySummary, uiStyles as styles } from '../ui/components';
import { useStorage } from '../storage/context';
import { downloadNativeImages } from '../images/native';
import { describeImages } from '../images/summary';
import type { ImageProgress, ImageResult } from '../images/download';
import type { ImageSummary } from '../images/types';
import { importProgressText, imageProgressText } from '../ui/operation-copy';
import { failureContext } from '../importing/failure-presentation';
import { acquireStory, ImportFailure, isStoryBusy, subscribeStoryOperations, subscribeStorySettled, withLocalStoryWrite } from '../importing/ownership';
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
  const [showActions, setShowActions] = useState(false);
  const [resume, setResume] = useState<ContinueReadingTarget | null>(null);
  const [refreshingForeign, setRefreshingForeign] = useState(false);
  const [refreshingFocus, setRefreshingFocus] = useState(false);
  const focusRefresh = useRef<object | null>(null);
  const foreignRefresh = useRef<object | null>(null);
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
  const busy = running || savingRead || managing || ownedElsewhere || refreshingForeign;
  const abort = useRef<AbortController | null>(null);
  // Cancellation does not settle a transaction whose COMMIT is already underway.
  usePreventRemove(busy, () => {});
  const focused = useRef(false);
  const focusVersion = useRef(0);
  const readVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++readVersion.current;
    try {
      const [next, current, unlisted, images, target] = await Promise.all([
        repository.getStory(id), repository.listContents(id), repository.listSavedUnlisted(id),
        repository.getImageSummary(id), repository.getContinueReading(id),
      ]);
      if (focused.current && version === readVersion.current) {
        displayedEntries.current = [...current, ...unlisted];
        setResume(target); setStory(next); setEntries(current); setSaved(unlisted); setImageSummary(images);
        setError(next ? null : 'Story is not in the local library.');
        return 'applied' as const;
      }
    } catch {
      if (focused.current && version === readVersion.current) {
        displayedEntries.current = [];
        setResume(null); setStory(null); setEntries([]); setSaved([]); setImageSummary(null);
        setError('storage: Could not read local story contents.');
        return 'failed' as const;
      }
    }
    return 'stale' as const;
  }, [id, repository]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    const token = {}; focusRefresh.current = token; setRefreshingFocus(true);
    setRunning(!!abort.current); setProgress(null); setOutcome(null); setImageProgress(null); setImageOutcome(null);
    setSavingRead(!!readWrite.current); setManaging(!!management.current);
    void refresh().finally(() => {
      if (focusRefresh.current === token) { focusRefresh.current = null; if (focused.current) setRefreshingFocus(false); }
    });
    return () => {
      focused.current = false; focusRefresh.current = null; foreignRefresh.current = null; setRefreshingForeign(false); focusVersion.current++; readVersion.current++; abort.current?.abort();
      if (management.current?.phase !== 'running') management.current = null;
    };
  }, [refresh]));
  useEffect(() => subscribeStorySettled((settledId) => {
    if (settledId !== id || !focused.current || abort.current || management.current) return;
    // Set the imperative gate synchronously, before the busy subscription releases
    // controls. A new completion invalidates any earlier in-flight local read.
    readVersion.current++;
    const token = {}; foreignRefresh.current = token; setRefreshingForeign(true);
    void (async () => {
      let result: Awaited<ReturnType<typeof refresh>> = 'stale';
      while (focused.current && foreignRefresh.current === token && result === 'stale') result = await refresh();
      if (foreignRefresh.current === token) { foreignRefresh.current = null; if (focused.current) setRefreshingForeign(false); }
    })();
  }), [id, refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') abort.current?.abort(); });
    return () => subscription.remove();
  }, []);

  async function runOperation(images = false) {
    if (!focused.current || foreignRefresh.current || abort.current || readWrite.current || management.current || isStoryBusy(id) || story?.id !== id || story.source !== 'spacebattles') return;
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
    if (!focused.current || foreignRefresh.current || abort.current || readWrite.current || management.current || isStoryBusy(id) || story?.id !== id) return;
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
    if (!focused.current || foreignRefresh.current || abort.current || readWrite.current || management.current || isStoryBusy(id) || story?.id !== id || story.source !== 'spacebattles') return;
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
    if (!focused.current || foreignRefresh.current || abort.current || readWrite.current || management.current || isStoryBusy(id)) return;
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

  const imageAction = imageSummary?.local || imageSummary?.mimeRetryable ? 'Retry Images' : 'Download Images';
  const rows = [...entries.map((entry) => ({ ...entry, saved: false })), ...saved.map((entry) => ({ ...entry, saved: true }))];
  const start = entries.find((entry) => entry.downloaded && !entry.isRead) ?? entries.find((entry) => entry.downloaded);
  const readingTarget = resume?.chapterId ?? start?.id;
  const canAct = () => focused.current && !foreignRefresh.current && !abort.current && !readWrite.current && !management.current && !isStoryBusy(id);
  const resumeDownload = () => { if (canAct()) router.push({ pathname: '/add-story', params: { story: id } }); };
  function openChapter(chapter: string) {
    if (canAct() && !focusRefresh.current && displayedEntries.current.some((entry) => entry.id === chapter && entry.downloaded)) {
      router.push({ pathname: '/reader', params: { chapter } });
    }
  }
  const maintenance = story && <View style={{ marginTop: 32, gap: 24 }}>
        {!!story.sourceUrl && <View style={{ gap: 8 }}>
          <SectionHeader>Story Actions</SectionHeader>
          {story.source === 'spacebattles' && <>
            <View style={styles.actions}>
              <Button label="Check for Updates" text="Check for Updates" variant="tertiary" disabled={busy} onPress={() => { void runOperation(); }} />
              {!!imageSummary && (imageSummary.unknown > 0 || imageSummary.pending > 0 || imageSummary.local > 0 || !!imageSummary.mimeRetryable) &&
                <Button label={imageAction} text={imageAction} variant="tertiary" disabled={busy} onPress={() => { void runOperation(true); }} />}
              {!!readingTarget && story.downloaded < story.total && <Button label="Resume Download" text="Resume Download" variant="tertiary" disabled={busy} onPress={resumeDownload} />}
            </View>
            {imageSummary && <AppText tone="caption">{describeImages(imageSummary)}</AppText>}
          </>}
          <Button label="Open story source in browser" text="View Source" variant="tertiary" disabled={busy}
            onPress={() => { if (canAct()) void Linking.openURL(story.sourceUrl).catch(() => { if (focused.current) setError('Could not open the source in your browser.'); }); }} />
          {story.lastUpdateAttemptAt !== null && <AppText tone="caption">Last update attempt: {new Date(story.lastUpdateAttemptAt).toLocaleString()}</AppText>}
          {story.lastUpdateSuccessAt !== null && <AppText tone="caption">Last complete check: {new Date(story.lastUpdateSuccessAt).toLocaleString()}</AppText>}
          {story.source === 'spacebattles' && <><AppText tone="secondary">Free local storage while keeping this story, Read/Unread state, reading positions and update history.</AppText>
            <Button label={'Remove downloads for ' + story.title} text="Remove Downloads" variant="destructive" disabled={busy} onPress={() => confirmManagement('downloads')} /></>}
        </View>}
        {story.source === 'spacebattles' && <View style={{ gap: 8 }}><SectionHeader>Danger Zone</SectionHeader>
          <AppText tone="secondary">Remove this story and all of its Stowaway data from this device.</AppText>
          <Button label={'Remove story ' + story.title + ' and all local state'} text="Remove Story" variant="destructive" disabled={busy} onPress={() => confirmManagement('story')} />
        </View>}
        {__DEV__ && !!imageOutcome?.mimeDiagnostics?.length && <View><SectionHeader>Development diagnostics</SectionHeader>
          {imageOutcome.mimeDiagnostics.map((diagnostic) => <AppText tone="caption" key={diagnostic.chapterId + ':' + diagnostic.slot}>
            {'Image MIME (dev): ' + diagnostic.chapterId + ' · slot ' + (diagnostic.slot + 1) + ' · received ' + (diagnostic.receivedMime ?? '(missing)') + ' · detected ' + diagnostic.detectedFormat + ' · ' + (diagnostic.accepted ? 'validated' : 'rejected')}
          </AppText>)}
        </View>}
      </View>;
  return <AppScreen>
    <Stack.Screen options={{ gestureEnabled: !busy }} />
    <FlatList data={rows} keyExtractor={(entry) => entry.id} contentContainerStyle={styles.content}
      ListHeaderComponent={<View style={[styles.section, { marginBottom: 0, gap: 8 }]}>
        <ScreenHeader display action={story && <Button label={showActions ? 'Hide story actions' : 'Show story actions'} text="…" variant="tertiary" quiet icon expanded={showActions} onPress={() => setShowActions(!showActions)} />} title={story?.title ?? 'Story contents'} back={<Button label="Return to Library" text="‹ Library" variant="tertiary" disabled={busy}
          onPress={() => { if (canAct()) router.replace('/'); }} />} />
        {story && <>
          {story.author && <AppText tone="secondary">{story.author}</AppText>}
          <AppText tone="secondary">{storySummary(story)}</AppText>
          {readingTarget ? <View style={{ gap: 8 }}>
            <Button label={resume ? 'Continue Reading' : 'Start Reading'} text={resume ? 'Continue Reading' : 'Start Reading'} variant="primary" disabled={busy || refreshingFocus}
              onPress={() => openChapter(readingTarget)} />
            <AppText tone="secondary">{resume?.chapterTitle ?? start?.title}</AppText>
            {resume && !resume.currentlyListed && <AppText tone="caption">Saved chapter no longer listed</AppText>}
          </View> : story.source === 'spacebattles' && story.downloaded < story.total &&
            <Button label="Resume Download" text="Resume Download" variant="primary" disabled={busy} onPress={resumeDownload} />}

        </>}
        {savingRead && <LoadingState text="Saving Read/Unread state locally…" />}
        {(refreshingForeign || ownedElsewhere && !running && !savingRead && !managing) && <LoadingState text="Another operation for this story is finishing. Refreshing local contents…" />}
        {running && <OperationPanel title={operation === 'images' ? 'Downloading images' : 'Checking for updates'}
          message={operation === 'images' ? imageProgressText(imageProgress) : importProgressText(progress)}
          completed={operation === 'images' ? imageProgress?.completed : progress?.phase === 'downloading' ? progress.downloaded : undefined}
          total={operation === 'images' ? imageProgress?.total : progress?.phase === 'downloading' ? progress.total : undefined}
          cancelLabel={operation === 'images' ? 'Cancel images' : 'Cancel update'} onCancel={() => abort.current?.abort()} />}
        {!running && outcome && <InlineBanner tone={outcome.failure ? outcome.failure.code === 'cancelled' ? 'info' : 'error' : 'success'}
          title={outcome.failure ? failureContext(outcome.failure) : 'Check finished.'} message={describeUpdate(outcome)}>
          {__DEV__ && outcome.failure && <AppText tone="caption">{outcome.failure.code}: {outcome.failure.message}</AppText>}
        </InlineBanner>}
        {!running && imageOutcome && <InlineBanner tone={imageOutcome.failure ? imageOutcome.failure.code === 'cancelled' ? 'info' : 'error' : 'success'}
          title={imageOutcome.failure ? failureContext(imageOutcome.failure) : 'Image work finished.'}
          message={imageOutcome.failure?.code === 'cancelled' ? 'Image work cancelled. Text and completed local images retained.' : undefined}>
          {__DEV__ && imageOutcome.failure && <AppText tone="caption">{imageOutcome.failure.code}: {imageOutcome.failure.message}</AppText>}
        </InlineBanner>}
        {error && <InlineBanner tone="error" message={error} />}
        {managing && <LoadingState text="Library management is awaiting confirmation or finishing locally…" />}
        {managementStatus && <InlineBanner tone="success" message={managementStatus} />}
        {cleanupWarning && <InlineBanner tone="warning" message={cleanupWarning}>
          <Button label="Retry local cleanup" text="Retry Cleanup" disabled={busy} onPress={() => { void retryCleanup(); }} />
        </InlineBanner>}
        {showActions && maintenance}
        {!!entries.length && <SectionHeader>Chapters</SectionHeader>}
      </View>}
      renderItem={({ item }) => <View>
        {item.saved && item.id === saved[0]?.id && <View style={{ marginTop: 24, marginBottom: 12, gap: 4 }}>
          <SectionHeader>Saved chapters no longer listed</SectionHeader><AppText tone="secondary">These local copies are kept for you. They are outside the current chapter order.</AppText>
        </View>}
        <ChapterRow entry={item} saved={item.saved} disabled={busy} readingDisabled={refreshingFocus} onOpen={() => openChapter(item.id)} onToggle={() => { void toggleRead(item); }} />
      </View>}
      ListFooterComponent={!showActions ? maintenance : null} />
  </AppScreen>;
}
