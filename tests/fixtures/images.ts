import { deflateSync } from 'node:zlib';

// Original synthetic raster/container fixtures; no fetched image bytes.
export function pngChunk(name: string, data = Buffer.alloc(0)): Buffer {
  const body = Buffer.concat([Buffer.from(name), data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, body, checksum]);
}
export function png(width = 2, height = 3, extra: Buffer[] = []): Uint8Array {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header),
    ...extra, pngChunk('IDAT', deflateSync(Buffer.alloc(21))), pngChunk('IEND')]));
}
// Generated once via System.Drawing: an original 2x3 bitmap, one navy pixel.
export const jpeg = () => new Uint8Array(Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAADAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8qiSxJJyTySaKKKbbbuwP/9k=', 'base64'));
export function webpChunk(name: string, bytes: Buffer): Buffer {
  const size = Buffer.alloc(4); size.writeUInt32LE(bytes.length);
  return Buffer.concat([Buffer.from(name), size, bytes, bytes.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}
export function webp(kind: 'VP8L' | 'VP8 ' | 'VP8X' = 'VP8L', width = 2, height = 3, animation = false): Uint8Array {
  // Constant opaque black: no transforms/cache/meta codes, five single-symbol
  // Huffman trees. The default VP8L fixture also decodes in the host image viewer.
  const bits: number[] = [];
  const put = (value: number, count: number) => { for (let i = 0; i < count; i++) bits.push((value >>> i) & 1); };
  put(0, 1); put(0, 1); put(0, 1);
  for (const symbol of [0, 0, 0, 255, 0]) {
    put(1, 1); put(0, 1); put(symbol > 1 ? 1 : 0, 1); put(symbol, symbol > 1 ? 8 : 1);
  }
  const lossless = Buffer.alloc(5 + Math.ceil(bits.length / 8));
  lossless[0] = 0x2f; lossless.writeUInt32LE((width - 1) + (height - 1) * 16384, 1);
  bits.forEach((bit, i) => { lossless[5 + (i >>> 3)]! |= bit << (i & 7); });
  // Lossy branch is a structural header fixture, not a decoded VP8 bitstream.
  const lossy = Buffer.from([0x10, 0, 0, 0x9d, 1, 0x2a, 0, 0, 0, 0, 0]); lossy.writeUInt16LE(width, 6); lossy.writeUInt16LE(height, 8);
  const extended = Buffer.alloc(10); extended[0] = animation ? 2 : 0; extended.writeUIntLE(width - 1, 4, 3); extended.writeUIntLE(height - 1, 7, 3);
  const chunks = kind === 'VP8X' ? Buffer.concat([webpChunk('VP8X', extended), webpChunk('VP8L', lossless)])
    : webpChunk(kind, kind === 'VP8L' ? lossless : lossy);
  const size = Buffer.alloc(4); size.writeUInt32LE(chunks.length + 4);
  return new Uint8Array(Buffer.concat([Buffer.from('RIFF'), size, Buffer.from('WEBP'), chunks]));
}
