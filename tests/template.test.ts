import { readerDocument } from '../src/reader/template';
import { allowReaderNavigation } from '../src/reader/navigation';
import { sanitize } from '../src/content/sanitize';
import { fixtureStory } from '../src/fixtures/story';
import { READER_FONT_STACKS } from '../src/reader/appearance';
import type { Preferences, ReaderFont } from '../src/domain/types';
import { READER_FONTS } from '../src/domain/preferences';
import { expectedReadingFonts } from './fixtures/reader-fonts';

const expectedStacks = Object.fromEntries(expectedReadingFonts.map(({ key, stack }) => [key, stack])) as Record<ReaderFont, string>;
test.each(Object.keys(expectedStacks) as ReaderFont[])('reader %s font is selected only from local app-owned CSS', (font) => {
  const content = sanitize('<p>Original synthetic paragraph.</p>');
  const html = readerDocument({ ...content, id: 'one', storyId: 'story', title: 'Generated', position: 0, contentHash: 'hash' },
    null, { theme: 'paper', fontSize: 20, font }, '11111111-1111-4111-8111-111111111111');
  expect(html).toContain(`data-theme="paper" data-font="${font}"`);
  expect(READER_FONT_STACKS).toEqual(expectedStacks);
  expect([...READER_FONTS].sort()).toEqual(Object.keys(expectedStacks).sort());
  expect(html).toContain(`:root[data-font="${font}"] { --reader-font:${expectedStacks[font]}; }`);
  expect(html).toContain('--paper:#eee8dd; --ink:#332e27; --link:#6b512e');
  expect(html).toContain(`<main id="chapter">${content.html}</main>`);
  expect(html).toContain("font-src 'none'"); expect(html).not.toContain('@font-face');
  expect(html).not.toMatch(/@import|url\s*\(|https?:\/\//i);
});

test('invalid persisted font/theme/size cannot inject CSS or script into the generated reader', () => {
  const content = sanitize('<p>Unchanged.</p>');
  const html = readerDocument({ ...content, id: 'one', storyId: 'story', title: 'Generated', position: 0, contentHash: 'hash' },
    null, { theme: '\"><script>injected()</script>', fontSize: '20; background:url(https://invalid.example)', font: '\"; evil' } as unknown as Preferences,
    '11111111-1111-4111-8111-111111111111');
  expect(html).toContain('data-theme="light" data-font="georgia"');
  expect(html).toContain('--font-size: 20px'); expect(html).not.toContain('injected()'); expect(html).not.toContain('invalid.example');
});

test('document embeds only the app bridge and restrictive local resource policy', () => {
  const content = sanitize(fixtureStory.chapters[0]!.sourceHtml);
  const html = readerDocument({ ...content, id: 'one', storyId: 'story', title: '</title><script>evil()</script>', position: 0, contentHash: 'hash' },
    null, { theme: 'dark', fontSize: 24 }, '11111111-1111-4111-8111-111111111111');
  expect(html.match(/<script /g)).toHaveLength(1);
  expect(html).toContain("connect-src 'none'");
  expect(html).toContain("default-src 'none'");
  expect(html).toContain("font-src 'none'");
  expect(html).not.toContain('__STOWAWAY_SOURCE_SCRIPT_RAN__');
  expect(html).not.toContain('https://invalid.example');
  expect(html).not.toContain('<script>evil()');
});

test('navigation permits only the current disposable local document', () => {
  const uri = 'file:///documents/reader/session/index.html';
  expect(allowReaderNavigation(uri, uri)).toBe(true);
  for (const url of ['https://example.com/', 'javascript:evil()', 'file:///documents/stowaway-s0.db',
    'file:///documents/reader/session/../other/index.html', 'about:blank']) {
    expect(allowReaderNavigation(url, uri)).toBe(false);
  }
});
