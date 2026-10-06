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
      const [next, current, unlisted] = await Promise.all([
        repository.getStory(id), repository.listContents(id), repository.listSavedUnlisted(id),
      ]);
      if (focused.current && version === readVersion.current) {
        setStory(next); setEntries(current); setSaved(unlisted);
        setError(next ? null : 'Story is not in the local library.');
        return 'applied' as const;
      }
    } catch {
      if (focused.current && version === readVersion.current) {
        setStory(null); setEntries([]); setSaved([]);
        setError('storage: Could not read local story contents.');
        return 'failed' as const;
      }
    }
    return 'stale' as const;
  }, [id, repository]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    setRunning(!!abort.current); setProgress(null); setOutcome(null);
    void refresh();
    return () => { focused.current = false; focusVersion.current++; readVersion.current++; abort.current?.abort(); };
  }, [refresh]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') abort.current?.abort(); });
    return () => subscription.remove();
  }, []);

  async function checkUpdates() {
    if (!focused.current || abort.current || story?.id !== id || story.source !== 'spacebattles') return;
    const controller = new AbortController(); abort.current = controller;
    const focus = focusVersion.current;
    readVersion.current++;
    setRunning(true); setOutcome(null); setError(null); setProgress(null);
    const owned = () => focused.current && focusVersion.current === focus && abort.current === controller;
    let unexpectedFailure = false;
    try {
      const result = await updateNativeStory(story, repository, { signal: controller.signal,
        onProgress: (next) => { if (owned() && (!next.storyId || next.storyId === id)) setProgress(next); } });
      if (result.story && result.story.id !== id) throw new Error('Update result belongs to a different story.');
      if (owned()) setOutcome(result);
    } catch {
      unexpectedFailure = true;
    } finally {
      if (abort.current === controller) {
        // Keep every exit blocked through settlement AND the authoritative read,
        // including a blur/refocus while an unavoidable COMMIT finishes.
        let refreshed: Awaited<ReturnType<typeof refresh>> = 'stale';
        while (focused.current && refreshed === 'stale') refreshed = await refresh();
        if (owned() && refreshed === 'applied' && unexpectedFailure) setError('Update stopped; earlier committed text is retained.');
        abort.current = null;
        if (focused.current) setRunning(false);
      }
    }
  }
  const status = progress ? {
    validating: 'Starting manual update check', manifest: `Checking complete primary manifest: ${progress.total} entries discovered`,
    saving: 'Saving complete primary manifest', reconciling: 'Reconciling complete primary manifest',
    downloading: `Downloading text: ${progress.downloaded} / ${progress.total}${progress.title ? ` · ${progress.title}` : ''}`,
    completed: 'Check finished.', cancelled: 'Cancelled. Committed text is retained.', failed: 'Update stopped.',
  }[progress.phase] : null;
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
          <Text>Text downloaded/offline. Source images are not downloaded. Only primary Threadmarks are included.</Text>
          <Control label="Check for Updates" text="Check for Updates" disabled={running} onPress={() => { void checkUpdates(); }} />
          {story.lastUpdateAttemptAt !== null && <Text>Last update attempt: {new Date(story.lastUpdateAttemptAt).toLocaleString()}</Text>}
          {story.lastUpdateSuccessAt !== null && <Text>Last complete check: {new Date(story.lastUpdateSuccessAt).toLocaleString()}</Text>}
        </>}
        {!!story.sourceUrl && <Control label="Open story source in browser" text="View source"
          onPress={() => { void Linking.openURL(story.sourceUrl).catch(() => setError('Could not open the source in your browser.')); }} />}
        {story.source === 'spacebattles' && story.downloaded < story.total && <Control label="Resume Download" text="Resume Download" disabled={running}
          onPress={() => { if (!abort.current) router.push({ pathname: '/add-story', params: { story: id } }); }} />}</>}
      {running && <Control label="Cancel update" text="Cancel" onPress={() => abort.current?.abort()} />}
      {status && <Text accessibilityLiveRegion="polite">{status}</Text>}
      {outcome && <Text accessibilityLiveRegion="polite">{describeUpdate(outcome)}</Text>}
      {outcome?.failure && <Text accessibilityRole="alert">{outcome.failure.code}: {outcome.failure.message}</Text>}
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
