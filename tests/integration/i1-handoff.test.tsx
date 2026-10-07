import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { AppState } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import StoryContents from '../../src/app/story';
import Reader from '../../src/app/reader';
import { useStorage } from '../../src/storage/context';
import { createRenderFile } from '../../src/storage/files';
import { migrate } from '../../src/storage/migrations';
import { createRepository } from '../../src/storage/repository';
import { prepareContent } from '../../src/content/sanitize';
import { updateNativeStory } from '../../src/importing/native';
import { updateStory } from '../../src/importing/import-story';
import { RequestClient } from '../../src/sources/spacebattles/request';
import type { StoryMetadata } from '../../src/domain/types';
import { hostSqlite } from './host-sqlite';
import * as Crypto from 'expo-crypto';
import { importRootUrl, storyHeader } from '../fixtures/import';
import { index, indexUrl, page, row, tabs } from '../fixtures/spacebattles';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { router: { push: jest.fn(), replace: jest.fn() }, Stack: { Screen: jest.fn(() => null) },
    useLocalSearchParams: jest.fn(), useFocusEffect: (callback: () => (() => void)) => useEffect(callback, [callback]) };
});
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('../../src/storage/context', () => ({ useStorage: jest.fn() }));
jest.mock('../../src/importing/native', () => ({ updateNativeStory: jest.fn() }));
jest.mock('../../src/storage/files', () => ({ createRenderFile: jest.fn() }));
jest.mock('react-native-webview', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ onMessage }: { onMessage: (event: unknown) => void }) => <View testID="reader-web" onMessage={onMessage} /> };
});

const digest = async (value: string) => createHash('sha256').update(value).digest('hex');
const id = 'spacebattles:thread:9001';
const title = (post: string) => `Original synthetic entry ${post}`;
const metadata: StoryMetadata = { id, source: 'spacebattles', threadId: '9001',
  title: 'The Synthetic Orchard & Sea', author: 'Generated Author', sourceUrl: importRootUrl, categoryId: '9' };
const posts = ['101', '102', '103'];
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}
let folder: string;
let host: ReturnType<typeof hostSqlite>;
let repo: ReturnType<typeof createRepository>;
beforeEach(async () => {
  jest.useFakeTimers(); jest.clearAllMocks(); jest.mocked(updateNativeStory).mockReset();
  jest.spyOn(Crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');
  folder = mkdtempSync(join(tmpdir(), 'stowaway-i1-handoff-'));
  host = hostSqlite(join(folder, 'test.db')); await migrate(host.db); repo = createRepository(host.db);
  await repo.commitInitialManifest(metadata, { state: 'COMPLETE', entries: posts.map((postId) => ({ postId,
    title: title(postId), url: `https://forums.spacebattles.com/posts/${postId}/` })) });
  for (const post of posts) await repo.commitDownloadedChapter(id, post, await prepareContent(`<p>Generated saved body ${post}.</p>`, digest));
  const chapter = (await repo.getChapter(`${id}:post:101`))!;
  await repo.saveLocator({ chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[0]!,
    offset: 9, progression: .3, expandedSpoilers: [] });
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: id });
  jest.mocked(useStorage).mockReturnValue({ repository: repo, preferences: { theme: 'light', fontSize: 20 },
    changePreferences: jest.fn() } as unknown as ReturnType<typeof useStorage>);
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.mocked(createRenderFile).mockResolvedValue({ uri: 'file:///generated/index.html', readAccess: 'file:///generated/',
    directory: { exists: false, delete: jest.fn() } } as unknown as Awaited<ReturnType<typeof createRenderFile>>);
});
afterEach(async () => {
  await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); jest.restoreAllMocks(); host.close();
  const target = resolve(folder);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('stowaway-i1-handoff-')) throw new Error('Unexpected test directory.');
  rmSync(target, { recursive: true, force: true });
});

function expectNavigationBlocked() {
  expect(screen.getByLabelText('Return to Library')).toBeDisabled();
  expect(screen.getByLabelText(`Read ${title('101')}`)).toBeDisabled();
  expect(screen.getByLabelText('Cancel update')).toBeEnabled();
  expect(jest.mocked(usePreventRemove).mock.calls.at(-1)![0]).toBe(true);
  expect(jest.mocked(Stack.Screen).mock.calls.at(-1)![0].options).toMatchObject({ gestureEnabled: false });
  fireEvent.press(screen.getByLabelText('Return to Library'));
  fireEvent.press(screen.getByLabelText(`Read ${title('101')}`));
  // The removal guard deliberately discards Back/POP; it never queues a later exit.
  act(() => jest.mocked(usePreventRemove).mock.calls.at(-1)![1]({ data: { action: { type: 'POP' } } }));
  expect(router.push).not.toHaveBeenCalled(); expect(router.replace).not.toHaveBeenCalled();
}

test.each(['removal', 'rename', 'reorder', 'rollback', 'unchanged'] as const)(
  '%s: navigation waits for operation settlement and final SQL refresh, then reader uses committed state', async (kind) => {
    const originalChapter = (await repo.getChapter(`${id}:post:101`))!;
    const originalLocator = await repo.getLocator(originalChapter.id);
    const incoming = kind === 'removal' ? ['102', '103'] : kind === 'reorder' ? ['102', '101', '103'] : posts;
    const renamed = 'Reconciled generated first';
    const documents = new Map([
      [importRootUrl, page(storyHeader + tabs)],
      [indexUrl, index(incoming.map((post) => row(post).replace(title(post), kind === 'rename' && post === '101' ? renamed : title(post))).join(''), { expected: incoming.length })],
    ]);
    let time = 0;
    const client = new RequestClient(async (url) => {
      const html = documents.get(url); if (html === undefined) throw new Error('Unexpected fixture request.');
      return { status: 200, url, bodyUsed: true, headers: { get: () => null }, text: async () => html };
    }, { now: () => time, sleep: async (ms) => { time += ms; } });
    const boundary = gate(); const reached = gate(); const refresh = gate(); const refreshing = gate();
    const transaction = host.db.withExclusiveTransactionAsync.bind(host.db);
    let signal: AbortSignal | undefined;
    jest.mocked(updateNativeStory).mockImplementation((story, repository, options) => {
      signal = options?.signal;
      return updateStory(story, repository, client, digest, { ...options, now: () => 500, onProgress(progress) {
        if (progress.phase === 'reconciling') {
          jest.spyOn(host.db, 'withExclusiveTransactionAsync').mockImplementationOnce((work) => transaction(async (tx) => {
            if (kind === 'rollback') {
              await work({ ...tx, async runAsync(sql, ...params) {
                const result = await tx.runAsync(sql, ...params);
                if (sql.startsWith('UPDATE threadmark_entries')) { reached.release(); await boundary.promise; }
                return result;
              } });
            } else {
              // work includes exclusiveTransaction's FK check AND final cancellation
              // guard. Hold only its return to the driver, immediately before COMMIT.
              await work(tx); reached.release(); await boundary.promise;
            }
          }));
        }
        options?.onProgress?.(progress);
      } });
    });
    const contents = render(<StoryContents />);
    await waitFor(() => expect(screen.getByLabelText(`Read ${title('101')}`)).toBeEnabled());
    expect(jest.mocked(usePreventRemove).mock.calls.at(-1)![0]).toBe(false);
    const saved = repo.listSavedUnlisted.bind(repo);
    jest.spyOn(repo, 'listSavedUnlisted').mockImplementationOnce(async (story) => {
      refreshing.release(); await refresh.promise; return saved(story);
    });
    fireEvent.press(screen.getByLabelText('Check for Updates'));
    await act(async () => reached.promise);
    expectNavigationBlocked();
    if (kind !== 'unchanged') {
      fireEvent.press(screen.getByLabelText('Cancel update')); expect(signal?.aborted).toBe(true);
      expectNavigationBlocked();
    }
    await act(async () => { boundary.release(); await refreshing.promise; });
    // Even though the operation/COMMIT has settled, navigation stays blocked
    // while the final authoritative SQL read is unfinished.
    expectNavigationBlocked();
    await act(async () => refresh.release());
    const readerTitle = kind === 'rename' ? renamed : title('101');
    await waitFor(() => expect(screen.getByLabelText(`Read ${readerTitle}`)).toBeEnabled());
    expect(screen.getByLabelText('Return to Library')).toBeEnabled();
    expect(screen.queryByLabelText('Cancel update')).toBeNull();
    expect(jest.mocked(usePreventRemove).mock.calls.at(-1)![0]).toBe(false);
    expect(jest.mocked(Stack.Screen).mock.calls.at(-1)![0].options).toMatchObject({ gestureEnabled: true });
    if (kind === 'removal') {
      expect(screen.getByText('Saved chapters no longer listed')).toBeTruthy();
      expect(screen.getByText('2 / 2 text chapters downloaded')).toBeTruthy();
    }
    if (kind === 'rollback') {
      expect((await repo.listContents(id)).map((entry) => entry.postId)).toEqual(posts);
      expect((await repo.getStory(id))?.lastUpdateSuccessAt).toBeNull();
    }
    fireEvent.press(screen.getByLabelText(`Read ${readerTitle}`));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/reader', params: { chapter: originalChapter.id } });
    contents.unmount(); jest.mocked(useLocalSearchParams).mockReturnValue({ chapter: originalChapter.id });
    const reader = render(<Reader />);
    await waitFor(() => expect(screen.getByText(readerTitle)).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy());
    const fileArguments = jest.mocked(createRenderFile).mock.calls.at(-1)!;
    expect(fileArguments[0]).toMatchObject({ html: originalChapter.html, contentHash: originalChapter.contentHash });
    expect(fileArguments[1]).toEqual(originalLocator);
    act(() => screen.getByTestId('reader-web').props.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'ready',
      session: fileArguments[3], chapterId: originalChapter.id, contentHash: originalChapter.contentHash }) } }));
    if (kind === 'removal') {
      expect(screen.getByLabelText('Previous chapter')).toBeDisabled(); expect(screen.getByLabelText('Next chapter')).toBeDisabled();
    } else if (kind === 'reorder') {
      expect(screen.getByLabelText('Previous chapter')).toBeEnabled(); expect(screen.getByLabelText('Next chapter')).toBeEnabled();
      fireEvent.press(screen.getByLabelText('Previous chapter'));
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/reader', params: { chapter: `${id}:post:102` } }));
      reader.unmount(); render(<Reader />);
      await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy());
      const session = jest.mocked(createRenderFile).mock.calls.at(-1)![3];
      act(() => screen.getByTestId('reader-web').props.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'ready',
        session, chapterId: originalChapter.id, contentHash: originalChapter.contentHash }) } }));
      fireEvent.press(screen.getByLabelText('Next chapter'));
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/reader', params: { chapter: `${id}:post:103` } }));
      return;
    } else {
      expect(screen.getByLabelText('Previous chapter')).toBeDisabled(); expect(screen.getByLabelText('Next chapter')).toBeEnabled();
    }
    fireEvent.press(screen.getByLabelText('Return to story contents'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/story', params: { story: id } }));
  });
