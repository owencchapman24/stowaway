import { CORPUS } from '../src/epub-spike/corpus';
import { context } from '../src/epub-spike/limits';
import { processEpub } from '../src/epub-spike/package';
import { observeOutput } from '../src/epub-spike/expectations';

describe('deterministic EPUB corpus (same bytes and pipeline as device)', () => {
  test.each(CORPUS)('$id: $name', async (test) => {
    const bytes = test.bytes(), abort = new AbortController(), ctx = context(abort.signal);
    let closed = 0, ticks = 0;
    ctx.checkpoint = (phase) => { if (test.cancel === phase && ++ticks === 2) abort.abort(); };
    const output = test.output ? observeOutput(test.output) : undefined;
    const promise = processEpub({ size: bytes.length, async read(at,n) { return bytes.slice(at, at + n); }, close() { closed++; } }, ctx, {onChapter:output?.chapter});
    if (test.expected === 'accepted') {
      const result = await promise; expect(output!.finish(result)).toBe(true);
      expect(result.packageHash).toMatch(/^[a-f0-9]{64}$/);
    } else await expect(promise).rejects.toMatchObject({ code: test.expected });
    expect(closed).toBe(1);
    expect(ctx.maxInput).toBeLessThanOrEqual(65_536); expect(ctx.maxOutput).toBeLessThanOrEqual(65_536);
  });
});
