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

export function postIdFromLink(value: string, base: string): string | null {
  let url: URL;
  try { url = new URL(value, base); } catch { return null; }
  if (url.origin !== ORIGIN) return null;
  const match = /^#post-([0-9]+)$/.exec(url.hash) ??
    /\/(?:posts\/|post-)([0-9]+)\/?$/.exec(url.pathname);
  return match?.[1] && !/^0+$/.test(match[1]) ? match[1].replace(/^0+/, '') : null;
}
