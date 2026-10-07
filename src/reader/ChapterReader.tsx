import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import * as Crypto from 'expo-crypto';
import type { Chapter, ChapterSummary, Preferences } from '../domain/types';
import type { Repository } from '../storage/repository';
import { createRenderFile } from '../storage/files';
import { Control, ReaderControls } from '../reader/controls';
import { PositionSession, parseMessage } from '../reader/position';
import { allowReaderNavigation } from '../reader/navigation';
import { ReadEndSession, type ReadCompletion } from './read-state';

interface ReaderModel {
  chapter: Chapter;
  session: string;
  file: Awaited<ReturnType<typeof createRenderFile>>;
  positions: PositionSession;
  readEnd: ReadEndSession | null;
}

async function saveProgress(current: ReaderModel): Promise<void> {
  // Settle both independently: failure of Read state cannot discard a locator.
  const [position, read] = await Promise.allSettled([current.positions.flush(), current.readEnd?.flush()]);
  if (read.status === 'rejected') throw new Error('Could not save Read state locally. Please retry leaving.');
  if (position.status === 'rejected') throw new Error('Could not save your position before leaving. Please retry.');
}

export interface ChapterReaderProps {
  chapterId: string;
  repository: Repository;
  preferences: Preferences;
  changePreferences(value: Preferences): Promise<void>;
  onRetry(): void;
  onNavigate(destination: string | null, storyId?: string): void;
  renderFile?: typeof createRenderFile;
  retainRenderFiles?: boolean;
  readCompletion?: ReadCompletion;
}
export function ChapterReader({ chapterId, repository, preferences, changePreferences, onRetry, onNavigate,
  renderFile = createRenderFile, retainRenderFiles = false, readCompletion }: ChapterReaderProps) {
  const preferencesRef = useRef(preferences);
  useEffect(() => { preferencesRef.current = preferences; }, [preferences]);
  const web = useRef<WebView>(null);
  const modelRef = useRef<ReaderModel | null>(null);
  const [model, setModel] = useState<ReaderModel | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const alive = useRef(true);
  const exiting = useRef(false);
  const webFailed = useRef(false);
  const webTerminated = useRef(false);
  const flushAcknowledgement = useRef<(() => void) | null>(null);
  const handoffGeneration = useRef(0);
  const pendingHandoff = useRef<{ id: string; finish(failure?: Error): void } | null>(null);

  useEffect(() => {
    alive.current = true;
    let active = true;
    let loaded: ReaderModel | null = null;
    repository.getChapter(chapterId).then(async (chapter) => {
      if (!chapter) throw new Error('Chapter is not downloaded.');
      const [locator, list, assetPath, images] = await Promise.all([repository.getLocator(chapterId),
        repository.listChapters(chapter.storyId), repository.getChapterAssetPath(chapterId), repository.listChapterImages(chapterId)]);
      if (!active) return;
      const session = Crypto.randomUUID();
      const file = await renderFile(chapter, locator, preferencesRef.current, session, assetPath, undefined, images);
      const positions = new PositionSession(repository.saveLocator, () => {
        if (active) setError('Could not save the latest position. The previous saved passage is retained.');
      });
      const readError = () => {
        if (active) setError('Could not save Read state locally. The previous state is retained. Retry leaving to save again.');
      };
      const readEnd = readCompletion ? new ReadEndSession(readCompletion, readError) : null;
      loaded = { chapter, session, file, positions, readEnd };
      if (!active) { positions.dispose(); if (!retainRenderFiles) file.directory.delete(); return; }
      modelRef.current = loaded;
      setChapters(list);
      setModel(loaded);
      // Only an already accepted intent can be retried here; loading never requests Read.
      void readEnd?.flush().catch(readError);
    }).catch(() => { if (active) setError('Could not open this local chapter. Your stored text has not been reset.'); });
    return () => {
      active = false;
      alive.current = false;
      modelRef.current = null;
      flushAcknowledgement.current?.();
      flushAcknowledgement.current = null;
      pendingHandoff.current?.finish(new Error('Reader closed before handoff.'));
      loaded?.positions.dispose();
      try { if (!retainRenderFiles && loaded?.file.directory.exists) loaded.file.directory.delete(); }
      catch { /* Disposable render files may be left until the next app-data cleanup. */ }
    };
  }, [chapterId, repository, renderFile, retainRenderFiles, readCompletion]);

  const flushForExit = useCallback(async (): Promise<void> => {
    const current = modelRef.current;
    if (!current) return;
    // Persist already received samples even if the WebView is about to suspend.
    await saveProgress(current);
    if (web.current && !webFailed.current) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          flushAcknowledgement.current = null;
          resolve();
        }, 600);
        flushAcknowledgement.current = () => { clearTimeout(timer); resolve(); };
        web.current?.injectJavaScript('window.StowawayReader && window.StowawayReader.flush(); true;');
      });
    }
    await saveProgress(current);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flushForExit().catch(() => {
        setError('Could not finish saving before backgrounding. The last completed save is retained.');
      });
    });
    return () => subscription.remove();
  }, [flushForExit]);

  function allowInteraction(enabled: boolean) {
    if (web.current && !webFailed.current) {
      web.current.injectJavaScript(`window.StowawayReader && window.StowawayReader.setInteractionEnabled(${enabled}); true;`);
    }
  }

  async function quiesce(current: ReaderModel, reopening: boolean): Promise<void> {
    if (!web.current || webTerminated.current) return;
    // A load error is not proof of process death. Retry can retain ownership
    // across a failed rendering; leaving the route still needs a live ack.
    if (webFailed.current) {
      if (reopening) return;
      throw new Error('Could not pause the local reader before leaving. Reopen this chapter and retry.');
    }
    const id = `${current.session}:${++handoffGeneration.current}`;
    await new Promise<void>((resolve, reject) => {
      const finish = (failure?: Error) => {
        if (pendingHandoff.current?.id !== id) return;
        clearTimeout(timer);
        pendingHandoff.current = null;
        if (failure) reject(failure); else resolve();
      };
      const timer = setTimeout(() => finish(new Error('Could not pause the local reader before leaving. Please retry.')), 600);
      pendingHandoff.current = { id, finish };
      try {
        web.current?.injectJavaScript(`window.StowawayReader && window.StowawayReader.prepareForExit(${JSON.stringify(id)}); true;`);
      } catch { finish(new Error('Could not pause the local reader before leaving. Please retry.')); }
    });
  }

  async function replaceReader(replace: (current: ReaderModel | null) => void, reopening: boolean) {
    if (!alive.current || exiting.current) return;
    exiting.current = true;
    setSettling(true);
    const current = modelRef.current;
    try {
      // Stop new trusted reading input, but keep accepting already queued messages.
      allowInteraction(false);
      if (current) {
        await saveProgress(current);
        if (!alive.current || modelRef.current !== current) return;
        // Only an explicit matching acknowledgement proves a live renderer has
        // stopped generating input. Background flush timeouts are not a handoff.
        await quiesce(current, reopening);
        await saveProgress(current);
      }
      const handoff = () => {
        if (alive.current && (!current || modelRef.current === current)) replace(modelRef.current);
      };
      if (readCompletion) {
        try { await readCompletion.settle(handoff); }
        catch { throw new Error('Could not save Read state locally. Please retry leaving.'); }
      } else handoff();
    } catch (failure) {
      if (alive.current && (!current || modelRef.current === current)) {
        exiting.current = false;
        setSettling(false);
        try { allowInteraction(true); } catch { webFailed.current = true; setReady(false); }
        setError(reopening ? 'Could not save local progress before reopening. Your pending saves are retained. Please retry.'
          : failure instanceof Error ? failure.message : 'Could not save before leaving. Please retry.');
      }
    }
  }

  async function go(destination: string | null) {
    await replaceReader((current) => onNavigate(destination, current?.chapter.storyId), false);
  }

  async function reopen() { await replaceReader(() => onRetry(), true); }

  function onTerminated() {
    if (!alive.current) return;
    webFailed.current = true;
    webTerminated.current = true;
    setReady(false);
    flushAcknowledgement.current?.();
    // A definitively terminated renderer needs no acknowledgement or commands.
    pendingHandoff.current?.finish();
    void reopen();
  }

  async function restyle(value: Preferences) {
    const current = modelRef.current;
    if (!current || !ready || exiting.current) return;
    setReady(false);
    try {
      await changePreferences(value);
      if (modelRef.current === current && !webFailed.current) {
        web.current?.injectJavaScript(`window.StowawayReader && window.StowawayReader.restyle(${value.fontSize}, ${JSON.stringify(value.theme)}); true;`);
      }
    } catch {
      setReady(true);
      setError('Could not save reading settings. Please retry.');
    }
  }

  function onMessage(raw: string) {
    const current = modelRef.current;
    if (!current) return;
    const message = parseMessage(raw, current.chapter, current.session);
    if (!message) return;
    current.positions.receive(message);
    current.readEnd?.receive(message);
    if (message.type === 'ready') {
      setReady(true);
      // A rendering that finishes loading during settlement must also be frozen.
      if (exiting.current) allowInteraction(false);
    }
    if (message.type === 'layout-start') setReady(false);
    if (message.type === 'flushed') flushAcknowledgement.current?.();
    if (message.type === 'quiesced' && pendingHandoff.current?.id === message.handoffId) pendingHandoff.current.finish();
    if (message.type === 'link') {
      const url = current.chapter.links[message.linkId];
      if (url) void Linking.openURL(url).catch(() => setError('Could not open the link in your browser.'));
    }
  }

  const index = chapters.findIndex((chapter) => chapter.id === chapterId);
  const previous = index >= 0 ? chapters[index - 1] : undefined;
  const next = index >= 0 ? chapters[index + 1] : undefined;
  return <SafeAreaView style={styles.page}>
    <Stack.Screen options={{ gestureEnabled: false }} />
    <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{model?.chapter.title ?? 'Reader'}</Text>
    <ReaderControls preferences={preferences} disabled={!ready || settling} onChange={(value) => { void restyle(value); }} />
    {error && <View style={styles.status}><Text accessibilityRole="alert">{error}</Text>
      <Control label="Reopen local chapter" text="Retry" onPress={() => { void reopen(); }} /></View>}
    {!ready && !error && <View style={styles.status}><ActivityIndicator /><Text>Restoring your passage…</Text></View>}
    {model && <WebView ref={web} source={{ uri: model.file.uri }}
      pointerEvents={settling ? 'none' : 'auto'}
      style={[styles.reader, { opacity: ready ? 1 : 0, backgroundColor: preferences.theme === 'dark' ? '#15191e' : '#faf7f0' }]}
      allowingReadAccessToURL={model.file.readAccess}
      // Route every navigation through our callback. Whitelists alone can launch external URLs.
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={(request) => allowReaderNavigation(request.url, model.file.uri)}
      onMessage={(event) => onMessage(event.nativeEvent.data)}
      onError={() => { webFailed.current = true; setReady(false); setError('Local WebView could not load. Reopen this chapter to retry.'); }}
      onContentProcessDidTerminate={onTerminated}
      javaScriptEnabled javaScriptCanOpenWindowsAutomatically={false}
      onOpenWindow={() => undefined} setSupportMultipleWindows={false}
      allowFileAccess allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
      mixedContentMode="never" domStorageEnabled={false} sharedCookiesEnabled={false}
      thirdPartyCookiesEnabled={false} cacheEnabled={false} incognito
      mediaPlaybackRequiresUserAction allowsInlineMediaPlayback={false}
      allowsLinkPreview={false} dataDetectorTypes="none"
      automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="never"
      textZoom={100} />}
    <View style={styles.navigation}>
      <Control label="Previous chapter" text="Previous" disabled={!previous || !ready}
        onPress={() => { if (previous) void go(previous.id); }} />
      <Control label="Return to story contents" text="Contents" onPress={() => { void go(null); }} />
      <Control label="Next chapter" text="Next" disabled={!next || !ready}
        onPress={() => { if (next) void go(next.id); }} />
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#faf7f0' },
  title: { fontSize: 18, fontWeight: '600', color: '#22252a', paddingHorizontal: 16, paddingTop: 8, textAlign: 'center' },
  reader: { flex: 1 },
  navigation: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, padding: 8 },
  status: { padding: 10, gap: 8, alignItems: 'center' },
});
