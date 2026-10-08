import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { AppState, Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { importNativeStory } from '../importing/native';
import type { ImportProgress, ImportResult } from '../importing/import-story';
import { AppScreen, AppText, Button, Card, InlineBanner, LoadingState, OperationPanel, ScreenHeader, uiStyles as styles } from '../ui/components';
import { importProgressText } from '../ui/operation-copy';
import { useTheme } from '../ui/theme';
import { useStorage } from '../storage/context';
import { failureContext } from '../importing/failure-presentation';

export default function AddStory() {
  const params = useLocalSearchParams<{ story?: string }>();
  const id = typeof params.story === 'string' ? params.story : '';
  return <AddStoryForm key={id} id={id} />;
}

function AddStoryForm({ id }: { id: string }) {
  const { repository } = useStorage();
  const theme = useTheme();
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
        setLocalError(story ? null : 'Story is not in the local library.');
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
    } catch { if (mounted.current) setLocalError('Local operation failed; completed text is retained. Reopen the local story and retry.'); }
    finally { abort.current = null; if (mounted.current) setRunning(false); }
  }
  function editUrl(value: string) {
    if (id || prefilling || running) return;
    setUrl(value); setResult(null); setProgress(null); setLocalError(null);
  }

  const story = prefilling ? null : result?.story;
  const paused = !!result?.failure && !!story && story.downloaded < story.total;
  return <AppScreen><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={styles.section}>
        <ScreenHeader title={id ? 'Resume Download' : 'Add Story'} back={<Button label="Return to Library" text="‹ Library" variant="tertiary"
          onPress={() => { abort.current?.abort(); router.replace('/'); }} />} />
        {prefilling ? <LoadingState text="Loading saved story…" /> : id ? <>
          {story && <AppText>{story.title}: {story.downloaded} / {story.total} text chapters downloaded</AppText>}
          <AppText tone="secondary">Download the missing current chapters from this story.</AppText>
        </> : <>
          <AppText tone="secondary">Paste a public SpaceBattles thread URL.</AppText>
          <Card><AppText>SpaceBattles URL</AppText>
            <TextInput accessibilityLabel="Public SpaceBattles thread URL" placeholder="https://forums.spacebattles.com/…"
              placeholderTextColor={theme.textSecondary} autoCapitalize="none" autoCorrect={false} keyboardType="url"
              value={url} onChangeText={editUrl} editable={!running} multiline scrollEnabled
              style={{ color: theme.textPrimary, backgroundColor: theme.surfaceSubtle, borderRadius: 10, padding: 12, minHeight: 88, fontSize: 17 }}
              onSubmitEditing={() => { if (url.trim() && !running) { Keyboard.dismiss(); void run(url); } }} />
          </Card>
          <AppText tone="caption">Only primary Threadmarks are imported. Downloads stay on this device.</AppText>
        </>}
        {!running && (!story || story.downloaded < story.total) && <Button label={id || story ? 'Resume Download' : 'Import story'}
          text={id || story ? 'Resume Download' : 'Import Story'} variant="primary" disabled={prefilling || !(story?.sourceUrl ?? url).trim()}
          onPress={() => { Keyboard.dismiss(); void run(story?.sourceUrl ?? url); }} />}
        {running && <><OperationPanel title={id ? 'Resuming download' : 'Importing story'} message={importProgressText(progress)}
          completed={progress?.phase === 'downloading' ? progress.downloaded : undefined} total={progress?.phase === 'downloading' ? progress.total : undefined}
          cancelLabel="Cancel import" onCancel={() => abort.current?.abort()} />
          <AppText tone="caption">Leaving pauses the download after any save already in progress finishes.</AppText></>}
        {localError && <InlineBanner tone="error" message={localError} />}
        {result?.failure && <InlineBanner tone={result.failure.code === 'cancelled' ? 'info' : 'error'}
          title={paused ? 'Download paused' : 'Could not finish'} message={failureContext(result.failure)}>
          {__DEV__ && <AppText tone="caption">{result.failure.code}: {result.failure.message}</AppText>}
        </InlineBanner>}
        {story && !running && <Card>
          {!id && <AppText>{story.title}: {story.downloaded} / {story.total} text chapters downloaded</AppText>}
          <AppText tone="secondary">{story.downloaded === story.total ? 'All primary text downloaded.' : story.downloaded + ' of ' + story.total + ' chapters are available offline.'}</AppText>
          <Button label="Open story contents" text={id && !progress ? 'Back to Story' : 'Open Story'} variant={story.downloaded === story.total ? 'primary' : 'secondary'}
            onPress={() => router.replace({ pathname: '/story', params: { story: story.id } })} />
        </Card>}
      </View>
    </ScrollView>
  </KeyboardAvoidingView></AppScreen>;
}
