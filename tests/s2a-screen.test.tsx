import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import S2AScreen from '../src/app/s2a';
import { getS2ADiagnostic } from '../src/diagnostics/s2a/native';
import type { S2ADiagnostic } from '../src/diagnostics/s2a/recovery';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock('../src/reader/ChapterReader', () => ({ ChapterReader: () => null }));
jest.mock('../src/diagnostics/s2a/native', () => ({ getS2ADiagnostic: jest.fn(), renderS2A: jest.fn() }));
const get = jest.mocked(getS2ADiagnostic);
let subscribe: jest.Mock;
let inspect: jest.Mock;
let initialize: jest.Mock;
let reset: jest.Mock;
let text: jest.Mock;
let listener: (message: string) => void;
let diagnostic: S2ADiagnostic;
beforeEach(() => {
  inspect = jest.fn().mockResolvedValue({ initialized: false, marker: 'No prior operation' });
  initialize = jest.fn().mockResolvedValue(undefined);
  reset = jest.fn().mockResolvedValue(undefined);
  text = jest.fn().mockResolvedValue(undefined);
  subscribe = jest.fn((value) => { listener = value; return jest.fn(); });
  diagnostic = { inspect, initialize, reset, text, subscribe, busy: false, checkpointReached: false } as unknown as S2ADiagnostic;
  get.mockReturnValue(diagnostic);
});
// As with S1, compile RN's lazy scroll/control modules before timing async actions.
beforeAll(() => {
  get.mockReturnValue({ subscribe: () => () => undefined } as unknown as S2ADiagnostic);
  const warm = render(<S2AScreen />); warm.unmount();
});

test('entering the screen performs no inspection, seed, repair or reset; initialization needs deliberate inspection', async () => {
  render(<S2AScreen />);
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(inspect).not.toHaveBeenCalled(); expect(initialize).not.toHaveBeenCalled(); expect(reset).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Initialize disposable S2A fixture'));
  expect(initialize).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Inspect persisted S2A state before repair'));
  await waitFor(() => expect(screen.getByText('Initialized: no')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Initialize disposable S2A fixture'));
  await waitFor(() => expect(initialize).toHaveBeenCalledTimes(1));
});

test('reset is a two-action S2A-only control, after inspection', async () => {
  render(<S2AScreen />);
  fireEvent.press(screen.getByLabelText('Inspect persisted S2A state before repair'));
  await waitFor(() => expect(screen.getByText('Initialized: no')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Reset only disposable S2A test data'));
  expect(reset).not.toHaveBeenCalled();
  expect(screen.getByText('CONFIRM reset S2A test data only')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Reset only disposable S2A test data'));
  await waitFor(() => expect(reset).toHaveBeenCalledTimes(1));
});

test('pending transaction leaves checkpoint status visible, does not reset/reseed on unmount or auto-release the checkpoint', async () => {
  inspect.mockResolvedValue({ initialized: true, marker: 'baseline', counts: { stories: 1, chapters: 3, assets: 1 } });
  text.mockImplementation(() => {
    listener('READY TO FORCE-QUIT BEFORE COMMIT');
    return new Promise(() => undefined);
  });
  const view = render(<S2AScreen />);
  fireEvent.press(screen.getByLabelText('Inspect persisted S2A state before repair'));
  await waitFor(() => expect(screen.getByText('Initialized: yes')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Arm transaction force quit checkpoint'));
  await waitFor(() => expect(screen.getAllByText('READY TO FORCE-QUIT BEFORE COMMIT')).toHaveLength(2));
  fireEvent.press(screen.getByLabelText('Reset only disposable S2A test data'));
  expect(reset).not.toHaveBeenCalled();
  expect(initialize).not.toHaveBeenCalled();
  view.unmount();
  expect(reset).not.toHaveBeenCalled();
  expect(text).toHaveBeenCalledTimes(1);
});
