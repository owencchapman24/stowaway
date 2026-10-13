import { epubEntries, makeZip, xhtml, tinyPng, type FixtureEntry } from '../src/epub-spike/fixtures';
import { replaceEntry } from '../src/epub-spike/corpus';
import { processEpub, type ProcessOptions } from '../src/epub-spike/package';
import { context } from '../src/epub-spike/limits';
import { prepareContent } from '../src/content/sanitize';
import { createHash } from 'node:crypto';
import { png, jpeg, webp } from './fixtures/images';

const run = (entries: FixtureEntry[], options?: ProcessOptions) => {
  const bytes = makeZip(entries); return processEpub({ size:bytes.length, async read(at,n) { return bytes.slice(at,at+n); }, close() {} },context(),options);
};
const replaceOpf = (change: (text: string) => string) => epubEntries().map((e) => e.name.endsWith('.opf') ? {...e,text:change(e.text!)} : e);
test('canonical formatting and hashes agree with the unchanged sanitizer; active markup cannot forge markers', async () => {
  const body = '<h1>Title</h1><p onclick="attack()">Text <em>emphasis</em><strong>strong</strong></p><ul><li>Item</li></ul><blockquote>Quote</blockquote><hr/><a href="https://example.org/">External</a><a href="end.xhtml#note">Internal</a><a href="javascript:attack()">Bad</a><script>ATTACK</script><style>PRIVATE CSS</style><form>ACTIVE FORM</form><img src="fixture://harbor.png" data-stowaway-image="0" id="block-0001"/><img src="https://example.org/picture"/><img src="file:///private"/>';
  let actual = '';
  const result = await run(replaceEntry(epubEntries(),'Book/Text/main.xhtml',xhtml(body)),{onChapter(chapter,summary) {
    if (summary.ordinal !== 1) return; actual = chapter.html;
    const expected = createHash('sha256').update(`${chapter.sanitizerVersion}\n${chapter.html}`).digest('hex'); expect(chapter.contentHash).toBe(expected);
    expect(chapter.links).toEqual({'link-1':'https://example.org/'});
  }});
  expect(actual).toContain('<em>emphasis</em>'); expect(actual).toContain('Internal'); expect(actual).toContain('Bad');
  expect(actual).not.toMatch(/ATTACK|PRIVATE CSS|ACTIVE FORM|onclick|fixture:|file:|asset-harbor|data-stowaway|<script|src=/);
  expect(result.chapters[1]!.images.every((i) => i.state === 'omitted')).toBe(true);
  const simple = await prepareContent('<p>synthetic</p>',async(v) => createHash('sha256').update(v).digest('hex'));
  expect(simple.sanitizerVersion).toBe('s0-allowlist-1');
});
test.each(['<p/>',''])('empty sections retain their ordinal %s', async (body) => {
  let html = ''; const result = await run(replaceEntry(epubEntries(),'Book/Text/front.xhtml',xhtml(body)), {onChapter(c,s) {if (!s.ordinal) html=c.html;}});
  expect(result.chapters).toHaveLength(3); expect(html).toContain('[Empty section]');
});
test('unsupported primary SVG cannot become an apparently successful blank chapter', async () => {
  await expect(run(replaceEntry(epubEntries(),'Book/Text/main.xhtml',xhtml('<div><svg xmlns="http://www.w3.org/2000/svg"><text>Graphic-only</text></svg></div>')))).rejects.toMatchObject({code:'unsupported'});
});
test.each([
  ['duplicate-spine',(s:string)=>s.replace('<itemref idref="front"/>','<itemref idref="main"/>'),'package'],
  ['missing-spine',(s:string)=>s.replace('idref="front"','idref="absent"'),'unsupported'],
  ['primary-media',(s:string)=>s.replace('media-type="application/xhtml+xml"','media-type="application/x-dtbook+xml"'),'unsupported'],
  ['fixed-layout',(s:string)=>s.replace('</metadata>','<meta property="rendition:layout">pre-paginated</meta></metadata>'),'unsupported'],
  ['scripted',(s:string)=>s.replace('id="front"','id="front" properties="scripted"'),'unsupported'],
  ['overlay',(s:string)=>s.replace('id="front"','id="front" media-overlay="sound"'),'unsupported'],
  ['remote-item',(s:string)=>s.replace('Text/front.xhtml','https://example.org/front.xhtml'),'path'],
  ['duplicate-item',(s:string)=>s.replace('id="front"','id="main"'),'package'],
  ['duplicate-selected-identifier',(s:string)=>s.replace('</metadata>','<dc:identifier id="book">ambiguous</dc:identifier></metadata>'),'package'],
  ['empty-selected-identifier',(s:string)=>s.replace('synthetic-001',' ').replace('</metadata>','<dc:identifier id="other">nonempty decoy</dc:identifier></metadata>'),'package'],
] as const)('%s package rejection', async (_id,change,code) => { await expect(run(replaceOpf(change))).rejects.toMatchObject({code}); });
test('unique-identifier selects exactly its declared metadata entry, not the first identifier',async()=>{
  const result=await run(replaceOpf((s)=>s.replace('<dc:identifier id="book">','<dc:identifier id="other">different</dc:identifier><dc:identifier id="book">')));
  expect(result.metadata.identifier).toBe('synthetic-001');
});
test('image omission does not change canonical HTML, blocks or hash', async () => {
  const hashes: string[] = [], html: string[] = [];
  for (const entries of [epubEntries(), epubEntries().filter((e)=>!e.name.endsWith('pixel.png'))]) {
    await run(entries,{onChapter(c,s){if(s.ordinal===1){hashes.push(c.contentHash);html.push(c.html);}}});
  }
  expect(hashes[0]).toBe(hashes[1]); expect(html[0]).toBe(html[1]);
});
test('selected corrupt image is fatal; unsupported image is an explicit omission', async () => {
  const bad = tinyPng(); bad[0] = 0;
  const result = await run(replaceEntry(epubEntries(),'Book/Images/pixel.png',bad));
  expect(result.acceptedImages).toBe(0); expect(result.chapters[1]!.images[0]!.reason).toBe('unsupported-format');
  const bytes = makeZip(epubEntries()), needle = tinyPng(); let at = -1;
  for(let i=0;i<bytes.length-needle.length;i++) if(needle.every((b,n)=>bytes[i+n]===b)){at=i;break;}
  expect(at).toBeGreaterThan(0); bytes[at+20] = bytes[at+20]! ^ 1;
  await expect(processEpub({size:bytes.length,async read(a,n){return bytes.slice(a,a+n);},close(){}},context())).rejects.toMatchObject({code:'integrity'});
});
test('per-chapter image instances count shared resources', async () => {
  const result = await run(replaceEntry(epubEntries(),'Book/Text/main.xhtml',xhtml('<p>Pictures</p>'+'<img src="../Images/pixel.png"/>'.repeat(33))));
  expect(result.acceptedImages).toBe(1); expect(result.chapters[1]!.images.filter((i)=>i.state==='accepted')).toHaveLength(32);
  expect(result.chapters[1]!.images[32]!.reason).toBe('chapter-image-budget');
});
const fontEncryption = '<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><enc:EncryptedData xmlns:enc="http://www.w3.org/2001/04/xmlenc#"><enc:EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/><enc:CipherData><enc:CipherReference URI="Book/font.otf"/></enc:CipherData></enc:EncryptedData></encryption>';
test('recognized IDPF obfuscation is allowed only for an unrendered declared font', async () => {
  const base = [...replaceOpf((s)=>s.replace('</manifest>','<item id="font" href="font.otf" media-type="font/otf"/></manifest>')), {name:'Book/font.otf',text:'discarded bytes'}];
  expect((await run([...base,{name:'META-INF/encryption.xml',text:fontEncryption}])).chapters).toHaveLength(3);
  for (const text of [fontEncryption.replace('http://www.idpf.org/2008/embedding','unknown'),fontEncryption.replace('Book/font.otf','Book/Text/main.xhtml'),fontEncryption.replace('<enc:CipherData>','<enc:KeyInfo/><enc:CipherData>'),fontEncryption.replace('URI="Book/font.otf"','URI="Book/font.otf" Key="secret"')]) await expect(run([...base,{name:'META-INF/encryption.xml',text}])).rejects.toMatchObject({code:'encryption'});
});
test.each([
  ['png','image/png',png],['jpeg','image/jpeg',jpeg],['webp','image/webp',webp],
] as const)('archive-local %s uses unchanged raster validation',async(format,media,create)=>{
  const entries=replaceEntry(replaceOpf((s)=>s.replace('media-type="image/png"',`media-type="${media}"`)),'Book/Images/pixel.png',create());
  const result=await run(entries);expect(result.acceptedImages).toBe(1);expect(result.chapters[1]!.images[0]!.format).toBe(format);
});
test.each([2047,2048,2049])('image dimension boundary %i',async(dimension)=>{
  const result=await run(replaceEntry(epubEntries(),'Book/Images/pixel.png',png(dimension,1)));
  expect(result.acceptedImages).toBe(dimension<=2048?1:0);
  if(dimension>2048)expect(result.chapters[1]!.images[0]!.reason).toBe('over-dimension-budget');
});
test('animated raster and unsupported MIME remain explicit omissions',async()=>{
  const animated=await run(replaceEntry(replaceOpf((s)=>s.replace('image/png','image/webp')),'Book/Images/pixel.png',webp('VP8X',2,3,true)));
  expect(animated.chapters[1]!.images[0]!.reason).toBe('animated');
  const svg=await run(replaceOpf((s)=>s.replace('image/png','image/svg+xml')));expect(svg.chapters[1]!.images[0]!.state).toBe('omitted');
});
