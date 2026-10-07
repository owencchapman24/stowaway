/** @jest-environment jsdom */
import { POSITION_BRIDGE } from '../src/reader/bridge';
import type { Locator } from '../src/domain/types';

type BridgeWindow = Window & typeof globalThis & {
  ReactNativeWebView: { postMessage: (raw: string) => void };
  StowawayReader: { flush: () => void; restyle: (size: number, theme: string) => void; setInteractionEnabled: (enabled: boolean) => void };
};
const bridgeWindow = window as BridgeWindow;
let messages: { type: string; locator?: Locator; linkId?: string }[];
let y: number;
let documentListeners: Map<string, EventListenerOrEventListenerObject[]>;
let cleanups: (() => void)[];
const locator: Locator = { chapterId: 'chapter', contentHash: 'hash', blockId: 'block-0005',
  offset: 35, progression: 0.3, expandedSpoilers: [] };

beforeEach(() => {
  jest.useFakeTimers();
  messages = [];
  y = 0;
  documentListeners = new Map();
  cleanups = [];
  document.documentElement.style.setProperty('--font-size', '20px');
  document.body.innerHTML = `<main id="chapter"><p id="block-0001" data-block>First</p>
    <details id="block-0002" data-block><summary id="block-0003" data-block>Outer</summary>
    <details id="block-0004" data-block><summary>Inner</summary><p id="block-0005" data-block>Target paragraph</p>
    </details></details><a href="https://example.com/" data-link="link-1">Safe link</a></main>`;
  Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 200 });
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y });
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, get: () => 1000 * scale() });
  jest.spyOn(window, 'scrollTo').mockImplementation(((_x: number, nextY: number) => {
    y = Math.max(0, Math.min(nextY, 1000 * scale() - 200));
    window.dispatchEvent(new Event('scroll'));
  }) as typeof window.scrollTo);
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) =>
    setTimeout(() => callback(0), 16) as unknown as number);
  bridgeWindow.ReactNativeWebView = { postMessage: (raw) => messages.push(JSON.parse(raw)) };
  const geometry: Record<string, [number, number]> = {
    'block-0001': [0, 200], 'block-0002': [200, 250], 'block-0003': [200, 40],
    'block-0004': [240, 160], 'block-0005': [280, 120],
  };
  for (const element of document.querySelectorAll<HTMLElement>('[data-block]')) {
    const [top, height] = geometry[element.id]!;
    element.getClientRects = () => ({ length: element.closest('details:not([open])') ? 0 : 1 }) as DOMRectList;
    element.getBoundingClientRect = () => ({ top: top * scale() - y, bottom: (top + height) * scale() - y,
      height: height * scale() }) as DOMRect;
  }
  const documentAdd = document.addEventListener.bind(document);
  jest.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
    documentListeners.set(type, [...documentListeners.get(type) ?? [], listener]);
    documentAdd(type, listener, options);
    cleanups.push(() => document.removeEventListener(type, listener, options));
  });
  const windowAdd = window.addEventListener.bind(window);
  jest.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    windowAdd(type, listener, options);
    cleanups.push(() => window.removeEventListener(type, listener, options));
  });
});
afterEach(() => { cleanups.forEach((cleanup) => cleanup()); jest.restoreAllMocks(); jest.useRealTimers(); });

function scale() { return Number.parseFloat(document.documentElement.style.getPropertyValue('--font-size')) / 20; }
function run(saved: Locator | null) {
  // Exercise the exact app-owned script against a DOM with deterministic emulated geometry.
  new Function('CONFIG', POSITION_BRIDGE)({ session: 'session', chapterId: 'chapter', contentHash: 'hash', locator: saved });
  jest.runAllTimers();
}
function gesture(type: string, event: Partial<Event>) {
  for (const listener of documentListeners.get(type) ?? []) (listener as EventListener)({ type, ...event } as Event);
}

function readingGesture(type = 'touchmove', trusted = true, target: EventTarget = document.getElementById('block-0001')!) {
  gesture(type, { isTrusted: trusted, target, preventDefault: jest.fn() });
}
const completions = () => messages.filter((message) => message.type === 'read-end');

test('replacement freeze blocks trusted reading/link events, preserves the last locator and requires fresh input after recovery', () => {
  run(null); gesture('touchstart', { isTrusted: true }); readingGesture(); window.scrollTo(0, 300);
  bridgeWindow.StowawayReader.setInteractionEnabled(false); bridgeWindow.StowawayReader.flush();
  expect(messages.filter((message) => message.type === 'position')).toHaveLength(1);
  window.scrollTo(0, 800); readingGesture('touchend'); readingGesture('click', true, document.querySelector('a')!);
  jest.runAllTimers();
  expect(completions()).toEqual([]); expect(messages.filter((message) => message.type === 'link')).toEqual([]);
  bridgeWindow.StowawayReader.setInteractionEnabled(true); window.dispatchEvent(new Event('scroll'));
  expect(completions()).toEqual([]); readingGesture('touchend'); expect(completions()).toHaveLength(1);
});

test('freezing does not retract an already generated completion or duplicate it after unfreezing', () => {
  run(null); readingGesture(); window.scrollTo(0, 800); expect(completions()).toHaveLength(1);
  bridgeWindow.StowawayReader.setInteractionEnabled(false); bridgeWindow.StowawayReader.flush();
  bridgeWindow.StowawayReader.setInteractionEnabled(true); readingGesture('touchend');
  expect(completions()).toHaveLength(1);
});

test('opening/restoring at bottom and background/pagehide/flush alone never complete a chapter', () => {
  run({ ...locator, contentHash: 'old', progression: 1 });
  expect(y).toBe(800); bridgeWindow.StowawayReader.flush(); window.dispatchEvent(new Event('pagehide'));
  expect(completions()).toEqual([]);
});
test('restyle/programmatic restore to bottom resets the scrolling gesture without completing', () => {
  run(null); readingGesture(); window.scrollTo(0, 600);
  bridgeWindow.StowawayReader.restyle(14, 'light'); jest.runAllTimers();
  window.scrollTo(0, 500); jest.runAllTimers();
  expect(completions()).toEqual([]);
});
test('trusted scrolling input to live end emits exactly once, even after reflow and repeated bottom scrolling', () => {
  run(null); readingGesture(); window.scrollTo(0, 790); jest.runAllTimers();
  expect(completions()).toEqual([{ type: 'read-end', session: 'session', chapterId: 'chapter', contentHash: 'hash' }]);
  readingGesture(); window.scrollTo(0, 800); bridgeWindow.StowawayReader.restyle(20, 'dark'); jest.runAllTimers();
  readingGesture('touchend'); expect(completions()).toHaveLength(1);
});
test('ordinary programmatic scroll after a trusted pointerdown cannot complete', () => {
  run(null); readingGesture('pointerdown'); window.scrollTo(0, 800); jest.runAllTimers();
  expect(completions()).toEqual([]);
});
test('untrusted synthetic input and scroll cannot complete', () => {
  run(null); readingGesture('touchmove', false); window.scrollTo(0, 800); readingGesture('touchend', false);
  expect(completions()).toEqual([]);
});
test('user engagement away from the end does not complete, and an expired gesture cannot authorize later layout scrolls', () => {
  run(null); readingGesture(); window.scrollTo(0, 300); expect(completions()).toEqual([]);
  jest.advanceTimersByTime(1201); window.scrollTo(0, 800); expect(completions()).toEqual([]);
});
test.each(['load', 'error'])('image %s/geometry alone invalidates prior scrolling input and never completes', (event) => {
  const image = document.createElement('img'); document.getElementById('chapter')!.append(image);
  let height = 1000;
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, get: () => height });
  run(null); readingGesture(); window.scrollTo(0, 600);
  height = 800; image.dispatchEvent(new Event(event)); window.dispatchEvent(new Event('scroll'));
  expect(completions()).toEqual([]);
  readingGesture('touchend'); expect(completions()).toHaveLength(1);
});
test('geometry change alone rejects a still-recent gesture even without an image event', () => {
  run(null); readingGesture(); window.scrollTo(0, 600);
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 800 });
  window.dispatchEvent(new Event('scroll')); expect(completions()).toEqual([]);
});
test('a no-scroll chapter stays Unread on open, then trusted text interaction can complete', () => {
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 150 });
  run(null); expect(completions()).toEqual([]);
  readingGesture('touchend'); expect(completions()).toHaveLength(1);
});
test('restored end requires fresh trusted interaction; safe links and spoilers remain separate actions', () => {
  run({ ...locator, contentHash: 'old', progression: 1 }); expect(completions()).toEqual([]);
  readingGesture('click', true, document.querySelector('summary')!); expect(completions()).toEqual([]);
  readingGesture('click', true, document.querySelector('a')!); expect(messages.filter((m) => m.type === 'link')).toHaveLength(1);
  expect(completions()).toEqual([]); readingGesture('touchend'); expect(completions()).toHaveLength(1);
});
test('interaction while restoration is not ready and outside chapter content cannot complete', () => {
  new Function('CONFIG', POSITION_BRIDGE)({ session: 'session', chapterId: 'chapter', contentHash: 'hash', locator: { ...locator, contentHash: 'old', progression: 1 } });
  readingGesture('touchend'); expect(completions()).toEqual([]); jest.runAllTimers();
  readingGesture('touchend', true, document.body); expect(completions()).toEqual([]);
});

test.each([false, true])('same-hash restoration retains logical image block identity with local image available=%s', (available) => {
  const target = document.getElementById('block-0005')!;
  target.innerHTML = available ? '<img src="source-image-0.png" alt="Synthetic">' : '[Local image unavailable]';
  const top = available ? 440 : 280;
  target.getBoundingClientRect = () => ({ top: top - y, bottom: top + 120 - y, height: 120 }) as DOMRect;
  run(locator);
  expect(y).toBe(top + locator.offset); expect(document.getElementById(locator.blockId)).toBe(target);
  expect(messages.map((message) => message.type)).toEqual(['ready']);
  bridgeWindow.StowawayReader.flush(); expect(messages.filter((message) => message.type === 'position')).toHaveLength(0);
});

test('restores the same block and spoiler ancestors; initial/reflow scrolls never save top', () => {
  run(locator);
  expect(y).toBe(315);
  expect(document.querySelectorAll('details[open]')).toHaveLength(2);
  expect(messages.map((message) => message.type)).toEqual(['ready']);
  bridgeWindow.StowawayReader.flush();
  expect(messages.filter((message) => message.type === 'position')).toHaveLength(0);
  gesture('touchstart', { isTrusted: true });
  window.scrollTo(0, 335);
  // Reflow flushes the last real reading position before pausing the bridge.
  bridgeWindow.StowawayReader.restyle(32, 'dark');
  jest.runAllTimers();
  const positions = messages.filter((message) => message.type === 'position');
  expect(positions).toHaveLength(1);
  expect(positions[0]?.locator).toMatchObject({ blockId: 'block-0005', offset: 55 });
  expect(y).toBe(503); // New block top (280 * 1.6) + offset 55.
  expect(document.documentElement.dataset.theme).toBe('dark');
  window.dispatchEvent(new Event('scroll'));
  jest.runAllTimers();
  bridgeWindow.StowawayReader.flush();
  expect(messages.filter((message) => message.type === 'position')).toHaveLength(1);
});

test('changed content uses progression', () => {
  run({ ...locator, contentHash: 'old', progression: 0.5 });
  expect(y).toBe(400);
  expect(document.querySelectorAll('details[open]')).toHaveLength(0);
  expect(messages.some((message) => message.type === 'position')).toBe(false);
});

test('a missing same-version block uses progression without saving the fallback', () => {
  run({ ...locator, blockId: 'block-missing', progression: 0.5 });
  expect(y).toBe(400);
  expect(messages.some((message) => message.type === 'position')).toBe(false);
});

test('restoring a closed spoiler summary leaves that spoiler closed', () => {
  run({ ...locator, blockId: 'block-0003', offset: 0 });
  expect(document.querySelectorAll('details[open]')).toHaveLength(0);
});

test('safe-link actions require a trusted click and automatic clicks never navigate', () => {
  run(null);
  const preventDefault = jest.fn();
  const target = document.querySelector('a')!;
  gesture('click', { target, preventDefault, isTrusted: false } as Partial<Event>);
  expect(messages.some((message) => message.type === 'link')).toBe(false);
  gesture('click', { target, preventDefault, isTrusted: true } as Partial<Event>);
  expect(preventDefault).toHaveBeenCalledTimes(2);
  expect(messages.find((message) => message.type === 'link')?.linkId).toBe('link-1');
});
