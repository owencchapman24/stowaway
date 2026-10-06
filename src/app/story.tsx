import { useCallback, useEffect, useRef, useState } from 'react';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { AppState, FlatList, Linking, Text, View } from 'react-native';
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
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [outcome, setOutcome] = useState<UpdateResult | null>(null);
  const [imageSummary, setImageSummary] = useState<ImageSummary | null>(null);
  const [imageProgress, setImageProgress] = useState<ImageProgress | null>(null);
  const [imageOutcome, setImageOutcome] = useState<ImageResult | null>(null);
  const [operation, setOperation] = useState<'update' | 'images' | null>(null);
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);
  // Cancellation does not settle a transaction whose COMMIT is already underway.
  usePreventRemove(running, () => {});
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
        setStory(next); setEntries(current); setSaved(unlisted); setImageSummary(images);
        setError(next ? null : 'Story is not in the local library.');
        return 'applied' as const;
      }
    } catch {
      if (focused.current && version === readVersion.current) {
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
    void refresh();
    return () => { focused.current = false; focusVersion.current++; readVersion.current++; abort.current?.abort(); };
  }, [refresh]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') abort.current?.abort(); });
    return () => subscription.remove();
  }, []);

  async function runOperation(images = false) {
    if (!focused.current || abort.current || story?.id !== id || story.source !== 'spacebattles') return;
    const controller = new AbortController(); abort.current = controller;
    const focus = focusVersion.current;
    readVersion.current++;
    setRunning(true); setOperation(images ? 'images' : 'update'); setOutcome(null); setError(null); setProgress(null);
    setImageProgress(null); setImageOutcome(null);
    const owned = () => focused.current && focusVersion.current === focus && abort.current === controller;
    let unexpectedFailure = false;
    try {
      if (images) {
        const result = await downloadNativeImages(id, repository, { signal: controller.signal,
          onProgress: (next) => { if (owned()) setImageProgress(next); } });
        if (result.storyId !== id) throw new Error('Image result belongs to a different story.');
        if (owned()) setImageOutcome(result);
      } else {
        const result = await updateNativeStory(story, repository, { signal: controller.signal,
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
        let refreshed: Awaited<ReturnType<typeof refresh>> = 'stale';
        while (focused.current && refreshed === 'stale') refreshed = await refresh();
        if (owned() && refreshed === 'applied' && unexpectedFailure) setError('Operation stopped; earlier committed text and local images are retained.');
        abort.current = null;
        if (focused.current) { setRunning(false); setOperation(null); }
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
    <Stack.Screen options={{ gestureEnabled: !running }} />
    <FlatList data={rows} keyExtractor={(entry) => entry.id}
    contentContainerStyle={styles.content} ListHeaderComponent={<View style={styles.section}>
      <Control label="Return to Library" text="Library" disabled={running}
        onPress={() => { if (!abort.current) router.replace('/'); }} />
      <Text accessibilityRole="header" style={styles.heading}>{story?.title ?? 'Story contents'}</Text>
      {story && <><Text>{story.author ?? 'Author unavailable'}</Text>
        <Text>{story.downloaded} / {story.total} text chapters downloaded</Text>
        {story.source === 'spacebattles' && <>
          <Text>Text and images have separate download states. Only primary Threadmarks are included.</Text>
          {imageSummary && <Text>{describeImages(imageSummary)}</Text>}
          {!!imageSummary && (imageSummary.unknown > 0 || imageSummary.pending > 0 || imageSummary.local > 0 || !!imageSummary.mimeRetryable) &&
            <Control label={imageAction} text={imageAction} disabled={running} onPress={() => { void runOperation(true); }} />}
          <Control label="Check for Updates" text="Check for Updates" disabled={running} onPress={() => { void runOperation(); }} />
          {story.lastUpdateAttemptAt !== null && <Text>Last update attempt: {new Date(story.lastUpdateAttemptAt).toLocaleString()}</Text>}
          {story.lastUpdateSuccessAt !== null && <Text>Last complete check: {new Date(story.lastUpdateSuccessAt).toLocaleString()}</Text>}
        </>}
        {!!story.sourceUrl && <Control label="Open story source in browser" text="View source"
          onPress={() => { void Linking.openURL(story.sourceUrl).catch(() => setError('Could not open the source in your browser.')); }} />}
        {story.source === 'spacebattles' && story.downloaded < story.total && <Control label="Resume Download" text="Resume Download" disabled={running}
          onPress={() => { if (!abort.current) router.push({ pathname: '/add-story', params: { story: id } }); }} />}</>}
      {running && <Control label={operation === 'images' ? 'Cancel images' : 'Cancel update'} text="Cancel" onPress={() => abort.current?.abort()} />}
      {status && <Text accessibilityLiveRegion="polite">{status}</Text>}
      {outcome && <Text accessibilityLiveRegion="polite">{describeUpdate(outcome)}</Text>}
      {outcome?.failure && <Text accessibilityRole="alert">{outcome.failure.code}: {outcome.failure.message}</Text>}
      {imageStatus && <Text accessibilityLiveRegion="polite">{imageStatus}</Text>}
      {imageOutcome?.failure && <Text accessibilityRole="alert">{imageOutcome.failure.code}: {imageOutcome.failure.message}</Text>}
      {__DEV__ && imageOutcome?.mimeDiagnostics?.map((diagnostic) => <Text selectable key={`${diagnostic.chapterId}:${diagnostic.slot}`}>
        {`Image MIME (dev): ${diagnostic.chapterId} · slot ${diagnostic.slot + 1} · received ${diagnostic.receivedMime ?? '(missing)'} · detected ${diagnostic.detectedFormat} · ${diagnostic.accepted ? 'validated' : 'rejected'}`}
      </Text>)}
      {error && <Text accessibilityRole="alert">{error}</Text>}
      <Text accessibilityRole="header">Primary Threadmarks</Text>
    </View>} renderItem={({ item }) => <View style={styles.section}>
      {item.saved && item.id === saved[0]?.id && <Text accessibilityRole="header">Saved chapters no longer listed</Text>}
      <Control label={`Read ${item.title}`} text={item.saved ? item.title : `${item.position + 1}. ${item.title}`} disabled={running || !item.downloaded}
        onPress={() => { if (item.downloaded && !abort.current) router.push({ pathname: '/reader', params: { chapter: item.id } }); }} />
      <Text>{item.downloaded ? 'Text downloaded' : 'Not downloaded'}</Text>
      {__DEV__ && <Text selectable>Post ID: {item.postId}</Text>}
    </View>} /></SafeAreaView>;
}
