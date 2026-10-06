import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import { ChapterReader } from '../src/reader/ChapterReader';
import type { Repository } from '../src/storage/repository';
import type { Chapter } from '../src/domain/types';
import { createRenderFile } from '../src/storage/files';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
jest.mock('../src/storage/files', () => ({ createRenderFile: jest.fn() }));
jest.mock('react-native-webview', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ onMessage }: { onMessage: (event: unknown) => void }) => <View testID="reader-web" onMessage={onMessage} /> };
});
const chapter: Chapter = { id: 'spacebattles:thread:9001:post:101', storyId: 'spacebattles:thread:9001',
  title: 'Generated first', position: 0, html: '<p>Generated</p>', contentHash: 'generated-hash',
  sanitizerVersion: '1', blockIds: ['block-0001'], links: {} };
const repo = { getChapter: jest.fn(), getLocator: jest.fn(), listChapters: jest.fn(), getChapterAssetPath: jest.fn(), saveLocator: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks();
  repo.getChapter.mockResolvedValue(chapter); repo.getLocator.mockResolvedValue(null);
  repo.listChapters.mockImplementation(async (story) => story === chapter.storyId ? [chapter] : [chapter, { id: 'fixture:thread:1001:post:2001' }]);
  repo.getChapterAssetPath.mockResolvedValue(null);
  jest.mocked(createRenderFile).mockResolvedValue({ uri: 'file:///generated/index.html', readAccess: 'file:///generated/',
    directory: { exists: false, delete: jest.fn() } } as unknown as Awaited<ReturnType<typeof createRenderFile>>);
});

test('reader loads local story-specific navigation/asset; Previous/Next never enter another story', async () => {
  const navigate = jest.fn();
  render(<ChapterReader chapterId={chapter.id} repository={repo as unknown as Repository} preferences={{ theme: 'light', fontSize: 20 }}
    changePreferences={jest.fn()} onRetry={jest.fn()} onNavigate={navigate} />);
  await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy());
  const session = jest.mocked(createRenderFile).mock.calls[0]![3];
  act(() => screen.getByTestId('reader-web').props.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'ready', session,
    chapterId: chapter.id, contentHash: chapter.contentHash }) } }));
  expect(repo.listChapters).toHaveBeenCalledWith(chapter.storyId);
  expect(repo.getChapterAssetPath).toHaveBeenCalledWith(chapter.id);
  expect(screen.getByLabelText('Previous chapter')).toBeDisabled();
  expect(screen.getByLabelText('Next chapter')).toBeDisabled();
  expect(jest.mocked(createRenderFile).mock.calls[0]![4]).toBeNull();
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith(null, chapter.storyId));
});

test('saved-unlisted chapter remains readable and Contents belongs to its story; both navigation directions are disabled', async () => {
  repo.listChapters.mockResolvedValue([{ id: chapter.storyId + ':post:102', title: 'Currently listed', position: 0 }]);
  const navigate = jest.fn();
  render(<ChapterReader chapterId={chapter.id} repository={repo as unknown as Repository} preferences={{ theme: 'light', fontSize: 20 }}
    changePreferences={jest.fn()} onRetry={jest.fn()} onNavigate={navigate} />);
  await waitFor(() => expect(screen.getByTestId('reader-web')).toBeTruthy());
  const session = jest.mocked(createRenderFile).mock.calls[0]![3];
  act(() => screen.getByTestId('reader-web').props.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'ready', session,
    chapterId: chapter.id, contentHash: chapter.contentHash }) } }));
  expect(screen.getByLabelText('Previous chapter')).toBeDisabled(); expect(screen.getByLabelText('Next chapter')).toBeDisabled();
  fireEvent.press(screen.getByLabelText('Return to story contents'));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith(null, chapter.storyId));
});

test('reader uses refreshed title and reconciled order while passing unchanged content/hash and locator to rendering', async () => {
  const renamed = { ...chapter, title: 'Updated generated title', position: 500 };
  const locator = { chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[0]!, offset: 12, progression: .4, expandedSpoilers: [] };
  repo.getChapter.mockResolvedValue(renamed); repo.getLocator.mockResolvedValue(locator);
  const nextId = chapter.storyId + ':post:103';
  repo.listChapters.mockResolvedValue([{ id: chapter.storyId + ':post:102', title: 'Before', position: 0 },
    { ...renamed, position: 1 }, { id: nextId, title: 'After', position: 2 }]);
  const navigate = jest.fn();
  render(<ChapterReader chapterId={chapter.id} repository={repo as unknown as Repository} preferences={{ theme: 'light', fontSize: 20 }}
    changePreferences={jest.fn()} onRetry={jest.fn()} onNavigate={navigate} />);
  await waitFor(() => expect(screen.getByText(renamed.title)).toBeTruthy());
  expect(jest.mocked(createRenderFile).mock.calls[0]!.slice(0, 2)).toEqual([renamed, locator]);
  const session = jest.mocked(createRenderFile).mock.calls[0]![3];
  act(() => screen.getByTestId('reader-web').props.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'ready', session,
    chapterId: chapter.id, contentHash: chapter.contentHash }) } }));
  expect(screen.getByLabelText('Previous chapter')).toBeEnabled(); fireEvent.press(screen.getByLabelText('Next chapter'));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith(nextId, chapter.storyId));
});
