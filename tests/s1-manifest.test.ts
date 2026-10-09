import { URL as NodeURL } from 'node:url';
import { discoverManifest, MAX_MANIFEST_DOCUMENTS, MAX_MANIFEST_NO_PROGRESS, runDiagnostic } from '../src/sources/spacebattles/diagnostic';
import { parseIndex, samplePost } from '../src/sources/spacebattles/parse';
import * as manifestParser from '../src/sources/spacebattles/parse';
import { RequestClient, type Clock, type TransportResponse } from '../src/sources/spacebattles/request';
import { threadFromUrl } from '../src/sources/spacebattles/url';
import { S1Failure, type Document } from '../src/sources/spacebattles/types';
import { index, indexUrl, page, post, range, rangeUrl, row, tabs, threadUrl } from './fixtures/spacebattles';

const thread = threadFromUrl(threadUrl);
const doc = (url: string, html: string): Document => ({ url, html, status: 200 });
const root = doc(threadUrl, page(tabs));

test.each([
  ['page skip', `${indexUrl}?page=2`, `${indexUrl}?page=3`],
  ['category change', `${indexUrl}?page=2`, `${indexUrl}?page=2&threadmark_category=42`],
  ['category alias change', `${indexUrl}?page=2`, `${indexUrl}?page=2&threadmark_category_id=42`],
  ['page size change', `${indexUrl}?page=2&per_page=7`, `${indexUrl}?page=2&per_page=8`],
  ['endpoint change', `${indexUrl}?page=2`, `${threadUrl}reader?page=2`],
  ['ambiguous page', `${indexUrl}?page=2`, `${indexUrl}?page=2&page=3`],
])('hardening: index redirect rejects %s without scoped totals', async (_name, requested, returned) => {
  const result = await discoverManifest(thread, async (url) => url === indexUrl
    ? doc(url, index(row('91'), { next: requested, last: `${indexUrl}?page=3` }))
    : doc(returned, index(row('93'))), root);
  expect(result.state).toBe('INCOMPLETE');
  if (result.state !== 'COMPLETE') expect(result.failure.code).toBe('incomplete');
  expect(result.entries.map((entry) => entry.postId)).toEqual(['91']);
});

test('hardening: initial index cannot redirect past page one', async () => {
  const result = await discoverManifest(thread, async () => doc(`${indexUrl}?page=2`, index(row('92'))), root);
  expect(result.state).toBe('INCOMPLETE');
  if (result.state !== 'COMPLETE') expect(result.failure.code).toBe('incomplete');
  expect(result.entries).toEqual([]);
});

test('hardening: same-page slug, trailing slash, numeric and query-order canonicalization is accepted', async () => {
  const next = `${indexUrl}?page=2&per_page=7&threadmark_category=9`;
  const result = await discoverManifest(thread, async (url) => url === indexUrl
    ? doc(`${threadUrl.replace('synthetic.', '')}threadmarks/?page=1`, index(row('91'), { next, last: next }))
    : doc(`${threadUrl.replace('synthetic.', 'renamed.')}threadmarks/?threadmark_category=9&per_page=7&page=02`, index(row('92'))), root);
  expect(result.state).toBe('COMPLETE');
  expect(result.entries.map((entry) => entry.postId)).toEqual(['91', '92']);
});

test.each([
  ['min', rangeUrl.replace('min=1', 'min=2')],
  ['max', rangeUrl.replace('max=8', 'max=9')],
  ['category', rangeUrl.replace('category_id=9', 'category_id=42')],
  ['endpoint', rangeUrl.replace('threadmarks-load-range', 'threadmarks')],
  ['thread', rangeUrl.replace('9001', '9002')],
  ['missing bound', rangeUrl.replace('&max=8', '')],
  ['unsupported category alias', rangeUrl.replace('threadmark_category_id', 'threadmark_category')],
  ['duplicate bound', `${rangeUrl}&min=2`],
])('hardening: range redirect rejects changed %s', async (_name, returned) => {
  const result = await discoverManifest(thread, async (url) => url === indexUrl
    ? doc(url, index(row('91') + range())) : doc(returned, row('92')), root);
  expect(result.state).toBe('INCOMPLETE');
  if (result.state !== 'COMPLETE') expect(result.failure.code).toBe('incomplete');
  expect(result.entries.map((entry) => entry.postId)).toEqual(['91']);
});

test('hardening: equivalent range slug, slash and query order are accepted', async () => {
  const returned = `${threadUrl.replace('synthetic.', '')}threadmarks-load-range/?max=08&min=01&threadmark_category_id=9`;
  const result = await discoverManifest(thread, async (url) => url === indexUrl
    ? doc(url, index(row('91') + range())) : doc(returned, row('92')), root);
  expect(result.state).toBe('COMPLETE');
  expect(result.entries.map((entry) => entry.postId)).toEqual(['91', '92']);
});
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

test.each([
  ['no explicit identity', row('92')],
  ['selected thread identity', page(row('92'))],
])('range fragments accept %s with valid primary rows', async (_name, html) => {
  const result = await discoverManifest(thread, source({
    [indexUrl]: index(row('91') + range(), { expected: 2 }),
    [rangeUrl]: JSON.stringify({ html: { content: html } }),
  }), root);
  expect(result.state).toBe('COMPLETE');
  expect(result.entries.map((entry) => entry.postId)).toEqual(['91', '92']);
});

test.each([
  page(row('92')).replace('thread-9001', 'thread-9999'),
  page('<div data-content-key="thread-9999">' + row('92') + '</div>'),
])('an explicit conflicting thread in a range cannot contribute complete entries', async (html) => {
  const result = await discoverManifest(thread, source({
    [indexUrl]: index(row('91') + range(), { expected: 2 }), [rangeUrl]: html,
  }), root);
  expect(result.state).toBe('INCOMPLETE');
  if (result.state !== 'COMPLETE') expect(result.failure.code).toBe('incomplete');
  expect(result.entries.map((entry) => entry.postId)).toEqual(['91']);
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
function paginatedSource(total: number, posts: (number: number) => string) {
  return jest.fn(async (url: string) => {
    const number = Number(new URL(url).searchParams.get('page') ?? 1);
    return doc(url, index(posts(number), number < total
      ? { next: `${indexUrl}?page=${number + 1}`, last: `${indexUrl}?page=${total}` } : {}));
  });
}

async function nativeUrlStress(work: () => Promise<void>) {
  // Use Node's WHATWG implementation only for the large generated stress cases;
  // keep the actual parser, continuation checks and production limits unchanged.
  const previous = globalThis.URL;
  globalThis.URL = NodeURL as unknown as typeof URL;
  try { await work(); } finally { globalThis.URL = previous; }
}

async function logicalDocumentStress(total: number, ranges: boolean, work: () => Promise<void>) {
  // Ceiling accounting consumes known parsed models at the real limit; parser
  // behavior is exercised separately by the 1,250-page and range fixtures.
  const entry = (number: number) => {
    const postId = String(10000 + Math.ceil(number / 4));
    return { postId, chapterId: `${thread.storyId}:post:${postId}`, threadmarkId: postId, title: 'Generated', url: `${threadUrl}#post-${postId}` };
  };
  const rangeAt = (number: number) => rangeUrl.replace('min=1', `min=${number}`).replace('max=8', `max=${total + 1}`);
  const indexParser = jest.spyOn(manifestParser, 'parseIndex').mockImplementation((response) => {
    const number = Number(new URL(response.url).searchParams.get('page') ?? 1);
    return { category: { id: '9', url: indexUrl, expected: null }, items: [entry(number),
      ...ranges ? [{ kind: 'range' as const, url: rangeAt(number) }, ...number === total ? [{ kind: 'range' as const, url: rangeAt(total + 1) }] : []] : []],
    next: number < total ? `${indexUrl}?page=${number + 1}` : null, lastPage: total };
  });
  const rangeParser = jest.spyOn(manifestParser, 'parseRange').mockImplementation((response) => [entry(Number(new URL(response.url).searchParams.get('min')))]);
  try { await nativeUrlStress(work); } finally { indexParser.mockRestore(); rangeParser.mockRestore(); }
}

test('a legitimate 1,250-page manifest keeps source order and completes below the defensive ceiling', () => nativeUrlStress(async () => {
  const get = paginatedSource(1250, (number) => row(String(10000 + number * 2)) + row(String(10001 + number * 2)));
  const result = await discoverManifest(thread, get, root);
  expect(result.state).toBe('COMPLETE'); expect(result.pages).toBe(1250);
  expect(result.entries.map((entry) => entry.postId)).toEqual(Array.from({ length: 2500 }, (_, i) => String(10002 + i)));
  expect(get).toHaveBeenCalledTimes(1250);
}));

test.each([0, 1])('actual document ceiling allows a complete boundary but refuses %s additional continuation', (extra) => logicalDocumentStress(MAX_MANIFEST_DOCUMENTS + extra, false, async () => {
  // Every fourth document advances stable identity: well within the existing
  // 10,000-entry cap, and never near the separate no-progress threshold.
  const get = paginatedSource(MAX_MANIFEST_DOCUMENTS + extra, (number) => row(String(10000 + Math.ceil(number / 4))));
  const result = await discoverManifest(thread, get, root);
  expect(result.pages).toBe(MAX_MANIFEST_DOCUMENTS);
  expect(get).toHaveBeenCalledTimes(MAX_MANIFEST_DOCUMENTS);
  expect(result.entries).toHaveLength(MAX_MANIFEST_DOCUMENTS / 4);
  expect(result.state).toBe(extra ? 'INCOMPLETE' : 'COMPLETE');
  if (result.state !== 'COMPLETE') {
    expect(result.failure.code).toBe('incomplete'); expect(result.failure.message).toMatch(/document limit/);
  }
  expect(get.mock.calls.at(-1)?.[0]).toBe(`${indexUrl}?page=${MAX_MANIFEST_DOCUMENTS}`);
}));

test.each([false, true])('repeated post IDs stop after the exact no-progress allowance even if terminal=%s', async (terminal) => {
  const total = 1 + MAX_MANIFEST_NO_PROGRESS + (terminal ? 0 : 100);
  const get = paginatedSource(total, () => row('91'));
  const result = await discoverManifest(thread, get, root);
  expect(result.state).toBe('INCOMPLETE');
  if (result.state !== 'COMPLETE') expect(result.failure).toMatchObject({ code: 'incomplete', message: expect.stringMatching(/no new post progress/) });
  expect(result.pages).toBe(1 + MAX_MANIFEST_NO_PROGRESS);
  expect(get).toHaveBeenCalledTimes(1 + MAX_MANIFEST_NO_PROGRESS);
  expect(result.entries.map((entry) => entry.postId)).toEqual(['91']);
});

test('index and range documents share the overall ceiling, including an unresolved final range', () => logicalDocumentStress(MAX_MANIFEST_DOCUMENTS / 2, true, async () => {
  const last = MAX_MANIFEST_DOCUMENTS / 2;
  const rangeAt = (number: number) => rangeUrl.replace('min=1', `min=${number}`).replace('max=8', `max=${last + 1}`);
  const get = jest.fn(async (url: string) => {
    if (url.includes('threadmarks-load-range')) {
      const number = Number(new URL(url).searchParams.get('min'));
      return doc(url, row(String(10000 + Math.ceil(number / 4))));
    }
    const number = Number(new URL(url).searchParams.get('page') ?? 1);
    return doc(url, index(row(String(10000 + Math.ceil(number / 4))) + range(rangeAt(number)) +
      (number === last ? range(rangeAt(last + 1)) : ''), number < last ? { next: `${indexUrl}?page=${number + 1}` } : {}));
  });
  const result = await discoverManifest(thread, get, root);
  expect(result.state).toBe('INCOMPLETE');
  if (result.state !== 'COMPLETE') expect(result.failure.message).toMatch(/document limit/);
  expect(result.pages).toBe(MAX_MANIFEST_DOCUMENTS); expect(get).toHaveBeenCalledTimes(MAX_MANIFEST_DOCUMENTS);
  expect(get.mock.calls.at(-1)?.[0]).toBe(rangeAt(last));
  expect(result.entries).toHaveLength(last / 4);
}));

test('slug/query/numeric canonicalization cannot disguise advancing pages with repeated semantic content', async () => {
  const get = jest.fn(async (url: string) => {
    const number = Number(new URL(url).searchParams.get('page') ?? 1);
    const returned = `${threadUrl.replace('synthetic.', `renamed-${number}.`)}threadmarks/?threadmark_category=9&page=0${number}`;
    const next = `${threadUrl.replace('synthetic.', `next-${number}.`)}threadmarks?page=${number + 1}&threadmark_category=9`;
    return doc(returned, index(row('91'), { next, last: next }));
  });
  const result = await discoverManifest(thread, get, root);
  expect(result.state).toBe('INCOMPLETE');
  if (result.state !== 'COMPLETE') expect(result.failure.message).toMatch(/no new post progress/);
  expect(get).toHaveBeenCalledTimes(1 + MAX_MANIFEST_NO_PROGRESS);
  expect(result.entries.map((entry) => entry.postId)).toEqual(['91']);
});

test('duplicates plus a new post reset a nearly exhausted no-progress streak and retain first source order', async () => {
  const total = MAX_MANIFEST_NO_PROGRESS * 2;
  const get = paginatedSource(total, (number) => row('91') + (number >= MAX_MANIFEST_NO_PROGRESS + 1 ? row('92') : ''));
  const result = await discoverManifest(thread, get, root);
  expect(result.state).toBe('COMPLETE'); expect(result.pages).toBe(total);
  expect(result.entries.map((entry) => entry.postId)).toEqual(['91', '92']);
  expect(result.duplicates).toHaveLength(total * 2 - MAX_MANIFEST_NO_PROGRESS - 2);
});

test.each(['bounds', 'aliases'] as const)('range %s cannot evade the semantic no-progress guard or authorize terminal completion', async (kind) => {
  const urls = Array.from({ length: MAX_MANIFEST_NO_PROGRESS + 1 }, (_, i) => kind === 'bounds'
    ? rangeUrl.replace('min=1', `min=${i + 1}`).replace('max=8', `max=${i + 100}`)
    : rangeUrl.replace('synthetic.', `renamed-${i}.`));
  const get = jest.fn(async (url: string) => doc(url, url === indexUrl
    ? index(row('91') + urls.map((value) => range(value)).join(''), { expected: 1 }) : row('91')));
  const result = await discoverManifest(thread, get, root);
  expect(result.state).toBe('INCOMPLETE');
  if (result.state !== 'COMPLETE') expect(result.failure.message).toMatch(/no new post progress/);
  expect(result.pages).toBe(1 + MAX_MANIFEST_NO_PROGRESS);
  expect(get.mock.calls.map(([url]) => url)).toEqual([indexUrl, ...urls.slice(0, MAX_MANIFEST_NO_PROGRESS)]);
  expect(result.entries.map((entry) => entry.postId)).toEqual(['91']);
});

test('new direct and descendant posts reset range progress; range-only wrappers remain valid', async () => {
  const bounds = rangeUrl.replace('max=8', 'max=100');
  const urls = Array.from({ length: MAX_MANIFEST_NO_PROGRESS - 1 }, (_, i) => bounds.replace('min=1', `min=${i + 1}`));
  const get = jest.fn(async (url: string) => {
    if (url.includes('threadmarks-load-range')) return doc(url, row('91'));
    const number = Number(new URL(url).searchParams.get('page') ?? 1);
    return doc(url, number <= MAX_MANIFEST_NO_PROGRESS
      ? index(row('91'), { next: `${indexUrl}?page=${number + 1}` })
      : index(row('92') + urls.map((value) => range(value)).join('')));
  });
  expect((await discoverManifest(thread, get, root)).state).toBe('COMPLETE');
  const nested = jest.fn(async (url: string) => {
    if (url === indexUrl) return doc(url, index(range(bounds)));
    const depth = Number(new URL(url).searchParams.get('min'));
    return doc(url, depth < 20 ? range(bounds.replace('min=1', `min=${depth + 1}`)) : row('93'));
  });
  const result = await discoverManifest(thread, nested, root);
  expect(result.state).toBe('COMPLETE'); expect(result.pages).toBe(21);
  expect(result.entries.map((entry) => entry.postId)).toEqual(['93']);
});

test.each([false, true])('productive range ancestors cannot erase trailing duplicate progress when terminal=%s', async (terminal) => {
  const at = (number: number) => rangeUrl.replace('min=1', `min=${number}`).replace('max=8', 'max=1000');
  const next = `${indexUrl}?page=2`;
  const innerDuplicates = Array.from({ length: MAX_MANIFEST_NO_PROGRESS - 1 }, (_, i) => at(100 + i));
  const outerDuplicates = Array.from({ length: MAX_MANIFEST_NO_PROGRESS - 1 }, (_, i) => at(200 + i));
  const get = jest.fn(async (url: string) => doc(url, url === indexUrl ? index(range(at(1)), { expected: terminal ? 1 : 2, ...terminal ? {} : { next } })
    : url === at(1) ? range(at(2)) + outerDuplicates.map((value) => range(value)).join('')
      : url === at(2) ? range(at(3)) + innerDuplicates.map((value) => range(value)).join('')
        : url === next ? index(row('92'), { expected: 2 }) : row('91')));
  const result = await discoverManifest(thread, get, root);
  expect(result.state).toBe('INCOMPLETE');
  if (result.state !== 'COMPLETE') expect(result.failure.message).toMatch(/no new post progress/);
  expect(result.pages).toBe(4 + MAX_MANIFEST_NO_PROGRESS);
  expect(get.mock.calls.map(([url]) => url)).toEqual([indexUrl, at(1), at(2), at(3), ...innerDuplicates, outerDuplicates[0]]);
  expect(result.entries.map((entry) => entry.postId)).toEqual(['91']);
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
