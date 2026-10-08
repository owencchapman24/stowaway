import { storyId } from '../../domain/identity';
import { S1Failure, type Thread } from './types';

export const ORIGIN = 'https://forums.spacebattles.com';

function sourceUrl(value: string, base?: string): URL {
  let url: URL;
  try { url = new URL(value, base); } catch { throw new S1Failure('unsupported-url', 'Invalid URL.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'forums.spacebattles.com' ||
      url.port || url.username || url.password || /[\\\u0000-\u0020\u007f]/.test(value) ||
      /%2f|%5c/i.test(url.pathname)) {
    throw new S1Failure('unsupported-url', 'Use an ordinary HTTPS SpaceBattles forum URL.');
  }
  return url;
}

export function threadFromUrl(value: string): Thread {
  const url = sourceUrl(value.trim());
  const match = /^\/threads\/(?:[^/]+\.)?([0-9]+)(?:\/(?:page-[0-9]+\/?)?)?$/.exec(url.pathname);
  if (!match?.[1] || /^0+$/.test(match[1])) {
    throw new S1Failure('unsupported-url', 'Story input must be a thread URL, not a post or utility URL.');
  }
  const threadId = match[1].replace(/^0+/, '');
  return { threadId, storyId: storyId('spacebattles', threadId), url: `${ORIGIN}/threads/${threadId}/` };
}

/** A tighter allowlist than robots: only this thread's document routes and numeric post links. */
export function documentUrl(value: string, threadId: string, base = ORIGIN): string {
  const url = sourceUrl(value, base);
  const thread = /^\/threads\/(?:[^/]+\.)?([0-9]+)\/(.*)$/.exec(url.pathname);
  const suffix = thread?.[2];
  const allowedThread = thread?.[1]?.replace(/^0+/, '') === threadId && suffix !== undefined &&
    /^(?:(?:page-[0-9]+|post-[0-9]+|reader|threadmarks|threadmarks-load-range)(?:\/)?)?$/.test(suffix);
  const allowedPost = /^\/posts\/[1-9][0-9]*\/?$/.test(url.pathname);
  if (!allowedThread && !allowedPost) {
    throw new S1Failure('unsupported-url', 'Source link leaves the selected public thread or uses an excluded path.');
  }
  for (const [key, item] of url.searchParams) {
    if (!['threadmark_category', 'threadmark_category_id', 'threadmark_id', 'per_page', 'page', 'min', 'max'].includes(key) || !/^[0-9]+$/.test(item)) {
      throw new S1Failure('unsupported-url', 'Unsupported source query; no utility or redirect endpoints are permitted.');
    }
  }
  url.hash = '';
  return url.href;
}

/** Request safety permits redirects; manifest authority also requires continuation identity. */
export function assertManifestContinuation(requested: string, returned: string, threadId: string,
  kind: 'index' | 'range', categoryId?: string): void {
  const fail = () => new S1Failure('incomplete', 'Source redirect changed or obscured the requested manifest continuation.');
  function identity(value: string) {
    let url: URL;
    try { url = new URL(documentUrl(value, threadId)); } catch { throw fail(); }
    const endpoint = kind === 'index' ? 'threadmarks' : 'threadmarks-load-range';
    if (!url.pathname.endsWith(`/${endpoint}`) && !url.pathname.endsWith(`/${endpoint}/`)) throw fail();
    const query = new Map<string, string>();
    for (const [key, raw] of url.searchParams) {
      if (query.has(key)) throw fail(); // Never guess which duplicate the server used.
      query.set(key, raw.replace(/^0+(?=\d)/, ''));
    }
    const scope = query.get('threadmark_category') ?? query.get('threadmark_category_id');
    if (kind === 'range' && !query.has('threadmark_category_id')) throw fail();
    if (query.has('threadmark_category') && query.has('threadmark_category_id') &&
        query.get('threadmark_category') !== query.get('threadmark_category_id')) throw fail();
    if (scope !== undefined && categoryId !== undefined && scope !== categoryId) throw fail();
    query.delete('threadmark_category'); query.delete('threadmark_category_id');
    if (kind === 'index') {
      const page = query.get('page') ?? '1';
      if (page === '0' || !Number.isSafeInteger(Number(page))) throw fail();
      query.set('page', page);
    } else if (!scope || !query.has('min') || !query.has('max')) throw fail();
    // Other allowed parameters (notably per_page/threadmark_id) cannot change silently.
    return { scope, query: JSON.stringify([...query].sort(([a], [b]) => a.localeCompare(b))) };
  }
  const before = identity(requested), after = identity(returned);
  if (before.query !== after.query ||
      (before.scope !== undefined && after.scope !== undefined && before.scope !== after.scope)) throw fail();
  // An omitted index scope means primary. The caller verifies both URLs again
  // with the parser's proven primary ID before accepting any rows.
}

export function postIdFromLink(value: string, base: string): string | null {
  let url: URL;
  try { url = new URL(value, base); } catch { return null; }
  if (url.origin !== ORIGIN) return null;
  const match = /^#post-([0-9]+)$/.exec(url.hash) ??
    /\/(?:posts\/|post-)([0-9]+)\/?$/.exec(url.pathname);
  return match?.[1] && !/^0+$/.test(match[1]) ? match[1].replace(/^0+/, '') : null;
}
