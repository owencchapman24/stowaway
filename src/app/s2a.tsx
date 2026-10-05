import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChapterReader } from '../reader/ChapterReader';
import { Control } from '../reader/controls';
import { getS2ADiagnostic, renderS2A } from '../diagnostics/s2a/native';
import type { S2ASnapshot } from '../diagnostics/s2a/recovery';
import type { Repository } from '../storage/repository';
import type { Preferences } from '../domain/types';

export default function S2AScreen() {
  if (!__DEV__) return <SafeAreaView><Text>S2A diagnostics are available only in development.</Text></SafeAreaView>;
  return <Diagnostic />;
}
function Diagnostic() {
  const [diagnostic] = useState(getS2ADiagnostic);
  const [snapshot, setSnapshot] = useState<S2ASnapshot | null>(null);
  const [inspected, setInspected] = useState(false);
  const [message, setMessage] = useState('No action performed. Inspect before initializing, repairing or retrying.');
  const [pending, setPending] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [reader, setReader] = useState<{ repository: Repository; chapterId: string; preferences: Preferences } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => diagnostic.subscribe(setMessage), [diagnostic]); // No seed/repair/reset on screen entry.
  async function inspect() {
    try { setSnapshot(await diagnostic.inspect()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Inspection failed; data retained.'); }
    finally { setInspected(true); }
  }
  async function run(work: () => Promise<unknown>) {
    setPending(true);
    setResetArmed(false);
    try { await work(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'S2A operation failed; inspect persisted state.'); }
    finally { setPending(false); await inspect(); }
  }
  async function openReader() {
    await run(async () => {
      const repository = await diagnostic.readerStorage();
      const first = (await repository.listChapters())[0];
      if (!first) throw new Error('No S2A chapter.');
      setReader({ repository, chapterId: first.id, preferences: await repository.getPreferences() });
    });
  }
  if (reader) return <ChapterReader key={`${reader.chapterId}:${attempt}`} {...reader}
    renderFile={renderS2A} retainRenderFiles onRetry={() => setAttempt((value) => value + 1)}
    changePreferences={async (value) => {
      await reader.repository.savePreferences(value);
      setReader((current) => current && { ...current, preferences: value });
    }} onNavigate={(destination) => {
      if (destination) setReader((current) => current && { ...current, chapterId: destination });
      else { setReader(null); void inspect(); }
    }} />;
  const disabled = pending || diagnostic.busy;
  const ready = !disabled && inspected && snapshot?.initialized;
  return <SafeAreaView style={styles.page}><Stack.Screen options={{ gestureEnabled: false }} />
    {message.startsWith('READY TO FORCE-QUIT') && <Text style={styles.checkpoint} accessibilityRole="alert">{message}</Text>}
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">S2A recovery diagnostic (dev only)</Text>
      <Text>Disposable stowaway-s2a.db and stowaway-s2a files only. Normal Contents data is separate. No source requests. S2B remains pending.</Text>
      <Text accessibilityRole="alert" selectable>{message}</Text>
      <Control text="Inspect persisted S2A state (no repair)" label="Inspect persisted S2A state before repair" disabled={disabled && !diagnostic.checkpointReached} onPress={() => { void inspect(); }} />
      {snapshot && <View style={styles.status}>
        <Text>Initialized: {snapshot.initialized ? 'yes' : 'no'}</Text>
        <Text selectable>Last recorded boundary: {snapshot.marker}</Text>
        {snapshot.initialized && <>
          <Text selectable>Revision {snapshot.revision}; hash {snapshot.chapter?.contentHash}</Text>
          <Text>Rows: {snapshot.counts?.stories} story / {snapshot.counts?.chapters} chapters / {snapshot.counts?.assets} asset (expected 1/3/1)</Text>
          <Text selectable>Locator: {snapshot.locator ? `${snapshot.locator.contentHash.slice(0, 12)} / ${snapshot.locator.blockId} + ${snapshot.locator.offset}px / ${snapshot.locator.progression.toFixed(3)}` : 'absent'}</Text>
          <Text>Locator hash matches: {snapshot.locator && snapshot.chapter && snapshot.locator.contentHash === snapshot.chapter.contentHash ? 'yes' : 'no; progression fallback only'}</Text>
          <Text selectable>Image: {snapshot.image}; reference: {snapshot.reference}; orphans: {snapshot.orphans}</Text>
        </>}
      </View>}
      <Control text="Initialize disposable S2A fixture" label="Initialize disposable S2A fixture" disabled={disabled || !inspected || snapshot?.initialized === true}
        onPress={() => { void run(diagnostic.initialize); }} />
      <Control text="Read/regenerate S2A chapter" label="Read and regenerate S2A chapter" disabled={!ready} onPress={() => { void openReader(); }} />
      <Text accessibilityRole="header">Text transactions</Text>
      <Control text="Inject JS failure before write" label="Inject failure before text write" disabled={!ready} onPress={() => { void run(() => diagnostic.text('before-write')); }} />
      <Control text="Inject JS failure between SQL writes" label="Inject failure between text writes" disabled={!ready} onPress={() => { void run(() => diagnostic.text('after-html-write')); }} />
      <Control text="Arm real force-quit before commit" label="Arm transaction force quit checkpoint" disabled={!ready} onPress={() => { void run(() => diagnostic.text('checkpoint')); }} />
      <Control text="Commit/retry revision B" label="Commit or retry text revision B" disabled={!ready} onPress={() => { void run(() => diagnostic.text('commit')); }} />
      <Control text="Close/reopen normally (not a kill)" label="Close and reopen S2A database normally" disabled={!ready} onPress={() => { void run(diagnostic.reopen); }} />
      <Text accessibilityRole="header">Images</Text>
      <Control text="Inject partial/corrupt staged file" label="Inject partial corrupt image file" disabled={!ready} onPress={() => { void run(() => diagnostic.image('corrupt-stage')); }} />
      <Control text="Stage valid image; fail DB reference" label="Stage valid image then fail reference commit" disabled={!ready} onPress={() => { void run(() => diagnostic.image('fail-reference')); }} />
      <Control text="Arm force-quit after validated staging" label="Arm image force quit checkpoint" disabled={!ready} onPress={() => { void run(() => diagnostic.image('checkpoint')); }} />
      <Control text="Commit/retry fresh validated image" label="Commit or retry fresh validated image" disabled={!ready} onPress={() => { void run(() => diagnostic.image('commit')); }} />
      <Control text="Remove referenced S2A image" label="Remove referenced S2A test image only" disabled={!ready} onPress={() => { void run(() => diagnostic.image('remove-reference')); }} />
      <Control text="Corrupt referenced S2A image" label="Corrupt referenced S2A test image only" disabled={!ready} onPress={() => { void run(() => diagnostic.image('corrupt-reference')); }} />
      <Control text="Clean eligible S2A orphan files" label="Clean only eligible S2A orphan files" disabled={!ready} onPress={() => { void run(diagnostic.cleanupOrphans); }} />
      <Control text="Remove disposable S2A render directories" label="Remove only disposable S2A render directories" disabled={!ready} onPress={() => { void run(diagnostic.removeRenders); }} />
      {diagnostic.checkpointReached && <>
        <Text>Backgrounding does not release this checkpoint. Swipe Expo Go away for the real kill test. These buttons are optional JS-only alternatives:</Text>
        <Control text="Release checkpoint and commit" label="Release checkpoint and commit without killing process" onPress={() => diagnostic.finishCheckpoint(true)} />
        <Control text="Release checkpoint with JS rollback" label="Release checkpoint with JS rollback without killing process" onPress={() => diagnostic.finishCheckpoint(false)} />
      </>}
      <Control text={resetArmed ? 'CONFIRM reset S2A test data only' : 'Reset S2A test data only'} label="Reset only disposable S2A test data" disabled={disabled || !inspected}
        onPress={() => { if (resetArmed) void run(diagnostic.reset); else setResetArmed(true); }} />
      <Control text="Normal Contents" label="Return to normal Contents" disabled={disabled} onPress={() => router.replace('/')} />
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#faf7f0' },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  status: { gap: 6, padding: 10, backgroundColor: '#eee9df' },
  checkpoint: { padding: 12, fontWeight: '700', backgroundColor: '#ffdc8c' },
});
