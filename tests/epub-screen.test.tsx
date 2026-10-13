import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import EpubDiagnostic from '../src/app/epub-diagnostic';
import * as policy from '../src/epub-spike/policy';
import { runNativeEpubSuite, runNativeEpubCase, selectNativeEpub, exportNativeEpubReport } from '../src/epub-spike/native';
import { retainedPress } from './ui-helpers';
import { finishReport } from '../src/epub-spike/report';
import { passedReport, passedResult, reportMetadata } from './fixtures/epub-report';
jest.mock('expo-router',()=>({router:{back:jest.fn()}}));
jest.mock('../src/epub-spike/policy',()=>({diagnosticAllowed:jest.fn(()=>true)}));
jest.mock('../src/epub-spike/native',()=>({runNativeEpubSuite:jest.fn(),runNativeEpubCase:jest.fn(),selectNativeEpub:jest.fn(),exportNativeEpubReport:jest.fn()}));
beforeEach(()=>{
  jest.clearAllMocks();jest.mocked(policy.diagnosticAllowed).mockReturnValue(true);
  jest.mocked(runNativeEpubSuite).mockReset();jest.mocked(selectNativeEpub).mockReset();jest.mocked(exportNativeEpubReport).mockReset();
  jest.mocked(runNativeEpubCase).mockReset();
});
test('disabled direct route has no processing controls or side effects',()=>{
  jest.mocked(policy.diagnosticAllowed).mockReturnValue(false);render(<EpubDiagnostic/>);
  expect(screen.queryByLabelText('Run EPUB Test Suite')).toBeNull();expect(screen.getByText(/disabled for this build/)).toBeTruthy();
  expect(runNativeEpubSuite).not.toHaveBeenCalled();expect(selectNativeEpub).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Investigate dense-valid')).toBeNull();expect(runNativeEpubCase).not.toHaveBeenCalled();
});

test('single-case investigation invalidates the previous report and exports its own identified result',async()=>{
  jest.mocked(runNativeEpubSuite).mockResolvedValueOnce(passedReport());
  const single=passedReport('single');jest.mocked(runNativeEpubCase).mockResolvedValueOnce(single);
  render(<EpubDiagnostic/>);fireEvent.press(screen.getByLabelText('Run EPUB Test Suite'));
  await waitFor(()=>expect(screen.getByLabelText('Export JSON Report')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Investigate dense-valid'));
  expect(screen.queryByLabelText('Export JSON Report')).toBeNull();
  await waitFor(()=>expect(screen.getByText(/single · pass/)).toBeTruthy());
  expect(runNativeEpubCase).toHaveBeenCalledWith('dense-valid',expect.anything());
  fireEvent.press(screen.getByLabelText('Export JSON Report'));await waitFor(()=>expect(exportNativeEpubReport).toHaveBeenCalledWith(single));
});

test.each([
  ['Run EPUB Test Suite','picker failure'],
  ['Run Extended Security and Performance Suite','provider read failure'],
  ['Run EPUB Test Suite','cancel'],
  ['Run EPUB Test Suite','suite failure'],
] as const)('prior success is invalidated after %s then %s',async(start,failure)=>{
  const first=passedReport();jest.mocked(runNativeEpubSuite).mockResolvedValueOnce(first);
  render(<EpubDiagnostic/>);fireEvent.press(screen.getByLabelText(start));
  await waitFor(()=>expect(screen.getByLabelText('Export JSON Report')).toBeTruthy());
  const stale=retainedPress('Export JSON Report');
  if(failure==='suite failure') {
    jest.mocked(runNativeEpubSuite).mockRejectedValueOnce(new Error('private failure'));
    fireEvent.press(screen.getByLabelText('Run EPUB Test Suite'));
  } else {
    if(failure==='cancel')jest.mocked(selectNativeEpub).mockResolvedValueOnce(null);
    else jest.mocked(selectNativeEpub).mockRejectedValueOnce(new Error('file:///private/book.epub'));
    fireEvent.press(screen.getByLabelText('Select EPUB File'));
  }
  expect(screen.queryByLabelText('Export JSON Report')).toBeNull();
  await waitFor(()=>expect(screen.getByText(failure==='cancel'?/Attempt 2: file selection cancelled/:/Attempt 2 failed before a report/)).toBeTruthy());
  act(()=>stale());expect(exportNativeEpubReport).not.toHaveBeenCalled();expect(screen.queryByText(/1 passed/)).toBeNull();
});
test('pending attempt blocks retained export; repeated failures cannot resurrect a report',async()=>{
  jest.mocked(runNativeEpubSuite).mockResolvedValueOnce(passedReport());render(<EpubDiagnostic/>);
  fireEvent.press(screen.getByLabelText('Run EPUB Test Suite'));await waitFor(()=>expect(screen.getByLabelText('Export JSON Report')).toBeTruthy());
  const stale=retainedPress('Export JSON Report');let reject!: (error:Error)=>void;
  jest.mocked(selectNativeEpub).mockImplementationOnce(()=>new Promise((_resolve,no)=>{reject=no;}));
  fireEvent.press(screen.getByLabelText('Select EPUB File'));act(()=>stale());expect(exportNativeEpubReport).not.toHaveBeenCalled();
  await act(async()=>reject(new Error('provider')));
  jest.mocked(selectNativeEpub).mockRejectedValueOnce(new Error('again'));fireEvent.press(screen.getByLabelText('Select EPUB File'));
  await waitFor(()=>expect(screen.getByText(/Attempt 3 failed/)).toBeTruthy());act(()=>stale());expect(exportNativeEpubReport).not.toHaveBeenCalled();
});
test('failure before any report, then repeated successful runs export only the latest report',async()=>{
  jest.mocked(runNativeEpubSuite).mockRejectedValueOnce(new Error('early'));
  render(<EpubDiagnostic/>);fireEvent.press(screen.getByLabelText('Run EPUB Test Suite'));
  await waitFor(()=>expect(screen.getByText(/Attempt 1 failed/)).toBeTruthy());expect(screen.queryByLabelText('Export JSON Report')).toBeNull();
  const second=passedReport(),third=passedReport('extended');
  jest.mocked(runNativeEpubSuite).mockResolvedValueOnce(second).mockResolvedValueOnce(third);
  fireEvent.press(screen.getByLabelText('Run EPUB Test Suite'));await waitFor(()=>expect(screen.getByLabelText('Export JSON Report')).toBeTruthy());
  const stale=retainedPress('Export JSON Report');
  fireEvent.press(screen.getByLabelText('Run Extended Security and Performance Suite'));
  await waitFor(()=>expect(screen.getByText(new RegExp(third.attemptId.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))).toBeTruthy());
  act(()=>stale());await waitFor(()=>expect(exportNativeEpubReport).toHaveBeenCalledWith(third));
  expect(exportNativeEpubReport).not.toHaveBeenCalledWith(second);
});
test('a structured failed current result may be exported, without exporting an earlier success',async()=>{
  const first=passedReport();const result=passedResult();result.status='fail';result.actual='io';result.failureCategory='io';
  const failed=finishReport({...reportMetadata,tier:'selected'},new Date().toISOString(),[result]);
  jest.mocked(runNativeEpubSuite).mockResolvedValueOnce(first);jest.mocked(selectNativeEpub).mockResolvedValueOnce(failed);
  render(<EpubDiagnostic/>);fireEvent.press(screen.getByLabelText('Run EPUB Test Suite'));await waitFor(()=>expect(screen.getByLabelText('Export JSON Report')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Select EPUB File'));await waitFor(()=>expect(screen.getByText(/Attempt 2: suite fail/)).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Export JSON Report'));await waitFor(()=>expect(exportNativeEpubReport).toHaveBeenCalledWith(failed));
  expect(exportNativeEpubReport).not.toHaveBeenCalledWith(first);
});
test('one action starts the suite; repeat/stale presses do not run twice; leaving aborts',async()=>{
  let signal:AbortSignal|undefined;const run=jest.mocked(runNativeEpubSuite);
  run.mockImplementation((_tier,s)=>{signal=s;return new Promise(()=>{});});
  const view=render(<EpubDiagnostic/>);const start=retainedPress('Run EPUB Test Suite');
  expect(run).not.toHaveBeenCalled();fireEvent.press(screen.getByLabelText('Run EPUB Test Suite'));start();
  await waitFor(()=>expect(run).toHaveBeenCalledTimes(1));expect(run.mock.calls[0]![0]).toBe('quick');
  view.unmount();expect(signal?.aborted).toBe(true);
});
test('rechecks permission in a retained callback',()=>{
  render(<EpubDiagnostic/>);const start=retainedPress('Run EPUB Test Suite');jest.mocked(policy.diagnosticAllowed).mockReturnValue(false);start();
  expect(runNativeEpubSuite).not.toHaveBeenCalled();
});
test('automatic report becomes exportable without copying logs',async()=>{
  const report=finishReport({appVersion:'test',audience:'internal-personal',diagnosticFlag:'enabled',runtime:'test',platform:'ios',hermes:false,tier:'quick'},new Date().toISOString(),[]);
  jest.mocked(runNativeEpubSuite).mockResolvedValue(report);jest.mocked(exportNativeEpubReport).mockResolvedValue();render(<EpubDiagnostic/>);
  fireEvent.press(screen.getByLabelText('Run EPUB Test Suite'));
  await waitFor(()=>expect(screen.getByLabelText('Export JSON Report')).toBeTruthy());fireEvent.press(screen.getByLabelText('Export JSON Report'));
  await waitFor(()=>expect(exportNativeEpubReport).toHaveBeenCalledWith(report));
});
