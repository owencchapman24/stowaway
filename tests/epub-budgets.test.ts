import { deflateRaw } from 'pako';
import { utf8, crc32, decodeUtf8, view } from '../src/epub-spike/bytes';
import { makeZip } from '../src/epub-spike/fixtures';
import { context, LIMITS } from '../src/epub-spike/limits';
import { archivePath, resolveReference } from '../src/epub-spike/paths';
import { strictXml } from '../src/epub-spike/xml';
import { indexZip, readMember, extract, type Member, type Seekable } from '../src/epub-spike/zip';

const file = (bytes: Uint8Array): Seekable => ({ size: bytes.length, async read(at,n) { return bytes.slice(at, at+n); }, close() {} });
const rawMember = (input: Uint8Array, raw: Uint8Array): Member => ({ name:'synthetic',directory:false,method:8,flags:0,crc:crc32(raw),compressed:input.length,size:raw.length,local:0,data:0,end:input.length,version:20,modified:0 });
test.each([-1,0,1])('actual member byte cap: boundary %+d', async (delta) => {
  const bytes = utf8('z'.repeat(65536 + delta)), compressed = deflateRaw(bytes), ctx = context();
  const member = rawMember(compressed, bytes);
  // Lie about size so declared checks cannot substitute for the actual-output assertion.
  member.size = 65536; let delivered = 0;
  const promise = extract(file(compressed), member, 65536, ctx, (b) => { delivered += b.length; });
  if (delta === 0) { await promise; expect(delivered).toBe(65536); }
  else await expect(promise).rejects.toMatchObject({ code: delta < 0 ? 'integrity' : 'budget' });
  expect(delivered).toBeLessThanOrEqual(65536); expect(ctx.output).toBeLessThanOrEqual(65537);
});
test.each([-1,0,1])('aggregate emitted-output cap: boundary %+d', async (delta) => {
  const bytes = utf8('abcd'), packed = deflateRaw(bytes), ctx = context(); ctx.output = LIMITS.output - 4 + delta;
  const promise = readMember(file(packed), rawMember(packed, bytes), 4, ctx);
  if (delta > 0) await expect(promise).rejects.toMatchObject({ code:'budget' }); else expect(await promise).toEqual(bytes);
});
test.each([-1,0,1])('selected file length checked before reads: %+d', async (delta) => {
  const read = jest.fn(async () => new Uint8Array(65536)), input: Seekable = { size: LIMITS.archive+delta, read, close() {} };
  await expect(indexZip(input, context())).rejects.toBeDefined();
  if (delta > 0) expect(read).not.toHaveBeenCalled(); else expect(read).toHaveBeenCalled();
});
test.each([-1,0,1])('path UTF8 byte boundary %+d', (delta) => {
  const value = ['a'.repeat(255),'b'.repeat(255),'c'.repeat(255),'d'.repeat(252),'e'.repeat(3+delta)].join('/');
  expect(utf8(value)).toHaveLength(1024+delta);
  if (delta > 0) expect(() => archivePath(value)).toThrow(); else expect(archivePath(value)).toBe(value);
});
test.each([-1,0,1])('path segment byte boundary %+d',(delta)=>{
  const value='a'.repeat(255+delta);if(delta>0)expect(()=>archivePath(value)).toThrow();else expect(archivePath(value)).toBe(value);
});
test('separate reference resolution allows safe parents but rejects aliases/root escape', () => {
  expect(resolveReference('Book/Text/a.xhtml','../Images/pixel.png')).toBe('Book/Images/pixel.png');
  expect(resolveReference('Book/a.xhtml','caf%C3%A9.png#caption')).toBe('Book/café.png');
  for (const ref of ['../../escape','%2e%2e/escape','%252e%252e/escape','a%2fb','file:///tmp/file','https://example.org/image','//host/image','a\\b','a?query','a%00b']) expect(() => resolveReference('Book/a.xhtml',ref)).toThrow();
});
test.each(['truncated','trailing','crc'])('raw DEFLATE integrity %s', async (kind) => {
  const raw = utf8('The bounded stream must end exactly. '.repeat(100)), packed = deflateRaw(raw);
  const bytes = kind === 'truncated' ? packed.slice(0,-1) : kind === 'trailing' ? new Uint8Array([...packed,0]) : packed;
  const member = rawMember(bytes,raw); if (kind === 'crc') member.crc ^= 1;
  await expect(readMember(file(bytes),member,raw.length,context())).rejects.toMatchObject({code:'integrity'});
});
test('descriptor and local/central contradictions are fatal', async () => {
  for (const descriptor of ['signed','unsigned'] as const) {
    const bytes = makeZip([{ name:'entry',text:'text',deflate:true,descriptor }]);
    const cd = view(bytes).getUint32(bytes.length - 6,true); bytes[cd-1] = bytes[cd-1]! ^ 1;
    await expect(indexZip(file(bytes),context())).rejects.toMatchObject({code:'integrity'});
  }
  const bytes = makeZip([{name:'entry',text:'text'}]); bytes[6] = bytes[6]! ^ 8;
  await expect(indexZip(file(bytes),context())).rejects.toMatchObject({code:'zip'});
});
test.each([-1,0,1])('XML nesting boundary %+d', async (delta) => {
  const input = '<a>'.repeat(64+delta) + '</a>'.repeat(64+delta);
  const promise = strictXml(utf8(input),context());
  if (delta > 0) await expect(promise).rejects.toMatchObject({code:'budget'}); else expect((await promise).name).toBe('a');
});
test.each([-1,0,1])('XML node boundary %+d', async (delta) => {
  const input = '<a>' + '<b/>'.repeat(29999+delta) + '</a>';
  const promise = strictXml(utf8(input),context());
  if (delta > 0) await expect(promise).rejects.toMatchObject({code:'budget'}); else expect((await promise).children.length).toBe(29999+delta);
});
test.each([-1,0,1])('attribute count boundary %+d', async (delta) => {
  const input = '<a ' + Array.from({length:64+delta},(_,i) => `a${i}="v"`).join(' ') + '/>';
  const promise = strictXml(utf8(input),context());
  if (delta > 0) await expect(promise).rejects.toMatchObject({code:'budget'}); else expect(Object.keys((await promise).attributes)).toHaveLength(64+delta);
});
test.each([-1,0,1])('attribute value boundary %+d', async (delta) => {
  const promise = strictXml(utf8('<a v="' + 'x'.repeat(65536+delta) + '"/>'),context());
  if (delta > 0) await expect(promise).rejects.toMatchObject({code:'budget'}); else expect((await promise).attributes.v).toHaveLength(65536+delta);
});
test.each([-1,0,1])('decoded string boundary %+d', async (delta) => {
  const input = '<a>' + 'x'.repeat(LIMITS.string-7+delta) + '</a>';
  const promise = strictXml(utf8(input),context());
  if (delta > 0) await expect(promise).rejects.toMatchObject({code:'budget'}); else expect((await promise).text.length).toBe(LIMITS.string-7+delta);
});
test.each([[0xed,0xa0,0x80],[0xf4,0x90,0x80,0x80],[0x80],[0xc2],[0xef,0xbf],[0xc0,0xaf]])('fatal UTF8 rejects %j', (...bytes) => {
  expect(() => decodeUtf8(new Uint8Array(bytes))).toThrow();
});
test.each([-1,0,1])('actual ZIP member-count boundary %+d',async(delta)=>{
  const bytes=makeZip(Array.from({length:LIMITS.members+delta},(_,i)=>({name:`member-${i}`})));
  const promise=indexZip(file(bytes),context());
  if(delta>0)await expect(promise).rejects.toMatchObject({code:'budget'});else expect((await promise).size).toBe(LIMITS.members+delta);
});
test.each([-1,0,1])('declared total boundary %+d is checked before local payloads',async(delta)=>{
  const bytes=makeZip([{name:'a'},{name:'b'}]),v=view(bytes),cd=v.getUint32(bytes.length-6,true);
  for(const [i,at] of [cd,cd+47].entries()){
    const size=LIMITS.output/2+(i?delta:0);v.setUint16(at+10,8,true);v.setUint32(at+20,Math.ceil(size/200),true);v.setUint32(at+24,size,true);
  }
  // In-bound declarations get as far as the contradictory local headers. Over-limit
  // declarations fail earlier; no claimed large payload is allocated or inflated.
  await expect(indexZip(file(bytes),context())).rejects.toMatchObject({code:delta>0?'budget':'zip'});
});
test('failed XML/index phases retain measured duration instead of reporting zero success-only time',async()=>{
  const ctx=context();
  let time=100;const clock=jest.spyOn(performance,'now').mockImplementation(()=>time++);
  try {
    await expect(strictXml(utf8('<broken>'),ctx)).rejects.toMatchObject({code:'xml'});
    expect(ctx.timings.xml).toBeGreaterThan(0);
    await expect(indexZip({...file(new Uint8Array()),size:0},ctx)).rejects.toMatchObject({code:'budget'});
    expect(ctx.timings.index).toBeGreaterThan(0);
  } finally {clock.mockRestore();}
});
