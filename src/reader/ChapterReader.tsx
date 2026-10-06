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

interface ReaderModel {
  chapter: Chapter;
  session: string;
  file: Awaited<ReturnType<typeof createRenderFile>>;
  positions: PositionSession;
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
}
export function ChapterReader({ chapterId, repository, preferences, changePreferences, onRetry, onNavigate,
  renderFile = createRenderFile, retainRenderFiles = false }: ChapterReaderProps) {
  const preferencesRef = useRef(preferences);
  useEffect(() => { preferencesRef.current = preferences; }, [preferences]);
  const web = useRef<WebView>(null);
  const modelRef = useRef<ReaderModel | null>(null);
  const [model, setModel] = useState<ReaderModel | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exiting = useRef(false);
  const flushAcknowledgement = useRef<(() => void) | null>(null);

  useEffect(() => {
    let active = true;
    let loaded: ReaderModel | null = null;
    repository.getChapter(chapterId).then(async (chapter) => {
      if (!chapter) throw new Error('Chapter is not downloaded.');
      const [locator, list, assetPath] = await Promise.all([repository.getLocator(chapterId),
        repository.listChapters(chapter.storyId), repository.getChapterAssetPath(chapterId)]);
      if (!active) return;
      const session = Crypto.randomUUID();
      const file = await renderFile(chapter, locator, preferencesRef.current, session, assetPath);
      const positions = new PositionSession(repository.saveLocator, () => {
        if (active) setError('Could not save the latest position. The previous saved passage is retained.');
      });
      loaded = { chapter, session, file, positions };
      if (!active) { positions.dispose(); if (!retainRenderFiles) file.directory.delete(); return; }
      modelRef.current = loaded;
      setChapters(list);
      setModel(loaded);
    }).catch(() => { if (active) setError('Could not open this local chapter. Your stored text has not been reset.'); });
    return () => {
      active = false;
      modelRef.current = null;
      flushAcknowledgement.current?.();
      flushAcknowledgement.current = null;
      loaded?.positions.dispose();
      try { if (!retainRenderFiles && loaded?.file.directory.exists) loaded.file.directory.delete(); }
      catch { /* Disposable render files may be left until the next app-data cleanup. */ }
    };
  }, [chapterId, repository, renderFile, retainRenderFiles]);

  const flushForExit = useCallback(async (): Promise<void> => {
    const current = modelRef.current;
    if (!current) return;
    // Persist already received samples even if the WebView is about to suspend.
    await current.positions.flush();
    if (!web.current) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        flushAcknowledgement.current = null;
        resolve();
      }, 600);
      flushAcknowledgement.current = () => { clearTimeout(timer); resolve(); };
      web.current?.injectJavaScript('window.StowawayReader && window.StowawayReader.flush(); true;');
    });
    await current.positions.flush();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flushForExit().catch(() => {
        setError('Could not finish saving before backgrounding. The last completed save is retained.');
      });
    });
    return () => subscription.remove();
  }, [flushForExit]);

  async function go(destination: string | null) {
    if (exiting.current) return;
    exiting.current = true;
    try {
      await flushForExit();
      onNavigate(destination, modelRef.current?.chapter.storyId);
    } catch {
      exiting.current = false;
      setError('Could not save before leaving. Please retry.');
    }
  }

  async function restyle(value: Preferences) {
    const current = modelRef.current;
    if (!current || !ready) return;
    setReady(false);
    try {
      await changePreferences(value);
      if (modelRef.current === current) {
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
    if (message.type === 'ready') setReady(true);
    if (message.type === 'layout-start') setReady(false);
    if (message.type === 'flushed') flushAcknowledgement.current?.();
    if (message.type === 'link') {
      const url = current.chapter.links[message.linkId];
      if (url) void Linking.openURL(url).catch(() => setError('Could not open the link in your browser.'));
    }
  }

  const index = chapters.findIndex((chapter) => chapter.id === chapterId);
  const previous = chapters[index - 1];
  const next = chapters[index + 1];
  return <SafeAreaView style={styles.page}>
    <Stack.Screen options={{ gestureEnabled: false }} />
    <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{model?.chapter.title ?? 'Reader'}</Text>
    <ReaderControls preferences={preferences} disabled={!ready} onChange={(value) => { void restyle(value); }} />
    {error && <View style={styles.status}><Text accessibilityRole="alert">{error}</Text>
      <Control label="Reopen local chapter" text="Retry" onPress={onRetry} /></View>}
    {!ready && !error && <View style={styles.status}><ActivityIndicator /><Text>Restoring your passage…</Text></View>}
    {model && <WebView ref={web} source={{ uri: model.file.uri }}
      style={[styles.reader, { opacity: ready ? 1 : 0, backgroundColor: preferences.theme === 'dark' ? '#15191e' : '#faf7f0' }]}
      allowingReadAccessToURL={model.file.readAccess}
      // Route every navigation through our callback. Whitelists alone can launch external URLs.
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={(request) => allowReaderNavigation(request.url, model.file.uri)}
      onMessage={(event) => onMessage(event.nativeEvent.data)}
      onError={() => { setReady(false); setError('Local WebView could not load. Reopen this chapter to retry.'); }}
      onContentProcessDidTerminate={onRetry}
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
