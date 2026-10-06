import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { AppState, ScrollView, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { importNativeStory } from '../importing/native';
import type { ImportProgress, ImportResult } from '../importing/import-story';
import { Control } from '../reader/controls';
import { screenStyles as styles } from '../reader/screen-styles';
import { useStorage } from '../storage/context';

export default function AddStory() {
  const params = useLocalSearchParams<{ story?: string }>();
  const id = typeof params.story === 'string' ? params.story : '';
  return <AddStoryForm key={id} id={id} />;
}

function AddStoryForm({ id }: { id: string }) {
  const { repository } = useStorage();
  const [url, setUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [prefilledId, setPrefilledId] = useState<string | null>(null);
  const prefilling = !!id && prefilledId !== id;
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') abort.current?.abort(); });
    return () => { mounted.current = false; abort.current?.abort(); subscription.remove(); };
  }, []);
  useEffect(() => {
    let active = true;
    if (id) repository.getStory(id).then((story) => {
      if (active) {
        setUrl(story?.sourceUrl ?? ''); setResult(story ? { story, failure: null } : null); setProgress(null);
        setLocalError(null);
      }
    }).catch(() => { if (active) {
      setUrl(''); setResult(null); setProgress(null); setLocalError('storage: Could not read the saved story.');
    } })
      .finally(() => { if (active) setPrefilledId(id); });
    return () => { active = false; };
  }, [id, repository]);
  async function run(value: string) {
    if (prefilling || abort.current) return;
    const controller = new AbortController(); abort.current = controller;
    setRunning(true); setResult(null); setLocalError(null);
    try {
      const outcome = await importNativeStory(value, repository, { signal: controller.signal,
        onProgress: (next) => { if (mounted.current) setProgress(next); } });
      if (mounted.current) setResult(outcome);
    } catch { if (mounted.current) setLocalError('Import failed; completed text is retained.'); }
    finally { abort.current = null; if (mounted.current) setRunning(false); }
  }
  function editUrl(value: string) {
    if (prefilling || running) return;
    setUrl(value); setResult(null); setProgress(null); setLocalError(null);
  }
  const status = prefilling ? 'Loading saved story…' : !progress ? 'Ready. Import starts only when you tap Import.' : {
    validating: 'Validating URL', manifest: `Fetching complete primary manifest: ${progress.total} entries discovered`,
    saving: `Manifest COMPLETE: ${progress.total} entries. Saving manifest`,
    reconciling: 'Reconciling complete primary manifest',
    downloading: `Downloading text: ${progress.downloaded} / ${progress.total}${progress.title ? ` · ${progress.title}` : ''}`,
    images: `Downloading eligible images${progress.title ? ` · ${progress.title}` : ''}. Text is already saved.`,
    completed: 'Completed. All primary text downloaded.', cancelled: 'Cancelled. Completed text is retained.', failed: 'Import stopped.',
  }[progress.phase];
  const story = prefilling ? null : result?.story;
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.heading}>Add SpaceBattles Story</Text>
    <Text>Personal public-thread import. Text and eligible local images have separate completion states.</Text>
    <TextInput accessibilityLabel="Public SpaceBattles thread URL" placeholder="Paste a public HTTPS thread URL"
      autoCapitalize="none" autoCorrect={false} keyboardType="url" value={url} onChangeText={editUrl}
      editable={!running && !prefilling} style={styles.input} />
    <Control label="Import story" text="Import" disabled={running || prefilling || !url.trim()} onPress={() => { void run(url); }} />
    {running && <Control label="Cancel import" text="Cancel" onPress={() => abort.current?.abort()} />}
    <Text accessibilityLiveRegion="polite">{status}</Text>
    {localError && <Text accessibilityRole="alert">{localError}</Text>}
    {result?.failure && <Text accessibilityRole="alert">{result.failure.code}: {result.failure.message}</Text>}
    {story && <><Text>{story.title}: {story.downloaded} / {story.total} text chapters downloaded</Text>
      {story.downloaded < story.total && <Control label="Resume Download" text="Resume Download" disabled={running}
        onPress={() => { void run(story.sourceUrl); }} />}
      <Control label="Open story contents" text="Story contents"
        onPress={() => router.replace({ pathname: '/story', params: { story: story.id } })} /></>}
    <Control label="Return to Library" text="Library" onPress={() => { abort.current?.abort(); router.replace('/'); }} />
  </ScrollView></SafeAreaView>;
}
