import { useState } from 'react';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import * as Crypto from 'expo-crypto';
import WebView from 'react-native-webview';
import StoryContents from '../../src/app/story';
import Library from '../../src/app/index';
import Reader from '../../src/app/reader';
import { ChapterReader } from '../../src/reader/ChapterReader';
import { useStorage } from '../../src/storage/context';
import { createRenderFile } from '../../src/storage/files';
import { migrate } from '../../src/storage/migrations';
import { createRepository } from '../../src/storage/repository';
import { prepareContent } from '../../src/content/sanitize';
import { updateNativeStory } from '../../src/importing/native';
import { downloadNativeImages } from '../../src/images/native';
import { retainedPress } from '../ui-helpers';
import { hostSqlite } from './host-sqlite';
import type { Chapter, Preferences, StoryMetadata } from '../../src/domain/types';
import type { UpdateResult } from '../../src/importing/import-story';
import type { ImageResult } from '../../src/images/download';

let mockBlur: () => void, mockRefocus: () => void;
let mockInject: (script: string) => void;
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { router: { push: jest.fn(), replace: jest.fn() }, Stack: { Screen: () => null }, useLocalSearchParams: jest.fn(),
    useFocusEffect: (callback: () => (() => void)) => useEffect(() => {
      let cleanup: (() => void) | undefined;
      mockBlur = () => cleanup?.(); mockRefocus = () => { cleanup = callback(); }; mockRefocus(); return () => cleanup?.();
    }, [callback]) };
});
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('../../src/storage/context', () => ({ useStorage: jest.fn() }));
jest.mock('../../src/importing/native', () => ({ updateNativeStory: jest.fn() }));
jest.mock('../../src/images/native', () => ({ downloadNativeImages: jest.fn() }));
jest.mock('../../src/storage/files', () => ({ createRenderFile: jest.fn() }));
jest.mock('react-native-webview', () => {
  const { View } = jest.requireActual('react-native');
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');
  return { __esModule: true, default: forwardRef(function Web({ onMessage, onError, onContentProcessDidTerminate, pointerEvents }: {
    onMessage: (event: unknown) => void; onError: () => void; onContentProcessDidTerminate: () => void;
    pointerEvents: string;
  }, ref: unknown) {
    useImperativeHandle(ref, () => ({ injectJavaScript: (script: string) => mockInject(script) }));
    return <View testID="reader-web" pointerEvents={pointerEvents} onMessage={onMessage} onError={onError} onContentProcessDidTerminate={onContentProcessDidTerminate} />;
  }) };
});
const digest = async (value: string) => createHash('sha256').update(value).digest('hex');
const id = 'spacebattles:thread:9001', session = '11111111-1111-4111-8111-111111111111';
const metadata: StoryMetadata = { id, source: 'spacebattles', threadId: '9001', title: 'Generated local library', author: null,
  sourceUrl: 'https://forums.spacebattles.com/threads/9001/', categoryId: '9' };
const manifest = (posts: string[]) => ({ state: 'COMPLETE' as const, entries: posts.map((postId) => ({ postId,
  title: `Generated ${postId}`, url: `https://forums.spacebattles.com/posts/${postId}/` })) });
let folder: string, host: ReturnType<typeof hostSqlite>, repo: ReturnType<typeof createRepository>, chapter: Chapter;
beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks(); jest.mocked(updateNativeStory).mockReset(); jest.mocked(downloadNativeImages).mockReset();
  jest.spyOn(Crypto, 'randomUUID').mockReturnValue(session);
  folder = mkdtempSync(join(tmpdir(), 'stowaway-i3-ui-')); host = hostSqlite(join(folder, 'test.db'));
  await migrate(host.db); repo = createRepository(host.db); await repo.commitInitialManifest(metadata, manifest(['101', '102', '103', '104']));
  for (const post of ['101', '102', '104']) await repo.commitDownloadedChapter(id, post, await prepareContent(`<p>Synthetic ${post}.</p>`, digest));
  await repo.reconcileManifest(id, metadata, manifest(['101', '102', '103']), 1);
  chapter = (await repo.getChapter(`${id}:post:102`))!;
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: id, chapter: chapter.id });
  jest.mocked(useStorage).mockReturnValue({ repository: repo, appStyle: 'stowaway', changeAppStyle: jest.fn(), preferences: { theme: 'light', fontSize: 20 },
    changePreferences: jest.fn(), imageWarning: null });
  jest.mocked(createRenderFile).mockResolvedValue({ uri: 'file:///generated/index.html', readAccess: 'file:///generated/',
    directory: { exists: false, delete: jest.fn() } } as unknown as Awaited<ReturnType<typeof createRenderFile>>);
  mockInject = acknowledge;
});
afterEach(async () => {
  await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers();
  jest.restoreAllMocks(); host.close(); const target = resolve(folder);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('stowaway-i3-ui-')) throw new Error('Unexpected test root.');
  rmSync(target, { recursive: true, force: true });
});
function send(type: string, extra = {}) {
  screen.getByTestId('reader-web').props.onMessage({ nativeEvent: { data: JSON.stringify({ type, session,
    chapterId: chapter.id, contentHash: chapter.contentHash, ...extra }) } });
}
async function readyReader() { const view = render(<Reader />); await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy()); act(() => send('ready')); return view; }
function gate() { let release!: () => void; const promise = new Promise<void>((resolve) => { release = resolve; }); return { release, promise }; }
function handler(label: string) { return retainedPress(label); }
function reopen(kind: 'retry' | 'termination') {
  if (kind === 'retry') fireEvent.press(screen.getByLabelText('Reopen local chapter'));
  else fireEvent(screen.getByTestId('reader-web'), 'contentProcessDidTerminate');
}
function savedPassage() {
  return { chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[0]!,
    offset: 9, progression: .9, expandedSpoilers: [] };
}

function exitId(script: string): string | null {
  const argument = script.match(/\.prepareForExit\(("[^"]+")\)/)?.[1];
  return argument ? JSON.parse(argument) as string : null;
}
function acknowledge(script: string) {
  const handoffId = exitId(script);
  if (handoffId) send('quiesced', { handoffId });
  else if (script.includes('.flush()')) send('flushed');
}

// Each case combines a 700 ms handoff timeout, real SQLite rollback/recovery
// and a cold UI render, so allow bounded CI wall time for this family only.
test.each(['Return to story contents', 'Next chapter', 'Previous chapter'])('unacknowledged %s retains the owner through real Read rollback and retries without another completion', async (label) => {
  await repo.commitDownloadedChapter(id, '103', await prepareContent('<p>Synthetic next.</p>', digest));
  const locator = savedPassage(); await repo.saveLocator(locator);
  const save = jest.spyOn(repo, 'markChapterRead');
  const view = render(<Reader />);
  await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy()); act(() => send('ready'));
  const owner = screen.UNSAFE_getByType(ChapterReader).props.readCompletion;
  const commands: string[] = []; mockInject = (script) => { commands.push(script); };
  fireEvent.press(screen.getByLabelText(label));
  await act(async () => { await jest.advanceTimersByTimeAsync(700); });
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Reopen local chapter')).toBeEnabled();
  expect(screen.getByTestId('reader-web').props.pointerEvents).toBe('auto');
  fireEvent.press(screen.getByLabelText('Reading appearance'));
  expect(screen.getByLabelText('Increase reading font size')).toBeEnabled();
  fireEvent.press(screen.getByLabelText('Close reading appearance'));
  expect(commands.some((script) => script.includes('setInteractionEnabled(true)'))).toBe(true);
  expect(screen.UNSAFE_getByType(ChapterReader).props.readCompletion).toBe(owner);
  expect(await repo.getChapter(chapter.id)).not.toBeNull();

  const commit = gate(), transaction = host.db.withExclusiveTransactionAsync.bind(host.db);
  let atCommit = false;
  jest.spyOn(host.db, 'withExclusiveTransactionAsync').mockImplementationOnce(async (work) => {
    await transaction(async (tx) => { await work(tx); atCommit = true; await commit.promise; host.failNextCommit(); });
  });
  act(() => send('read-end'));
  await waitFor(() => expect(atCommit).toBe(true));
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => commit.release());
  await waitFor(() => expect(screen.getByText(/Could not save Read state locally/)).toBeTruthy());
  expect((await repo.listContents(id))[1]?.isRead).toBe(false);
  expect(screen.UNSAFE_getByType(ChapterReader).props.readCompletion).toBe(owner);
  expect(router.replace).not.toHaveBeenCalled();

  mockInject = acknowledge;
  fireEvent.press(screen.getByLabelText(label));
  await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledTimes(2);
  expect((await repo.listContents(id))[1]?.isRead).toBe(true);
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
  expect(await repo.listContents(id)).toMatchObject([{ isRead: false }, { isRead: true }, { isRead: false }]);
  view.unmount(); jest.mocked(useLocalSearchParams).mockReturnValue({ story: id }); render(<StoryContents />);
  await waitFor(() => expect(screen.getByLabelText('Mark Generated 102 as unread')).toBeEnabled());
}, 15_000);

test.each(['Return to story contents', 'Next chapter', 'Previous chapter'])('queued completion before matching acknowledgement persists before %s', async (label) => {
  await repo.commitDownloadedChapter(id, '103', await prepareContent('<p>Synthetic next.</p>', digest));
  const locator = savedPassage(); await repo.saveLocator(locator);
  const write = gate(), original = repo.markChapterRead;
  const save = jest.spyOn(repo, 'markChapterRead').mockImplementation(async (...args) => { await write.promise; await original(...args); });
  await readyReader(); let handoffId: string | null = null;
  mockInject = (script) => { handoffId = exitId(script) ?? handoffId; };
  fireEvent.press(screen.getByLabelText(label));
  await waitFor(() => expect(handoffId).not.toBeNull());
  act(() => { send('read-end'); send('quiesced', { handoffId }); });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => write.release());
  await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  expect((await repo.listContents(id))[1]?.isRead).toBe(true);
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
  expect(save).toHaveBeenCalledTimes(1);
});

test('timed-out acknowledgement A, wrong identity/id/shape and generic flushed cannot release handoff B', async () => {
  const save = jest.spyOn(repo, 'markChapterRead'); await readyReader();
  const requests: string[] = [];
  mockInject = (script) => { const id = exitId(script); if (id) requests.push(id); };
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(requests).toHaveLength(1));
  await act(async () => { await jest.advanceTimersByTimeAsync(700); });
  expect(screen.getByLabelText('Reopen local chapter')).toBeEnabled();
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(requests).toHaveLength(2));
  const [a, b] = requests; expect(a).not.toBe(b);
  act(() => {
    for (const fields of [{ handoffId: a }, { handoffId: 'wrong' }, { handoffId: b, session: 'old' },
      { handoffId: b, chapterId: 'other' }, { handoffId: b, contentHash: 'old' },
      { handoffId: b, extra: true }, { handoffId: 2 }, { handoffId: '' }, { handoffId: null }]) send('quiesced', fields);
    send('flushed');
    handler('Return to story contents')();
    handler('Reopen local chapter')();
  });
  await act(async () => { await jest.advanceTimersByTimeAsync(100); });
  expect(router.replace).not.toHaveBeenCalled(); expect(requests).toHaveLength(2);
  expect(screen.getByTestId('reader-web').props.pointerEvents).toBe('none');
  act(() => send('quiesced', { handoffId: b }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  expect(save).not.toHaveBeenCalled();
});

test('Read rollback after queued completion and acknowledgement holds navigation and preserves the successful locator', async () => {
  await readyReader(); const owner = screen.UNSAFE_getByType(ChapterReader).props.readCompletion;
  const locator = savedPassage(), original = repo.markChapterRead, commit = gate();
  const transaction = host.db.withExclusiveTransactionAsync.bind(host.db);
  let atCommit = false, handoffId: string | null = null;
  const save = jest.spyOn(repo, 'markChapterRead').mockImplementation(original);
  mockInject = (script) => { handoffId = exitId(script) ?? handoffId; };
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(handoffId).not.toBeNull());
  act(() => send('position', { locator, reason: 'flush' }));
  await waitFor(async () => expect(await repo.getLocator(chapter.id)).toEqual(locator));
  jest.spyOn(host.db, 'withExclusiveTransactionAsync').mockImplementationOnce(async (work) => {
    await transaction(async (tx) => { await work(tx); atCommit = true; await commit.promise; host.failNextCommit(); });
  });
  act(() => { send('read-end'); send('quiesced', { handoffId }); });
  await waitFor(() => expect(atCommit).toBe(true)); expect(router.replace).not.toHaveBeenCalled();
  await act(async () => commit.release());
  await waitFor(() => expect(screen.getByText(/Please retry leaving/)).toBeTruthy());
  expect(save).toHaveBeenCalledTimes(1); expect((await repo.listContents(id))[1]?.isRead).toBe(false);
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
  expect(screen.UNSAFE_getByType(ChapterReader).props.readCompletion).toBe(owner);
  expect(screen.getByTestId('reader-web').props.pointerEvents).toBe('auto');
  mockInject = acknowledge; fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledTimes(2); expect((await repo.listContents(id))[1]?.isRead).toBe(true);
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
});

test('locator rollback after acknowledgement does not roll back Read and navigation waits for locator recovery', async () => {
  const locator = savedPassage(), original = repo.saveLocator;
  const position = jest.spyOn(repo, 'saveLocator').mockImplementationOnce(async (...args) => { host.failNextCommit(); await original(...args); })
    .mockRejectedValue(new Error('Locator remains unavailable'));
  const save = jest.spyOn(repo, 'markChapterRead'); await readyReader();
  act(() => send('read-end'));
  await waitFor(async () => expect((await repo.listContents(id))[1]?.isRead).toBe(true));
  mockInject = (script) => {
    if (exitId(script)) send('position', { locator, reason: 'flush' });
    acknowledge(script);
  };
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(screen.getByText(/Could not save your position before leaving/)).toBeTruthy());
  expect(router.replace).not.toHaveBeenCalled(); expect(await repo.getLocator(chapter.id)).toBeNull();
  expect((await repo.listContents(id))[1]?.isRead).toBe(true); expect(save).toHaveBeenCalledTimes(1);
  position.mockImplementation(original); mockInject = acknowledge;
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  expect(await repo.getLocator(chapter.id)).toEqual(locator); expect(save).toHaveBeenCalledTimes(1);
});

test('termination during a live handoff releases only the dead-renderer wait and drains accepted Read without commands', async () => {
  const write = gate(), original = repo.markChapterRead;
  const save = jest.spyOn(repo, 'markChapterRead').mockImplementation(async (...args) => { await write.promise; await original(...args); });
  await readyReader(); let handoffId: string | null = null;
  mockInject = (script) => { handoffId = exitId(script) ?? handoffId; };
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(handoffId).not.toBeNull());
  act(() => send('read-end')); await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  mockInject = () => { throw new Error('Dead renderer received a command'); };
  reopen('termination'); expect(router.replace).not.toHaveBeenCalled();
  await act(async () => write.release());
  await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  expect((await repo.listContents(id))[1]?.isRead).toBe(true); expect(save).toHaveBeenCalledTimes(1);
  expect(createRenderFile).toHaveBeenCalledTimes(1);
});

test('a load error cannot stand in for quiescence, but same-chapter Retry can recover the failed renderer', async () => {
  await readyReader(); const owner = screen.UNSAFE_getByType(ChapterReader).props.readCompletion;
  fireEvent(screen.getByTestId('reader-web'), 'error');
  mockInject = () => { throw new Error('Failed rendering must not be commanded'); };
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(screen.getByText(/Reopen this chapter and retry/)).toBeTruthy());
  expect(router.replace).not.toHaveBeenCalled();
  reopen('retry'); await waitFor(() => expect(createRenderFile).toHaveBeenCalledTimes(2));
  expect(screen.UNSAFE_getByType(ChapterReader).props.readCompletion).toBe(owner);
});

test('cleanup cancels the live handoff and stale acknowledgements/navigation callbacks cannot affect another chapter', async () => {
  const view = render(<Reader />); await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy()); act(() => send('ready'));
  const a = chapter, old = screen.getByTestId('reader-web').props, oldContents = handler('Return to story contents');
  let handoffId: string | null = null; mockInject = (script) => { handoffId = exitId(script) ?? handoffId; };
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(handoffId).not.toBeNull());
  chapter = (await repo.getChapter(`${id}:post:101`))!; jest.mocked(useLocalSearchParams).mockReturnValue({ chapter: chapter.id });
  view.rerender(<Reader />); await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy()); act(() => send('ready'));
  act(() => {
    old.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'quiesced', handoffId, session, chapterId: a.id, contentHash: a.contentHash }) } });
    oldContents(); old.onContentProcessDidTerminate();
  });
  await act(async () => { await jest.advanceTimersByTimeAsync(700); });
  expect(router.replace).not.toHaveBeenCalled(); expect(screen.queryByLabelText('Reopen local chapter')).toBeNull();
  mockInject = acknowledge; fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  expect((await repo.listContents(id)).every((entry) => !entry.isRead)).toBe(true);
});

test('already-Read navigation requires acknowledgement without another automatic Read transaction', async () => {
  await repo.setEntryRead(id, '102', true); const save = jest.spyOn(repo, 'markChapterRead'); await readyReader();
  let handoffId: string | null = null; mockInject = (script) => { handoffId = exitId(script) ?? handoffId; };
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(handoffId).not.toBeNull()); expect(router.replace).not.toHaveBeenCalled();
  act(() => send('quiesced', { handoffId })); await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  expect(save).not.toHaveBeenCalled(); expect((await repo.listContents(id))[1]?.isRead).toBe(true);
});

test('background saving remains a generic flush without quiescence or frozen interaction', async () => {
  const subscription = jest.spyOn(AppState, 'addEventListener'); await readyReader();
  const commands: string[] = [], locator = savedPassage();
  mockInject = (script) => { commands.push(script); if (script.includes('.flush()')) send('position', { locator, reason: 'flush' }); acknowledge(script); };
  act(() => subscription.mock.calls.find(([event]) => event === 'change')![1]('background'));
  await waitFor(async () => expect(await repo.getLocator(chapter.id)).toEqual(locator));
  expect(commands.some((script) => script.includes('.flush()'))).toBe(true);
  expect(commands.some((script) => script.includes('prepareForExit') || script.includes('setInteractionEnabled'))).toBe(false);
  expect(screen.getByTestId('reader-web').props.pointerEvents).toBe('auto'); expect(router.replace).not.toHaveBeenCalled();
});

async function lateCompletionRecovery(kind: 'retry' | 'termination') {
  const firstLocator = gate(), finalLocator = gate(), originalLocator = repo.saveLocator, originalRead = repo.markChapterRead;
  let locatorCalls = 0;
  const position = jest.spyOn(repo, 'saveLocator').mockImplementation(async (locator) => {
    locatorCalls++;
    if (kind === 'termination' && locatorCalls === 2) await firstLocator.promise;
    if (locatorCalls === 3) await finalLocator.promise;
    await originalLocator(locator);
  });
  const save = jest.spyOn(repo, 'markChapterRead');
  await readyReader(); const locator = { ...savedPassage(), offset: 10 };
  host.failNextCommit(); act(() => send('position', { locator: savedPassage(), reason: 'flush' }));
  await waitFor(() => expect(screen.getByText(/Could not save the latest position/)).toBeTruthy());
  mockInject = (script) => {
    if (kind === 'termination') throw new Error('Dead WebView must not be sampled or commanded');
    if (exitId(script) || script.includes('.flush()')) { send('position', { locator, reason: 'flush' }); acknowledge(script); }
  };
  reopen(kind);
  if (kind === 'termination') {
    await waitFor(() => expect(locatorCalls).toBe(2));
    // A queued last sample can still arrive from the old renderer without sampling it.
    act(() => send('position', { locator, reason: 'flush' }));
    await act(async () => firstLocator.release());
  }
  await waitFor(() => expect(locatorCalls).toBe(3));
  host.failNextCommit(); act(() => send('read-end'));
  await waitFor(() => expect(screen.getByText(/Could not save Read state locally/)).toBeTruthy());
  expect((await repo.listContents(id))[1]?.isRead).toBe(false);
  expect(createRenderFile).toHaveBeenCalledTimes(1); expect(save).toHaveBeenCalledTimes(1);
  return { finalLocator, locator, save, position, originalRead, originalLocator };
}

test('opening Library/Contents is local/read-only and shows current unread including pending, excluding saved', async () => {
  const write = jest.spyOn(repo, 'setEntryRead'); const automatic = jest.spyOn(repo, 'markChapterRead');
  const library = render(<Library />); await waitFor(() => expect(screen.getByText(/· 3 unread$/)).toBeTruthy());
  expect(screen.getByText('2 of 3 downloaded · 3 unread')).toBeTruthy(); library.unmount();
  render(<StoryContents />); await waitFor(() => expect(screen.getByText(/· 3 unread$/)).toBeTruthy());
  expect(screen.getAllByText('○')).toHaveLength(4);
  for (const row of screen.getAllByLabelText(/^Read Generated [0-9]+$/)) expect(row.props.accessibilityValue.text).toMatch(/Unread · (Downloaded|Not downloaded)$/); expect(screen.getByLabelText('Read Generated 103')).toBeDisabled();
  expect(screen.getByLabelText('Mark Generated 103 as read')).toBeEnabled(); expect(screen.getByLabelText('Mark Generated 104 as read')).toBeEnabled();
  expect(write).not.toHaveBeenCalled(); expect(automatic).not.toHaveBeenCalled(); expect(updateNativeStory).not.toHaveBeenCalled(); expect(downloadNativeImages).not.toHaveBeenCalled();
});
test.each(['101', '103', '104'])('manual %s correction updates authoritative SQL, state and current-only totals; refocus retains it', async (post) => {
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText(`Mark Generated ${post} as read`)).toBeEnabled());
  fireEvent.press(screen.getByLabelText(`Mark Generated ${post} as read`));
  await waitFor(() => expect(screen.getByLabelText(`Mark Generated ${post} as unread`)).toBeEnabled());
  expect(screen.getByText(post === '104' ? /· 3 unread$/ : /· 2 unread$/)).toBeTruthy();
  expect(await host.db.getFirstAsync('SELECT is_read FROM threadmark_entries WHERE story_id = ? AND post_id = ?', id, post)).toEqual({ is_read: 1 });
  act(() => { mockBlur(); mockRefocus(); }); await waitFor(() => expect(screen.getByLabelText(`Mark Generated ${post} as unread`)).toBeEnabled());
  fireEvent.press(screen.getByLabelText(`Mark Generated ${post} as unread`)); await waitFor(() => expect(screen.getByLabelText(`Mark Generated ${post} as read`)).toBeEnabled());
  expect(screen.getByText(/· 3 unread$/)).toBeTruthy(); expect(updateNativeStory).not.toHaveBeenCalled(); expect(downloadNativeImages).not.toHaveBeenCalled();
});
test('failed manual save retains previous SQL/screen state and permits retry', async () => {
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Mark Generated 101 as read')).toBeEnabled());
  host.failNextCommit(); fireEvent.press(screen.getByLabelText('Mark Generated 101 as read'));
  await waitFor(() => expect(screen.getByText(/Could not change Read\/Unread/)).toBeTruthy());
  expect(screen.getByText(/· 3 unread$/)).toBeTruthy(); expect((await repo.listContents(id))[0]?.isRead).toBe(false);
  fireEvent.press(screen.getByLabelText('Mark Generated 101 as read')); await waitFor(() => expect(screen.getByLabelText('Mark Generated 101 as unread')).toBeEnabled());
});
test('manual write blocks source/reader exits and native removal through settlement/final refresh, including stale handlers', async () => {
  const write = gate(), refresh = gate(), original = repo.setEntryRead;
  jest.spyOn(repo, 'setEntryRead').mockImplementation(async (...args) => { await write.promise; await original(...args); });
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Mark Generated 101 as read')).toBeEnabled());
  const stale = ['Return to Library', 'Read Generated 101', 'Resume Download', 'Check for Updates', 'Mark Generated 102 as read'].map(handler);
  const originalRead = repo.listSavedUnlisted;
  jest.spyOn(repo, 'listSavedUnlisted').mockImplementationOnce(async (...args) => { await refresh.promise; return originalRead(...args); });
  fireEvent.press(screen.getByLabelText('Mark Generated 101 as read')); act(() => stale.forEach((press) => press()));
  expect(router.push).not.toHaveBeenCalled(); expect(router.replace).not.toHaveBeenCalled(); expect(updateNativeStory).not.toHaveBeenCalled();
  expect(jest.mocked(usePreventRemove).mock.calls.at(-1)![0]).toBe(true);
  await act(async () => write.release()); expect(screen.getByLabelText('Mark Generated 101 as read')).toBeDisabled();
  await act(async () => refresh.release()); await waitFor(() => expect(screen.getByLabelText('Mark Generated 101 as unread')).toBeEnabled());
  expect(jest.mocked(usePreventRemove).mock.calls.at(-1)![0]).toBe(false); expect(screen.getByText(/· 2 unread$/)).toBeTruthy();
});
test.each(['update', 'images'] as const)('%s operation blocks manual stale handlers until final authoritative refresh, then preserves Read state', async (kind) => {
  const work = gate(), refresh = gate(); await repo.setEntryRead(id, '101', true);
  if (kind === 'update') jest.mocked(updateNativeStory).mockImplementation(async () => { await work.promise; return { story: await repo.getStory(id), failure: null, bodiesDownloaded: 0, reconciliation: null } as UpdateResult; });
  else jest.mocked(downloadNativeImages).mockImplementation(async () => { await work.promise; return { storyId: id, summary: await repo.getImageSummary(id), failure: null } as ImageResult; });
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Mark Generated 101 as unread')).toBeEnabled());
  const stale = handler('Mark Generated 101 as unread'); const read = repo.listSavedUnlisted;
  jest.spyOn(repo, 'listSavedUnlisted').mockImplementationOnce(async (...args) => { await refresh.promise; return read(...args); });
  fireEvent.press(screen.getByLabelText(kind === 'update' ? 'Check for Updates' : 'Download Images'));
  act(() => stale()); expect((await repo.listContents(id))[0]?.isRead).toBe(true);
  await act(async () => work.release()); expect(screen.getByLabelText('Mark Generated 101 as unread')).toBeDisabled();
  await act(async () => refresh.release()); await waitFor(() => expect(screen.getByLabelText('Mark Generated 101 as unread')).toBeEnabled());
  fireEvent.press(screen.getByLabelText('Mark Generated 101 as unread')); await waitFor(() => expect(screen.getByText(/· 3 unread$/)).toBeTruthy());
});
test('late local read from another route cannot replace current Read state/actions', async () => {
  const gateRead = gate(), read = repo.listContents;
  jest.spyOn(repo, 'listContents').mockImplementationOnce(async (...args) => { await gateRead.promise; return read(...args); });
  const view = render(<StoryContents />);
  const other = { ...metadata, id: 'spacebattles:thread:9002', threadId: '9002', title: 'Generated other', sourceUrl: 'https://forums.spacebattles.com/threads/9002/' };
  await repo.commitInitialManifest(other, manifest(['201'])); await repo.setEntryRead(other.id, '201', true);
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: other.id }); view.rerender(<StoryContents />);
  await waitFor(() => expect(screen.getByText(/· All read$/)).toBeTruthy()); await act(async () => gateRead.release());
  expect(screen.queryByLabelText('Mark Generated 101 as read')).toBeNull(); expect(screen.getByLabelText('Mark Generated 201 as unread')).toBeEnabled();
});
test('delayed pre-correction refocus read cannot overwrite newer manual SQL/screen state; retained Mark Read is idempotent', async () => {
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Mark Generated 101 as read')).toBeEnabled());
  const staleMarkRead = handler('Mark Generated 101 as read');
  const delayed = gate(), old = await repo.listContents(id);
  jest.spyOn(repo, 'listContents').mockImplementationOnce(async () => { await delayed.promise; return old; });
  act(() => { mockBlur(); mockRefocus(); });
  expect(screen.getByLabelText('Read Generated 101')).toBeDisabled();
  fireEvent.press(screen.getByLabelText('Mark Generated 101 as read'));
  await waitFor(() => expect(screen.getByLabelText('Mark Generated 101 as unread')).toBeEnabled());
  await act(async () => delayed.release()); expect(screen.getByText(/· 2 unread$/)).toBeTruthy();
  act(() => staleMarkRead()); await waitFor(() => expect(screen.getByLabelText('Mark Generated 101 as unread')).toBeEnabled());
  expect((await repo.listContents(id))[0]?.isRead).toBe(true);
});
test('retained manual action cannot mutate a pending entry hidden by a later COMPLETE removal', async () => {
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Mark Generated 103 as read')).toBeEnabled());
  const stale = handler('Mark Generated 103 as read'); await repo.reconcileManifest(id, metadata, manifest(['101', '102']), 2);
  // Settle the asynchronous focus refresh before polling for the removed row.
  await act(async () => { mockBlur(); mockRefocus(); }); await waitFor(() => expect(screen.queryByLabelText('Mark Generated 103 as read')).toBeNull());
  const changeRead = jest.spyOn(repo, 'setEntryRead');
  await act(async () => { stale(); });
  expect(changeRead).not.toHaveBeenCalled();
  expect(await host.db.getFirstAsync('SELECT is_read FROM threadmark_entries WHERE story_id = ? AND post_id = ?', id, '103')).toEqual({ is_read: 0 });
});
test.each(['Next chapter', 'Previous chapter', 'Return to story contents'])('automatic Read survives immediate %s; neighboring entry and locator remain independent', async (label) => {
  await repo.commitDownloadedChapter(id, '103', await prepareContent('<p>Synthetic next.</p>', digest));
  const write = gate(), original = repo.markChapterRead;
  const save = jest.spyOn(repo, 'markChapterRead').mockImplementation(async (...args) => { await write.promise; await original(...args); });
  await readyReader(); expect(save).not.toHaveBeenCalled(); act(() => send('read-end')); fireEvent.press(screen.getByLabelText(label));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1)); expect(router.replace).not.toHaveBeenCalled();
  act(() => send('read-end')); await act(async () => write.release()); await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  expect(await repo.listContents(id)).toMatchObject([{ postId: '101', isRead: false }, { postId: '102', isRead: true }, { postId: '103', isRead: false }]);
  expect(await repo.getLocator(chapter.id)).toBeNull(); expect(save).toHaveBeenCalledTimes(1);
});
test('completion arriving before WebView quiescence settles before navigation', async () => {
  await readyReader(); mockInject = (script) => { if (exitId(script)) send('read-end'); acknowledge(script); };
  fireEvent.press(screen.getByLabelText('Return to story contents')); await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  expect((await repo.listContents(id))[1]?.isRead).toBe(true);
});
test('failed automatic Read reports useful local error, saves locator independently and holds navigation until explicit retry', async () => {
  const original = repo.markChapterRead, save = jest.spyOn(repo, 'markChapterRead').mockRejectedValue(new Error('Injected disk failure'));
  await readyReader(); act(() => send('read-end'));
  await waitFor(() => expect(screen.getByText(/Could not save Read state locally/)).toBeTruthy());
  const locator = { chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[0]!, offset: 9, progression: .7, expandedSpoilers: [] };
  act(() => send('position', { locator, reason: 'flush' })); fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(screen.getByText(/Please retry leaving/)).toBeTruthy());
  expect(router.replace).not.toHaveBeenCalled(); expect(await repo.getLocator(chapter.id)).toEqual(locator); expect((await repo.listContents(id))[1]?.isRead).toBe(false);
  save.mockImplementation(original); fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1)); expect((await repo.listContents(id))[1]?.isRead).toBe(true);
});
test.each(['retry', 'termination'] as const)('%s recovery persists failed completion before reopening, without another end interaction', async (kind) => {
  const locator = savedPassage(); await repo.saveLocator(locator);
  const save = jest.spyOn(repo, 'markChapterRead');
  await readyReader(); host.failNextCommit(); act(() => send('read-end'));
  await waitFor(() => expect(screen.getByText(/Could not save Read state locally/)).toBeTruthy());
  expect((await repo.listContents(id))[1]?.isRead).toBe(false);
  expect(screen.getByLabelText('Reopen local chapter')).toBeEnabled();
  if (kind === 'termination') mockInject = () => { throw new Error('Terminated WebView must not be sampled'); };
  reopen(kind);
  await waitFor(() => expect(createRenderFile).toHaveBeenCalledTimes(2));
  expect(save).toHaveBeenCalledTimes(2); expect((await repo.listContents(id))[1]?.isRead).toBe(true);
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
  expect(jest.mocked(createRenderFile).mock.calls[1]![1]).toEqual(locator);
  await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy()); act(() => send('ready'));
  mockInject = acknowledge;
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/story', params: { story: id } }));
  expect(save).toHaveBeenCalledTimes(2); expect((await repo.listContents(id))[1]?.isRead).toBe(true);
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
  expect(updateNativeStory).not.toHaveBeenCalled(); expect(downloadNativeImages).not.toHaveBeenCalled();
});
test.each(['retry', 'termination'] as const)('%s repeated failure refuses remount, preserves locator independently and remains retryable', async (kind) => {
  const original = repo.markChapterRead, save = jest.spyOn(repo, 'markChapterRead').mockRejectedValue(new Error('Injected disk failure'));
  await readyReader(); act(() => send('read-end'));
  await waitFor(() => expect(screen.getByText(/Could not save Read state locally/)).toBeTruthy());
  const locator = savedPassage(); act(() => send('position', { locator, reason: 'scroll' }));
  reopen(kind);
  await waitFor(() => expect(screen.getByText(/Could not save local progress before reopening/)).toBeTruthy());
  expect(save).toHaveBeenCalledTimes(2); expect(createRenderFile).toHaveBeenCalledTimes(1);
  expect((await repo.listContents(id))[1]?.isRead).toBe(false); expect(await repo.getLocator(chapter.id)).toEqual(locator);
  expect(screen.getByLabelText('Reopen local chapter')).toBeEnabled(); expect(router.replace).not.toHaveBeenCalled();
  save.mockImplementation(original); reopen('retry');
  await waitFor(() => expect(createRenderFile).toHaveBeenCalledTimes(2));
  expect(save).toHaveBeenCalledTimes(3); expect((await repo.listContents(id))[1]?.isRead).toBe(true);
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
  await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy()); act(() => send('ready'));
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1)); expect(save).toHaveBeenCalledTimes(3);
});
test.each(['retry', 'termination'] as const)('%s recovery holds remount/navigation and deduplicates retained recovery controls until Read settles', async (kind) => {
  const write = gate(), original = repo.markChapterRead;
  const save = jest.spyOn(repo, 'markChapterRead').mockRejectedValueOnce(new Error('Injected disk failure'))
    .mockImplementation(async (...args) => { await write.promise; await original(...args); });
  await readyReader(); act(() => send('read-end'));
  await waitFor(() => expect(screen.getByText(/Could not save Read state locally/)).toBeTruthy());
  const retainedRetry = handler('Reopen local chapter'); reopen(kind);
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId('reader-web').props.pointerEvents).toBe('none');
  act(() => { retainedRetry(); reopen('termination'); });
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  expect(createRenderFile).toHaveBeenCalledTimes(1); expect(router.replace).not.toHaveBeenCalled();
  expect((await repo.listContents(id))[1]?.isRead).toBe(false);
  await act(async () => write.release()); await waitFor(() => expect(createRenderFile).toHaveBeenCalledTimes(2));
  expect(save).toHaveBeenCalledTimes(2); expect((await repo.listContents(id))[1]?.isRead).toBe(true);
});
test('Retry after an initial local render failure remains ordinary recovery with no Read request', async () => {
  const file = jest.mocked(createRenderFile).getMockImplementation()!;
  jest.mocked(createRenderFile).mockRejectedValueOnce(new Error('Injected local render failure')).mockImplementation(file);
  const save = jest.spyOn(repo, 'markChapterRead'); render(<Reader />);
  await waitFor(() => expect(screen.getByText(/Could not open this local chapter/)).toBeTruthy());
  reopen('retry'); await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy());
  expect(createRenderFile).toHaveBeenCalledTimes(2); expect(save).not.toHaveBeenCalled();
});

test.each(['retry', 'termination'] as const)('late completion during final %s locator wait survives real SQLite rollback and recovery before remount', async (kind) => {
  const { finalLocator, locator, save } = await lateCompletionRecovery(kind);
  await act(async () => finalLocator.release());
  await waitFor(() => expect(createRenderFile).toHaveBeenCalledTimes(2));
  expect((await repo.listContents(id))[1]?.isRead).toBe(true); expect(save).toHaveBeenCalledTimes(2);
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
  expect(jest.mocked(createRenderFile).mock.calls[1]![1]).toEqual(locator);
  await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy()); act(() => send('ready'));
  mockInject = acknowledge;
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledTimes(2); expect((await repo.listContents(id))[1]?.isRead).toBe(true);
});

test.each(['retry', 'termination'] as const)('late %s completion survives a second real Read rollback and later visible Retry', async (kind) => {
  const { finalLocator, locator, save, originalRead } = await lateCompletionRecovery(kind);
  save.mockImplementationOnce(async (...args) => { host.failNextCommit(); await originalRead(...args); });
  await act(async () => finalLocator.release());
  await waitFor(() => expect(screen.getByText(/Could not save local progress before reopening/)).toBeTruthy());
  expect(save).toHaveBeenCalledTimes(2); expect(createRenderFile).toHaveBeenCalledTimes(1);
  expect((await repo.listContents(id))[1]?.isRead).toBe(false); expect(await repo.getLocator(chapter.id)).toEqual(locator);
  expect(screen.getByLabelText('Reopen local chapter')).toBeEnabled();
  expect(screen.getByTestId('reader-web').props.pointerEvents).toBe('auto');
  reopen('retry'); await waitFor(() => expect(createRenderFile).toHaveBeenCalledTimes(2));
  expect(save).toHaveBeenCalledTimes(3); expect((await repo.listContents(id))[1]?.isRead).toBe(true);
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
});

test('late completion survives locator rollback, then Read success remains independent of further locator failure', async () => {
  const { finalLocator, locator, save, position, originalLocator } = await lateCompletionRecovery('retry');
  host.failNextCommit(); await act(async () => finalLocator.release());
  await waitFor(() => expect(screen.getByText(/Could not save local progress before reopening/)).toBeTruthy());
  expect(save).toHaveBeenCalledTimes(1); expect((await repo.listContents(id))[1]?.isRead).toBe(false);
  expect(await repo.getLocator(chapter.id)).toEqual(savedPassage());
  position.mockRejectedValue(new Error('Locator remains unavailable'));
  reopen('retry'); await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  await waitFor(async () => expect((await repo.listContents(id))[1]?.isRead).toBe(true));
  expect(createRenderFile).toHaveBeenCalledTimes(1); expect(await repo.getLocator(chapter.id)).toEqual(savedPassage());
  position.mockImplementation(originalLocator); reopen('retry');
  await waitFor(() => expect(createRenderFile).toHaveBeenCalledTimes(2));
  expect(save).toHaveBeenCalledTimes(2); expect(await repo.getLocator(chapter.id)).toEqual(locator);
});

test('route-owned completion survives keyed replacement and stale old reader callbacks cannot replace or mutate the new session', async () => {
  const retryWrite = gate(), original = repo.markChapterRead;
  const save = jest.spyOn(repo, 'markChapterRead').mockImplementationOnce(original)
    .mockImplementation(async (...args) => { await retryWrite.promise; await original(...args); });
  const locator = savedPassage(); await repo.saveLocator(locator);
  await readyReader(); const old = screen.getByTestId('reader-web').props;
  const oldContents = handler('Return to story contents');
  host.failNextCommit(); act(() => send('read-end'));
  await waitFor(() => expect(screen.getByText(/Could not save Read state locally/)).toBeTruthy());
  const oldRetry = handler('Reopen local chapter');
  const route = screen.UNSAFE_getByType(ChapterReader).props;
  // Force the lifetime boundary itself: even a request beyond the child drain
  // cannot be erased by the parent's keyed replacement.
  act(() => route.onRetry());
  await waitFor(() => expect(createRenderFile).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(screen.UNSAFE_getByType(ChapterReader).props.readCompletion).toBe(route.readCompletion);
  act(() => {
    oldRetry(); oldContents(); old.onContentProcessDidTerminate();
    old.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'read-end', session, chapterId: chapter.id, contentHash: chapter.contentHash }) } });
  });
  expect(createRenderFile).toHaveBeenCalledTimes(2); expect(router.replace).not.toHaveBeenCalled();
  await act(async () => retryWrite.release());
  await waitFor(async () => expect((await repo.listContents(id))[1]?.isRead).toBe(true));
  expect(save).toHaveBeenCalledTimes(2); expect(await repo.getLocator(chapter.id)).toEqual(locator);
});

test('ordinary locator-only Retry preserves the passage without requesting Read', async () => {
  const save = jest.spyOn(repo, 'markChapterRead'); await readyReader(); const locator = savedPassage();
  host.failNextCommit(); act(() => send('position', { locator, reason: 'flush' }));
  await waitFor(() => expect(screen.getByText(/Could not save the latest position/)).toBeTruthy());
  reopen('retry'); await waitFor(() => expect(createRenderFile).toHaveBeenCalledTimes(2));
  expect(save).not.toHaveBeenCalled(); expect(await repo.getLocator(chapter.id)).toEqual(locator);
  expect((await repo.listContents(id))[1]?.isRead).toBe(false);
});

test('route-owned pending Read blocks leaving during keyed reader restoration before a new model exists', async () => {
  const readWrite = gate(), renderWait = gate(), originalRead = repo.markChapterRead;
  const renderFile = jest.mocked(createRenderFile).getMockImplementation()!;
  const save = jest.spyOn(repo, 'markChapterRead').mockImplementationOnce(originalRead)
    .mockImplementation(async (...args) => { await readWrite.promise; await originalRead(...args); });
  const view = render(<Reader />); await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy());
  act(() => send('ready')); host.failNextCommit(); act(() => send('read-end'));
  await waitFor(() => expect(screen.getByText(/Could not save Read state locally/)).toBeTruthy());
  jest.mocked(createRenderFile).mockImplementation(async (...args) => { await renderWait.promise; return renderFile(...args); });
  act(() => screen.UNSAFE_getByType(ChapterReader).props.onRetry());
  await waitFor(() => expect(createRenderFile).toHaveBeenCalledTimes(2));
  expect(screen.queryByTestId('reader-web')).toBeNull();
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => readWrite.release()); await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  expect((await repo.listContents(id))[1]?.isRead).toBe(true); expect(save).toHaveBeenCalledTimes(2);
  view.unmount(); await act(async () => renderWait.release());
});
test('termination with no completion request reopens without inferring Read', async () => {
  const save = jest.spyOn(repo, 'markChapterRead'); await readyReader(); reopen('termination');
  await waitFor(() => expect(createRenderFile).toHaveBeenCalledTimes(2)); expect(save).not.toHaveBeenCalled();
  expect((await repo.listContents(id))[1]?.isRead).toBe(false);
});
test('successful completion followed by Retry never repeats the successful Read write', async () => {
  const save = jest.spyOn(repo, 'markChapterRead'); await readyReader(); act(() => send('read-end'));
  await waitFor(async () => expect((await repo.listContents(id))[1]?.isRead).toBe(true));
  fireEvent(screen.getByTestId('reader-web'), 'error'); reopen('retry');
  await waitFor(() => expect(createRenderFile).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy()); act(() => send('ready'));
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1)); expect(save).toHaveBeenCalledTimes(1);
});
test('callback-free S2A reader reuse can recover termination without invoking a Read API', async () => {
  const save = jest.spyOn(repo, 'markChapterRead'), retry = jest.fn();
  render(<ChapterReader chapterId={chapter.id} repository={repo} preferences={{ theme: 'light', fontSize: 20 }}
    changePreferences={jest.fn()} onRetry={retry} onNavigate={jest.fn()} />);
  await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy()); act(() => { send('ready'); send('read-end'); });
  reopen('termination'); await waitFor(() => expect(retry).toHaveBeenCalledTimes(1)); expect(save).not.toHaveBeenCalled();
});
test('pre-ready/layout and wrong identity messages cannot write Read; optional callback keeps the S2A reader unchanged', async () => {
  const save = jest.spyOn(repo, 'markChapterRead');
  const reader = render(<Reader />); await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy());
  act(() => { send('read-end'); send('ready'); send('read-end', { session: 'wrong' }); send('layout-start'); send('read-end'); });
  expect(save).not.toHaveBeenCalled(); reader.unmount();
  render(<ChapterReader chapterId={chapter.id} repository={repo} preferences={{ theme: 'light', fontSize: 20 }}
    changePreferences={jest.fn()} onRetry={jest.fn()} onNavigate={jest.fn()} />);
  await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy()); act(() => { send('ready'); send('read-end'); });
  expect(save).not.toHaveBeenCalled(); expect((await repo.listContents(id))[1]?.isRead).toBe(false);
});
test('saved-unlisted completion remains local with both navigation directions disabled and no effect on current total', async () => {
  chapter = (await repo.getChapter(`${id}:post:104`))!; jest.mocked(useLocalSearchParams).mockReturnValue({ chapter: chapter.id });
  await readyReader(); expect(screen.getByLabelText('Next chapter')).toBeDisabled(); expect(screen.getByLabelText('Previous chapter')).toBeDisabled();
  act(() => send('read-end')); fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/story', params: { story: id } }));
  expect(await repo.listSavedUnlisted(id)).toMatchObject([{ postId: '104', isRead: true }]); expect(await repo.getStory(id)).toMatchObject({ unread: 3 });
});

test('UI appearance persists preferences through the existing restyle flow without saving a transient locator', async () => {
  const locator = savedPassage(); await repo.saveLocator(locator);
  const save = jest.spyOn(repo, 'saveLocator'), read = jest.spyOn(repo, 'markChapterRead');
  jest.mocked(useStorage).mockImplementation(function useTestStorage() {
    const [preferences, setPreferences] = useState<Preferences>({ theme: 'light', fontSize: 20 });
    return { repository: repo, appStyle: 'stowaway', changeAppStyle: jest.fn(), preferences, imageWarning: null, changePreferences: async (value) => { await repo.savePreferences(value); setPreferences(value); } };
  });
  const commands: string[] = [];
  mockInject = (script) => { commands.push(script); acknowledge(script); };
  await readyReader();
  expect(screen.getByText('2 of 3')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Reading appearance'));
  expect(screen.getByRole('header', { name: 'Reading Appearance' })).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Increase reading font size'));
  await waitFor(() => expect(screen.getByLabelText('Reading font size 22')).toBeTruthy());
  expect(commands.some((command) => command.includes('restyle(22, "light", "georgia")'))).toBe(true);
  expect(screen.getByLabelText('Increase reading font size')).toBeDisabled();
  const ready = () => screen.getByTestId('reader-web', { includeHiddenElements: true }).props.onMessage({ nativeEvent: { data: JSON.stringify({
    type: 'ready', session, chapterId: chapter.id, contentHash: chapter.contentHash,
  }) } });
  act(ready);
  fireEvent.press(screen.getByLabelText('Use dark reading theme'));
  await waitFor(() => expect(screen.getByLabelText('Use dark reading theme').props.accessibilityState.selected).toBe(true));
  expect(await repo.getPreferences()).toEqual({ theme: 'dark', fontSize: 22, font: 'georgia' });
  expect(commands.some((command) => command.includes('restyle(22, "dark", "georgia")'))).toBe(true);
  act(ready);
  fireEvent.press(screen.getByLabelText('Reading font'));
  fireEvent.press(screen.getByLabelText('Use Palatino reading font'));
  await waitFor(() => expect(screen.getByLabelText('Use Palatino reading font').props.accessibilityState.selected).toBe(true));
  expect(commands.some((command) => command.includes('restyle(22, "dark", "palatino")'))).toBe(true);
  expect(await repo.getPreferences()).toEqual({ theme: 'dark', fontSize: 22, font: 'palatino' });
  expect(screen.getByLabelText('Use System Sans reading font')).toBeDisabled();
  act(ready); fireEvent.press(screen.getByLabelText('Use Avenir Next reading font'));
  await waitFor(() => expect(screen.getByLabelText('Use Avenir Next reading font').props.accessibilityState.selected).toBe(true));
  expect(commands.some((command) => command.includes('restyle(22, "dark", "avenir-next")'))).toBe(true);
  fireEvent.press(screen.getByLabelText('Close reading font'));
  expect(screen.getByLabelText('Reading font')).toHaveAccessibilityValue({ text: 'Avenir Next' });
  act(ready); fireEvent.press(screen.getByLabelText('Use paper reading theme'));
  await waitFor(() => expect(screen.getByLabelText('Use paper reading theme').props.accessibilityState.selected).toBe(true));
  expect(await repo.getPreferences()).toEqual({ theme: 'paper', fontSize: 22, font: 'avenir-next' });
  expect(commands.some((command) => command.includes('restyle(22, "paper", "avenir-next")'))).toBe(true);
  act(ready); fireEvent.press(screen.getByLabelText('Close reading appearance'));
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
  expect(save).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(router.replace).toHaveBeenCalled());
  expect(commands.some((command) => command.includes('prepareForExit('))).toBe(true);
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
});

test('rapid font comparisons settle independently and backdrop dismissal preserves the committed choice and passage', async () => {
  const locator = savedPassage(); await repo.saveLocator(locator);
  await repo.savePreferences({ theme: 'paper', fontSize: 24, font: 'georgia' });
  let initial = await repo.getPreferences();
  const save = jest.spyOn(repo, 'saveLocator'), read = jest.spyOn(repo, 'markChapterRead'), preferenceSave = jest.spyOn(repo, 'savePreferences');
  jest.mocked(useStorage).mockImplementation(function useTestStorage() {
    const [preferences, setPreferences] = useState<Preferences>(initial);
    return { repository: repo, appStyle: 'stowaway', changeAppStyle: jest.fn(), preferences, imageWarning: null,
      changePreferences: async (value) => { await repo.savePreferences(value); setPreferences(value); } };
  });
  const commands: string[] = [];
  mockInject = (script) => { commands.push(script); acknowledge(script); };
  const view = await readyReader();
  const readerSource = screen.UNSAFE_getByType(WebView).props.source;
  expect(screen.getByTestId('reader-content').props.pointerEvents).toBe('auto');
  const ready = () => screen.getByTestId('reader-web', { includeHiddenElements: true }).props.onMessage({ nativeEvent: { data: JSON.stringify({
    type: 'ready', session, chapterId: chapter.id, contentHash: chapter.contentHash,
  }) } });
  fireEvent.press(screen.getByLabelText('Reading appearance')); fireEvent.press(screen.getByLabelText('Reading font'));
  const hiddenReader = screen.getByTestId('reader-content', { includeHiddenElements: true });
  expect(hiddenReader.props.pointerEvents).toBe('none');
  expect(hiddenReader.props.accessibilityElementsHidden).toBe(true);
  expect(hiddenReader.props.importantForAccessibility).toBe('no-hide-descendants');
  for (const [index, name, key] of [[1, 'Avenir Next', 'avenir-next'], [2, 'Menlo', 'menlo'], [3, 'Marker Felt', 'marker-felt']] as const) {
    fireEvent.press(screen.getByLabelText('Use ' + name + ' reading font'));
    fireEvent.press(screen.getByLabelText('Use Papyrus reading font'));
    expect(preferenceSave).toHaveBeenCalledTimes(index);
    expect(screen.getByLabelText('Use Papyrus reading font')).toBeDisabled();
    await waitFor(() => expect(screen.getByLabelText('Use ' + name + ' reading font').props.accessibilityState.selected).toBe(true));
    expect(commands.some((command) => command.includes(`restyle(24, "paper", "${key}")`))).toBe(true);
    expect(screen.getByRole('header', { name: 'Reading Font' })).toBeTruthy();
    expect(screen.UNSAFE_getByType(WebView).props.source).toEqual(readerSource);
    expect(createRenderFile).toHaveBeenCalledTimes(1);
    if (index < 3) {
      act(ready);
      expect(StyleSheet.flatten(screen.UNSAFE_getByType(WebView).props.style)).toMatchObject({ opacity: 1 });
      expect(screen.getByRole('header', { name: 'Reading Font' })).toBeTruthy();
    }
  }
  fireEvent.press(screen.getByTestId('appearance-backdrop', { includeHiddenElements: true }));
  expect(screen.getByLabelText('Reading font')).toHaveAccessibilityValue({ text: 'Marker Felt' });
  fireEvent.press(screen.getByTestId('appearance-backdrop', { includeHiddenElements: true }));
  expect(screen.queryByRole('header', { name: 'Reading Appearance' })).toBeNull();
  expect(screen.getByTestId('reader-content').props.pointerEvents).toBe('auto');
  expect(screen.getByTestId('reader-content').props.accessibilityElementsHidden).toBe(false);
  act(ready);
  initial = await repo.getPreferences(); expect(initial).toEqual({ theme: 'paper', fontSize: 24, font: 'marker-felt' });
  expect(preferenceSave).toHaveBeenCalledTimes(3);
  expect(save).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
  view.unmount(); await readyReader();
  fireEvent.press(screen.getByLabelText('Reading appearance'));
  expect(screen.getByLabelText('Reading font')).toHaveAccessibilityValue({ text: 'Marker Felt' });
  expect(screen.getByLabelText('Reading font size 24')).toBeTruthy();
  expect(screen.getByLabelText('Use paper reading theme').props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByTestId('appearance-backdrop', { includeHiddenElements: true }));
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(router.replace).toHaveBeenCalled());
  expect(commands.some((command) => command.includes('prepareForExit('))).toBe(true);
  expect(await repo.getLocator(chapter.id)).toEqual(locator); expect(read).not.toHaveBeenCalled();
});
