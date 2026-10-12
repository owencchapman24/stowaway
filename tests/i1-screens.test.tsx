import { AppState, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import StoryContents from '../src/app/story';
import { useStorage } from '../src/storage/context';
import { updateNativeStory } from '../src/importing/native';
import { S1Failure } from '../src/sources/spacebattles/types';
import { retainedPress } from './ui-helpers';
import type { ImportProgress, UpdateResult } from '../src/importing/import-story';
import type { StoryContentsEntry, StorySummary } from '../src/domain/types';
import { downloadNativeImages } from '../src/images/native';
import type { ImageResult } from '../src/images/download';
import type { ImageSummary } from '../src/images/types';

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
jest.mock('../src/config/build-audience', () => ({ BUILD_AUDIENCE: 'internal-personal' }));
jest.mock('../src/importing/native', () => ({ updateNativeStory: jest.fn() }));
jest.mock('../src/images/native', () => ({ downloadNativeImages: jest.fn() }));
const story: StorySummary = { id: 'spacebattles:thread:9001', source: 'spacebattles', threadId: '9001',
  title: 'Generated story A', author: null, sourceUrl: 'https://forums.spacebattles.com/threads/9001/', categoryId: '9',
  total: 2, downloaded: 2, unread: 2, lastUpdateAttemptAt: null, lastUpdateSuccessAt: null };
const other = { ...story, id: 'spacebattles:thread:9002', threadId: '9002', title: 'Generated story B', sourceUrl: 'https://forums.spacebattles.com/threads/9002/' };
const entry = (post: string, name: string, downloaded = true): StoryContentsEntry => ({ id: `${story.id}:post:${post}`,
  postId: post, title: name, position: 0, sourceUrl: story.sourceUrl + `#post-${post}`, downloaded, isRead: false });
const repository = { getContinueReading: jest.fn(async () => null), getStory: jest.fn(), listContents: jest.fn(), listSavedUnlisted: jest.fn(), getImageSummary: jest.fn() };
const run = jest.mocked(updateNativeStory);
const imageRun = jest.mocked(downloadNativeImages);
const unchanged: UpdateResult = { story, failure: null, bodiesDownloaded: 0, reconciliation: {
  added: 0, reactivated: 0, removed: 0, renamed: 0, orderChanged: false, metadataChanged: false, total: 2, downloaded: 2, pending: 0,
} };
function setup() {
  repository.getContinueReading.mockResolvedValue(null);
  jest.mocked(useStorage).mockReturnValue({ repository } as unknown as ReturnType<typeof useStorage>);
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: story.id });
  repository.getStory.mockImplementation(async (id) => id === other.id ? other : story);
  repository.listContents.mockResolvedValue([entry('101', 'Current first'), { ...entry('102', 'Current second'), position: 1 }]);
  repository.listSavedUnlisted.mockResolvedValue([]);
  repository.getImageSummary.mockResolvedValue({ unknown: 0, mismatch: 0, scanned: 2, local: 0, pending: 0, omitted: 0 });
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
}
beforeAll(() => { setup(); const warm = render(<StoryContents />); warm.unmount(); });
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); run.mockReset(); imageRun.mockReset();
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
  expect(screen.getByText('Chapters')).toBeTruthy(); expect(within(screen.getByLabelText('Read Current second')).getByText('Current second')).toBeTruthy();
  expect(screen.getByLabelText('Read Current second').props.accessibilityValue.text).toMatch(/^Chapter 1\./);
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
  expect(screen.getByText('Reading primary Threadmarks · 3 found')).toBeTruthy();
  expect(screen.getByLabelText('Check for Updates')).toBeDisabled();
  act(() => progress({ phase: 'reconciling', storyId: story.id, downloaded: 2, total: 3 }));
  expect(screen.getByText('Saving story contents')).toBeTruthy();
  act(() => progress({ phase: 'downloading', storyId: story.id, downloaded: 2, total: 3, title: 'New current' }));
  expect(screen.getByText('2 of 3 chapters downloaded · New current')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Cancel update')); expect(signal?.aborted).toBe(true);
  const pending = { ...story, total: 3, downloaded: 2, lastUpdateAttemptAt: 500, lastUpdateSuccessAt: 500 };
  repository.getStory.mockResolvedValue(pending);
  repository.listContents.mockResolvedValue([entry('101', 'Current first'), entry('104', 'New current', false)]);
  await act(async () => finish({ ...unchanged, story: pending, failure: new S1Failure('cancelled', 'Generated cancellation'),
    reconciliation: { ...unchanged.reconciliation!, added: 1, total: 3, downloaded: 2, pending: 1 } }));
  expect(screen.getByText('2 of 3 downloaded · 2 unread')).toBeTruthy();
  expect(screen.getByText(/Contents checked; 1 chapter pending/)).toBeTruthy();
  expect(screen.getByLabelText('Read New current')).toBeDisabled(); expect(screen.getByLabelText('Resume Download')).toBeEnabled();
  fireEvent.press(screen.getByLabelText('Resume Download'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/add-story', params: { story: story.id } });
});

test.each(['blocked', 'parser', 'network', 'incomplete'] as const)('typed %s result retains old contents/read actions', async (code) => {
  run.mockResolvedValue({ story, failure: new S1Failure(code, 'Generated failure'), bodiesDownloaded: 0, reconciliation: null });
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Check for Updates')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Check for Updates'));
  await waitFor(() => expect(screen.getByText(`${code}: Generated failure`)).toBeTruthy());
  expect(screen.getByText('Previous primary contents kept; no complete update committed.')).toBeTruthy();
  expect(screen.getByLabelText('Read Current first')).toBeEnabled(); expect(screen.getByText('2 chapters · 2 unread')).toBeTruthy();
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
  await waitFor(() => expect(screen.getByText('2 chapters · 2 unread')).toBeTruthy());
  const pending = { ...story, total: 3, downloaded: 2, lastUpdateSuccessAt: 700 };
  repository.getStory.mockResolvedValue(pending);
  await act(async () => finish({ ...unchanged, story: pending, reconciliation: { ...unchanged.reconciliation!, added: 1 },
    failure: new S1Failure('cancelled', 'Old cancellation') }));
  await waitFor(() => expect(screen.getByText('2 of 3 downloaded · 2 unread')).toBeTruthy());
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
  const handler = (label: string) => retainedPress(label);
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

const unknownImages: ImageSummary = { unknown: 2, scanned: 0, mismatch: 0, local: 0, pending: 0, omitted: 0 };
test('I2 opening Story starts zero image traffic; deliberate Download Images refreshes separate SQLite status/text counts', async () => {
  repository.getImageSummary.mockResolvedValue(unknownImages);
  const local = { ...unknownImages, unknown: 0, scanned: 2, local: 8, omitted: 2, pending: 1 };
  imageRun.mockImplementation(async (_id, _repo, options) => {
    options?.onProgress?.({ phase: 'discovering', title: 'Current first', completed: 0, total: 0 });
    options?.onProgress?.({ phase: 'completed', completed: 0, total: 0 });
    repository.getImageSummary.mockResolvedValue(local);
    return { storyId: story.id, summary: local, failure: null };
  });
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Download Images')).toBeEnabled());
  expect(imageRun).not.toHaveBeenCalled(); expect(run).not.toHaveBeenCalled();
  expect(screen.getByText('Images: 2 text chapters not scanned')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Download Images'));
  await waitFor(() => expect(screen.getByText('Images: 8 local · 2 omitted · 1 pending')).toBeTruthy());
  expect(screen.getByText('2 chapters · 2 unread')).toBeTruthy();
  expect(imageRun).toHaveBeenCalledWith(story.id, repository, expect.objectContaining({ signal: expect.anything() }));
  expect(screen.getByLabelText('Retry Images')).toBeEnabled(); expect(screen.getByLabelText('Read Current first')).toBeEnabled();
});
test('I2 fixture has no source-image action even with unexpected source summary rows', async () => {
  repository.getStory.mockResolvedValue({ ...story, source: 'fixture' }); repository.getImageSummary.mockResolvedValue(unknownImages);
  render(<StoryContents />); await waitFor(() => expect(screen.getByText(story.title)).toBeTruthy());
  expect(screen.queryByLabelText('Download Images')).toBeNull(); expect(screen.queryByLabelText('Retry Images')).toBeNull(); expect(imageRun).not.toHaveBeenCalled();
});

test('I2 all-omitted MIME failures expose deliberate Retry Images and bounded dev MIME/format metadata', async () => {
  repository.getImageSummary.mockResolvedValue({ ...unknownImages, unknown: 0, scanned: 2, omitted: 58, mimeRetryable: 8 });
  const local = { ...unknownImages, unknown: 0, scanned: 2, local: 8, omitted: 50, mimeRetryable: 0 };
  imageRun.mockImplementation(async () => {
    repository.getImageSummary.mockResolvedValue(local);
    return { storyId: story.id, summary: local, failure: null, mimeDiagnostics: [{ chapterId: entry('101', '').id, slot: 50, receivedMime: 'image/jpg', detectedFormat: 'png', accepted: true }] };
  });
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Retry Images')).toBeEnabled());
  expect(imageRun).not.toHaveBeenCalled(); expect(screen.getByText(/8 previously rejected images can be retried/)).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Retry Images'));
  await waitFor(() => expect(screen.getByText('Images: 8 local · 50 omitted · 0 pending')).toBeTruthy());
  expect(screen.getByText(/Image MIME \(dev\):.*slot 51.*received image\/jpg.*detected png.*validated/)).toBeTruthy();
  expect(screen.getByText('2 chapters · 2 unread')).toBeTruthy();
});
test('I2 MIME metadata is hidden outside development mode', async () => {
  const dev = __DEV__; Reflect.set(global, '__DEV__', false);
  try {
    repository.getImageSummary.mockResolvedValue(unknownImages);
    imageRun.mockResolvedValue({ storyId: story.id, summary: unknownImages, failure: null,
      mimeDiagnostics: [{ chapterId: entry('101', '').id, slot: 0, receivedMime: 'text/html', detectedFormat: 'png', accepted: false }] });
    render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Download Images')).toBeEnabled());
    fireEvent.press(screen.getByLabelText('Download Images')); await waitFor(() => expect(imageRun).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByLabelText('Cancel images')).toBeNull());
    expect(screen.queryByText(/Image MIME \(dev\)/)).toBeNull();
  } finally { Reflect.set(global, '__DEV__', dev); }
});
test.each([
  [{ ...unknownImages, unknown: 0, scanned: 2 }, 'Images: no source images'],
  [{ ...unknownImages, unknown: 0, scanned: 2, omitted: 3 }, 'Images: 0 local · 3 omitted · 0 pending'],
  [{ ...unknownImages, unknown: 0, mismatch: 2 }, 'Images: 2 chapters unavailable: saved text differs'],
])('I2 permanent/zero results are explicit without a false all-images-downloaded claim', async (summary, text) => {
  repository.getImageSummary.mockResolvedValue(summary); render(<StoryContents />);
  await waitFor(() => expect(screen.getByText(text)).toBeTruthy());
  expect(screen.queryByLabelText('Download Images')).toBeNull(); expect(screen.queryByLabelText('Retry Images')).toBeNull();
});
test('I2 Cancel, Read/Library/Resume/native removal guards persist through image settlement and final SQL refresh', async () => {
  repository.getImageSummary.mockResolvedValue(unknownImages); repository.getStory.mockResolvedValue({ ...story, downloaded: 1 });
  let finish!: (result: ImageResult) => void, read!: (value: ImageSummary) => void, signal: AbortSignal | undefined;
  imageRun.mockImplementation((_id, _repo, options) => {
    signal = options?.signal; options?.onProgress?.({ phase: 'downloading', title: 'Current first', slot: 2, completed: 1, total: 4 });
    return new Promise((resolve) => { finish = resolve; });
  });
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Download Images')).toBeEnabled());
  const handlers = ['Return to Library', 'Read Current first', 'Resume Download'].map((label) => retainedPress(label));
  fireEvent.press(screen.getByLabelText('Download Images'));
  expect(screen.getByText('1 of 4 images processed · Current first')).toBeTruthy();
  for (const label of ['Read Current first', 'Return to Library', 'Resume Download', 'Check for Updates', 'Download Images']) expect(screen.getByLabelText(label)).toBeDisabled();
  act(() => handlers.forEach((handler) => handler())); expect(router.push).not.toHaveBeenCalled(); expect(router.replace).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Cancel images')); expect(signal?.aborted).toBe(true);
  repository.getImageSummary.mockReturnValueOnce(new Promise((resolve) => { read = resolve; }));
  await act(async () => finish({ storyId: story.id, summary: unknownImages, failure: new S1Failure('cancelled', 'Generated image cancellation') }));
  expect(screen.getByLabelText('Cancel images')).toBeEnabled(); expect(screen.getByLabelText('Read Current first')).toBeDisabled();
  expect(jest.mocked(usePreventRemove).mock.calls.at(-1)![0]).toBe(true);
  expect(jest.mocked(Stack.Screen).mock.calls.at(-1)![0].options).toMatchObject({ gestureEnabled: false });
  await act(async () => read({ ...unknownImages, unknown: 0, scanned: 2, local: 1, pending: 3 }));
  expect(screen.getByLabelText('Retry Images')).toBeEnabled(); expect(screen.getByLabelText('Read Current first')).toBeEnabled();
  expect(jest.mocked(usePreventRemove).mock.calls.at(-1)![0]).toBe(false); expect(screen.queryByLabelText('Cancel images')).toBeNull();
});
test('I2 background/route change aborts image work and rejects old progress/result', async () => {
  repository.getImageSummary.mockResolvedValue(unknownImages);
  let finish!: (result: ImageResult) => void, signal: AbortSignal | undefined;
  let progress!: NonNullable<Parameters<typeof downloadNativeImages>[2]>['onProgress'];
  let background!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { background = listener; return { remove: jest.fn() }; });
  imageRun.mockImplementation((_id, _repo, options) => { signal = options?.signal; progress = options?.onProgress; return new Promise((resolve) => { finish = resolve; }); });
  const view = render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Download Images')).toBeEnabled());
  fireEvent.press(screen.getByLabelText('Download Images')); act(() => background('background')); expect(signal?.aborted).toBe(true);
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: other.id }); view.rerender(<StoryContents />);
  await waitFor(() => expect(screen.getByText(other.title)).toBeTruthy());
  await act(async () => { progress?.({ phase: 'discovering', title: 'Old image chapter', completed: 0, total: 0 }); finish({ storyId: story.id, summary: unknownImages, failure: null }); });
  expect(screen.queryByText(/Old image chapter/)).toBeNull(); expect(screen.queryByLabelText('Cancel images')).toBeNull();
});
test('I2 failed final image refresh clears stale chapter/image controls before navigation unlocks', async () => {
  repository.getImageSummary.mockResolvedValue(unknownImages);
  imageRun.mockImplementation(async () => { repository.getImageSummary.mockRejectedValueOnce(new Error('Injected image read failure')); return { storyId: story.id, summary: unknownImages, failure: null }; });
  render(<StoryContents />); await waitFor(() => expect(screen.getByLabelText('Download Images')).toBeEnabled());
  fireEvent.press(screen.getByLabelText('Download Images'));
  await waitFor(() => expect(screen.getByText('storage: Could not read local story contents.')).toBeTruthy());
  expect(screen.queryByLabelText('Read Current first')).toBeNull(); expect(screen.queryByLabelText('Download Images')).toBeNull(); expect(screen.getByLabelText('Return to Library')).toBeEnabled();
});
