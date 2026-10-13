import { requireEpub, checkpoint, measureSync, type Context } from './limits';

export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
/** Fatal UTF-8 without relying on a runtime's TextDecoder fatal-option support. */
export function decodeUtf8(bytes: Uint8Array, maxUnits = Infinity): string {
  const chunks: string[] = []; let chars: number[] = [], units = 0;
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i++]!; let cp = first, count = 0, minimum = 0;
    if (first >= 0xc2 && first <= 0xdf) { cp &= 31; count = 1; minimum = 0x80; }
    else if (first >= 0xe0 && first <= 0xef) { cp &= 15; count = 2; minimum = 0x800; }
    else if (first >= 0xf0 && first <= 0xf4) { cp &= 7; count = 3; minimum = 0x10000; }
    else requireEpub(first < 0x80, 'xml');
    for (let n = 0; n < count; n++) {
      const next = bytes[i++]; requireEpub(next !== undefined && (next & 0xc0) === 0x80, 'xml');
      cp = (cp << 6) | (next & 63);
    }
    requireEpub(cp >= minimum && cp <= 0x10ffff && (cp < 0xd800 || cp > 0xdfff), 'xml');
    units += cp > 0xffff ? 2 : 1; requireEpub(units <= maxUnits, 'budget');
    if (cp > 0xffff) { cp -= 0x10000; chars.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023)); }
    else chars.push(cp);
    if (chars.length >= 4096) { chunks.push(String.fromCharCode(...chars)); chars = []; }
  }
  chunks.push(String.fromCharCode(...chars)); return chunks.join('');
}
/** Fatal decoding in bounded byte units, preserving UTF-8 sequences and the
 * pre-normalization UTF-16 cap. A real timer yield is available between units. */
export async function decodeXmlUtf8(bytes: Uint8Array, maxUnits: number, ctx: Context) {
  const parts: string[] = []; let units = 0;
  for (let at = 0; at < bytes.length;) {
    await checkpoint(ctx, 'xml');
    let end = Math.min(at + 16_384, bytes.length);
    if (end < bytes.length) {
      let back = 0;
      while ((bytes[end]! & 0xc0) === 0x80) { end--; requireEpub(++back <= 3 && end > at, 'xml'); }
    }
    const part = measureSync(ctx, 'xmlDecode', () => decodeUtf8(bytes.subarray(at, end), maxUnits - units));
    units += part.length; parts.push(part); at = end;
  }
  return measureSync(ctx, 'xmlDecode', () => parts.join(''));
}
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let bit = 0; bit < 8; bit++) n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0);
  return n >>> 0;
});
export function crcUpdate(crc: number, bytes: Uint8Array) {
  for (const b of bytes) crc = (crc >>> 8) ^ table[(crc ^ b) & 255]!;
  return crc >>> 0;
}
export const crc32 = (bytes: Uint8Array) => (crcUpdate(0xffffffff, bytes) ^ 0xffffffff) >>> 0;
export const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
