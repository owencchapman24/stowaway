import { IMAGE_LIMITS } from '../content/image';
import type { ImageFile, ImageMimeDiagnostic, ImageReason } from './types';

// Application phone-safety budgets; fixture/S2A validation stays unchanged.
export const SOURCE_IMAGE_LIMITS = { ...IMAGE_LIMITS, maxPixels: 2048 * 2048 };
export class ImageRejected extends Error {
  constructor(readonly reason: ImageReason, readonly mime?: Pick<ImageMimeDiagnostic, 'receivedMime' | 'detectedFormat'>) {
    super(`Image omitted: ${reason}`); this.name = 'ImageRejected';
  }
}
const compatibleMime = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/webp', 'application/octet-stream']);
/** Only a bounded media-type token survives; parameters and raw headers never enter diagnostics. */
export function normalizeImageMime(contentType?: string | null): string | null {
  if (!contentType) return null;
  if (/[\r\n\0]/.test(contentType)) return 'invalid';
  const end = contentType.indexOf(';');
  const mime = contentType.slice(0, end < 0 ? undefined : end).trim().toLowerCase();
  if (!mime && end < 0) return null;
  return /^[a-z0-9][a-z0-9.+_-]{0,47}\/[a-z0-9][a-z0-9.+_-]{0,47}$/.test(mime) ? mime : 'invalid';
}
const reject = (reason: ImageReason = 'invalid-bytes'): never => { throw new ImageRejected(reason); };
const ascii = (b: Uint8Array, start: number, length: number) => String.fromCharCode(...b.slice(start, start + length));
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(b: Uint8Array, v: DataView): [number, number] {
  if (b.length < 57) reject();
  let at = 8, width = 0, height = 0, data = false, dataBytes = 0, endedData = false, palette = false, color = -1, end = false;
  while (at < b.length) {
    if (at + 12 > b.length) reject();
    const n = v.getUint32(at), name = ascii(b, at + 4, 4);
    if (n > b.length - at - 12 || !/^[A-Za-z]{4}$/.test(name)) reject();
    if (crc32(b.subarray(at + 4, at + 8 + n)) !== v.getUint32(at + 8 + n)) reject();
    if (['acTL', 'fcTL', 'fdAT'].includes(name)) reject('animated');
    if (at === 8) {
      if (name !== 'IHDR' || n !== 13) reject();
      width = v.getUint32(at + 8); height = v.getUint32(at + 12);
      color = b[at + 17]!;
      const bits = b[at + 16]!;
      const permitted: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!permitted[color]?.includes(bits) || b[at + 18] !== 0 || b[at + 19] !== 0 || b[at + 20]! > 1) reject();
    } else if (name === 'IHDR') reject();
    else if (name === 'PLTE') {
      if (palette || data || !n || n % 3 || n > 768 || color === 0 || color === 4) reject();
      palette = true;
    } else if (name === 'IDAT') {
      if (endedData || (color === 3 && !palette)) reject();
      data = true; dataBytes += n;
    } else if (name === 'IEND') {
      if (n || !data || !dataBytes || at + 12 !== b.length) reject();
      end = true;
    } else {
      if (data) endedData = true;
      // Unknown critical chunks cannot safely be interpreted.
      if (name[0] === name[0]!.toUpperCase()) reject();
    }
    at += n + 12;
  }
  if (!end) reject();
  return [width, height];
}
function jpeg(b: Uint8Array, v: DataView): [number, number] {
  let at = 2, width = 0, height = 0, scans = 0, entropy = false, scanBytes = 0;
  const sof = new Set([0xc0, 0xc1, 0xc2]);
  while (at < b.length) {
    if (entropy) {
      if (b[at] !== 0xff) { at++; scanBytes++; continue; }
      if (b[at + 1] === 0 || (b[at + 1]! >= 0xd0 && b[at + 1]! <= 0xd7)) { at += 2; scanBytes++; continue; }
      entropy = false;
    }
    if (b[at++] !== 0xff) reject();
    while (b[at] === 0xff) at++;
    const marker = b[at++];
    if (marker === 0xd9) {
      if (at !== b.length || !width || !height || !scans || !scanBytes) reject();
      return [width, height];
    }
    if (marker === undefined || marker === 0 || marker === 0xd8 || marker === 1 || (marker >= 0xd0 && marker <= 0xd7) || at + 2 > b.length) reject();
    const n = v.getUint16(at);
    if (n < 2 || n > b.length - at) reject();
    if (sof.has(marker!)) {
      if (width || n < 11 || b[at + 2] !== 8 || ![1, 3, 4].includes(b[at + 7]!) || n !== 8 + 3 * b[at + 7]!) reject();
      height = v.getUint16(at + 3); width = v.getUint16(at + 5);
    } else if (marker! >= 0xc0 && marker! <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker!)) reject('unsupported-format');
    if (marker === 0xda) {
      if (!width || n < 8 || !b[at + 2] || n !== 6 + 2 * b[at + 2]!) reject();
      scans++; entropy = true;
    }
    at += n;
  }
  return reject();
}
const u24 = (b: Uint8Array, at: number) => b[at]! + b[at + 1]! * 256 + b[at + 2]! * 65536;
function webp(b: Uint8Array, v: DataView): [number, number] {
  if (b.length < 26 || v.getUint32(4, true) !== b.length - 8) reject();
  let at = 12, width = 0, height = 0, canvas: [number, number] | null = null, payload = false;
  while (at < b.length) {
    if (at + 8 > b.length) reject();
    const tag = ascii(b, at, 4), n = v.getUint32(at + 4, true), start = at + 8;
    if (n > b.length - start || start + n + (n & 1) > b.length || ((n & 1) && b[start + n] !== 0)) reject();
    if (tag === 'ANIM' || tag === 'ANMF') reject('animated');
    if (tag === 'VP8X') {
      if (at !== 12 || n !== 10 || canvas || b[start + 1] || b[start + 2] || b[start + 3]) reject();
      if (b[start]! & 2) reject('animated');
      if (b[start]! & 0xc1) reject();
      canvas = [u24(b, start + 4) + 1, u24(b, start + 7) + 1];
    } else if (tag === 'VP8 ') {
      if (payload || n < 11 || (b[start]! & 1) || ascii(b, start + 3, 3) !== '\x9d\x01\x2a') reject();
      const frame = u24(b, start);
      if (((frame >>> 1) & 7) > 3 || !(frame & 16) || (frame >>> 5) > n - 10) reject();
      width = v.getUint16(start + 6, true) & 0x3fff; height = v.getUint16(start + 8, true) & 0x3fff; payload = true;
    } else if (tag === 'VP8L') {
      if (payload || n < 6 || b[start] !== 0x2f) reject();
      const bits = v.getUint32(start + 1, true);
      if (bits >>> 29) reject();
      width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1; payload = true;
    } else if (!canvas || !['ALPH', 'ICCP', 'EXIF', 'XMP '].includes(tag) || !n) reject();
    at = start + n + (n & 1);
  }
  if (!payload || (canvas && (canvas[0] !== width || canvas[1] !== height))) reject();
  return [width, height];
}

export function validateSourceImage(bytes: Uint8Array, contentType?: string | null): Omit<ImageFile, 'relativePath' | 'digest'> {
  if (bytes.length > SOURCE_IMAGE_LIMITS.maxBytes) reject('over-byte-budget');
  if (bytes.length < 12) reject();
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let format: ImageFile['format'], size: [number, number];
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) { format = 'png'; size = png(bytes, v); }
  else if (bytes[0] === 0xff && bytes[1] === 0xd8) { format = 'jpeg'; size = jpeg(bytes, v); }
  else if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') { format = 'webp'; size = webp(bytes, v); }
  else reject('unsupported-format');
  const [width, height] = size!;
  if (!width || !height) reject();
  if (width > SOURCE_IMAGE_LIMITS.maxDimension || height > SOURCE_IMAGE_LIMITS.maxDimension || width * height > SOURCE_IMAGE_LIMITS.maxPixels) reject('over-dimension-budget');
  // Bytes have already passed every structural/animation/budget check. A safe
  // raster label may be inaccurate; HTML/XML/unsupported labels remain a veto.
  const mime = normalizeImageMime(contentType);
  if (mime && !compatibleMime.has(mime)) throw new ImageRejected('content-type-mismatch', { receivedMime: mime, detectedFormat: format! });
  return { format: format!, width, height, byteLength: bytes.length };
}
