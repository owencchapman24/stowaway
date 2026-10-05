import { discoverManifest, runDiagnostic } from '../src/sources/spacebattles/diagnostic';
import { parseIndex, samplePost } from '../src/sources/spacebattles/parse';
import { RequestClient, type Clock, type TransportResponse } from '../src/sources/spacebattles/request';
import { threadFromUrl } from '../src/sources/spacebattles/url';
import { S1Failure, type Document } from '../src/sources/spacebattles/types';
import { index, indexUrl, page, post, range, rangeUrl, row, tabs, threadUrl } from './fixtures/spacebattles';

const thread = threadFromUrl(threadUrl);
const doc = (url: string, html: string): Document => ({ url, html, status: 200 });
const root = doc(threadUrl, page(tabs));
function source(pages: Record<string, string>) {
  return jest.fn(async (url: string) => {
    if (!(url in pages)) throw new S1Failure('network', 'Synthetic missing page.');
    return doc(url, pages[url]!);
  });
}

test('default index/category identity selects primary independently of label; excludes other categories and global count', async () => {
  const html = index(row('91') + row('92'));
  const other = '<div class="block-body--threadmarkBody category-42">' + row('500') + '</div>';
  const result = await discoverManifest(thread, source({ [indexUrl]: html.replace('</body>', `${other}</body>`) }), root);
  expect(result.state).toBe('COMPLETE'); expect(result.category?.id).toBe('9');
  expect(result.category?.expected).toBeNull(); expect(result.entries.map((e) => e.postId)).toEqual(['91', '92']);
  expect(result.entries[0]).toMatchObject({ chapterId: 'spacebattles:thread:9001:post:91', threadmarkId: '91', title: 'Original synthetic entry 91' });
});
test('follows explicit pagination with variable numbers of entries, in source order', async () => {
  const next = `${indexUrl}?per_page=7&page=2`;
  const get = source({ [indexUrl]: index(row('93') + row('91'), { expected: 3, next, last: next }),
    [next]: index(row('92'), { expected: 3 }) });
  const result = await discoverManifest(thread, get, root);
  expect(result.state).toBe('COMPLETE'); expect(result.entries.map((e) => e.postId)).toEqual(['93', '91', '92']);
  expect(get.mock.calls.map(([url]) => url)).toEqual([indexUrl, next]);
});
test('expands ranges in place, handles JSON HTML envelopes and deduplicates stable post IDs without sorting', async () => {
  const get = source({ [indexUrl]: index(row('94') + range() + row('92'), { expected: 4 }),
    [rangeUrl]: JSON.stringify({ html: { content: row('91') + row('94') + row('93') } }) });
  const result = await discoverManifest(thread, get, root);
  expect(result.state).toBe('COMPLETE'); expect(result.entries.map((e) => e.postId)).toEqual(['94', '91', '93', '92']);
  expect(result.duplicates).toEqual(['94']); expect(result.pages).toBe(2);
});
test('supports nested observed range URLs and rejects cycles/missing continuations', async () => {
  const nested = rangeUrl.replace('min=1', 'min=2');
  const complete = await discoverManifest(thread, source({ [indexUrl]: index(range(), { expected: 2 }),
    [rangeUrl]: row('91') + range(nested), [nested]: row('92') }), root);
  expect(complete.state).toBe('COMPLETE');
  const cycle = await discoverManifest(thread, source({ [indexUrl]: index(range()), [rangeUrl]: range() }), root);
  expect(cycle.state).toBe('INCOMPLETE');
  if (cycle.state !== 'COMPLETE') expect(cycle.failure.code).toBe('incomplete');
  const missing = await discoverManifest(thread, source({ [indexUrl]: index(row('91') + range()), }), root);
  expect(missing.state).toBe('INCOMPLETE'); expect(missing.entries.map((e) => e.postId)).toEqual(['91']);
});
test('expected unique count mismatch is incomplete, never complete', async () => {
  const result = await discoverManifest(thread, source({ [indexUrl]: index(row('91') + row('91'), { expected: 2 }) }), root);
  expect(result.state).toBe('INCOMPLETE');
  if (result.state !== 'COMPLETE') expect(result.failure.code).toBe('incomplete');
});
test('advertised missing pagination and interrupted second page cannot mean complete', async () => {
  const next = `${indexUrl}?page=2`;
  const missing = await discoverManifest(thread, source({ [indexUrl]: index(row('91'), { last: next }) }), root);
  expect(missing.state).toBe('FAILED');
  const interrupted = await discoverManifest(thread, source({ [indexUrl]: index(row('91'), { next, last: next }) }), root);
  expect(interrupted.state).toBe('INCOMPLETE'); expect(interrupted.entries).toHaveLength(1);
});
test('category/count changes and malformed post rows fail explicitly', async () => {
  const next = `${indexUrl}?page=2`;
  for (const second of [index(row('92'), { expected: 3 }), index(row('92'), { category: '42' }), index('<div class="structItem--threadmark"></div>')]) {
    const result = await discoverManifest(thread, source({ [indexUrl]: index(row('91'), { expected: 2, next, last: next }), [next]: second }), root);
    expect(result.state).toBe('INCOMPLETE');
  }
});
test('an active side category, wrong range category and error envelope cannot complete', async () => {
  const wrongTab = index(row('91')).replace('tabs-tab is-active', 'tabs-tab').replace('class="tabs-tab" href="' + indexUrl + '?', 'class="tabs-tab is-active" href="' + indexUrl + '?');
  expect(() => parseIndex(doc(indexUrl, wrongTab), thread)).toThrow();
  for (const html of [index(row('92'), { category: '42' }), JSON.stringify({ errors: ['Synthetic error'], html: row('92') })]) {
    const result = await discoverManifest(thread, source({ [indexUrl]: index(row('91') + range()), [rangeUrl]: html }), root);
    expect(result.state).toBe('INCOMPLETE');
  }
});
test('does not infer chapters from author posts, first-post links, labels or timestamps', async () => {
  const result = await discoverManifest(thread, source({}), doc(threadUrl, page('<a href="/posts/91/">Threadmarks</a><article id="js-post-91">Synthetic author post.</article>')));
  expect(result.state).toBe('FAILED'); expect(result.entries).toHaveLength(0);
  expect(() => parseIndex(doc(indexUrl, '<html>Unexpected source.</html>'), thread)).toThrow();
});
test('representative body is mapped by exact numeric article ID and category, not post position', () => {
  const entry = parseIndex(doc(indexUrl, index(row('92'))), thread).items[0];
  if (!entry || 'kind' in entry) throw new Error('Fixture must have a post entry.');
  const sample = samplePost(doc(threadUrl, post('91').replace('</body>', post('92') + '</body>')), thread, entry, '9');
  expect(sample.postId).toBe('92'); expect(sample.bodyCharacters).toBeGreaterThan(0); expect(sample.formattingTags).toContain('blockquote');
  expect(() => samplePost(doc(threadUrl, post('91')), thread, entry, '9')).toThrow();
  expect(() => samplePost(doc(threadUrl, post('92').replace('threadmark-category-9', 'threadmark-category-42')), thread, entry, '9')).toThrow();
});
test('diagnostic uses actual post page links without fixed Reader page sizes; repeated runs return only metadata', async () => {
  let now = 0;
  const clock: Clock = { now: () => now, sleep: async (ms) => { now += ms; } };
  const urls: string[] = [];
  const client = new RequestClient(async (url): Promise<TransportResponse> => {
    urls.push(url);
    const html = url === thread.url ? page(tabs) : url === indexUrl ? index(row('91', 37) + row('92', 112), { expected: 2 }) :
      url === `${threadUrl}page-37` ? post('91') : url === `${threadUrl}page-112` ? post('92') : '';
    return { url, status: 200, headers: { get: () => null }, text: async () => html };
  }, clock);
  const first = await runDiagnostic(threadUrl, client, { laterSample: true });
  const second = await runDiagnostic(threadUrl, client, { laterSample: true });
  expect(first.failure).toBeNull(); expect(second.failure).toBeNull();
  expect(first.samples.map((s) => s.postId)).toEqual(['91', '92']);
  expect(first.requests).toBe(4); expect(second.requests).toBe(4);
  expect(urls).toEqual([thread.url, indexUrl, `${threadUrl}page-37`, `${threadUrl}page-112`, thread.url, indexUrl, `${threadUrl}page-37`, `${threadUrl}page-112`]);
  expect(JSON.stringify(first)).not.toContain('Entirely original synthetic sample.');
  expect(JSON.stringify(first)).not.toContain('bbWrapper');
});
