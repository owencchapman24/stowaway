import { AppState, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import StoryContents from '../src/app/story';
import { useStorage } from '../src/storage/context';
import { updateNativeStory } from '../src/importing/native';
import { S1Failure } from '../src/sources/spacebattles/types';
import { Control } from '../src/reader/controls';
import type { ImportProgress, UpdateResult } from '../src/importing/import-story';
import type { StoryContentsEntry, StorySummary } from '../src/domain/types';

let mockBlur: () => void;
let mockRefocus: () => void;
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { router: { push: jest.fn(), replace: jest.fn() }, Stack: { Screen: jest.fn(() => null) }, useLocalSearchParams: jest.fn(),
    useFocusEffect: (callback: () => (() => void) | void) => useEffect(() => {
      let cleanup: (() => void) | undefined;
      mockBlur = () => cleanup?.();
      mockRefocus = () => { cleanup = callback() ?? undefined; };
      mockRefocus();
      return () => cleanup?.();
    }, [callback]) };
});
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('../src/storage/context', () => ({ useStorage: jest.fn() }));
jest.mock('../src/importing/native', () => ({ updateNativeStory: jest.fn() }));
const story: StorySummary = { id: 'spacebattles:thread:9001', source: 'spacebattles', threadId: '9001',
  title: 'Generated story A', author: null, sourceUrl: 'https://forums.spacebattles.com/threads/9001/', categoryId: '9',
  total: 2, downloaded: 2, lastUpdateAttemptAt: null, lastUpdateSuccessAt: null };
const other = { ...story, id: 'spacebattles:thread:9002', threadId: '9002', title: 'Generated story B', sourceUrl: 'https://forums.spacebattles.com/threads/9002/' };
const entry = (post: string, name: string, downloaded = true): StoryContentsEntry => ({ id: `${story.id}:post:${post}`,
  postId: post, title: name, position: 0, sourceUrl: story.sourceUrl + `#post-${post}`, downloaded });
const repository = { getStory: jest.fn(), listContents: jest.fn(), listSavedUnlisted: jest.fn() };
const run = jest.mocked(updateNativeStory);
const unchanged: UpdateResult = { story, failure: null, bodiesDownloaded: 0, reconciliation: {
  added: 0, reactivated: 0, removed: 0, renamed: 0, orderChanged: false, metadataChanged: false, total: 2, downloaded: 2, pending: 0,
} };
function setup() {
  jest.mocked(useStorage).mockReturnValue({ repository } as unknown as ReturnType<typeof useStorage>);
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: story.id });
  repository.getStory.mockImplementation(async (id) => id === other.id ? other : story);
  repository.listContents.mockResolvedValue([entry('101', 'Current first'), { ...entry('102', 'Current second'), position: 1 }]);
  repository.listSavedUnlisted.mockResolvedValue([]);
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
}
beforeAll(() => { setup(); const warm = render(<StoryContents />); warm.unmount(); });
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); run.mockReset();
  Object.values(repository).forEach((method) => method.mockReset()); setup();
});
afterEach(async () => { await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); jest.restoreAllMocks(); });

test('opening Story performs local reads only; Check for Updates deliberately starts and reports Up to date with timestamps', async () => {
  run.mockImplementation(async (_url, _repo, options) => {
    options?.onProgress?.({ phase: 'completed', storyId: story.id, downloaded: 2, total: 2 });
    repository.getStory.mockResolvedValue({ ...story, lastUpdateAttemptAt: 100, lastUpdateSuccessAt: 200 });
    return unchanged;
  });
  render(<StoryContents />);
  await waitFor(() => expect(screen.getByLabelText('Check for Updates')).toBeTruthy());
  expect(run).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Check for Updates'));
  await waitFor(() => expect(screen.getByText('Up to date.')).toBeTruthy());
  expect(run).toHaveBeenCalledTimes(1); expect(run).toHaveBeenCalledWith(story, repository, expect.objectContaining({ signal: expect.anything() }));
  expect(screen.getByText(/^Last update attempt:/)).toBeTruthy(); expect(screen.getByText(/^Last complete check:/)).toBeTruthy();
  expect(screen.queryByLabelText('Cancel update')).toBeNull();
});

test('current primary and readable saved-unlisted content render as separate groups and route to the same reader', async () => {
  repository.listContents.mockResolvedValue([entry('102', 'Current second'), { ...entry('104', 'Pending current', false), position: 1 }]);
  repository.listSavedUnlisted.mockResolvedValue([entry('101', 'Saved first')]);
  render(<StoryContents />);
  await waitFor(() => expect(screen.getByText('Saved chapters no longer listed')).toBeTruthy());
  expect(screen.getByText('Primary Threadmarks')).toBeTruthy(); expect(screen.getByText('1. Current second')).toBeTruthy();
  expect(screen.getByLabelText('Read Pending current')).toBeDisabled(); expect(screen.getByLabelText('Read Saved first')).toBeEnabled();
  fireEvent.press(screen.getByLabelText('Read Saved first'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/reader', params: { chapter: `${story.id}:post:101` } });
  expect(run).not.toHaveBeenCalled();
});

test('fixture has no Check for Updates or timestamps and empty saved section is absent', async () => {
  repository.getStory.mockResolvedValue({ ...story, source: 'fixture', id: 'fixture:thread:1001', sourceUrl: '', categoryId: null });
  render(<StoryContents />); await waitFor(() => expect(screen.getByText(story.title)).toBeTruthy());
  expect(screen.queryByLabelText('Check for Updates')).toBeNull(); expect(screen.queryByText('Saved chapters no longer listed')).toBeNull();
  expect(run).not.toHaveBeenCalled();
});

test('checking/reconciling/downloading progress is cancellable; cancelled update refreshes SQLite pending state and explicit Resume', async () => {
  let signal: AbortSignal | undefined; let finish!: (result: UpdateResult) => void; let progress!: (value: ImportProgress) => void;
  run.mockImplementation((_url, _repo, options) => {
    signal = options?.signal; progress = options!.onProgress!;
    progress({ phase: 'manifest', storyId: story.id, downloaded: 2, total: 3 });
    return new Promise((resolve) => { finish = resolve; });
  });
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Check for Updates')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Check for Updates'));
  expect(screen.getByText('Checking complete primary manifest: 3 entries discovered')).toBeTruthy();
  expect(screen.getByLabelText('Check for Updates')).toBeDisabled();
  act(() => progress({ phase: 'reconciling', storyId: story.id, downloaded: 2, total: 3 }));
  expect(screen.getByText('Reconciling complete primary manifest')).toBeTruthy();
  act(() => progress({ phase: 'downloading', storyId: story.id, downloaded: 2, total: 3, title: 'New current' }));
  expect(screen.getByText('Downloading text: 2 / 3 · New current')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Cancel update')); expect(signal?.aborted).toBe(true);
  const pending = { ...story, total: 3, downloaded: 2, lastUpdateAttemptAt: 500, lastUpdateSuccessAt: 500 };
  repository.getStory.mockResolvedValue(pending);
  repository.listContents.mockResolvedValue([entry('101', 'Current first'), entry('104', 'New current', false)]);
  await act(async () => finish({ ...unchanged, story: pending, failure: new S1Failure('cancelled', 'Generated cancellation'),
    reconciliation: { ...unchanged.reconciliation!, added: 1, total: 3, downloaded: 2, pending: 1 } }));
  expect(screen.getByText('2 / 3 text chapters downloaded')).toBeTruthy();
  expect(screen.getByText(/Complete manifest checked; 1 chapter pending/)).toBeTruthy();
  expect(screen.getByLabelText('Read New current')).toBeDisabled(); expect(screen.getByLabelText('Resume Download')).toBeEnabled();
  fireEvent.press(screen.getByLabelText('Resume Download'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/add-story', params: { story: story.id } });
});

test.each(['blocked', 'parser', 'network', 'incomplete'] as const)('typed %s result retains old contents/read actions', async (code) => {
  run.mockResolvedValue({ story, failure: new S1Failure(code, 'Generated failure'), bodiesDownloaded: 0, reconciliation: null });
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Check for Updates')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Check for Updates'));
  await waitFor(() => expect(screen.getByText(`${code}: Generated failure`)).toBeTruthy());
  expect(screen.getByText('Prior primary contents retained; no complete update committed.')).toBeTruthy();
  expect(screen.getByLabelText('Read Current first')).toBeEnabled(); expect(screen.getByText('2 / 2 text chapters downloaded')).toBeTruthy();
});

test('backgrounding/leaving aborts update; late progress/result cannot attach to another story', async () => {
  let signal: AbortSignal | undefined; let finish!: (value: UpdateResult) => void; let progress!: (value: ImportProgress) => void;
  let background!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { background = listener; return { remove: jest.fn() }; });
  run.mockImplementation((_url, _repo, options) => {
    signal = options?.signal; progress = options!.onProgress!;
    return new Promise((resolve) => { finish = resolve; });
  });
  const view = render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Check for Updates')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Check for Updates')); act(() => background('background')); expect(signal?.aborted).toBe(true);
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: other.id });
  repository.listContents.mockResolvedValue([]); view.rerender(<StoryContents />);
  await waitFor(() => expect(screen.getByText(other.title)).toBeTruthy());
  await act(async () => { progress({ phase: 'downloading', storyId: story.id, downloaded: 2, total: 3, title: 'Old operation' }); finish(unchanged); });
  expect(screen.queryByText('Up to date.')).toBeNull(); expect(screen.queryByText(/Old operation/)).toBeNull();
  expect(screen.queryByLabelText('Cancel update')).toBeNull(); expect(screen.getByLabelText('Check for Updates')).toBeEnabled();
  fireEvent.press(screen.getByLabelText('Return to Library')); expect(router.replace).toHaveBeenCalledWith('/');
});

test('delayed contents read for A cannot populate B or expose an A update action', async () => {
  let finish!: (value: StorySummary) => void;
  repository.getStory.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const view = render(<StoryContents />); expect(screen.queryByLabelText('Check for Updates')).toBeNull();
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: other.id }); view.rerender(<StoryContents />);
  await waitFor(() => expect(screen.getByText(other.title)).toBeTruthy()); await act(async () => finish(story));
  expect(screen.queryByText(story.title)).toBeNull(); run.mockResolvedValue({ ...unchanged, story: other });
  fireEvent.press(screen.getByLabelText('Check for Updates'));
  await waitFor(() => expect(run).toHaveBeenCalledWith(other, repository, expect.anything()));
});

test('blur/refocus while cancelled COMMIT finishes refreshes persistent counts without displaying the old result', async () => {
  let finish!: (value: UpdateResult) => void; let signal: AbortSignal | undefined;
  run.mockImplementation((_story, _repo, options) => { signal = options?.signal; return new Promise((resolve) => { finish = resolve; }); });
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Check for Updates')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Check for Updates'));
  act(() => mockBlur()); expect(signal?.aborted).toBe(true); act(() => mockRefocus());
  await waitFor(() => expect(screen.getByText('2 / 2 text chapters downloaded')).toBeTruthy());
  const pending = { ...story, total: 3, downloaded: 2, lastUpdateSuccessAt: 700 };
  repository.getStory.mockResolvedValue(pending);
  await act(async () => finish({ ...unchanged, story: pending, reconciliation: { ...unchanged.reconciliation!, added: 1 },
    failure: new S1Failure('cancelled', 'Old cancellation') }));
  await waitFor(() => expect(screen.getByText('2 / 3 text chapters downloaded')).toBeTruthy());
  expect(screen.getByLabelText('Resume Download')).toBeEnabled();
  expect(screen.queryByText(/Old cancellation/)).toBeNull(); expect(screen.queryByText('Up to date.')).toBeNull();
});

test('Cancel and native/back guard remain active through a delayed final read; stale route handlers cannot bypass disabled controls', async () => {
  repository.getStory.mockResolvedValue({ ...story, downloaded: 1 });
  let finish!: (value: UpdateResult) => void; let read!: (value: StoryContentsEntry[]) => void;
  run.mockImplementation((_story, _repo, options) => new Promise((resolve) => {
    finish = resolve; expect(options?.signal?.aborted).toBe(false);
  }));
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Resume Download')).toBeEnabled());
  const handler = (label: string) => screen.UNSAFE_getAllByType(Control).find((control) => control.props.label === label)!.props.onPress;
  const library = handler('Return to Library');
  const chapter = handler('Read Current first');
  const resume = handler('Resume Download');
  repository.listSavedUnlisted.mockReturnValueOnce(new Promise((resolve) => { read = resolve; }));
  fireEvent.press(screen.getByLabelText('Check for Updates'));
  act(() => { library(); chapter(); resume(); });
  expect(router.push).not.toHaveBeenCalled(); expect(router.replace).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Cancel update'));
  await act(async () => finish({ ...unchanged, failure: new S1Failure('cancelled', 'Generated cancellation') }));
  expect(screen.getByLabelText('Return to Library')).toBeDisabled();
  expect(screen.getByLabelText('Read Current first')).toBeDisabled(); expect(screen.getByLabelText('Resume Download')).toBeDisabled();
  expect(screen.getByLabelText('Cancel update')).toBeEnabled();
  expect(jest.mocked(usePreventRemove).mock.calls.at(-1)![0]).toBe(true);
  expect(jest.mocked(Stack.Screen).mock.calls.at(-1)![0].options).toMatchObject({ gestureEnabled: false });
  await act(async () => read([]));
  expect(screen.getByLabelText('Resume Download')).toBeEnabled(); expect(screen.getByLabelText('Read Current first')).toBeEnabled();
  expect(jest.mocked(usePreventRemove).mock.calls.at(-1)![0]).toBe(false);
  expect(jest.mocked(Stack.Screen).mock.calls.at(-1)![0].options).toMatchObject({ gestureEnabled: true });
  fireEvent.press(screen.getByLabelText('Return to Library')); expect(router.replace).toHaveBeenCalledWith('/');
});

test('blur/refocus superseding the final read keeps navigation blocked until an authoritative read is applied', async () => {
  let finish!: (value: UpdateResult) => void; let read!: (value: StoryContentsEntry[]) => void;
  run.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Check for Updates')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Check for Updates'));
  repository.listSavedUnlisted.mockReturnValueOnce(new Promise((resolve) => { read = resolve; }));
  await act(async () => finish(unchanged));
  act(() => mockBlur());
  let refocusRead!: (value: StoryContentsEntry[]) => void; let finalRead!: (value: StoryContentsEntry[]) => void;
  repository.listSavedUnlisted.mockReturnValueOnce(new Promise((resolve) => { refocusRead = resolve; }))
    .mockReturnValueOnce(new Promise((resolve) => { finalRead = resolve; }));
  act(() => mockRefocus());
  await act(async () => read([]));
  expect(screen.getByLabelText('Return to Library')).toBeDisabled(); expect(screen.getByLabelText('Read Current first')).toBeDisabled();
  await act(async () => { refocusRead([]); finalRead([]); });
  expect(screen.getByLabelText('Read Current first')).toBeEnabled(); expect(screen.getByLabelText('Return to Library')).toBeEnabled();
});

test('failed final SQL refresh clears stale chapter actions rather than opening a reader with old membership', async () => {
  run.mockImplementation(async () => {
    repository.listSavedUnlisted.mockRejectedValueOnce(new Error('Injected read failure'));
    return unchanged;
  });
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Read Current first')).toBeEnabled());
  fireEvent.press(screen.getByLabelText('Check for Updates'));
  await waitFor(() => expect(screen.getByText('storage: Could not read local story contents.')).toBeTruthy());
  expect(screen.queryByLabelText('Read Current first')).toBeNull(); expect(screen.queryByLabelText('Resume Download')).toBeNull();
  expect(screen.getByLabelText('Return to Library')).toBeEnabled(); expect(screen.queryByLabelText('Cancel update')).toBeNull();
});
