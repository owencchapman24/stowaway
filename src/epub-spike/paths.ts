import { LIMITS, requireEpub } from './limits';
import { utf8 } from './bytes';

/** ZIP names are literal; URL decoding here would introduce aliases. */
export function archivePath(value: string): string {
  requireEpub(value.length > 0 && utf8(value).length <= LIMITS.path && value === value.normalize('NFC'), 'path');
  requireEpub(!/[\\%:#?\u0000-\u0020\u007f-\u009f]/.test(value) && !value.startsWith('/'), 'path');
  const parts = value.endsWith('/') ? value.slice(0, -1).split('/') : value.split('/');
  requireEpub(parts.every((p) => p && p !== '.' && p !== '..' && utf8(p).length <= LIMITS.segment), 'path');
  return value;
}
/** Resolve a URI reference once in the virtual archive, never on the filesystem. */
export function resolveReference(base: string, reference: string): string {
  requireEpub(reference.length > 0 && reference.length <= 2048 && !/[\\\u0000-\u0020\u007f-\u009f]/.test(reference), 'path');
  requireEpub(!reference.startsWith('/') && !/^[a-z][a-z\d+.-]*:/i.test(reference) && !reference.includes('?'), 'path');
  const encoded = reference.split('#')[0]!;
  requireEpub(!/%(?:2f|5c|2e|25|00)/i.test(encoded), 'path');
  let decoded: string;
  try { decoded = decodeURIComponent(encoded); } catch { requireEpub(false, 'path'); }
  if (!decoded) return archivePath(base);
  const stack = base ? base.split('/').slice(0, -1) : [];
  for (const segment of decoded.split('/')) {
    if (segment === '.') continue;
    if (segment === '..') { requireEpub(stack.length > 0, 'path'); stack.pop(); }
    else { requireEpub(!!segment, 'path'); stack.push(segment); }
  }
  return archivePath(stack.join('/'));
}
