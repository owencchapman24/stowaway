import { parseMessage, PositionSession, type ReaderMessage } from '../src/reader/position';
import type { Chapter, Locator } from '../src/domain/types';

const chapter: Chapter = { id: 'fixture:thread:1001:post:2001', storyId: 'fixture:thread:1001', title: 'One', position: 0,
  html: '', contentHash: 'hash', sanitizerVersion: '1', blockIds: ['block-0001', 'block-0002'], links: { 'link-1': 'https://example.com/' } };
const identity = { session: 'session-1', chapterId: chapter.id, contentHash: chapter.contentHash };
const locator: Locator = { chapterId: chapter.id, contentHash: 'hash', blockId: 'block-0002',
  offset: 67, progression: 0.5, expandedSpoilers: ['block-0001'] };
const position = (value = locator): ReaderMessage => ({ ...identity, type: 'position', locator: value, reason: 'scroll' });
const phase = (type: 'ready' | 'layout-start'): ReaderMessage => ({ ...identity, type });

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

test.each([false, true])('hardening: older failure never retries over queued newer sample (newer fails=%s)', async (newerFails) => {
  const entered = gate(), finish = gate(); let saved = 0;
  const save = jest.fn(async (value: Locator) => {
    if (save.mock.calls.length === 1) { entered.release(); await finish.promise; throw new Error('A rollback'); }
    if (newerFails && save.mock.calls.length === 2) throw new Error('B rollback');
    saved = value.offset;
  });
  const session = new PositionSession(save, jest.fn()); session.receive(phase('ready'));
  session.receive(position({ ...locator, offset: 10 })); const a = session.flush().catch(() => {}); await entered.promise;
  session.receive(position({ ...locator, offset: 20 })); const b = session.flush().catch(() => {});
  finish.release(); await Promise.all([a, b]); await session.flush();
  expect(saved).toBe(20);
  expect(save.mock.calls.map(([value]) => value.offset)).toEqual(newerFails ? [10, 20, 20] : [10, 20]);
  session.dispose();
});

test('hardening: newer merely pending sample survives older failure', async () => {
  const entered = gate(), finish = gate();
  const save = jest.fn(async (_value: Locator) => {
    if (save.mock.calls.length === 1) { entered.release(); await finish.promise; throw new Error('A rollback'); }
  });
  const session = new PositionSession(save, jest.fn()); session.receive(phase('ready'));
  session.receive(position({ ...locator, offset: 10 })); const a = session.flush().catch(() => {}); await entered.promise;
  session.receive(position({ ...locator, offset: 20 })); finish.release(); await a; await session.flush();
  expect(save.mock.calls.map(([value]) => value.offset)).toEqual([10, 20]); session.dispose();
});

test.each([[true, false, false], [true, true, false], [true, false, true], [false, true, true]])(
  'hardening: rapid samples and overlapping background/exit/dispose preserve latest (%s/%s/%s)', async (aFails, bFails, cFails) => {
    const entered = gate(), finish = gate(); const failures = [aFails, bFails, cFails]; let saved = 0;
    const save = jest.fn(async (value: Locator) => {
      const call = save.mock.calls.length - 1;
      if (call === 0) { entered.release(); await finish.promise; }
      if (failures[call]) throw new Error('Synthetic rollback');
      saved = value.offset;
    });
    const session = new PositionSession(save, jest.fn()); session.receive(phase('ready'));
    const flushes: Promise<void>[] = [];
    for (const offset of [10, 20, 30]) {
      session.receive(position({ ...locator, offset })); flushes.push(session.flush().catch(() => {}));
      if (offset === 10) await entered.promise;
    }
    const background = session.flush().catch(() => {}); session.dispose(); finish.release();
    await Promise.all([...flushes, background]); await session.flush();
    expect(saved).toBe(30);
    expect(save.mock.calls.map(([value]) => value.offset)).toEqual(cFails ? [10, 20, 30, 30] : [10, 20, 30]);
  });

test('loading/restoration/typography cannot overwrite a saved passage with temporary top', async () => {
  let saved = locator;
  const save = jest.fn(async (value: Locator) => { saved = value; });
  const session = new PositionSession(save, jest.fn());
  const top = { ...locator, blockId: 'block-0001', offset: 0, progression: 0 };
  session.receive(position(top));
  session.receive(phase('ready')); // A ready handshake itself never saves.
  await session.flush();
  expect(saved).toEqual(locator);
  expect(save).not.toHaveBeenCalled();
  session.receive(position());
  session.receive(phase('layout-start'));
  session.receive(position(top));
  await session.flush();
  expect(saved).toEqual(locator);
  session.receive(phase('ready'));
  await session.flush();
  expect(save).toHaveBeenCalledTimes(1);
  session.dispose();
});

test('debounces scrolling and flush waits for an already in-flight save', async () => {
  let finish: (() => void) | undefined;
  const save = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  const session = new PositionSession(save, jest.fn());
  session.receive(phase('ready'));
  session.receive(position({ ...locator, offset: 10 }));
  session.receive(position({ ...locator, offset: 20 }));
  await jest.advanceTimersByTimeAsync(300);
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith({ ...locator, offset: 20 });
  let flushed = false;
  const flushing = session.flush().then(() => { flushed = true; });
  await Promise.resolve();
  expect(flushed).toBe(false);
  finish!();
  await flushing;
  session.dispose();
});

test('a failed save is retryable without inventing a new locator', async () => {
  const save = jest.fn().mockRejectedValueOnce(new Error('full')).mockResolvedValue(undefined);
  const session = new PositionSession(save, jest.fn());
  session.receive(phase('ready'));
  session.receive(position());
  await expect(session.flush()).rejects.toThrow('full');
  await session.flush();
  expect(save).toHaveBeenLastCalledWith(locator);
  session.dispose();
});

test('validates identity, session, version, message shape, block IDs and finite offsets', () => {
  const raw = (value: unknown) => JSON.stringify(value);
  expect(parseMessage(raw(position()), chapter, identity.session)).toEqual(position());
  for (const bad of [null, {}, { ...position(), session: 'old' }, { ...position(), chapterId: 'other' },
    { ...position(), contentHash: 'old' }, { ...position(), type: 'eval' },
    position({ ...locator, offset: -1 }), position({ ...locator, progression: 1.1 }),
    position({ ...locator, blockId: 'spoof' }), position({ ...locator, expandedSpoilers: ['spoof'] }),
    { ...position(), locator: { ...locator, offset: '1' } },
    { ...identity, type: 'link', linkId: '__proto__' }]) {
    expect(parseMessage(raw(bad), chapter, identity.session)).toBeNull();
  }
  expect(parseMessage('not JSON', chapter, identity.session)).toBeNull();
  expect(parseMessage('x'.repeat(16_001), chapter, identity.session)).toBeNull();
});

test.each([
  { session: 'other' }, { chapterId: 'other' }, { contentHash: 'other' }, { type: 'read-end-forged' },
  { locator }, { progression: 1 }, { session: null }, { chapterId: 1 }, { contentHash: null },
])('read-end rejects mismatched identity/types and extra fields: %j', (override) => {
  expect(parseMessage(JSON.stringify({ ...identity, type: 'read-end', ...override }), chapter, identity.session)).toBeNull();
});
test('read-end accepts only the exact four-field current identity, under the existing 16KB cap', () => {
  const message = { ...identity, type: 'read-end' };
  expect(parseMessage(JSON.stringify(message), chapter, identity.session)).toEqual(message);
  expect(parseMessage(JSON.stringify({ ...message, extra: 'x'.repeat(16_000) }), chapter, identity.session)).toBeNull();
});

test('quiesced accepts only a bounded handoff id with the exact current identity and message shape', () => {
  const message = { ...identity, type: 'quiesced', handoffId: 'session-1:2' };
  expect(parseMessage(JSON.stringify(message), chapter, identity.session)).toEqual(message);
  for (const fields of [{ handoffId: undefined }, { handoffId: null }, { handoffId: 1 }, { handoffId: {} },
    { handoffId: '' }, { handoffId: 'x'.repeat(101) }, { handoffId: 'bad id' }, { extra: true },
    { type: 'quiesced-forged' }, { session: 'old' }, { chapterId: 'other' }, { contentHash: 'old' }]) {
    expect(parseMessage(JSON.stringify({ ...message, ...fields }), chapter, identity.session)).toBeNull();
  }
});
