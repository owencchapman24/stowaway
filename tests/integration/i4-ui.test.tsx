import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, AppState } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import StoryContents from '../../src/app/story';
import Library from '../../src/app/index';
import AddStory from '../../src/app/add-story';
import { useStorage } from '../../src/storage/context';
import { manageNativeStory, cleanupNativeStoryFiles } from '../../src/storage/management-native';
import { CLEANUP_WARNING, REMOVAL_ROLLBACK } from '../../src/storage/management';
import { migrate } from '../../src/storage/migrations';
import { compileFixture, createRepository } from '../../src/storage/repository';
import { prepareContent } from '../../src/content/sanitize';
import { importNativeStory, updateNativeStory } from '../../src/importing/native';
import { downloadNativeImages } from '../../src/images/native';
import { ImportFailure, acquireStory, isStoryBusy } from '../../src/importing/ownership';
import { S1Failure } from '../../src/sources/spacebattles/types';
import { retainedPress } from '../ui-helpers';
import { hostSqlite } from './host-sqlite';
import { importStory } from '../../src/importing/import-story';
import { RequestClient } from '../../src/sources/spacebattles/request';
import { page } from '../fixtures/spacebattles';
import { bodyArticle } from '../fixtures/import';
import type { StoryMetadata } from '../../src/domain/types';

let mockBlur: () => void, mockRefocus: () => void;
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
jest.mock('../../src/storage/management-native', () => ({ manageNativeStory: jest.fn(), cleanupNativeStoryFiles: jest.fn() }));
jest.mock('../../src/importing/native', () => ({ importNativeStory: jest.fn(), updateNativeStory: jest.fn() }));
jest.mock('../../src/images/native', () => ({ downloadNativeImages: jest.fn() }));
const digest = async (value: string) => createHash('sha256').update(value).digest('hex');
const id = 'spacebattles:thread:9001', otherId = 'spacebattles:thread:9002';
const metadata: StoryMetadata = { id, source: 'spacebattles', threadId: '9001', title: 'Generated A', author: null,
  sourceUrl: 'https://forums.spacebattles.com/threads/9001/', categoryId: '9' };
const other = { ...metadata, id: otherId, threadId: '9002', title: 'Generated B', sourceUrl: 'https://forums.spacebattles.com/threads/9002/' };
const manifest = { state: 'COMPLETE' as const, entries: [{ postId: '101', title: 'First', url: 'https://forums.spacebattles.com/posts/101/' },
  { postId: '102', title: 'Pending', url: 'https://forums.spacebattles.com/posts/102/' }] };
let folder: string, host: ReturnType<typeof hostSqlite>, repo: ReturnType<typeof createRepository>;
let alert: jest.SpyInstance<ReturnType<typeof Alert.alert>, Parameters<typeof Alert.alert>>;
beforeEach(async () => {
  jest.useFakeTimers(); jest.clearAllMocks();
  for (const method of [manageNativeStory, cleanupNativeStoryFiles, updateNativeStory, importNativeStory, downloadNativeImages]) jest.mocked(method).mockReset();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  folder = mkdtempSync(join(tmpdir(), 'stowaway-i4-ui-')); host = hostSqlite(join(folder, 'test.db'));
  await migrate(host.db); repo = createRepository(host.db);
  await repo.commitInitialManifest(metadata, manifest); await repo.commitInitialManifest(other, manifest);
  await repo.commitDownloadedChapter(id, '101', await prepareContent('<p>Synthetic first.</p>', digest));
  await repo.setEntryRead(id, '101', true);
  jest.mocked(useStorage).mockReturnValue({ repository: repo, preferences: { theme: 'light', fontSize: 20 }, changePreferences: jest.fn(), imageWarning: null });
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: id });
  jest.mocked(manageNativeStory).mockImplementation((story, action, repository, onSettled) => repository.manageStory(story, action, { cleanup: async () => {}, onSettled }));
  jest.mocked(cleanupNativeStoryFiles).mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); jest.restoreAllMocks(); host.close(); const target = resolve(folder);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('stowaway-i4-ui-')) throw new Error('Unexpected test root.');
  rmSync(target, { recursive: true, force: true });
});
const downloadLabel = 'Remove downloads for Generated A', storyLabel = 'Remove story Generated A and all local state';
async function ready() { const view = render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText(downloadLabel)).toBeTruthy()); return view; }
function handler(label: string): () => void { return retainedPress(label); }
function confirmation(text: string) { const call = jest.mocked(Alert.alert).mock.calls.at(-1)!; const button = call[2]!.find((button) => button.text === text)!; expect(button).toBeTruthy(); act(() => button.onPress?.()); }
function gate() { let release!: () => void; const promise = new Promise<void>((resolve) => { release = resolve; }); return { promise, release }; }

test('opening screens is local-only; downloads cancellation retains body/read and confirms exact story + retained metadata contract', async () => {
  await ready(); expect(manageNativeStory).not.toHaveBeenCalled(); expect(updateNativeStory).not.toHaveBeenCalled(); expect(downloadNativeImages).not.toHaveBeenCalled();
  const before = await repo.getChapter(`${id}:post:101`); fireEvent.press(screen.getByLabelText(downloadLabel));
  expect(alert.mock.calls[0]![0]).toBe('Remove downloads for Generated A?'); expect(alert.mock.calls[0]![1]).toMatch(/Read\/Unread state, saved reading positions and update history/);
  expect(screen.getByLabelText('Return to Library')).toBeDisabled(); confirmation('Cancel');
  expect(manageNativeStory).not.toHaveBeenCalled(); expect(await repo.getChapter(`${id}:post:101`)).toEqual(before); expect(screen.getByLabelText(downloadLabel)).toBeEnabled();
});

test('confirmed downloads removal refreshes actual SQLite availability/counts without changing unread; duplicate confirmation/retained ordinary actions cannot run', async () => {
  await ready(); const read = handler('Read First'), update = handler('Check for Updates'), resume = handler('Resume Download'), library = handler('Return to Library'), remove = handler(downloadLabel);
  act(() => { remove(); remove(); read(); update(); resume(); library(); }); expect(alert).toHaveBeenCalledTimes(1); expect(router.push).not.toHaveBeenCalled(); expect(router.replace).not.toHaveBeenCalled();
  const confirm = alert.mock.calls[0]![2]!.find((button) => button.text === 'Remove Downloads')!.onPress!;
  act(() => { confirm(); confirm(); }); await waitFor(() => expect(screen.getByText(/^Downloads removed\./)).toBeTruthy());
  expect(manageNativeStory).toHaveBeenCalledTimes(1); expect(screen.getByText('0 of 2 downloaded · 1 unread')).toBeTruthy(); expect(screen.getByText(/· 1 unread$/)).toBeTruthy();
  expect(screen.getByLabelText('Read First')).toBeDisabled(); expect(screen.getByLabelText('Mark First as unread')).toBeEnabled(); expect(screen.getByLabelText('Resume Download')).toBeEnabled();
  expect(updateNativeStory).not.toHaveBeenCalled(); expect(importNativeStory).not.toHaveBeenCalled(); expect(downloadNativeImages).not.toHaveBeenCalled();
});

test.each(['first', 'second'] as const)('full story removal cancel at %s confirmation preserves all local state', async (stage) => {
  await ready(); fireEvent.press(screen.getByLabelText(storyLabel));
  expect(alert.mock.calls[0]![1]).toMatch(/all of its Stowaway data/); expect(manageNativeStory).not.toHaveBeenCalled();
  if (stage === 'second') { confirmation('Continue'); expect(alert.mock.calls.at(-1)![0]).toBe('Confirm removal of Generated A'); }
  confirmation('Cancel'); expect(manageNativeStory).not.toHaveBeenCalled(); expect(await repo.getStory(id)).not.toBeNull(); expect(await repo.getChapter(`${id}:post:101`)).not.toBeNull();
});

test('full story removal requires second destructive confirmation, clears route/actions; stale route stays missing and Library contains only other story', async () => {
  const view = await ready(); fireEvent.press(screen.getByLabelText(storyLabel)); confirmation('Continue');
  expect(manageNativeStory).not.toHaveBeenCalled(); expect(alert.mock.calls.at(-1)![2]!.find((button) => button.text === 'Remove Story')!.style).toBe('destructive');
  confirmation('Remove Story'); await waitFor(() => expect(screen.getByText(/^Story removed from this device/)).toBeTruthy());
  expect(screen.queryByLabelText('Check for Updates')).toBeNull(); expect(screen.queryByLabelText('Resume Download')).toBeNull(); expect(screen.queryByLabelText(storyLabel)).toBeNull();
  view.unmount(); const stale = render(<StoryContents />); await waitFor(() => expect(screen.getByText('Story is not in the local library.')).toBeTruthy()); expect(await repo.getStory(id)).toBeNull(); stale.unmount();
  render(<Library />); await waitFor(() => expect(screen.getByLabelText('Open Generated B')).toBeTruthy()); expect(screen.queryByLabelText('Open Generated A')).toBeNull();
});

test.each(['downloads', 'story'] as const)('%s rollback error is distinct from successful DB deletion + cleanup warning', async (action) => {
  await ready(); host.failNextCommit(); fireEvent.press(screen.getByLabelText(action === 'downloads' ? downloadLabel : storyLabel));
  if (action === 'story') confirmation('Continue'); confirmation(action === 'downloads' ? 'Remove Downloads' : 'Remove Story');
  await waitFor(() => expect(screen.getByText(REMOVAL_ROLLBACK)).toBeTruthy()); expect(await repo.getChapter(`${id}:post:101`)).not.toBeNull(); expect(screen.queryByText(CLEANUP_WARNING)).toBeNull();
});

test.each(['downloads', 'story'] as const)('%s cleanup warning reports logical success; explicit local retry makes zero source requests and does not resurrect story', async (action) => {
  jest.mocked(manageNativeStory).mockImplementation((story, kind, repository, onSettled) => repository.manageStory(story, kind, { cleanup: async () => { throw new Error('Injected cleanup failure'); }, onSettled }));
  await ready(); fireEvent.press(screen.getByLabelText(action === 'downloads' ? downloadLabel : storyLabel)); if (action === 'story') confirmation('Continue'); confirmation(action === 'downloads' ? 'Remove Downloads' : 'Remove Story');
  await waitFor(() => expect(screen.getByText(CLEANUP_WARNING)).toBeTruthy()); expect(screen.queryByText(REMOVAL_ROLLBACK)).toBeNull(); expect(await repo.getChapter(`${id}:post:101`)).toBeNull();
  fireEvent.press(screen.getByLabelText('Retry local cleanup')); await waitFor(() => expect(screen.queryByText(CLEANUP_WARNING)).toBeNull());
  expect(cleanupNativeStoryFiles).toHaveBeenCalledWith(id, repo); expect(!!await repo.getStory(id)).toBe(action === 'downloads');
  expect(updateNativeStory).not.toHaveBeenCalled(); expect(importNativeStory).not.toHaveBeenCalled(); expect(downloadNativeImages).not.toHaveBeenCalled();
});

test('management blocks navigation through actual commit settlement and final authoritative refresh, including blur/refocus', async () => {
  await ready(); const commit = gate(), entered = gate(), reading = gate(), refreshStarted = gate();
  const transaction = host.db.withExclusiveTransactionAsync;
  host.db.withExclusiveTransactionAsync = (work) => transaction(async (tx) => { await work(tx); entered.release(); await commit.promise; });
  const get = repo.getStory;
  fireEvent.press(screen.getByLabelText(downloadLabel)); confirmation('Remove Downloads'); await entered.promise;
  expect(screen.getByLabelText('Return to Library')).toBeDisabled(); act(() => { handler('Return to Library')(); mockBlur(); mockRefocus(); });
  await act(async () => { await Promise.resolve(); });
  const spy = jest.spyOn(repo, 'getStory').mockImplementation(async (key) => { refreshStarted.release(); await reading.promise; return get(key); });
  await act(async () => commit.release()); await refreshStarted.promise;
  expect(screen.getByLabelText('Return to Library')).toBeDisabled(); expect(jest.mocked(usePreventRemove).mock.calls.at(-1)![0]).toBe(true);
  await expect(repo.manageStory(metadata, 'story', { cleanup: async () => {} })).rejects.toMatchObject({ code: 'busy' });
  act(() => { handler('Return to Library')(); handler('Resume Download')(); }); expect(router.push).not.toHaveBeenCalled(); expect(router.replace).not.toHaveBeenCalled();
  await act(async () => reading.release()); await waitFor(() => expect(screen.getByLabelText('Return to Library')).toBeEnabled()); expect(screen.getByText('0 of 2 downloaded · 1 unread')).toBeTruthy(); spy.mockRestore();
});

test.each(['update', 'images', 'read'] as const)('%s operations block retained destructive handlers until authoritative refresh', async (kind) => {
  await ready(); const remove = handler(downloadLabel), held = gate();
  if (kind === 'read') {
    const write = repo.setEntryRead; jest.spyOn(repo, 'setEntryRead').mockImplementation(async (...args) => { await held.promise; return write(...args); });
    fireEvent.press(screen.getByLabelText('Mark First as unread'));
  } else if (kind === 'update') {
    jest.mocked(updateNativeStory).mockImplementation(async () => { await held.promise; return { story: await repo.getStory(id), failure: null, reconciliation: null, bodiesDownloaded: 0 }; }); fireEvent.press(screen.getByLabelText('Check for Updates'));
  } else {
    jest.mocked(downloadNativeImages).mockImplementation(async () => { await held.promise; return { storyId: id, failure: null, summary: await repo.getImageSummary(id) }; });
    // Existing downloaded text has unknown discovery, so the explicit image action is present.
    fireEvent.press(screen.getByLabelText('Download Images'));
  }
  expect(screen.getByLabelText(downloadLabel)).toBeDisabled(); act(remove); expect(alert).not.toHaveBeenCalled();
  await act(async () => held.release()); await waitFor(() => expect(screen.getByLabelText(downloadLabel)).toBeEnabled());
});

test('stale handler and pending confirmation from A cannot remove A or B after route changes, at either confirmation stage', async () => {
  const view = await ready(); const remove = handler(storyLabel); act(remove); confirmation('Continue');
  const final = alert.mock.calls.at(-1)![2]!.find((button) => button.text === 'Remove Story')!.onPress!;
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: otherId }); view.rerender(<StoryContents />);
  await waitFor(() => expect(screen.getByLabelText('Remove downloads for Generated B')).toBeTruthy()); act(() => { remove(); final(); });
  expect(manageNativeStory).not.toHaveBeenCalled(); expect(await repo.getStory(id)).not.toBeNull(); expect(await repo.getStory(otherId)).not.toBeNull();
});

test('fixture exposes no production destructive controls; absent story route cannot resurrect it', async () => {
  await repo.seed(await compileFixture(digest), { relativePath: '', byteLength: 0 }); jest.mocked(useLocalSearchParams).mockReturnValue({ story: 'fixture:thread:1001' });
  const view = render(<StoryContents />); await waitFor(() => expect(screen.getByText('The Lantern Cartographer')).toBeTruthy()); expect(screen.queryByText('Manage this story')).toBeNull();
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: 'spacebattles:thread:9999' }); view.rerender(<StoryContents />); await waitFor(() => expect(screen.getByText('Story is not in the local library.')).toBeTruthy()); expect(screen.queryByText('Manage this story')).toBeNull(); expect(manageNativeStory).not.toHaveBeenCalled();
});

const failureCases = [
  ['blocked', /Source access blocked/], ['challenge', /Source access blocked/], ['incomplete', /Incomplete primary index/],
  ['parser', /could not be parsed safely/], ['network', /Network request failed/], ['storage', /Local storage failed/],
] as const;
test.each(failureCases)('Contents presents typed %s failure with an actionable category and retained state', async (code, explanation) => {
  const failure = code === 'storage' ? new ImportFailure('storage', 'Synthetic local failure') : new S1Failure(code, 'Synthetic source failure');
  jest.mocked(updateNativeStory).mockResolvedValue({ story: await repo.getStory(id), failure, reconciliation: null, bodiesDownloaded: 0 });
  await ready(); fireEvent.press(screen.getByLabelText('Check for Updates')); await waitFor(() => expect(screen.getByText(explanation)).toBeTruthy());
  expect(screen.queryByText('Up to date.')).toBeNull(); expect(screen.getByText('1 of 2 downloaded · 1 unread')).toBeTruthy(); expect(screen.getByLabelText('Read First')).toBeEnabled();
});

test.each(failureCases)('Add Story presents typed %s failure without claiming an empty/successful story', async (code, explanation) => {
  const failure = code === 'storage' ? new ImportFailure('storage', 'Synthetic local failure') : new S1Failure(code, 'Synthetic source failure');
  jest.mocked(importNativeStory).mockResolvedValue({ story: null, failure }); jest.mocked(useLocalSearchParams).mockReturnValue({});
  render(<AddStory />); fireEvent.changeText(screen.getByLabelText('Public SpaceBattles thread URL'), metadata.sourceUrl); fireEvent.press(screen.getByLabelText('Import story'));
  await waitFor(() => expect(screen.getByText(explanation)).toBeTruthy()); expect(screen.queryByText('All primary text downloaded.')).toBeNull();
});

test('busy repository refusal is local and leaves downloads usable', async () => {
  await ready(); fireEvent.press(screen.getByLabelText(downloadLabel)); let release!: () => void; act(() => { release = acquireStory(id); });
  try {
    confirmation('Remove Downloads'); await waitFor(() => expect(screen.getByText(/already has an import, update/)).toBeTruthy());
    expect(await repo.getChapter(`${id}:post:101`)).not.toBeNull();
  } finally { await act(async () => release()); }
});

test('operation owned by another handle disables management/navigation/read controls and retained handlers without blocking another story', async () => {
  const view = await ready(); const remove = handler(downloadLabel), navigate = handler('Return to Library');
  let release!: () => void;
  act(() => { release = acquireStory(id); });
  expect(screen.getByLabelText(downloadLabel)).toBeDisabled(); expect(screen.getByLabelText(storyLabel)).toBeDisabled();
  expect(screen.getByLabelText('Mark First as unread')).toBeDisabled(); expect(screen.getByLabelText('Return to Library')).toBeDisabled();
  act(() => { remove(); navigate(); }); expect(alert).not.toHaveBeenCalled(); expect(router.replace).not.toHaveBeenCalled();
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: otherId }); view.rerender(<StoryContents />);
  await waitFor(() => expect(screen.getByLabelText('Remove downloads for Generated B')).toBeEnabled()); await act(async () => release());
});

test.each(['downloads', 'story'] as const)('UI D4: %s COMMIT-then-reject presents the authoritative removed state', async (action) => {
  await ready(); const transaction = host.db.withExclusiveTransactionAsync;
  host.db.withExclusiveTransactionAsync = async (work) => { await transaction(work); throw new Error('Driver closed after commit'); };
  fireEvent.press(screen.getByLabelText(action === 'downloads' ? downloadLabel : storyLabel));
  if (action === 'story') confirmation('Continue'); confirmation(action === 'downloads' ? 'Remove Downloads' : 'Remove Story');
  await waitFor(() => expect(screen.getByText(action === 'downloads' ? /^Downloads removed\./ : /^Story removed from this device/)).toBeTruthy());
  expect(screen.queryByText(REMOVAL_ROLLBACK)).toBeNull(); expect(await repo.getChapter(id + ':post:101')).toBeNull();
  if (action === 'downloads') { expect(screen.getByLabelText('Resume Download')).toBeEnabled(); expect(screen.getByLabelText('Read First')).toBeDisabled(); }
  else expect(screen.queryByLabelText('Read First')).toBeNull();
});

test('UI D1: held real Resume COMMIT refreshes focused foreign Contents before restoring controls', async () => {
  await repo.manageStory(metadata, 'downloads', { cleanup: async () => {} });
  const transaction = host.db.withExclusiveTransactionAsync, commit = gate(), entered = gate(), refreshed = gate(), finishRead = gate();
  host.db.withExclusiveTransactionAsync = (work) => transaction(async (tx) => { await work(tx); entered.release(); await commit.promise; });
  let time = 0;
  const client = new RequestClient(async (url) => ({ url, status: 200, bodyUsed: true,
    headers: { get: () => 'text/html' }, text: async () => page(bodyArticle('101', '<p>Synthetic resumed body.</p>')) }),
    { now: () => time, sleep: async (ms) => { time += ms; } });
  let importDone!: Promise<Awaited<ReturnType<typeof importStory>>>;
  jest.mocked(importNativeStory).mockImplementation((url, repository, options) => { importDone = importStory(url, repository, client, digest, options); return importDone; });
  const adding = render(<AddStory />); await waitFor(() => expect(screen.getByLabelText('Resume Download')).toBeEnabled());
  await act(async () => { fireEvent.press(screen.getByLabelText('Resume Download')); await entered.promise; });
  adding.unmount(); // Requests cancellation, but this transaction has passed its final guard.
  await ready(); expect(screen.getByLabelText('Read First')).toBeDisabled();
  const oldRead = handler('Read First'), oldResume = handler('Resume Download'), get = repo.getStory;
  jest.spyOn(repo, 'getStory').mockImplementation(async (key) => {
    if (key === id && !isStoryBusy(id)) { refreshed.release(); await finishRead.promise; }
    return get(key);
  });
  await act(async () => commit.release()); await refreshed.promise;
  expect(screen.getByLabelText('Read First')).toBeDisabled(); expect(screen.getByLabelText('Resume Download')).toBeDisabled();
  act(() => { oldRead(); oldResume(); }); expect(router.push).not.toHaveBeenCalled();
  await act(async () => { finishRead.release(); await importDone; });
  await waitFor(() => expect(screen.getByLabelText('Read First')).toBeEnabled());
  expect(screen.getByText('1 of 2 downloaded · 1 unread')).toBeTruthy();
  expect(screen.getByLabelText('Read Pending')).toBeDisabled(); expect(screen.getByLabelText('Resume Download')).toBeEnabled();
});

test('UI D2: Contents prefers first unread readable, then first readable; a saved locator overrides Start', async () => {
  const view = await ready();
  expect(screen.getByLabelText('Start Reading')).toBeEnabled(); fireEvent.press(screen.getByLabelText('Start Reading'));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/reader', params: { chapter: id + ':post:101' } });
  await act(async () => { await repo.commitDownloadedChapter(id, '102', await prepareContent('<p>Second local chapter.</p>', digest)); mockBlur(); mockRefocus(); });
  await waitFor(() => expect(screen.getByLabelText('Read Pending')).toBeEnabled());
  fireEvent.press(screen.getByLabelText('Start Reading')); expect(router.push).toHaveBeenLastCalledWith({ pathname: '/reader', params: { chapter: id + ':post:102' } });
  const chapter = (await repo.getChapter(id + ':post:101'))!;
  await act(async () => { await repo.saveLocator({ chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[0]!, offset: 4, progression: .2, expandedSpoilers: [] }); mockBlur(); mockRefocus(); });
  await waitFor(() => expect(screen.getByLabelText('Continue Reading')).toBeEnabled()); expect(screen.queryByLabelText('Start Reading')).toBeNull();
  fireEvent.press(screen.getByLabelText('Continue Reading')); expect(router.push).toHaveBeenLastCalledWith({ pathname: '/reader', params: { chapter: chapter.id } });
  await act(async () => { await repo.reconcileManifest(id, metadata, { ...manifest, entries: [manifest.entries[1]!] }, 100); mockBlur(); mockRefocus(); });
  await waitFor(() => expect(screen.getByText('Saved chapter no longer listed')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Continue Reading')); expect(router.push).toHaveBeenLastCalledWith({ pathname: '/reader', params: { chapter: chapter.id } });
  view.unmount();
});

test('UI D2: Library Continue disappears after downloads removal and returns with retained locator after redownload', async () => {
  const chapter = (await repo.getChapter(id + ':post:101'))!;
  await repo.saveLocator({ chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[0]!, offset: 8, progression: .4, expandedSpoilers: [] });
  const library = render(<Library />); await waitFor(() => expect(screen.getByLabelText('Continue Reading: Generated A, First')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Continue Reading: Generated A, First'));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/reader', params: { chapter: chapter.id } });
  await act(async () => { await repo.manageStory(metadata, 'downloads', { cleanup: async () => {} }); mockBlur(); mockRefocus(); });
  await waitFor(() => expect(screen.queryByLabelText('Continue Reading: Generated A, First')).toBeNull());
  await act(async () => { await repo.commitDownloadedChapter(id, '101', chapter); mockBlur(); mockRefocus(); });
  await waitFor(() => expect(screen.getByLabelText('Continue Reading: Generated A, First')).toBeTruthy());
  await act(async () => { await repo.manageStory(metadata, 'story', { cleanup: async () => {} }); mockBlur(); mockRefocus(); });
  await waitFor(() => expect(screen.queryByLabelText('Open Generated A')).toBeNull());
  expect(screen.queryByLabelText('Continue Reading: Generated A, First')).toBeNull(); library.unmount();
});
