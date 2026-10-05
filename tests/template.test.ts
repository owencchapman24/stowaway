import { readerDocument } from '../src/reader/template';
import { allowReaderNavigation } from '../src/reader/navigation';
import { sanitize } from '../src/content/sanitize';
import { fixtureStory } from '../src/fixtures/story';

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
