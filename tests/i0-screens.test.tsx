import { AppState, Linking, type AppStateStatus } from 'react-native';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Library from '../src/app/index';
import AddStory from '../src/app/add-story';
import StoryContents from '../src/app/story';
import Reader from '../src/app/reader';
import { useStorage } from '../src/storage/context';
import { importNativeStory } from '../src/importing/native';
import { S1Failure } from '../src/sources/spacebattles/types';
import type { ChapterReaderProps } from '../src/reader/ChapterReader';
import type { StorySummary } from '../src/domain/types';
import { threadUrl } from './fixtures/spacebattles';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { router: { push: jest.fn(), replace: jest.fn() }, Stack: { Screen: () => null },
    useLocalSearchParams: jest.fn(), useFocusEffect: (callback: () => void) => useEffect(callback, [callback]) };
});
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('../src/storage/context', () => ({ useStorage: jest.fn() }));
jest.mock('../src/importing/native', () => ({ importNativeStory: jest.fn() }));
let mockReaderProps: ChapterReaderProps;
jest.mock('../src/reader/ChapterReader', () => ({ ChapterReader: (props: ChapterReaderProps) => { mockReaderProps = props; return null; } }));
const fixture: StorySummary = { id: 'fixture:thread:1001', source: 'fixture', threadId: '1001', title: 'The Lantern Cartographer',
  author: 'Synthetic author', sourceUrl: '', categoryId: null, total: 3, downloaded: 3, unread: 3, lastUpdateAttemptAt: null, lastUpdateSuccessAt: null };
const story: StorySummary = { id: 'spacebattles:thread:9001', source: 'spacebattles', threadId: '9001', title: 'Synthetic import',
  author: null, sourceUrl: threadUrl, categoryId: '9', total: 3, downloaded: 1, unread: 3, lastUpdateAttemptAt: null, lastUpdateSuccessAt: null };
const entries = [
  { id: story.id + ':post:101', postId: '101', title: 'First', position: 0, downloaded: true, isRead: false, sourceUrl: threadUrl + '#post-101' },
  { id: story.id + ':post:102', postId: '102', title: 'Second', position: 1, downloaded: false, isRead: false, sourceUrl: threadUrl + '#post-102' },
];
const repository = { getContinueReading: jest.fn(async () => null), listStories: jest.fn(), getStory: jest.fn(), listContents: jest.fn(), listSavedUnlisted: jest.fn(),
  getImageSummary: jest.fn(async () => ({ unknown: 0, mismatch: 0, scanned: 0, local: 0, pending: 0, omitted: 0 })) };
const run = jest.mocked(importNativeStory);
beforeAll(() => {
  jest.mocked(useStorage).mockReturnValue({ repository, preferences: { theme: 'light', fontSize: 20 }, changePreferences: jest.fn(), imageWarning: null } as unknown as ReturnType<typeof useStorage>);
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  repository.listStories.mockResolvedValue([]);
  const warm = render(<Library />); warm.unmount();
});
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks(); run.mockReset();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  repository.listStories.mockResolvedValue([fixture, story]); repository.getStory.mockResolvedValue(story); repository.listContents.mockResolvedValue(entries);
  repository.listSavedUnlisted.mockResolvedValue([]);
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});
afterEach(async () => {
  await act(async () => { jest.runOnlyPendingTimers(); });
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('Library lists stories/counts and routes Add Story and selected contents', async () => {
  render(<Library />);
  await waitFor(() => expect(screen.getByText('The Lantern Cartographer')).toBeTruthy());
  expect(screen.getByText('3 chapters · 3 unread')).toBeTruthy();
  expect(screen.getByText('1 of 3 downloaded · 3 unread')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Add Story')); expect(router.push).toHaveBeenCalledWith('/add-story');
  fireEvent.press(screen.getByLabelText('Open Synthetic import'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/story', params: { story: story.id } });
});

test('Import starts deliberately, renders progress, cancels and exposes persistent partial resume', async () => {
  let signal: AbortSignal | undefined; let finish!: (result: Awaited<ReturnType<typeof importNativeStory>>) => void;
  run.mockImplementation((_url, _repo, options) => {
    signal = options?.signal;
    options?.onProgress?.({ phase: 'downloading', storyId: story.id, downloaded: 1, total: 3, title: 'Second' });
    return new Promise((resolve) => { finish = resolve; });
  });
  render(<AddStory />);
  fireEvent.changeText(screen.getByLabelText('Public SpaceBattles thread URL'), threadUrl);
  expect(run).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Import story'));
  await waitFor(() => expect(screen.getByText('1 of 3 chapters downloaded · Second')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Cancel import')); expect(signal?.aborted).toBe(true);
  await act(async () => finish({ story, failure: new S1Failure('cancelled', 'Generated cancellation') }));
  expect(screen.getByText('cancelled: Generated cancellation')).toBeTruthy();
  expect(screen.getByLabelText('Resume Download')).toBeTruthy();
});

test('typed access failure and completed state are clear', async () => {
  run.mockResolvedValueOnce({ story: null, failure: new S1Failure('blocked', 'Synthetic refusal', 403) });
  render(<AddStory />);
  fireEvent.changeText(screen.getByLabelText('Public SpaceBattles thread URL'), threadUrl);
  fireEvent.press(screen.getByLabelText('Import story'));
  await waitFor(() => expect(screen.getByText('blocked: Synthetic refusal')).toBeTruthy());
  run.mockImplementationOnce(async (_value, _repo, options) => {
    options?.onProgress?.({ phase: 'completed', downloaded: 3, total: 3 });
    return { story: { ...story, downloaded: 3 }, failure: null };
  });
  fireEvent.press(screen.getByLabelText('Import story'));
  await waitFor(() => expect(screen.getByText('All primary text downloaded.')).toBeTruthy());
  expect(screen.queryByLabelText('Resume Download')).toBeNull();
});

test('resume screen reads stored state without fetching; leaving/backgrounding cancels active work', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: story.id });
  let signal: AbortSignal | undefined;
  run.mockImplementation((_url, _repo, options) => { signal = options?.signal; return new Promise(() => undefined); });
  let change!: (state: AppStateStatus) => void;
  const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    change = listener; return { remove: jest.fn() };
  });
  const view = render(<AddStory />);
  await waitFor(() => expect(screen.getByLabelText('Resume Download')).toBeTruthy());
  expect(run).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Resume Download'));
  await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  act(() => change('background')); expect(signal?.aborted).toBe(true);
  view.unmount(); spy.mockRestore();
});


test('delayed resume prefill blocks work and hides URL editing; resume uses only the stored URL', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: story.id });
  let resolveStory!: (value: StorySummary) => void;
  repository.getStory.mockReturnValueOnce(new Promise((resolve) => { resolveStory = resolve; }));
  run.mockResolvedValue({ story, failure: null });
  render(<AddStory />);
  expect(screen.getByText('Loading saved story…')).toBeTruthy();
  expect(screen.queryByLabelText('Public SpaceBattles thread URL')).toBeNull();
  expect(screen.getByLabelText('Resume Download')).toBeDisabled();
  fireEvent.press(screen.getByLabelText('Resume Download')); expect(run).not.toHaveBeenCalled();
  await act(async () => resolveStory(story));
  expect(screen.queryByLabelText('Public SpaceBattles thread URL')).toBeNull();
  expect(screen.getByLabelText('Resume Download')).toBeEnabled(); expect(run).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Resume Download'));
  await waitFor(() => expect(run).toHaveBeenCalledWith(threadUrl, repository, expect.anything()));
});

test('editing a new import URL clears old result actions and imports the newly selected story', async () => {
  const otherUrl = 'https://forums.spacebattles.com/threads/9002/';
  const other = { ...story, id: 'spacebattles:thread:9002', threadId: '9002', title: 'Other synthetic story', sourceUrl: otherUrl };
  run.mockResolvedValueOnce({ story, failure: null }).mockResolvedValueOnce({ story: other, failure: null });
  render(<AddStory />);
  fireEvent.changeText(screen.getByLabelText('Public SpaceBattles thread URL'), threadUrl);
  fireEvent.press(screen.getByLabelText('Import story'));
  await waitFor(() => expect(screen.getByLabelText('Resume Download')).toBeEnabled());
  fireEvent.changeText(screen.getByLabelText('Public SpaceBattles thread URL'), otherUrl);
  expect(screen.queryByLabelText('Resume Download')).toBeNull(); expect(screen.queryByLabelText('Open story contents')).toBeNull();
  fireEvent.press(screen.getByLabelText('Import story'));
  await waitFor(() => expect(screen.getByText('Other synthetic story: 1 / 3 text chapters downloaded')).toBeTruthy());
  expect(run).toHaveBeenLastCalledWith(otherUrl, repository, expect.anything());
  fireEvent.press(screen.getByLabelText('Open story contents'));
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/story', params: { story: other.id } });
});
test('contents preserves order, gates missing bodies, offers resume and opens source only deliberately', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: story.id });
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  render(<StoryContents />);
  await waitFor(() => expect(screen.getByLabelText('Read First')).toBeTruthy());
  expect(screen.getByText('1. First')).toBeTruthy(); expect(screen.getByText('2. Second')).toBeTruthy();
  expect(screen.getByLabelText('Read Second')).toBeDisabled();
  fireEvent.press(screen.getByLabelText('Read Second')); expect(router.push).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Read First'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/reader', params: { chapter: entries[0]!.id } });
  expect(open).not.toHaveBeenCalled(); fireEvent.press(screen.getByLabelText('Open story source in browser'));
  expect(open).toHaveBeenCalledWith(threadUrl);
  fireEvent.press(screen.getByLabelText('Resume Download'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/add-story', params: { story: story.id } });
  open.mockRestore();
});

test('changing Resume route aborts old download and late results/progress cannot attach to the next story', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ story: story.id });
  let signal: AbortSignal | undefined; let finish!: (value: Awaited<ReturnType<typeof importNativeStory>>) => void;
  let nextProgress: NonNullable<Parameters<typeof importNativeStory>[2]>['onProgress'];
  run.mockImplementation((_url, _repo, options) => {
    signal = options?.signal; nextProgress = options?.onProgress;
    return new Promise((resolve) => { finish = resolve; });
  });
  const view = render(<AddStory />); await waitFor(() => expect(screen.getByLabelText('Resume Download')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Resume Download'));
  const other = { ...story, id: 'spacebattles:thread:9002', threadId: '9002', title: 'Other resumed story', sourceUrl: 'https://forums.spacebattles.com/threads/9002/' };
  repository.getStory.mockResolvedValue(other); jest.mocked(useLocalSearchParams).mockReturnValue({ story: other.id });
  view.rerender(<AddStory />); await waitFor(() => expect(screen.getByText('Other resumed story: 1 / 3 text chapters downloaded')).toBeTruthy());
  expect(signal?.aborted).toBe(true);
  await act(async () => { nextProgress?.({ phase: 'downloading', storyId: story.id, downloaded: 2, total: 3, title: 'Old body' }); finish({ story, failure: null }); });
  expect(screen.queryByText(/Old body/)).toBeNull(); expect(screen.queryByText('Synthetic import: 1 / 3 text chapters downloaded')).toBeNull();
  fireEvent.press(screen.getByLabelText('Open story contents'));
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/story', params: { story: other.id } });
});

test('normal reader Contents routes to its current story', () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ chapter: entries[0]!.id });
  render(<Reader />);
  mockReaderProps.onNavigate(null, story.id);
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/story', params: { story: story.id } });
});

test('empty Library has one header Add Story action, clear empty state, and no invented Continue target', async () => {
  repository.listStories.mockResolvedValue([]);
  render(<Library />);
  await waitFor(() => expect(screen.getByText('No stories yet')).toBeTruthy());
  expect(screen.getByLabelText('Add Story')).toBeEnabled();
  expect(screen.getByLabelText('Add your first story')).toBeEnabled();
  expect(screen.queryByText('Continue Reading')).toBeNull();
  expect(run).not.toHaveBeenCalled();
});

test('Library reports local read failure and image warning while suppressing an unverified Continue target', async () => {
  const context = jest.mocked(useStorage).getMockImplementation()!();
  jest.mocked(useStorage).mockReturnValue({ ...context, imageWarning: 'A local image could not be checked.' });
  repository.listStories.mockRejectedValueOnce(new Error('Synthetic read error'));
  render(<Library />);
  await waitFor(() => expect(screen.getByText(/Local storage failure: could not read the library/)).toBeTruthy());
  expect(screen.getByText('A local image could not be checked.')).toBeTruthy();
  expect(screen.queryByText('Continue Reading')).toBeNull();
  jest.mocked(useStorage).mockReturnValue(context);
});

test('Library development controls are absent from production', async () => {
  const dev = __DEV__; Reflect.set(global, '__DEV__', false);
  try {
    render(<Library />); await waitFor(() => expect(screen.getByLabelText('Open Synthetic import')).toBeTruthy());
    expect(screen.queryByText('Development diagnostics')).toBeNull();
    expect(screen.queryByLabelText('Open S1 development diagnostic')).toBeNull();
    expect(screen.queryByLabelText('Open S2A recovery diagnostic')).toBeNull();
  } finally { Reflect.set(global, '__DEV__', dev); }
});
