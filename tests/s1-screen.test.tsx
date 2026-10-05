import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import S1Screen from '../src/app/s1';
import { runNativeDiagnostic } from '../src/sources/spacebattles/native';
import { threadFromUrl } from '../src/sources/spacebattles/url';
import { threadUrl } from './fixtures/spacebattles';
import { S1Failure } from '../src/sources/spacebattles/types';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('../src/sources/spacebattles/native', () => ({ runNativeDiagnostic: jest.fn() }));
const run = jest.mocked(runNativeDiagnostic);
// RN compiles lazy list/scroll components on first render. Keep that synchronous tooling
// setup outside the async action timeout, including in a clean-cache CI run.
beforeAll(() => { const warm = render(<S1Screen />); warm.unmount(); });
beforeEach(() => run.mockReset());

test('dev screen starts only on deliberate action and shows complete manifest/sample metadata', async () => {
  run.mockResolvedValue({ thread: threadFromUrl(threadUrl), manifest: { state: 'COMPLETE', category: { id: '9', expected: 1, url: threadUrl + 'threadmarks' },
    entries: [{ postId: '91', chapterId: 'spacebattles:thread:9001:post:91', title: 'Synthetic title', url: threadUrl + '#post-91', threadmarkId: null }],
    duplicates: [], pages: 1 }, samples: [{ postId: '91', bodyCharacters: 120, formattingTags: ['p'] }], requests: 2, elapsedMs: 2100, failure: null });
  render(<S1Screen />);
  expect(run).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Public SpaceBattles thread URL'), threadUrl);
  fireEvent.press(screen.getByLabelText('Run S1 diagnostic'));
  await waitFor(() => expect(screen.getByText(/Manifest: COMPLETE/)).toBeTruthy());
  expect(run).toHaveBeenCalledTimes(1);
  expect(screen.getByText('1. post 91 · Synthetic title')).toBeTruthy();
});
test('a blocked request is reported as failure, without a successful manifest', async () => {
  run.mockResolvedValue({ thread: threadFromUrl(threadUrl), manifest: null, samples: [], requests: 1,
    elapsedMs: 20, failure: new S1Failure('blocked', 'Synthetic access refusal.', 403) });
  render(<S1Screen />);
  fireEvent.changeText(screen.getByLabelText('Public SpaceBattles thread URL'), threadUrl);
  fireEvent.press(screen.getByLabelText('Run S1 diagnostic'));
  await waitFor(() => expect(screen.getByText(/Failure: blocked \(HTTP 403\)/)).toBeTruthy());
  expect(screen.queryByText(/Manifest: COMPLETE/)).toBeNull();
  expect(run).toHaveBeenCalledTimes(1);
});
test('leaving the screen aborts an active run', async () => {
  let signal: AbortSignal | undefined;
  run.mockImplementation((_value, options) => { signal = options?.signal; return new Promise(() => undefined); });
  const view = render(<S1Screen />);
  fireEvent.changeText(screen.getByLabelText('Public SpaceBattles thread URL'), threadUrl);
  fireEvent.press(screen.getByLabelText('Run S1 diagnostic'));
  await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  view.unmount(); expect(signal?.aborted).toBe(true);
});
