import { CORPUS, PERFORMANCE_CASES, type PerformanceCase, type CorpusCase } from './corpus';
import { context, EpubFailure, checkAbort, requireEpub, measureSync, measureStage, type Context } from './limits';
import { processEpub, ProcessingFailure } from './package';
import { finishReport, type Report, type TestResult } from './report';
import type { Seekable } from './zip';
import { canonicalShape, observeOutput } from './expectations';

export interface ScratchInput {
  file: Seekable; cleanup(): void;
  stats: TestResult['cleanup'];
}
export interface DiagnosticIO { create(bytes: Uint8Array): Promise<ScratchInput>; }
export class ScratchFailure extends EpubFailure {
  constructor(readonly stats: TestResult['cleanup'], code: EpubFailure['code'] = 'io') { super(code); }
}
function heartbeat() {
  let last = performance.now(), worst = 0;
  const tick = () => { const now = performance.now(); worst = Math.max(worst, now - last - 10); last = now; };
  const timer = setInterval(tick, 10);
  return { async finish() { await new Promise<void>((resolve) => setTimeout(resolve, 12)); clearInterval(timer); return Math.max(0, worst); } };
}
function counters(ctx: Context): TestResult['counters'] {
  return { output: ctx.output, bytesRead: ctx.bytesRead, compressed: ctx.compressed, maxInput: ctx.maxInput, maxOutput: ctx.maxOutput, timings: ctx.timings, operations: ctx.operations };
}
type SelectedCase = { id: 'selected-file'; name: string; expected: 'accepted'; output?: never; cancel?: never };
type Preparation = { succeeded: boolean; metrics: TestResult['preparation'] };
async function execute(test: CorpusCase | SelectedCase, acquire: () => Promise<ScratchInput>, parent?: AbortSignal,
  prepared: Preparation = { succeeded: true, metrics: { elapsedMs: 0, longestStallMs: 0 } }): Promise<TestResult> {
  const started = performance.now(), monitor = heartbeat(), abort = new AbortController(), ctx = context(abort.signal);
  let requested: number | null = null, latency: number | 'unavailable' = 'unavailable', input: ScratchInput | undefined;
  let actual = 'accepted', failure: string | null = null, assertion = true, ticks = 0;
  let stage: 'preparation' | 'acquisition' | 'processing' | 'assertion' = 'preparation';
  let eligible = false, processingOwnsFile = false, closeFailed = false;
  const observed = test.output ? observeOutput(test.output) : null; let chapters = 0;
  const notes: string[] = [], stats = { created: 0, removed: 0, handlesOpened: 0, handlesClosed: 0, failures: 0 };
  const abortParent = () => abort.abort(); parent?.addEventListener('abort', abortParent);
  if (parent?.aborted) abort.abort();
  ctx.checkpoint = (phase) => {
    if (phase === test.cancel && ++ticks === (phase === 'index' || phase === 'inflate' ? 2 : 1)) { requested = performance.now(); abort.abort(); }
  };
  try {
    if (!prepared.succeeded) throw new EpubFailure('io');
    stage = 'acquisition';
    checkAbort(abort.signal); input = await measureStage(ctx, 'acquire', acquire);
    const file = input.file;
    stage = 'processing'; processingOwnsFile = true;
    const result = await processEpub(file, ctx, { onChapter(content, summary) {
      assertion = summary.ordinal === chapters && canonicalShape(content) && assertion; chapters++;
      observed?.chapter(content, summary);
    } });
    stage = 'assertion';
    assertion = measureSync(ctx, 'expectations', () => assertion && (observed ? observed.finish(result) : test.id === 'selected-file' && chapters > 0 && chapters === result.chapters.length));
    eligible = assertion;
    if (!assertion) { actual = 'assertion'; failure = 'assertion'; notes.push('Failure origin: assertion.'); }
  } catch (error) {
    if (error instanceof ScratchFailure) Object.assign(stats, error.stats);
    actual = error instanceof EpubFailure ? error.code : 'io'; failure = actual;
    const origin = stage === 'processing' && error instanceof ProcessingFailure ? error.origin : stage;
    notes.push(`Failure origin: ${origin}.`);
    eligible = stage === 'processing' && error instanceof ProcessingFailure &&
      (error.origin === 'validation' || (error.origin === 'cancelled' && requested !== null));
    if (stage === 'processing' && error instanceof ProcessingFailure && error.origin === 'cleanup' && input) {
      closeFailed = true; input.stats.failures++;
    }
    if (requested !== null && origin === 'cancelled') latency = performance.now() - requested;
  } finally {
    parent?.removeEventListener('abort', abortParent);
    if (input) {
      const cleanupStart = performance.now();
      // No successful second close; only pre-ownership failure or failed-close retry.
      if (!processingOwnsFile || closeFailed) {
        try { measureSync(ctx, 'cleanup', () => input!.file.close()); } catch { input.stats.failures++; }
      }
      try { measureSync(ctx, 'cleanup', () => input!.cleanup()); } catch { input.stats.failures++; }
      ctx.timings.cleanup += performance.now() - cleanupStart;
      Object.assign(stats, input.stats);
    }
  }
  if (stats.created !== stats.removed || stats.handlesOpened !== stats.handlesClosed) stats.failures++;
  if (stats.failures && !notes.includes('Failure origin: cleanup.')) notes.push('Failure origin: cleanup.');
  return { id: test.id, name: test.name, fixture: test.id, expected: test.expected, actual,
    status: eligible && actual === test.expected && assertion && !stats.failures ? 'pass' : 'fail', failureCategory: failure,
    elapsedMs: performance.now() - started, longestStallMs: await monitor.finish(), cancellationLatencyMs: latency, preparation: prepared.metrics,
    counters: counters(ctx), cleanup: stats, notes };
}
export async function runDiagnostic(io: DiagnosticIO, metadata: Report['metadata'], signal?: AbortSignal, progress?: (done: number, total: number) => void, singleCase?: PerformanceCase): Promise<Report> {
  const started = new Date().toISOString(), tests: TestResult[] = [];
  requireEpub(metadata.tier === 'single' ? !!singleCase && PERFORMANCE_CASES.includes(singleCase) :
    singleCase === undefined && (metadata.tier === 'quick' || metadata.tier === 'extended'), 'policy');
  const cases = CORPUS.filter((t) => singleCase ? t.id === singleCase : metadata.tier === 'extended' || t.tier === 'quick');
  for (const test of cases) {
    if (signal?.aborted) {
      const ctx = context();
      tests.push({ id: test.id, name: test.name, fixture: test.id, expected: test.expected, actual: 'not-run', status: 'skip', failureCategory: null,
        elapsedMs: 0, longestStallMs: 0, cancellationLatencyMs: 'unavailable', preparation: { elapsedMs: 0, longestStallMs: 0 }, counters: counters(ctx),
        cleanup: { created: 0, removed: 0, handlesOpened: 0, handlesClosed: 0, failures: 0 }, notes: ['Suite cancelled before test.'] });
      continue;
    }
    // Corpus construction is artificial compression/CRC work, not file import.
    // Drain its heartbeat before starting the processing monitor. Copying,
    // reads, validation, expectations and cleanup all remain inside that monitor.
    const prepMonitor = heartbeat(), prepStart = performance.now(); let bytes: Uint8Array | undefined;
    try { bytes = test.bytes(); } catch { /* Report preparation separately, without private exception text. */ }
    const elapsedMs = performance.now() - prepStart, longestStallMs = await prepMonitor.finish();
    tests.push(await execute(test, () => {
      return io.create(bytes!);
    }, signal, { succeeded: bytes !== undefined, metrics: { elapsedMs, longestStallMs } })); progress?.(tests.length, cases.length);
  }
  return finishReport(metadata, started, tests, signal?.aborted);
}
export async function runSelected(acquire: () => Promise<ScratchInput>, metadata: Report['metadata'], signal?: AbortSignal) {
  const started = new Date().toISOString();
  const test: SelectedCase = { id: 'selected-file', name: 'Deliberately selected local file', expected: 'accepted' };
  return finishReport({ ...metadata, tier: 'selected' }, started, [await execute(test, acquire, signal)], signal?.aborted);
}
