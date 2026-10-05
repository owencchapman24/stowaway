import { createHash } from 'node:crypto';
import { parseStoryMetadata, extractPostBody } from '../src/sources/spacebattles/parse';
import { threadFromUrl } from '../src/sources/spacebattles/url';
import { prepareContent } from '../src/content/sanitize';
import { bodyArticle, storyHeader } from './fixtures/import';
import { page, threadUrl } from './fixtures/spacebattles';

const thread = threadFromUrl(threadUrl);
const entry = { postId: '101', chapterId: `${thread.storyId}:post:101`, title: 'Generated', url: `${threadUrl}#post-101`, threadmarkId: null };
const doc = (html: string) => ({ url: threadUrl, html, status: 200 });
const digest = async (value: string) => createHash('sha256').update(value).digest('hex');

test('metadata parses title and thread-header author; missing author stays unknown, never a later poster', () => {
  expect(parseStoryMetadata(doc(page(storyHeader)), thread)).toMatchObject({ title: 'The Synthetic Orchard & Sea', author: 'Generated Author', threadId: '9001' });
  expect(parseStoryMetadata(doc(page(storyHeader.replace(/<div class="p-description">.*?<\/div>/, '') + '<article><a class="username">Later poster</a></article>')), thread).author).toBeNull();
  expect(() => parseStoryMetadata(doc(page('<h1>Unrecognized title</h1>')), thread)).toThrow('title');
});

test('only exact body is sanitized; formatting, nested spoilers and deliberate links survive without active or remote content', async () => {
  const raw = page('<nav>Excluded forum chrome.</nav>' + bodyArticle('999', '<p>Excluded different post.</p>') + bodyArticle('101', `
    <h2 onclick="bad()">Generated heading</h2><p>A <em>generated</em> <strong>passage</strong>.</p>
    <ul><li>One</li></ul><blockquote>Quote</blockquote><table><tr><td>Cell</td></tr></table>
    <div class="bbCodeSpoiler"><button>Spoiler button</button><div class="bbCodeSpoiler-content"><div class="bbCodeSpoiler-content-inner">
      <p>Outer</p><div class="bbCodeSpoiler"><div class="bbCodeSpoiler-content-inner"><p>Inner</p></div></div>
    </div></div></div><script>bad()</script><iframe src="https://example.com"></iframe>
    <img src="https://example.com/image.png" onerror="bad()"><img src="fixture://harbor.png">
    <a href="https://example.com/safe">Safe link</a><a href="/threads/synthetic.9001/">Relative link</a>`));
  const content = await prepareContent(extractPostBody(doc(raw), thread, entry, '9'), digest);
  expect(content.html).toContain('<em>generated</em>');
  expect(content.html).toContain('<table');
  expect(content.html.match(/<details/g)).toHaveLength(2);
  expect(content.html).toContain('[Image omitted: external or unsupported asset]');
  expect(content.html).not.toMatch(/<img|<script|onclick|onerror|<iframe|asset-harbor|Excluded|Spoiler button/);
  expect(Object.values(content.links)).toEqual(['https://example.com/safe', threadUrl]);
  expect(await prepareContent(extractPostBody(doc(raw), thread, entry, '9'), digest)).toEqual(content);
  expect(content.blockIds.length).toBeGreaterThan(5);
});

test.each([
  page(bodyArticle('999')),
  page(bodyArticle('101')).replace('thread-9001', 'thread-9002'),
  page(bodyArticle('101')).replace('threadmark-category-9', 'threadmark-category-42'),
  page(bodyArticle('101')).replace('data-content="post-101"', 'data-content="post-999"'),
  page(bodyArticle('101') + bodyArticle('101')),
  page(bodyArticle('101')).replace('<div class="bbWrapper">', '<div class="bbWrapper"><div class="bbWrapper">'),
])('wrong, ambiguous or conflicting body identity is rejected', (html) => {
  expect(() => extractPostBody(doc(html), thread, entry, '9')).toThrow();
});

test('body without category metadata is allowed; exposed wrong category is rejected', () => {
  const html = page(bodyArticle('101')).replace(' threadmark-category-9', '');
  expect(extractPostBody(doc(html), thread, entry, '9')).toContain('Original generated passage.');
});

test('plain-text/BR XenForo body receives paragraph-sized local blocks for position persistence', async () => {
  const content = await prepareContent(extractPostBody(doc(page(bodyArticle('101', 'Original text<br>Another line'))), thread, entry, '9'), digest);
  expect(content.blockIds).toHaveLength(3);
  expect(content.html).toContain('Original text</p><p');
  expect(content.html).toContain('Another line</p>');
});
