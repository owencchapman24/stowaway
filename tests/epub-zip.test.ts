import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { makeZip } from '../src/epub-spike/fixtures';
import { context, LIMITS } from '../src/epub-spike/limits';
import { indexZip, readMember, type Seekable } from '../src/epub-spike/zip';
import { decodeUtf8 } from '../src/epub-spike/bytes';

export function memoryFile(bytes: Uint8Array): Seekable {
  return { size: bytes.length, async read(at, n) { return bytes.slice(at, at + n); }, close() {} };
}
describe('M1a first gate: seekable files and caller-owned output', () => {
  test.each([undefined, 'signed', 'unsigned'] as const)('real file, DEFLATE, descriptor %s', async (descriptor) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stowaway-m1a-'));
    const name = path.join(dir, 'synthetic.zip');
    const expected = 'bounded synthetic content '.repeat(2000);
    fs.writeFileSync(name, makeZip([{ name: 'member', text: expected, deflate: true, descriptor }]));
    const fd = fs.openSync(name, 'r'), ctx = context(); let closed = false;
    const file: Seekable = { size: fs.fstatSync(fd).size, async read(at, n) { expect(n).toBeLessThanOrEqual(65_536); const b = Buffer.alloc(n); fs.readSync(fd, b, 0, n, at); return b; }, close() { fs.closeSync(fd); closed = true; } };
    try {
      const zip = await indexZip(file, ctx);
      expect(decodeUtf8(await readMember(file, zip.get('member')!, LIMITS.xml, ctx))).toBe(expected);
      expect(ctx.output).toBe(expected.length); expect(ctx.maxOutput).toBe(65_536);
    } finally { file.close(); fs.unlinkSync(name); fs.rmdirSync(dir); }
    expect(closed).toBe(true);
  });
});
