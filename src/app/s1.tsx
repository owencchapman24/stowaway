import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Control } from '../reader/controls';
import { runNativeDiagnostic } from '../sources/spacebattles/native';
import { S1Failure, type Diagnostic } from '../sources/spacebattles/types';
import { USER_AGENT } from '../sources/spacebattles/request';

export default function S1Screen() {
  const [url, setUrl] = useState('');
  const [later, setLater] = useState(false);
  const [running, setRunning] = useState(false);
  const [state, setState] = useState('Idle');
  const [result, setResult] = useState<Diagnostic | null>(null);
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; abort.current?.abort(); }; }, []);

  async function run() {
    setRunning(true); setResult(null); setState('Starting');
    const controller = new AbortController();
    abort.current = controller;
    try {
      const diagnostic = await runNativeDiagnostic(url, {
        signal: controller.signal, laterSample: later,
        onEvent: (e) => { if (mounted.current) setState(`${e.state} · ${e.count} requests${e.status ? ` · HTTP ${e.status}` : ''}`); },
        onProgress: (count, category) => { if (mounted.current) setState(`Primary category ${category.id} · ${count} unique entries`); },
      });
      if (mounted.current) { setResult(diagnostic); setState(diagnostic.failure ? `${diagnostic.failure.code}: ${diagnostic.failure.message}` : 'Diagnostic finished; compare with the site.'); }
    } catch (error) {
      if (mounted.current) setState(error instanceof S1Failure ? `${error.code}: ${error.message}` : 'Diagnostic failed.');
    } finally {
      if (mounted.current) setRunning(false);
      abort.current = null;
    }
  }

  if (!__DEV__) return <SafeAreaView><Text>S1 diagnostics are available in development only.</Text></SafeAreaView>;
  const manifest = result?.manifest;
  const entries = manifest?.entries ?? [];
  return <SafeAreaView style={styles.page}><FlatList
    data={entries} keyExtractor={(entry) => entry.postId}
    contentContainerStyle={styles.content}
    ListHeaderComponent={<View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>S1 diagnostic · development only</Text>
      <Text>Public primary Threadmarks and minimal samples. Results stay in memory and never enter the library.</Text>
      <TextInput accessibilityLabel="Public SpaceBattles thread URL" placeholder="Paste a public HTTPS thread URL"
        autoCapitalize="none" autoCorrect={false} keyboardType="url" value={url} onChangeText={setUrl}
        editable={!running} style={styles.input} />
      <View style={styles.row}><Switch accessibilityLabel="Also sample the last discovered primary post"
        value={later} onValueChange={setLater} disabled={running} /><Text>Also sample the last primary post (maximum two samples)</Text></View>
      <Control label="Run S1 diagnostic" text="Run S1 diagnostic" disabled={running || !url.trim()} onPress={() => { void run(); }} />
      {running && <Control label="Cancel S1 diagnostic" text="Cancel" onPress={() => abort.current?.abort()} />}
      <Control label="Return to fixture contents" text="Contents" onPress={() => router.back()} />
      <Text selectable accessibilityLiveRegion="polite">{state}</Text>
      <Text>User-Agent requested: {USER_AGENT}</Text>
      <Text>No cookies/auth; checked redirects; ≥2 seconds between starts. Stop on access/challenge failure.</Text>
      {result && <Text selectable>{[
        `Thread ID: ${result.thread.threadId}`, `Canonical URL: ${result.thread.url}`,
        `Access: ${result.failure ? result.failure.code : 'public source documents parsed'}`,
        `Manifest: ${manifest?.state ?? 'NOT RETRIEVED'}`, `Primary source ID: ${manifest?.category?.id ?? 'unknown'}`,
        `Expected primary count: ${manifest?.category?.expected ?? 'not separately exposed; compare manually'}`,
        `Unique entries: ${entries.length}`, `Index/range pages: ${manifest?.pages ?? 0}`,
        `Duplicate post IDs: ${manifest?.duplicates.join(', ') || 'none'}`,
        `First / last post IDs: ${entries[0]?.postId ?? 'none'} / ${entries.at(-1)?.postId ?? 'none'}`,
        `Requests: ${result.requests} · ${(result.elapsedMs / 1000).toFixed(1)} seconds`,
        ...result.samples.map((s) => `Sample ${s.postId}: mapped · ${s.bodyCharacters} characters · tags ${s.formattingTags.join(', ') || 'plain text'}`),
        result.failure ? `Failure: ${result.failure.code}${result.failure.status ? ` (HTTP ${result.failure.status})` : ''} · ${result.failure.message}` : 'Samples mapped. Physical acceptance requires your source comparison.',
      ].join('\n')}</Text>}
      {!!entries.length && <Text accessibilityRole="header">{manifest?.state === 'COMPLETE' ? 'Primary source order' : 'Partial entries — not a complete manifest'}</Text>}
    </View>}
    renderItem={({ item, index }) => <Text selectable style={styles.entry}>{index + 1}. post {item.postId} · {item.title}</Text>}
  /></SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#faf7f0' }, content: { padding: 20, gap: 10 },
  header: { gap: 14 }, title: { fontSize: 24, fontWeight: '700' },
  input: { borderWidth: 1, padding: 12, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, entry: { fontSize: 15, paddingVertical: 5 },
});
