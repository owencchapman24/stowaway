import { CORPUS } from '../src/epub-spike/corpus';
import { runDiagnostic, runSelected, ScratchFailure, type ScratchInput } from '../src/epub-spike/diagnostic';
import { context, EpubFailure } from '../src/epub-spike/limits';
import { processEpub } from '../src/epub-spike/package';
import { serializeReport, type Report } from '../src/epub-spike/report';
import { epubEntries, makeZip } from '../src/epub-spike/fixtures';

const metadata: Report['metadata'] = { appVersion: 'test', audience: 'internal-personal', diagnosticFlag: 'enabled', runtime: 'Node', platform: 'test', hermes: false, tier: 'single' };
const privateFailure = () => Object.assign(new EpubFailure('budget'), { message: 'PRIVATE_PROVIDER_PATH_AND_PROSE' });
function memory(bytes: Uint8Array, firstClose?: () => void) {
  const stats = { created: 1, removed: 0, handlesOpened: 1, handlesClosed: 0, failures: 0 };
  let attempted = false, closed = false;
  const close = jest.fn(() => {
    if (closed) return;
    if (!attempted) { attempted = true; firstClose?.(); }
    closed = true; stats.handlesClosed++;
  });
  const input: ScratchInput = { stats, file: { size: bytes.length, async read(at, n) { return bytes.slice(at, at + n); }, close },
    cleanup() { if (!closed) close(); stats.removed++; } };
  return { input, close };
}
const ratio = (create: (bytes: Uint8Array) => Promise<ScratchInput>) => runDiagnostic({ create }, metadata, undefined, undefined, 'ratio');
function failed(report: Report, origin: string) {
  expect(report.summary).toMatchObject({ total: 1, passed: 0, failed: 1, skipped: 0, verdict: 'fail' });
  expect(report.tests[0]!.notes).toContain(`Failure origin: ${origin}.`);
  expect(serializeReport(report)).not.toContain('PRIVATE_PROVIDER_PATH_AND_PROSE');
}

test('real ratio rejection during early ZIP validation passes, with no extracted output required', async () => {
  const report = await ratio(async bytes => memory(bytes).input), result = report.tests[0]!;
  expect(report.summary).toMatchObject({ total: 1, passed: 1, failed: 0, skipped: 0, cleanupFailures: 0, verdict: 'pass' });
  expect(result).toMatchObject({ actual: 'budget', status: 'pass', notes: ['Failure origin: validation.'] });
  expect(result.counters.bytesRead).toBeGreaterThan(0); expect(result.counters.output).toBe(0);
});

test('preparation with matching category cannot exercise a validation expectation', async () => {
  const test = CORPUS.find(c => c.id === 'ratio')!, create = jest.fn();
  const spy = jest.spyOn(test, 'bytes').mockImplementation(() => { throw privateFailure(); });
  try { const report = await ratio(create); failed(report, 'preparation'); expect(create).not.toHaveBeenCalled(); }
  finally { spy.mockRestore(); }
});

test.each(['reserve', 'copy', 'copy-cleanup'] as const)('single ratio fails acquisition %s with a matching budget category', async kind => {
  const report = await ratio(async () => {
    if (kind === 'reserve') throw privateFailure();
    throw Object.assign(new ScratchFailure({ created: 1, removed: 1, handlesOpened: 1, handlesClosed: 1, failures: kind === 'copy-cleanup' ? 1 : 0 }, 'budget'), { message: privateFailure().message });
  });
  failed(report, 'acquisition'); expect(report.tests[0]!.actual).toBe('budget');
  expect(report.tests[0]!.counters.bytesRead).toBe(0);
  expect(report.summary.cleanupFailures).toBe(kind === 'copy-cleanup' ? 1 : 0);
});

test.each(['sync-read', 'async-read', 'short-read', 'invalid-read', 'size', 'invalid-size'] as const)('adapter %s cannot masquerade as validation inside the processor', async kind => {
  const report = await ratio(async bytes => {
    const { input } = memory(bytes);
    if (kind === 'size') Object.defineProperty(input.file, 'size', { get() { throw privateFailure(); } });
    else if (kind === 'invalid-size') input.file.size = NaN;
    else if (kind === 'sync-read') input.file.read = () => { throw privateFailure(); };
    else input.file.read = async () => {
      if (kind === 'short-read') return new Uint8Array(0);
      if (kind === 'invalid-read') return null as unknown as Uint8Array;
      throw privateFailure();
    };
    return input;
  });
  failed(report, 'read'); expect(report.tests[0]!.actual).toBe('io');
  expect(report.tests[0]!.cleanup).toEqual({ created: 1, removed: 1, handlesOpened: 1, handlesClosed: 1, failures: 0 });
});

test('short read on an integrity fixture is IO, not a passing integrity rejection', async () => {
  const test = CORPUS.find(c => c.id === 'crc')!, { input } = memory(test.bytes());
  input.file.read = async () => new Uint8Array(0);
  await expect(processEpub(input.file, context())).rejects.toMatchObject({ origin: 'read', code: 'io' });
  expect(input.stats.handlesClosed).toBe(1);
});

test('chapter callback cannot inject a validation-origin error', async () => {
  const { input } = memory(makeZip(epubEntries()));
  await expect(processEpub(input.file, context(), { onChapter() { throw privateFailure(); } })).rejects.toMatchObject({ origin: 'assertion', code: 'assertion' });
  expect(input.stats.handlesClosed).toBe(1);
});

test('successful owning close is measured once; later idempotent close adds no count or handle', async () => {
  const { input, close } = memory(makeZip(epubEntries())), ctx = context();
  await processEpub(input.file, ctx);
  expect(close).toHaveBeenCalledTimes(1); expect(ctx.operations.cleanup.calls).toBe(1);
  expect(input.stats.handlesClosed).toBe(1);
  input.file.close(); input.cleanup();
  expect(ctx.operations.cleanup.calls).toBe(1); expect(input.stats.handlesClosed).toBe(1);
  expect(ctx.timings.cleanup).toBeGreaterThanOrEqual(ctx.operations.cleanup.totalMs);
});

test('315 ms owning close is reported by cleanup maxima and fails the unchanged heartbeat gate', async () => {
  let close!: ReturnType<typeof memory>['close'];
  const report = await ratio(async bytes => {
    const created = memory(bytes, () => { const end = performance.now() + 315; while (performance.now() < end) { /* Fault injection. */ } });
    close = created.close; return created.input;
  });
  const result = report.tests[0]!;
  expect(result.status).toBe('pass'); expect(report.summary.verdict).toBe('fail');
  expect(result.longestStallMs).toBeGreaterThan(250);
  expect(result.counters.timings.cleanup).toBeGreaterThanOrEqual(315);
  expect(result.counters.operations.cleanup.maxMs).toBeGreaterThanOrEqual(315);
  expect(result.counters.operations.cleanup.calls).toBe(2); // Owning close and scratch cleanup.
  expect(close).toHaveBeenCalledTimes(1); expect(report.summary.cleanupFailures).toBe(0);
  expect(() => serializeReport(report)).not.toThrow();
});

test.each(['accepted', 'rejected'] as const)('throwing owning close stays failed after successful retry on %s input', async kind => {
  let close!: ReturnType<typeof memory>['close'];
  const acquire = async (bytes: Uint8Array) => { const created = memory(bytes, () => { throw privateFailure(); }); close = created.close; return created.input; };
  const report = kind === 'accepted' ? await runSelected(() => acquire(makeZip(epubEntries())), metadata) : await ratio(acquire);
  failed(report, 'cleanup'); expect(report.tests[0]!.actual).toBe('io');
  expect(close).toHaveBeenCalledTimes(2);
  expect(report.tests[0]!.cleanup).toEqual({ created: 1, removed: 1, handlesOpened: 1, handlesClosed: 1, failures: 1 });
  expect(report.tests[0]!.counters.operations.cleanup.calls).toBe(3);
});

test('persistent close failure remains visible with an unclosed handle', async () => {
  const report = await ratio(async bytes => {
    const { input } = memory(bytes); input.file.close = () => { throw privateFailure(); };
    input.cleanup = () => { input.file.close(); }; return input;
  });
  failed(report, 'cleanup'); expect(report.summary.cleanupFailures).toBeGreaterThan(0);
  expect(report.tests[0]!.cleanup.handlesClosed).toBe(0);
});

test.each(['cancelled', 'validation', 'unexpected'] as const)('%s processing still executes the measured owning close', async kind => {
  const abort = new AbortController(), ctx = context(abort.signal);
  const bytes = kind === 'validation' ? CORPUS.find(c => c.id === 'ratio')!.bytes() : makeZip(epubEntries());
  const { input, close } = memory(bytes);
  if (kind === 'cancelled') ctx.checkpoint = () => abort.abort();
  if (kind === 'unexpected') ctx.checkpoint = () => { throw new Error('PRIVATE_PROVIDER_PATH_AND_PROSE'); };
  await expect(processEpub(input.file, ctx)).rejects.toMatchObject({ origin: kind });
  expect(close).toHaveBeenCalledTimes(1); expect(input.stats.handlesClosed).toBe(1);
  expect(ctx.operations.cleanup.calls).toBe(1);
});

test('scratch cleanup exception cannot turn the genuine expected ratio rejection into PASS', async () => {
  const report = await ratio(async bytes => { const { input } = memory(bytes); input.cleanup = () => { throw privateFailure(); }; return input; });
  failed(report, 'cleanup'); expect(report.tests[0]!.actual).toBe('budget');
  expect(report.summary.cleanupFailures).toBeGreaterThan(0);
});
