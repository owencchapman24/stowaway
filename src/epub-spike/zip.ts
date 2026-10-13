import { ZStream, zlibInflateInit2, zlibInflate, zlibInflateEnd, Z_NO_FLUSH, Z_OK, Z_STREAM_END, Z_BUF_ERROR } from 'pako';
import { sha256 } from '@noble/hashes/sha2.js';
import { crcUpdate, decodeUtf8, view } from './bytes';
import { archivePath } from './paths';
import { LIMITS, requireEpub, checkpoint, measureSync, type Context } from './limits';

export interface Seekable { size: number; read(offset: number, length: number): Promise<Uint8Array>; close(): void; }
export interface Member {
  name: string; directory: boolean; method: number; flags: number; crc: number;
  compressed: number; size: number; local: number; data: number; end: number;
  version: number; modified: number;
}
async function read(file: Seekable, at: number, length: number, ctx: Context) {
  requireEpub(Number.isSafeInteger(at) && at >= 0 && length >= 0 && length <= LIMITS.buffer && at + length <= file.size, 'zip');
  const start = performance.now(), bytes = await file.read(at, length); ctx.timings.read += performance.now() - start;
  ctx.bytesRead += bytes.length; ctx.maxInput = Math.max(ctx.maxInput, bytes.length);
  requireEpub(bytes.length === length, 'integrity'); return bytes;
}
function extras(bytes: Uint8Array) {
  const v = view(bytes); let at = 0;
  while (at < bytes.length) {
    requireEpub(at + 4 <= bytes.length, 'zip');
    const tag = v.getUint16(at, true), n = v.getUint16(at + 2, true);
    // ZIP64 and alternate Unicode path encodings are outside this unambiguous profile.
    requireEpub(tag !== 1 && tag !== 0x7075 && tag !== 0x6375, 'unsupported');
    at += 4 + n; requireEpub(at <= bytes.length, 'zip');
  }
}

export async function indexZip(file: Seekable, ctx: Context): Promise<Map<string, Member>> {
  const start = performance.now();
  try {
  requireEpub(Number.isSafeInteger(file.size) && file.size >= 22 && file.size <= LIMITS.archive, 'budget');
  await checkpoint(ctx, 'index', true);
  const tailAt = Math.max(0, file.size - 65_557), tailSize = file.size - tailAt;
  const tail = new Uint8Array(tailSize);
  for (let at = 0; at < tailSize; at += LIMITS.buffer) tail.set(await read(file, tailAt + at, Math.min(LIMITS.buffer, tailSize - at), ctx), at);
  const t = view(tail); let eocd = -1;
  for (let at = tail.length - 22; at >= 0; at--) {
    if (t.getUint32(at, true) === 0x06054b50 && at + 22 + t.getUint16(at + 20, true) === tail.length) {
      requireEpub(eocd < 0, 'zip'); eocd = at;
    }
  }
  requireEpub(eocd >= 0, 'zip');
  const disk = t.getUint16(eocd + 4, true), cdDisk = t.getUint16(eocd + 6, true);
  const count = t.getUint16(eocd + 10, true), cdSize = t.getUint32(eocd + 12, true), cdAt = t.getUint32(eocd + 16, true);
  requireEpub(!disk && !cdDisk && count === t.getUint16(eocd + 8, true), 'unsupported');
  requireEpub(count !== 0xffff && cdSize !== 0xffffffff && cdAt !== 0xffffffff, 'unsupported');
  requireEpub(count > 0 && count <= LIMITS.members && cdSize <= LIMITS.central, 'budget');
  requireEpub(cdAt + cdSize === tailAt + eocd, 'zip');
  const entries = new Map<string, Member>(); let at = cdAt, total = 0;
  for (let i = 0; i < count; i++) {
    await checkpoint(ctx, 'index');
    requireEpub(at + 46 <= cdAt + cdSize, 'zip');
    const header = view(await read(file, at, 46, ctx));
    requireEpub(header.getUint32(0, true) === 0x02014b50, 'zip');
    const made = header.getUint16(4, true), needed = header.getUint16(6, true), flags = header.getUint16(8, true), method = header.getUint16(10, true);
    const crc = header.getUint32(16, true), compressed = header.getUint32(20, true), size = header.getUint32(24, true);
    const n = header.getUint16(28, true), x = header.getUint16(30, true), comment = header.getUint16(32, true);
    const attr = header.getUint32(38, true), local = header.getUint32(42, true);
    requireEpub(needed >= 10 && needed <= 20 && ((method === 0 && !(flags & 8)) || needed === 20) && !(flags & ~0x080e) && [0, 8].includes(method) && (method !== 0 || !(flags & 6)) && !header.getUint16(34, true), 'unsupported');
    requireEpub(compressed !== 0xffffffff && size !== 0xffffffff && local !== 0xffffffff, 'unsupported');
    requireEpub(n > 0 && n <= LIMITS.path && at + 46 + n + x + comment <= cdAt + cdSize, 'zip');
    const nameBytes = await read(file, at + 46, n, ctx);
    requireEpub(!!(flags & 0x800) || nameBytes.every((b) => b < 128), 'unsupported');
    const name = archivePath(decodeUtf8(nameBytes)), directory = name.endsWith('/');
    const type = (attr >>> 16) & 0xf000;
    requireEpub((made >>> 8) === 0 || (made >>> 8) === 3, 'unsupported');
    requireEpub(!type || type === (directory ? 0x4000 : 0x8000), 'unsupported');
    requireEpub(!(attr & 0x08) && !(attr & 0x40), 'unsupported');
    requireEpub(!(attr & 0x10) || directory, 'zip');
    requireEpub(!entries.has(name) && !entries.has(directory ? name.slice(0, -1) : name + '/'), 'path');
    requireEpub(!directory || (size === 0 && compressed === 0 && method === 0 && !(flags & 8)), 'unsupported');
    requireEpub(method !== 0 || compressed === size, 'integrity');
    requireEpub(size <= 1024 * 1024 || size <= compressed * 200, 'budget');
    total += size; requireEpub(total <= LIMITS.output, 'budget');
    extras(await read(file, at + 46 + n, x, ctx));
    entries.set(name, { name, directory, method, flags, crc, compressed, size, local, data: 0, end: 0, version: needed, modified: header.getUint32(12, true) });
    at += 46 + n + x + comment;
  }
  requireEpub(at === cdAt + cdSize, 'zip');
  for (const member of entries.values()) {
    await checkpoint(ctx, 'index');
    const parts = member.name.split('/'); parts.pop(); let parent = '';
    for (const part of parts) { parent += (parent ? '/' : '') + part; requireEpub(!entries.has(parent), 'path'); }
  }
  const sorted = [...entries.values()].sort((a, b) => a.local - b.local);
  let end = 0;
  for (const member of sorted) {
    await checkpoint(ctx, 'index');
    requireEpub(member.local === end && member.local + 30 <= cdAt, 'zip');
    const h = view(await read(file, member.local, 30, ctx));
    requireEpub(h.getUint32(0, true) === 0x04034b50 && h.getUint16(4, true) === member.version && h.getUint32(10, true) === member.modified && h.getUint16(6, true) === member.flags && h.getUint16(8, true) === member.method, 'zip');
    const n = h.getUint16(26, true), x = h.getUint16(28, true);
    requireEpub(n > 0 && n <= LIMITS.path && member.local + 30 + n + x <= cdAt, 'zip');
    requireEpub(decodeUtf8(await read(file, member.local + 30, n, ctx)) === member.name, 'zip');
    extras(await read(file, member.local + 30 + n, x, ctx));
    for (const [offset, expected] of [[14, member.crc], [18, member.compressed], [22, member.size]] as const) {
      const actual = h.getUint32(offset, true);
      requireEpub(actual === expected || (!!(member.flags & 8) && actual === 0), 'integrity');
    }
    member.data = member.local + 30 + n + x; member.end = member.data + member.compressed;
    requireEpub(member.end <= cdAt, 'zip');
    if (member.flags & 8) {
      requireEpub(member.end + 12 <= cdAt, 'zip');
      const sig = view(await read(file, member.end, 4, ctx)).getUint32(0, true) === 0x08074b50;
      const d = view(await read(file, member.end + (sig ? 4 : 0), 12, ctx));
      requireEpub(d.getUint32(0, true) === member.crc && d.getUint32(4, true) === member.compressed && d.getUint32(8, true) === member.size, 'integrity');
      member.end += sig ? 16 : 12;
    }
    requireEpub(member.end <= cdAt, 'zip'); end = member.end;
  }
  requireEpub(end === cdAt, 'zip');
  return entries;
  } finally { ctx.timings.index += performance.now() - start; }
}

/** Fixed-buffer raw DEFLATE; sink sees a borrowed buffer valid only until return. */
export async function extract(file: Seekable, m: Member, cap: number, ctx: Context, sink: (bytes: Uint8Array) => void) {
  requireEpub(m.size <= cap && ctx.output + m.size <= LIMITS.output, 'budget');
  const start = performance.now(); let produced = 0, crc = 0xffffffff, loaded = 0;
  try {
  function emit(bytes: Uint8Array) {
    produced += bytes.length; ctx.output += bytes.length;
    requireEpub(produced <= m.size && produced <= cap && ctx.output <= LIMITS.output, 'budget');
    crc = crcUpdate(crc, bytes); sink(bytes);
  }
  if (m.method === 0) {
    while (loaded < m.compressed) {
      await checkpoint(ctx, 'resource');
      const b = await read(file, m.data + loaded, Math.min(LIMITS.buffer, m.compressed - loaded), ctx);
      loaded += b.length; ctx.compressed += b.length; emit(b);
    }
  } else {
    const stream = new ZStream(); requireEpub(zlibInflateInit2(stream, -15) === Z_OK, 'integrity');
    const output = new Uint8Array(LIMITS.buffer); ctx.maxOutput = Math.max(ctx.maxOutput, output.length);
    try {
      for (;;) {
        await checkpoint(ctx, 'inflate');
        if (!stream.avail_in && loaded < m.compressed) {
          stream.input = await read(file, m.data + loaded, Math.min(LIMITS.buffer, m.compressed - loaded), ctx);
          stream.next_in = 0; stream.avail_in = stream.input.length; loaded += stream.input.length;
        }
        stream.output = output; stream.next_out = 0;
        stream.avail_out = Math.min(output.length, m.size - produced + 1, cap - produced + 1, LIMITS.output - ctx.output + 1);
        const before = stream.avail_in;
        const status = zlibInflate(stream, Z_NO_FLUSH);
        ctx.compressed += before - stream.avail_in;
        emit(output.subarray(0, stream.next_out));
        if (status === Z_STREAM_END) {
          requireEpub(loaded === m.compressed && stream.avail_in === 0 && stream.total_in === m.compressed, 'integrity'); break;
        }
        requireEpub((status === Z_OK || status === Z_BUF_ERROR) && (stream.next_out > 0 || before !== stream.avail_in), 'integrity');
      }
    } finally { zlibInflateEnd(stream); }
  }
  requireEpub(produced === m.size && ((crc ^ 0xffffffff) >>> 0) === m.crc, 'integrity');
  } finally { ctx.timings.inflate += performance.now() - start; }
}
export async function readMember(file: Seekable, m: Member, cap: number, ctx: Context): Promise<Uint8Array> {
  requireEpub(m.size <= cap && ctx.output + m.size <= LIMITS.output, 'budget');
  const output = new Uint8Array(m.size); let at = 0;
  await extract(file, m, cap, ctx, (chunk) => { output.set(chunk, at); at += chunk.length; }); return output;
}
export async function packageHash(file: Seekable, ctx: Context) {
  const start = performance.now(), hash = sha256.create();
  for (let at = 0; at < file.size; at += LIMITS.buffer) {
    await checkpoint(ctx, 'hash');
    const bytes = await read(file, at, Math.min(LIMITS.buffer, file.size - at), ctx);
    measureSync(ctx, 'packageHash', () => hash.update(bytes));
  }
  ctx.timings.hash += performance.now() - start;
  return Array.from(hash.digest(), (b) => b.toString(16).padStart(2, '0')).join('');
}
