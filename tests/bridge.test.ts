/** @jest-environment jsdom */
import { POSITION_BRIDGE } from '../src/reader/bridge';
import { URL as HostURL } from 'node:url';
import type { Locator } from '../src/domain/types';
import { sanitize } from '../src/content/sanitize';
import { extractPostBody } from '../src/sources/spacebattles/parse';
import { threadFromUrl } from '../src/sources/spacebattles/url';
import { bodyArticle } from './fixtures/import';
import { page, threadUrl } from './fixtures/spacebattles';

type BridgeWindow = Window & typeof globalThis & {
  ReactNativeWebView: { postMessage: (raw: string) => void };
  StowawayReader: { flush: () => void; restyle: (size: number, theme: string, font?: string) => void; setInteractionEnabled: (enabled: boolean) => void;
    prepareForExit: (handoffId: string) => void };
};
const bridgeWindow = window as BridgeWindow;
// jest-expo installs a lazy native URL; extraction here runs in host JSDOM.
const presetURL = Object.getOwnPropertyDescriptor(globalThis, 'URL')!;
beforeAll(() => { Object.defineProperty(globalThis, 'URL', { configurable: true, value: HostURL }); });
afterAll(() => { Object.defineProperty(globalThis, 'URL', presetURL); });
let messages: { type: string; locator?: Locator; linkId?: string; handoffId?: string }[];
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
  document.documentElement.dataset.font = 'georgia'; document.documentElement.dataset.theme = 'light';
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
  const inlineSummary = document.querySelector('summary:not([data-block])')!;
  inlineSummary.getBoundingClientRect = () => ({ top: 240 * scale() - y, bottom: 280 * scale() - y, height: 40 * scale() }) as DOMRect;
  const createRange = document.createRange.bind(document);
  jest.spyOn(document, 'createRange').mockImplementation(() => {
    const range = createRange();
    // JSDOM has no layout for Range; use the explicitly emulated inline box.
    range.getClientRects = () => [range.startContainer.parentElement!.getBoundingClientRect()] as unknown as DOMRectList;
    return range;
  });
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

// Real imported/sanitized topology; only layout and native input are emulated.
function importedLayout(html: string, geometry: (element: Element, index: number) => [number, number]) {
  const thread = threadFromUrl(threadUrl);
  const source = extractPostBody({ url: threadUrl, status: 200, html: page(bodyArticle('91', html)) }, thread,
    { postId: '91', chapterId: `${thread.storyId}:post:91`, title: 'Generated', url: threadUrl, threadmarkId: null }, '9');
  const canonical = sanitize(source);
  document.body.innerHTML = `<main id="chapter">${canonical.html}</main>`;
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, get: () => 12000 * scale() });
  jest.mocked(window.scrollTo).mockImplementation(((_x: number, next: number) => {
    y = Math.max(0, Math.min(next, 12000 * scale() - 200)); window.dispatchEvent(new Event('scroll'));
  }) as typeof window.scrollTo);
  Array.from(document.querySelectorAll('[data-block]')).forEach((element, index) => {
    const [top, height] = geometry(element, index);
    const visible = () => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS' && !(parent as HTMLDetailsElement).open &&
          !parent.querySelector('summary')?.contains(element)) return false;
      }
      return true;
    };
    element.getClientRects = () => ({ length: visible() ? 1 : 0 }) as DOMRectList;
    element.getBoundingClientRect = () => ({ top: 24 + top * scale() - y, bottom: 24 + (top + height) * scale() - y,
      height: visible() ? height * scale() : 0 }) as DOMRect;
  });
  return canonical;
}
function sampleAt(top: number) {
  gesture('touchstart', { isTrusted: true }); window.scrollTo(0, top); bridgeWindow.StowawayReader.flush();
  return messages.filter((message) => message.type === 'position').at(-1)!.locator!;
}

const fontGeometry: Record<string, number> = { palatino: 76, serif: 66, sans: 54, baskerville: 72, charter: 82, times: 48, 'avenir-next': 86, 'helvetica-neue': 52, menlo: 92, 'marker-felt': 104 };
test.each(Object.keys(fontGeometry))('font %s reflow restores a deep semantic paragraph, not progression, without transient saves or Read completion', (font) => {
  const canonical = importedLayout(Array.from({ length: 100 }, (_, i) => `<p>Generated paragraph ${i}.</p>`).join(''),
    (_element, index) => index === 0 ? [0, 6000] : [(index - 1) * 60, 42]);
  Array.from(document.querySelectorAll<HTMLElement>('p[data-block]')).forEach((element, index) => {
    element.getBoundingClientRect = () => {
      const step = fontGeometry[document.documentElement.dataset.font!] ?? 60;
      const top = 24 + index * step + (step === 60 ? 0 : index % 5 * 2) - y;
      return { top, bottom: top + 42, height: 42 } as DOMRect;
    };
  });
  const before = document.getElementById('chapter')!.innerHTML;
  run(null); const sampled = sampleAt(3039);
  expect(sampled).toMatchObject({ blockId: canonical.blockIds[51], offset: 15 });
  bridgeWindow.StowawayReader.restyle(20, 'paper', font); jest.runAllTimers();
  const step = fontGeometry[font]!;
  expect(y).toBeCloseTo(24 + 50 * step + 15);
  expect(Math.abs(y - sampled.progression * 11800)).toBeGreaterThan(200);
  expect(messages.filter((message) => message.type === 'position')).toHaveLength(1);
  expect(document.documentElement.dataset).toMatchObject({ theme: 'paper', font });
  expect(completions()).toEqual([]); expect(document.getElementById('chapter')!.innerHTML).toBe(before);
  bridgeWindow.StowawayReader.prepareForExit('font-handoff');
  expect(messages.at(-1)).toMatchObject({ type: 'quiesced', handoffId: 'font-handoff' });
});

test('bridge rejects unknown font and theme before starting layout or flushing', () => {
  run(null); const before = [...messages];
  bridgeWindow.StowawayReader.restyle(20, 'paper', 'url(https://invalid.example)');
  bridgeWindow.StowawayReader.restyle(20, 'unknown', 'palatino');
  expect(messages).toEqual(before); expect(document.documentElement.dataset.font).toBe('georgia');
});

test.each([14, 32])('hardening: imported paragraph gap anchors locally through font size %s', (size) => {
  const canonical = importedLayout(Array.from({ length: 100 }, (_, i) => `<p>Generated line ${i}.</p>`).join(''),
    (_element, index) => index === 0 ? [0, 5300] : [(index - 1) * 53, 33]);
  const before = document.getElementById('chapter')!.innerHTML;
  run(null); expect(messages.map((message) => message.type)).toEqual(['ready']);
  const sampled = sampleAt(2664);
  expect(sampled).toMatchObject({ blockId: canonical.blockIds[51], offset: 0 });
  bridgeWindow.StowawayReader.restyle(size, 'light'); jest.runAllTimers();
  expect(y).toBeCloseTo(24 + 2650 * size / 20);
  expect(messages.filter((message) => message.type === 'position')).toHaveLength(1);
  expect(completions()).toEqual([]); expect(document.getElementById('chapter')!.innerHTML).toBe(before);
});

test('hardening: reading within imported paragraph still uses its local offset', () => {
  importedLayout('<p>First.</p><p>Second.</p>', (_element, index) => index === 0 ? [0, 10000] : [index * 100, 40]);
  run(null); expect(sampleAt(234)).toMatchObject({ blockId: 'block-0003', offset: 10 });
});

test.each([
  ['nested wrappers', '<div><div><p>First.</p><p>Second.</p></div></div>', 'p:last-child'],
  ['heading', '<h2>Heading</h2><p>Text.</p>', 'h2'],
  ['list', '<ul><li>First.</li><li>Second.</li></ul>', 'li:last-child'],
  ['quote', '<blockquote><p>Quoted text.</p></blockquote>', 'p'],
  ['table', '<table><tbody><tr><td>Cell.</td></tr></tbody></table>', 'td'],
  ['pre', '<pre>Generated preformatted text.</pre>', 'pre'],
  ['direct inline text', '<div><span>Direct <strong>readable</strong> text.</span></div>', 'div div'],
])('hardening: meaningful %s wins over giant structural ancestors', (_name, html, selector) => {
  importedLayout(html, (element) => element.matches(selector) ? [500, 40]
    : /^(P|LI|SUMMARY|H2|TD|PRE|IMG)$/.test(element.tagName) ? [100, 40] : [0, 10000]);
  const target = document.querySelector(`#chapter ${selector}`)!;
  run(null); expect(sampleAt(514)).toMatchObject({ blockId: target.id, offset: 0 });
});

test.each([false, true])('hardening: spoiler summary/descendant visibility (open=%s)', (open) => {
  importedLayout('<details><summary>Disclosure</summary><div><p>Hidden paragraph.</p></div></details><p>Following.</p>',
    (element) => element.tagName === 'SUMMARY' ? [300, 40] : element.tagName === 'P'
      ? [element.closest('details') ? 500 : 1000, 40] : [0, 10000]);
  document.querySelector('details')!.open = open; run(null);
  const target = document.querySelector(open ? 'details p' : 'summary')!;
  expect(sampleAt(open ? 514 : 314)).toMatchObject({ blockId: target.id, offset: 0 });
});

test.each([false, true])('hardening: image or placeholder anchors its canonical block (local=%s)', (local) => {
  const canonical = importedLayout('<p>Before.</p><img src="https://example.com/generated.png"><p>After.</p>',
    (element, index) => index === 2 ? [500, 200] : element.tagName === 'P' ? [100, 40] : [0, 10000]);
  const imageBlock = document.getElementById(canonical.blockIds[2]!)!;
  if (local) imageBlock.innerHTML = '<img src="source-image-0.png" alt="Generated">';
  run(null); expect(sampleAt(514)).toMatchObject({ blockId: imageBlock.id, offset: 0 });
  expect(canonical.blockIds[2]).toBe(imageBlock.id);
});

test.each([false, true])('hardening: mixed direct text remains local without claiming child whitespace (at text=%s)', (atText) => {
  importedLayout('<div><span>Direct container text.</span><p>First child.</p><p>Second child.</p></div>',
    (element) => element.tagName === 'P' ? [element.matches('p:last-child') ? 500 : 200, 40] : [0, 10000]);
  const inline = document.querySelector('span')!;
  inline.getBoundingClientRect = () => ({ top: 124 * scale() - y, bottom: 164 * scale() - y, height: 40 * scale() }) as DOMRect;
  const target = document.querySelector(atText ? '#chapter > div > div' : 'p:last-child')!;
  run(null);
  expect(sampleAt(atText ? 134 : 514)).toMatchObject({ blockId: target.id, offset: atText ? 110 : 0 });
});

test('hardening: final gap falls back to nearby previous prose rather than a wrapper', () => {
  importedLayout('<div><p>Last paragraph.</p></div>', (element) => element.tagName === 'P' ? [500, 40] : [0, 10000]);
  const target = document.querySelector('p')!; run(null);
  expect(sampleAt(574)).toMatchObject({ blockId: target.id, offset: 50 });
});

test('prepareForExit flushes the dirty locator before matching quiescence and freezes fresh trusted input until recovery', () => {
  run(null); gesture('touchstart', { isTrusted: true }); readingGesture(); window.scrollTo(0, 300);
  bridgeWindow.StowawayReader.prepareForExit('handoff-A');
  expect(messages.map((message) => message.type)).toEqual(['ready', 'position', 'quiesced']);
  expect(messages.at(-1)).toEqual({ type: 'quiesced', handoffId: 'handoff-A', session: 'session', chapterId: 'chapter', contentHash: 'hash' });
  window.scrollTo(0, 800); readingGesture('touchend'); readingGesture('click', true, document.querySelector('a')!);
  jest.runAllTimers(); expect(completions()).toEqual([]); expect(messages.filter((message) => message.type === 'link')).toEqual([]);
  expect(messages.filter((message) => message.type === 'position')).toHaveLength(1);
  bridgeWindow.StowawayReader.setInteractionEnabled(true); window.dispatchEvent(new Event('scroll'));
  expect(completions()).toEqual([]); readingGesture('touchend'); expect(completions()).toHaveLength(1);
});

test('already generated completion precedes quiescence and stays deduplicated after failed-handoff recovery', () => {
  run(null); gesture('touchstart', { isTrusted: true }); readingGesture(); window.scrollTo(0, 800);
  bridgeWindow.StowawayReader.prepareForExit('handoff-A');
  expect(messages.map((message) => message.type)).toEqual(['ready', 'read-end', 'position', 'quiesced']);
  bridgeWindow.StowawayReader.setInteractionEnabled(true); readingGesture('touchend');
  bridgeWindow.StowawayReader.prepareForExit('handoff-B');
  expect(completions()).toHaveLength(1); expect(messages.at(-1)?.handoffId).toBe('handoff-B');
});

test('quiescing while restoration is pending does not save a transient locator or resume trusted input on ready', () => {
  new Function('CONFIG', POSITION_BRIDGE)({ session: 'session', chapterId: 'chapter', contentHash: 'hash', locator });
  bridgeWindow.StowawayReader.prepareForExit('handoff-A');
  expect(messages.map((message) => message.type)).toEqual(['quiesced']);
  jest.runAllTimers(); window.scrollTo(0, 800); readingGesture('touchend');
  expect(messages.map((message) => message.type)).toEqual(['quiesced', 'ready']);
});

test('invalid handoff command arguments never produce a quiescence acknowledgement', () => {
  run(null);
  for (const invalid of ['', 'x'.repeat(101), 'bad id', null, 1, {}]) {
    bridgeWindow.StowawayReader.prepareForExit(invalid as string);
  }
  expect(messages.map((message) => message.type)).toEqual(['ready']);
  readingGesture(); window.scrollTo(0, 800); expect(completions()).toHaveLength(1);
});

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
