import { OPERATIONS, TIMINGS, type Context } from './limits';
export const REPORT_VERSION = 3;
let reportSequence = 0;
export interface TestResult {
  id: string; name: string; fixture: string; expected: string; actual: string;
  status: 'pass' | 'fail' | 'skip'; failureCategory: string | null; elapsedMs: number;
  longestStallMs: number; cancellationLatencyMs: number | 'unavailable';
  preparation: { elapsedMs: number; longestStallMs: number };
  counters: Pick<Context, 'output' | 'bytesRead' | 'compressed' | 'maxInput' | 'maxOutput' | 'timings' | 'operations'>;
  cleanup: { created: number; removed: number; handlesOpened: number; handlesClosed: number; failures: number };
  notes: string[];
}
export interface Report {
  schemaVersion: 3; suiteVersion: string; attemptId: string; startedAt: string; completedAt: string;
  metadata: { appVersion: string; audience: string; diagnosticFlag: string; runtime: string; platform: string; hermes: boolean | 'unavailable'; tier: 'quick' | 'extended' | 'selected' | 'single' };
  tests: TestResult[];
  summary: { total: number; passed: number; failed: number; skipped: number; warnings: number; longestStallMs: number; worstCancellationMs: number | 'unavailable'; cleanupFailures: number; criticalFailures: number; verdict: 'pass' | 'fail' | 'cancelled' };
  peakMemoryBytes: 'unavailable'; limitations: string[];
}
function summarize(tests: TestResult[], cancelled: boolean): Report['summary'] {
  const latencies = tests.map((t) => t.cancellationLatencyMs).filter((n): n is number => typeof n === 'number');
  const longestStallMs = Math.max(0, ...tests.map((t) => t.longestStallMs));
  const failed = tests.filter((t) => t.status === 'fail').length, cleanupFailures = tests.reduce((n,t) => n + t.cleanup.failures, 0);
  const performanceFailures = Number(longestStallMs > 250) + Number(latencies.some((n) => n > 1000));
  const skipped = tests.filter((t)=>t.status==='skip').length, incomplete = !tests.length || (skipped > 0 && !cancelled);
  return { total: tests.length, passed: tests.filter((t) => t.status === 'pass').length, failed, skipped,
      warnings: tests.reduce((n,t) => n + t.notes.length, 0) + performanceFailures, longestStallMs,
      worstCancellationMs: latencies.length ? Math.max(...latencies) : 'unavailable', cleanupFailures, criticalFailures: failed + cleanupFailures + performanceFailures + Number(incomplete),
      verdict: cancelled ? 'cancelled' : failed || cleanupFailures || performanceFailures || incomplete ? 'fail' : 'pass' };
}
export function finishReport(metadata: Report['metadata'], startedAt: string, tests: TestResult[], cancelled = false): Report {
  return { schemaVersion: REPORT_VERSION, suiteVersion: 'm1a-3', attemptId: `${startedAt}#${++reportSequence}`, startedAt, completedAt: new Date().toISOString(), metadata, tests,
    summary: summarize(tests,cancelled),
    peakMemoryBytes: 'unavailable', limitations: ['Processing heartbeat includes JS scratch acquire/copy, reads, validation, output assertions and cleanup; scheduling/GC is unattributed and heap is unavailable.',
      'Synthetic fixture preparation has separate duration/stall measurements and is excluded from the processing gate. Selected files have zero preparation.',
      'The native Files picker and its OS-managed provider copy precede selected-file processing; their duration/allocation is not measured here.',
      'Operation maxima measure synchronous calls, not the cause of a heartbeat stall. Stage totals include yields and may overlap; they are not additive.',
      'Single-case results are investigation only; they do not replace either complete suite.',
      'Synchronous XML/sanitizer/image validation cannot be cancelled mid-call.', 'Only processed members have CRC evidence.', 'No reader, Library persistence, or public-release acceptance is implied.'] };
}
/** Export only an explicit schema; selected metadata, member names, URIs and prose are absent. */
export function serializeReport(report: Report): string {
  if (report.schemaVersion !== REPORT_VERSION || !Array.isArray(report.tests) || report.tests.length > 1000 || report.summary.total !== report.tests.length) throw new Error('Invalid diagnostic report.');
  // Fail closed on additional fields rather than accidentally exporting future private data.
  const keys = (object: object, expected: string) => {
    const allowed = expected.split(' '), actual = Object.keys(object);
    if (actual.length !== allowed.length || actual.some((key) => !allowed.includes(key))) throw new Error('Unexpected diagnostic fields.');
  };
  keys(report, 'schemaVersion suiteVersion attemptId startedAt completedAt metadata tests summary peakMemoryBytes limitations');
  keys(report.metadata, 'appVersion audience diagnosticFlag runtime platform hermes tier');
  keys(report.summary, 'total passed failed skipped warnings longestStallMs worstCancellationMs cleanupFailures criticalFailures verdict');
  const measurement = (value: unknown) => { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid diagnostic measurement.'); };
  const string = (value: unknown) => { if (typeof value !== 'string' || value.length > 512) throw new Error('Invalid diagnostic string.'); };
  const strings = (values: unknown) => { if (!Array.isArray(values) || values.length > 32) throw new Error('Invalid diagnostic notes.'); values.forEach(string); };
  for (const value of [report.suiteVersion,report.attemptId,report.startedAt,report.completedAt]) string(value);
  if (report.suiteVersion !== 'm1a-3' || !report.attemptId.startsWith(report.startedAt+'#') ||
    new Date(report.startedAt).toISOString() !== report.startedAt || new Date(report.completedAt).toISOString() !== report.completedAt ||
    report.peakMemoryBytes !== 'unavailable' || !['quick','extended','selected','single'].includes(report.metadata.tier) ||
    ![true,false,'unavailable'].includes(report.metadata.hermes)) throw new Error('Invalid diagnostic metadata.');
  for (const [key,value] of Object.entries(report.metadata)) if (key!=='hermes') string(value);
  strings(report.limitations);
  for (const test of report.tests) {
    keys(test, 'id name fixture expected actual status failureCategory elapsedMs longestStallMs cancellationLatencyMs preparation counters cleanup notes');
    keys(test.preparation, 'elapsedMs longestStallMs');
    keys(test.counters, 'output bytesRead compressed maxInput maxOutput timings operations');
    keys(test.counters.timings, TIMINGS.join(' '));
    keys(test.counters.operations, OPERATIONS.join(' '));
    for (const operation of Object.values(test.counters.operations)) {
      keys(operation, 'calls totalMs maxMs'); Object.values(operation).forEach(measurement);
      if (!Number.isInteger(operation.calls) || operation.maxMs > operation.totalMs || (!operation.calls && operation.totalMs)) throw new Error('Invalid operation measurement.');
    }
    keys(test.cleanup, 'created removed handlesOpened handlesClosed failures');
    if (!['pass','fail','skip'].includes(test.status) || !Array.isArray(test.notes)) throw new Error('Invalid diagnostic status.');
    for (const value of [test.id,test.name,test.fixture,test.expected,test.actual]) string(value);
    if (test.failureCategory!==null) string(test.failureCategory);
    strings(test.notes);
    for (const value of [test.elapsedMs,test.longestStallMs,...Object.values(test.preparation),...Object.entries(test.counters).filter(([key])=>key!=='timings' && key!=='operations').map(([,value])=>value),...Object.values(test.counters.timings),...Object.values(test.cleanup)]) measurement(value);
    if (test.cancellationLatencyMs!=='unavailable') measurement(test.cancellationLatencyMs);
    if (test.status==='pass' && (test.actual!==test.expected || test.cleanup.failures || test.cleanup.created!==test.cleanup.removed || test.cleanup.handlesOpened!==test.cleanup.handlesClosed)) throw new Error('Invalid diagnostic success.');
    if (test.status==='skip' && test.actual!=='not-run') throw new Error('Invalid diagnostic skip.');
  }
  for (const [key,value] of Object.entries(report.summary)) if(key!=='verdict' && value!=='unavailable') measurement(value);
  const expected = summarize(report.tests,report.summary.verdict==='cancelled');
  if (Object.entries(expected).some(([key,value])=>report.summary[key as keyof Report['summary']]!==value)) throw new Error('Inconsistent diagnostic summary.');
  const json = JSON.stringify(report, (_key, value: unknown) => {
    if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) throw new Error('Invalid diagnostic measurement.');
    if (typeof value === 'string' && value.length > 512) throw new Error('Unbounded diagnostic string.');
    return value;
  }, 2);
  if (json.length > 2_000_000) throw new Error('Diagnostic report exceeds budget.'); return json;
}
