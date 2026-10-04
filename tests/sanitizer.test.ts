import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseDocument, DomUtils } from 'htmlparser2';
import { prepareContent, safeLink, sanitize } from '../src/content/sanitize';
import { HARBOR_SHA256, validatePng } from '../src/content/image';
import { fixtureStory } from '../src/fixtures/story';
import { malicious } from './fixtures/malicious';

const digest = async (value: string) => createHash('sha256').update(value).digest('hex');

test('preserves rich prose, nested spoilers, a local raster and one safe link', () => {
  const content = sanitize(fixtureStory.chapters[0]!.sourceHtml);
  expect(content.html).toContain('<h1');
  expect(content.html).toContain('<em>');
  expect(content.html).toContain('<blockquote');
  expect(content.html).toContain('<ul>');
  expect(content.html).toContain('<table');
  expect(content.html.match(/<details /g)).toHaveLength(2);
  expect(content.html).toContain('copper cup on the mossy shelf');
  expect(content.html).toContain('src="asset-harbor.png"');
  expect(Object.values(content.links)).toEqual(['https://example.com/']);
  expect(new Set(content.blockIds).size).toBe(content.blockIds.length);
  expect(content.blockIds.length).toBeGreaterThan(40);
});

test('hostile markup cannot become active content or spoof generated attributes', () => {
  const content = sanitize(malicious);
  expect(content.html).not.toMatch(/<(script|style|svg|iframe|object|form|input|meta|base|link|template)\b/i);
  expect(content.html).not.toMatch(/\b(on\w+|style|srcset|srcdoc)\s*=/i);
  expect(content.html).not.toContain('evil()');
  expect(content.html).not.toContain('id="spoof"');
  expect(content.html).not.toContain('data-link="link-1"');
  expect(content.html).toContain('Keep &amp; escape &lt;script&gt;');
  expect(content.html).toContain('but readable');
  expect(content.html).toContain('Next paragraph');
  expect(content.html).toContain('&quot;type&quot;:&quot;position&quot;');
  const elements = DomUtils.getElementsByTagName('*', parseDocument(content.html).children, true);
  for (const element of elements) {
    for (const attribute of Object.keys(element.attribs)) {
      expect(['id', 'data-block', 'href', 'data-link', 'rel', 'src', 'width', 'height', 'alt']).toContain(attribute);
    }
    if (element.name === 'img') expect(element.attribs.src).toBe('asset-harbor.png');
  }
});

test.each(['javascript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,x', '//example.com',
  'file:///secret', 'http://example.com', 'https://user:pass@example.com', ' https://example.com'])('rejects active/unsupported URL %p', (url) => {
  expect(safeLink(url)).toBeNull();
});

test('hash and numbered blocks are deterministic within the exact sanitized version', async () => {
  const a = await prepareContent('<p>One</p><p>Two</p>', digest);
  expect(await prepareContent('<p>One</p><p>Two</p>', digest)).toEqual(a);
  expect(await prepareContent('<p onclick="evil()">One</p><p>Two</p>', digest)).toEqual(a);
  const changed = await prepareContent('<p>Inserted</p><p>One</p><p>Two</p>', digest);
  expect(changed.contentHash).not.toBe(a.contentHash);
  expect(a.contentHash).toMatch(/^[a-f0-9]{64}$/);
});

test('whitespace before a legitimate spoiler summary does not create a second summary', () => {
  const content = sanitize('<details>\n <summary>Secret</summary><p>Inside</p></details>');
  expect(content.html.match(/<summary/g)).toHaveLength(1);
});

test('applies structural budgets and verifies the bundled PNG bytes', () => {
  expect(() => sanitize('x'.repeat(1_000_001))).toThrow();
  expect(() => sanitize('<div>'.repeat(102) + 'x' + '</div>'.repeat(102))).toThrow();
  const bytes = readFileSync('assets/harbor.png');
  expect(() => validatePng(bytes)).not.toThrow();
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(HARBOR_SHA256);
  const bad = Buffer.from(bytes);
  bad[0] = 0;
  expect(() => validatePng(bad)).toThrow();
  const huge = Buffer.from(bytes);
  huge.writeUInt32BE(9999, 16);
  expect(() => validatePng(huge)).toThrow();
});
