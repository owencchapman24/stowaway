import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import * as Crypto from 'expo-crypto';
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
import { Control } from '../../src/reader/controls';
import { hostSqlite } from './host-sqlite';
import type { Chapter, StoryMetadata } from '../../src/domain/types';
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
  return { __esModule: true, default: forwardRef(function Web({ onMessage, onError, onContentProcessDidTerminate }: {
    onMessage: (event: unknown) => void; onError: () => void; onContentProcessDidTerminate: () => void;
  }, ref: unknown) {
    useImperativeHandle(ref, () => ({ injectJavaScript: (script: string) => mockInject(script) }));
    return <View testID="reader-web" onMessage={onMessage} onError={onError} onContentProcessDidTerminate={onContentProcessDidTerminate} />;
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
  jest.mocked(useStorage).mockReturnValue({ repository: repo, preferences: { theme: 'light', fontSize: 20 },
    changePreferences: jest.fn(), imageWarning: null });
  jest.mocked(createRenderFile).mockResolvedValue({ uri: 'file:///generated/index.html', readAccess: 'file:///generated/',
    directory: { exists: false, delete: jest.fn() } } as unknown as Awaited<ReturnType<typeof createRenderFile>>);
  mockInject = (script) => { if (script.includes('.flush()')) send('flushed'); };
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
async function readyReader() { render(<Reader />); await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy()); act(() => send('ready')); }
function gate() { let release!: () => void; const promise = new Promise<void>((resolve) => { release = resolve; }); return { release, promise }; }
function handler(label: string) { return screen.UNSAFE_getAllByType(Control).find((control) => control.props.label === label)!.props.onPress; }
function reopen(kind: 'retry' | 'termination') {
  if (kind === 'retry') fireEvent.press(screen.getByLabelText('Reopen local chapter'));
  else fireEvent(screen.getByTestId('reader-web'), 'contentProcessDidTerminate');
}
function savedPassage() {
  return { chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[0]!,
    offset: 9, progression: .9, expandedSpoilers: [] };
}

test('opening Library/Contents is local/read-only and shows current unread including pending, excluding saved', async () => {
  const write = jest.spyOn(repo, 'setEntryRead'); const automatic = jest.spyOn(repo, 'markChapterRead');
  const library = render(<Library />); await waitFor(() => expect(screen.getByText('3 unread')).toBeTruthy());
  expect(screen.getByText('2 / 3 text chapters downloaded')).toBeTruthy(); library.unmount();
  render(<StoryContents />); await waitFor(() => expect(screen.getByText('3 unread')).toBeTruthy());
  expect(screen.getAllByText('Unread')).toHaveLength(4); expect(screen.getByLabelText('Read Generated 103')).toBeDisabled();
  expect(screen.getByLabelText('Mark Generated 103 as read')).toBeEnabled(); expect(screen.getByLabelText('Mark Generated 104 as read')).toBeEnabled();
  expect(write).not.toHaveBeenCalled(); expect(automatic).not.toHaveBeenCalled(); expect(updateNativeStory).not.toHaveBeenCalled(); expect(downloadNativeImages).not.toHaveBeenCalled();
});
test.each(['101', '103', '104'])('manual %s correction updates authoritative SQL, state and current-only totals; refocus retains it', async (post) => {
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText(`Mark Generated ${post} as read`)).toBeEnabled());
  fireEvent.press(screen.getByLabelText(`Mark Generated ${post} as read`));
  await waitFor(() => expect(screen.getByLabelText(`Mark Generated ${post} as unread`)).toBeEnabled());
  expect(screen.getByText(post === '104' ? '3 unread' : '2 unread')).toBeTruthy();
  expect(await host.db.getFirstAsync('SELECT is_read FROM threadmark_entries WHERE story_id = ? AND post_id = ?', id, post)).toEqual({ is_read: 1 });
  act(() => { mockBlur(); mockRefocus(); }); await waitFor(() => expect(screen.getByLabelText(`Mark Generated ${post} as unread`)).toBeEnabled());
  fireEvent.press(screen.getByLabelText(`Mark Generated ${post} as unread`)); await waitFor(() => expect(screen.getByLabelText(`Mark Generated ${post} as read`)).toBeEnabled());
  expect(screen.getByText('3 unread')).toBeTruthy(); expect(updateNativeStory).not.toHaveBeenCalled(); expect(downloadNativeImages).not.toHaveBeenCalled();
});
test('failed manual save retains previous SQL/screen state and permits retry', async () => {
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Mark Generated 101 as read')).toBeEnabled());
  host.failNextCommit(); fireEvent.press(screen.getByLabelText('Mark Generated 101 as read'));
  await waitFor(() => expect(screen.getByText(/Could not change Read\/Unread/)).toBeTruthy());
  expect(screen.getByText('3 unread')).toBeTruthy(); expect((await repo.listContents(id))[0]?.isRead).toBe(false);
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
  expect(jest.mocked(usePreventRemove).mock.calls.at(-1)![0]).toBe(false); expect(screen.getByText('2 unread')).toBeTruthy();
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
  fireEvent.press(screen.getByLabelText('Mark Generated 101 as unread')); await waitFor(() => expect(screen.getByText('3 unread')).toBeTruthy());
});
test('late local read from another route cannot replace current Read state/actions', async () => {
  const gateRead = gate(), read = repo.listContents;
  jest.spyOn(repo, 'listContents').mockImplementationOnce(async (...args) => { await gateRead.promise; return read(...args); });
  const view = render(<StoryContents />);
  const other = { ...metadata, id: 'spacebattles:thread:9002', threadId: '9002', title: 'Generated other', sourceUrl: 'https://forums.spacebattles.com/threads/9002/' };
  await repo.commitInitialManifest(other, manifest(['201'])); await repo.setEntryRead(other.id, '201', true);
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: other.id }); view.rerender(<StoryContents />);
  await waitFor(() => expect(screen.getByText('0 unread')).toBeTruthy()); await act(async () => gateRead.release());
  expect(screen.queryByLabelText('Mark Generated 101 as read')).toBeNull(); expect(screen.getByLabelText('Mark Generated 201 as unread')).toBeEnabled();
});
test('delayed pre-correction refocus read cannot overwrite newer manual SQL/screen state; retained Mark Read is idempotent', async () => {
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Mark Generated 101 as read')).toBeEnabled());
  const staleMarkRead = handler('Mark Generated 101 as read');
  const delayed = gate(), old = await repo.listContents(id);
  jest.spyOn(repo, 'listContents').mockImplementationOnce(async () => { await delayed.promise; return old; });
  act(() => { mockBlur(); mockRefocus(); }); fireEvent.press(screen.getByLabelText('Mark Generated 101 as read'));
  await waitFor(() => expect(screen.getByLabelText('Mark Generated 101 as unread')).toBeEnabled());
  await act(async () => delayed.release()); expect(screen.getByText('2 unread')).toBeTruthy();
  act(() => staleMarkRead()); await waitFor(() => expect(screen.getByLabelText('Mark Generated 101 as unread')).toBeEnabled());
  expect((await repo.listContents(id))[0]?.isRead).toBe(true);
});
test('retained manual action cannot mutate a pending entry hidden by a later COMPLETE removal', async () => {
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Mark Generated 103 as read')).toBeEnabled());
  const stale = handler('Mark Generated 103 as read'); await repo.reconcileManifest(id, metadata, manifest(['101', '102']), 2);
  act(() => { mockBlur(); mockRefocus(); }); await waitFor(() => expect(screen.queryByLabelText('Mark Generated 103 as read')).toBeNull());
  act(() => stale()); expect(await host.db.getFirstAsync('SELECT is_read FROM threadmark_entries WHERE story_id = ? AND post_id = ?', id, '103')).toEqual({ is_read: 0 });
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
test('completion arriving during the WebView flush handshake settles before navigation', async () => {
  await readyReader(); mockInject = () => { send('read-end'); send('flushed'); };
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
  mockInject = () => send('flushed');
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
