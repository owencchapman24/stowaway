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
