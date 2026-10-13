/** M1a acceptance budgets, not EPUB conformance or a native memory guarantee. */
export const LIMITS = Object.freeze({
  archive: 100 * 1024 * 1024, members: 10_000, central: 4 * 1024 * 1024,
  output: 256 * 1024 * 1024, spine: 2_000, buffer: 65_536,
  smallXml: 65_536, xml: 1_000_000, xhtml: 4_000_000, string: 1_000_000,
  depth: 64, nodes: 30_000, attributes: 64, attribute: 65_536,
  path: 1024, segment: 255, canonical: 64 * 1024 * 1024,
  metadata: 65_536, images: 2_000, imageBytes: 64 * 1024 * 1024,
  chapterImages: 32, chapterPixels: 8_388_608, reserve: 512 * 1024 * 1024,
});

export type FailureCode = 'zip' | 'path' | 'integrity' | 'budget' | 'xml' | 'namespace' |
  'unsupported' | 'encryption' | 'package' | 'cancelled' | 'io' | 'policy' | 'assertion';
export class EpubFailure extends Error {
  constructor(readonly code: FailureCode) { super(`EPUB diagnostic: ${code}`); this.name = 'EpubFailure'; }
}
export function requireEpub(condition: unknown, code: FailureCode): asserts condition {
  if (!condition) throw new EpubFailure(code);
}
export function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw new EpubFailure('cancelled'); }

export type Phase = 'index' | 'inflate' | 'resource' | 'chapter' | 'hash' | 'xml';
// Fixed, content-free operation names. These measure calls, not heartbeat causality.
export const OPERATIONS = ['xmlDecode', 'xmlParse', 'canonicalEscape', 'canonicalJoin', 'sanitize',
  'contentHash', 'packageHash', 'imageValidate', 'imageHash', 'outputAssembly', 'expectations', 'cleanup'] as const;
export type Operation = typeof OPERATIONS[number];
export type Operations = Record<Operation, { calls: number; totalMs: number; maxMs: number }>;
export const TIMINGS = ['index', 'inflate', 'xml', 'xmlParse', 'xmlNormalize', 'xmlPreflight', 'xmlNamespaces',
  'canonical', 'canonicalRewrite', 'contentHash', 'sanitize', 'hash', 'read', 'acquire', 'cleanup'] as const;
export interface Context {
  signal?: AbortSignal;
  checkpoint?: (phase: Phase) => void;
  lastYield: number;
  output: number;
  bytesRead: number;
  compressed: number;
  maxInput: number;
  maxOutput: number;
  operations: Operations;
  timings: Record<typeof TIMINGS[number], number>;
}
export function context(signal?: AbortSignal): Context {
  return { signal, lastYield: performance.now(), output: 0, bytesRead: 0, compressed: 0,
    operations: Object.fromEntries(OPERATIONS.map((key) => [key, { calls: 0, totalMs: 0, maxMs: 0 }])) as Operations,
    maxInput: 0, maxOutput: 0, timings: Object.fromEntries(TIMINGS.map((key) => [key, 0])) as Context['timings'] };
}
export async function measureStage<T>(ctx: Context, stage: typeof TIMINGS[number], work: () => Promise<T>): Promise<T> {
  const started = performance.now();
  try { return await work(); } finally { ctx.timings[stage] += performance.now() - started; }
}
/** Use only around synchronous work. Async stage wall time is recorded separately. */
export function measureSync<T>(ctx: Context, operation: Operation, work: () => T): T {
  const started = performance.now();
  try { return work(); } finally {
    const elapsed = performance.now() - started, measurement = ctx.operations[operation];
    measurement.calls++; measurement.totalMs += elapsed; measurement.maxMs = Math.max(measurement.maxMs, elapsed);
  }
}
/** Timers can run between bounded units; this cannot interrupt a synchronous parser. */
export async function checkpoint(ctx: Context, phase: Phase, force = false) {
  ctx.checkpoint?.(phase); checkAbort(ctx.signal);
  if (force || performance.now() - ctx.lastYield >= 8) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    ctx.lastYield = performance.now(); checkAbort(ctx.signal);
  }
}
