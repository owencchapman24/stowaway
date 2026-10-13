import { sha256 } from '@noble/hashes/sha2.js';
import { utf8 } from './bytes';
import { checkpoint, measureSync, type Context } from './limits';

export const HASH_CHUNK = 16_384;
export const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** Exactly SHA-256(UTF8(source)); do not cut a surrogate pair between encodes. */
export async function hashText(source: string, ctx: Context) {
  const hash = sha256.create();
  for (let at = 0; at < source.length;) {
    await checkpoint(ctx, 'hash');
    let end = Math.min(at + HASH_CHUNK, source.length);
    if (end < source.length && source.charCodeAt(end - 1) >= 0xd800 && source.charCodeAt(end - 1) <= 0xdbff &&
      source.charCodeAt(end) >= 0xdc00 && source.charCodeAt(end) <= 0xdfff) end--;
    measureSync(ctx, 'contentHash', () => hash.update(utf8(source.slice(at, end)))); at = end;
  }
  await checkpoint(ctx, 'hash', true);
  return hex(measureSync(ctx, 'contentHash', () => hash.digest()));
}
export async function hashImage(bytes: Uint8Array, ctx: Context) {
  const hash = sha256.create();
  for (let at = 0; at < bytes.length; at += HASH_CHUNK) {
    await checkpoint(ctx, 'hash');
    measureSync(ctx, 'imageHash', () => hash.update(bytes.subarray(at, at + HASH_CHUNK)));
  }
  return hex(measureSync(ctx, 'imageHash', () => hash.digest()));
}
