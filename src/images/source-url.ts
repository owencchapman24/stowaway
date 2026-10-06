import { ORIGIN } from '../sources/spacebattles/url';
import type { ImageReason } from './types';

/** Exact canonical source origin, never subdomains, sessions or source filenames as paths. */
export function classifyImageUrl(value: string, base = ORIGIN): { sourceUrl: string | null; reason: ImageReason | null } {
  if (!value || value.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(value)) return { sourceUrl: null, reason: 'invalid-url' };
  let url: URL;
  try { url = new URL(value, base); } catch { return { sourceUrl: null, reason: 'invalid-url' }; }
  if (url.protocol !== 'https:') return { sourceUrl: null, reason: 'non-https' };
  if (url.username || url.password || /%2f|%5c/i.test(url.pathname)) return { sourceUrl: null, reason: 'invalid-url' };
  url.hash = '';
  if (url.href.length > 2048) return { sourceUrl: null, reason: 'invalid-url' };
  if (url.origin !== ORIGIN) return { sourceUrl: url.href, reason: 'external-host' };
  // GET only, but exclude known account/administrative/action utilities.
  if (/^\/(?:login|logout|account|admin|moderator|register|conversations)(?:\/|\.|$)/i.test(url.pathname)) {
    return { sourceUrl: null, reason: 'invalid-url' };
  }
  for (const key of url.searchParams.keys()) {
    if (/(?:auth|token|session|cookie|password|csrf)/i.test(key)) return { sourceUrl: null, reason: 'invalid-url' };
  }
  if (/\.(?:gif|svg|avif)(?:\.|\/|$)/i.test(url.pathname)) return { sourceUrl: url.href, reason: 'unsupported-format' };
  return { sourceUrl: url.href, reason: null };
}
