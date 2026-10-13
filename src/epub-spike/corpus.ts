import { epubEntries, makeZip, xhtml, LINE_ENDINGS, type FixtureEntry } from './fixtures';
import { utf8, view } from './bytes';
import { type FailureCode, type Phase } from './limits';
import { STANDARD_BOOK, HOSTILE_BOOK, denseExpected, scopesExpected, expectedBook, paragraphExpected, type OutputExpectation } from './expectations';

export type CorpusCase = { id: string; name: string; tier: 'quick' | 'extended'; bytes: () => Uint8Array; cancel?: Phase } &
  ({ expected: 'accepted'; output: OutputExpectation } | { expected: FailureCode; output?: never });
export function replaceEntry(entries: FixtureEntry[], name: string, text: string | Uint8Array) {
  return entries.map((e) => e.name === name ? { name, ...(typeof text === 'string' ? { text } : { bytes: text }) } : e);
}
export function mutateZip(edit: (bytes: Uint8Array, central: number) => void): Uint8Array {
  const bytes = makeZip(epubEntries()), central = view(bytes).getUint32(bytes.length - 6, true); edit(bytes, central); return bytes;
}
const cases: CorpusCase[] = [
  ...([2,3] as const).map((version): CorpusCase => ({ id: `epub${version}`, name: `EPUB ${version}, spine, navigation and shared raster`, tier: 'quick', expected: 'accepted', bytes: () => makeZip(epubEntries(version)), output: STANDARD_BOOK })),
  { id: 'directories', name: 'Harmless directory entry', tier: 'quick', expected: 'accepted', bytes: () => makeZip([...epubEntries(), { name: 'Unused/' }]), output: STANDARD_BOOK },
  { id: 'crc', name: 'Processed member CRC corruption', tier: 'quick', expected: 'integrity', bytes: () => mutateZip((b) => { b[38] = 0; }) },
  { id: 'truncated', name: 'Truncated central directory', tier: 'quick', expected: 'zip', bytes: () => makeZip(epubEntries()).slice(0, -8) },
  { id: 'local-header', name: 'Invalid local signature', tier: 'quick', expected: 'zip', bytes: () => mutateZip((b) => { b[0] = 0; }) },
  { id: 'overlap', name: 'Overlapping local member ranges', tier: 'quick', expected: 'zip', bytes: () => mutateZip((b,c) => { const v = view(b); const second = c + 46 + v.getUint16(c + 28, true); v.setUint32(second + 42, 0, true); }) },
  { id: 'method', name: 'Unsupported compression', tier: 'quick', expected: 'unsupported', bytes: () => mutateZip((b,c) => view(b).setUint16(c + 10, 99, true)) },
  { id: 'encrypted', name: 'ZIP encryption flag', tier: 'quick', expected: 'unsupported', bytes: () => mutateZip((b,c) => view(b).setUint16(c + 8, 0x801, true)) },
  { id: 'zip64', name: 'ZIP64 sentinel', tier: 'quick', expected: 'unsupported', bytes: () => mutateZip((b,c) => view(b).setUint32(c + 24, 0xffffffff, true)) },
  { id: 'split', name: 'Split archive', tier: 'quick', expected: 'unsupported', bytes: () => mutateZip((b) => view(b).setUint16(b.length - 18, 1, true)) },
  { id: 'symlink', name: 'Unix symlink', tier: 'quick', expected: 'unsupported', bytes: () => mutateZip((b,c) => { view(b).setUint16(c + 4, 0x314, true); view(b).setUint32(c + 38, 0xa0000000, true); }) },
  ...['../escape', '/absolute', 'C:drive', 'a\\b', 'a/%2e%2e/b', 'a//b', 'a/./b', 'e\u0301'].map((name, i): CorpusCase => ({ id: `path-${i}`, name: 'Unsafe archive path', tier: 'quick', expected: 'path', bytes: () => makeZip([...epubEntries(), { name }]) })),
  { id: 'duplicate', name: 'Duplicate member names', tier: 'quick', expected: 'path', bytes: () => makeZip([...epubEntries(), { name: 'mimetype' }]) },
  { id: 'ratio', name: 'High expansion early filter', tier: 'extended', expected: 'budget', bytes: () => makeZip([...epubEntries(), { name: 'bomb', text: 'a'.repeat(1_048_577), deflate: true }]) },
  { id: 'member-count', name: 'Excessive declared member count', tier: 'extended', expected: 'budget', bytes: () => mutateZip((b) => { view(b).setUint16(b.length - 14, 10001, true); view(b).setUint16(b.length - 12, 10001, true); }) },
  { id: 'central-budget', name: 'Excessive central directory', tier: 'extended', expected: 'budget', bytes: () => mutateZip((b) => view(b).setUint32(b.length - 10, 4 * 1024 * 1024 + 1, true)) },
];
const xmlCases: [string, string | Uint8Array, FailureCode][] = [
  ['malformed', xhtml('<p>not closed'), 'xml'],
  ['utf8', new Uint8Array([0xc0,0xaf]), 'xml'],
  ['duplicate-attribute', xhtml('<p a="1" a="2"/>'), 'xml'],
  ['namespace-collision', xhtml('<p xmlns:a="urn:x" xmlns:b="urn:x" a:x="1" b:x="2"/>'), 'namespace'],
  ['unbound-prefix', xhtml('<bad:p/>'), 'namespace'],
  ['reserved-prefix', xhtml('<p xmlns:xml="urn:wrong"/>'), 'namespace'],
  ['reserved-uri', xhtml('<p xmlns:z="http://www.w3.org/XML/1998/namespace"/>'), 'namespace'],
  ['dtd', '<!DOCTYPE html SYSTEM "https://example.org/dtd">' + xhtml('<p>Text</p>'), 'xml'],
  ['entity', '<!DOCTYPE html [<!ENTITY x "text">]>' + xhtml('<p>&x;</p>'), 'xml'],
  ['xinclude', xhtml('<xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="file:///secret"/>'), 'unsupported'],
  ['depth', xhtml('<div>'.repeat(64) + 'text' + '</div>'.repeat(64)), 'budget'],
  ['attributes', xhtml('<p ' + Array.from({length:65}, (_,i) => `a${i}="x"`).join(' ') + '/>'), 'budget'],
  ['long-attribute', xhtml('<p a="' + 'x'.repeat(65_537) + '"/>'), 'budget'],
  ['encoding', '<?xml version="1.0" encoding="UTF-16"?>' + xhtml('<p>Text</p>'), 'xml'],
  ['closing-token', xhtml('<p>Text</p extra>'), 'xml'],
  ['many-nodes', xhtml('<p/>'.repeat(30_001)), 'budget'],
];
for (const [id, text, expected] of xmlCases) cases.push({ id, name: `Strict XML: ${id}`, tier: ['many-nodes','long-attribute'].includes(id) ? 'extended' : 'quick', expected,
  bytes: () => makeZip(replaceEntry(epubEntries(), 'Book/Text/main.xhtml', text)) });
for (const phase of ['index','inflate','resource','chapter'] as const) cases.push({ id: `cancel-${phase}`, name: `Cancellation during ${phase}`, tier: 'quick', expected: 'cancelled', cancel: phase, bytes: () => makeZip(epubEntries()) });
cases.push({ id: 'dense-valid', name: 'Dense namespace-heavy valid XML', tier: 'extended', expected: 'accepted', output: expectedBook(denseExpected), bytes: () => makeZip(replaceEntry(epubEntries(), 'Book/Text/main.xhtml', xhtml('<p xmlns:a="urn:one" a:k="value">original prose</p>'.repeat(9000)))) });
cases.push({ id: 'long-text', name: 'Long valid chapter near decoded cap', tier: 'extended', expected: 'accepted', output: expectedBook(()=>paragraphExpected('original '.repeat(109000))), bytes: () => makeZip(replaceEntry(epubEntries(), 'Book/Text/main.xhtml', xhtml('<p>' + 'original '.repeat(109000) + '</p>'))) });
cases.push({ id: 'decoded-cap', name: 'Decoded XHTML over cap', tier: 'extended', expected: 'budget', bytes: () => makeZip(replaceEntry(epubEntries(), 'Book/Text/main.xhtml', xhtml('<p>' + 'x'.repeat(1_000_000) + '</p>'))) });
cases.push({ id: 'namespace-scopes', name: 'Deep namespace scopes with many siblings', tier: 'extended', expected: 'accepted', output: expectedBook(scopesExpected), bytes: () => {
  const layers = Array.from({length:40},(_,depth) => '<div ' + Array.from({length:32},(_,n)=>`xmlns:n${depth}_${n}="urn:${depth}:${n}"`).join(' ') + '>').join('');
  return makeZip(replaceEntry(epubEntries(),'Book/Text/main.xhtml',xhtml(layers+'<p xmlns:last="urn:last">Scoped prose</p>'.repeat(3000)+'</div>'.repeat(40))));
} });
cases.push({id:'active-content',name:'Canonical removal of active content and forged markers',tier:'quick',expected:'accepted',output:HOSTILE_BOOK,
  bytes:()=>makeZip(replaceEntry(epubEntries(),'Book/Text/main.xhtml',xhtml('<p onclick="unsafe()" id="forged" data-reader="unsafe">Safe synthetic <em>formatting</em>.</p><script>UNSAFE_SOURCE</script><style>UNSAFE_SOURCE</style><iframe src="https://example.org/"/><object>UNSAFE_SOURCE</object><form>UNSAFE_SOURCE</form><a href="javascript:unsafe()">Inert bad link</a><img src="fixture://harbor.png" data-stowaway-image="0"/><img src="file:///private"/><img src="https://example.org/remote.png"/>'))) });
for (const sample of LINE_ENDINGS) cases.push({id:sample.id,name:`Literal XML line endings: ${sample.id}`,tier:'extended',expected:'accepted',output:expectedBook(()=>paragraphExpected(sample.text())),
  bytes:()=>makeZip(replaceEntry(epubEntries(),'Book/Text/main.xhtml',xhtml(sample.body()))) });
cases.push({id:'cr-malformed',name:'Malformed XML with hostile CR pattern',tier:'extended',expected:'xml',bytes:()=>makeZip(replaceEntry(epubEntries(),'Book/Text/main.xhtml',xhtml('<p>'+'x\r'.repeat(200000)+'</wrong>'))) });
cases.push({id:'cr-references',name:'Literal CR and character references stay distinct',tier:'quick',expected:'accepted',output:expectedBook(()=>paragraphExpected('a\nb\nc\nd\re\rf')),
  bytes:()=>makeZip(replaceEntry(epubEntries(),'Book/Text/main.xhtml',xhtml('<p a="a\rb\r\nc&#13;d">a\rb\r\nc\nd&#13;e&#xD;f</p>'))) });
for (const [id,boms,version,encoding] of [
  ['one-bom',1,'1.0','UTF-8'],['two-boms',2,'1.0','UTF-8'],['three-boms',3,'1.0','UTF-8'],
  ['one-bom-encoding',1,'1.0','UTF-16'],['two-boms-encoding',2,'1.0','UTF-16'],
  ['one-bom-version',1,'1.1','UTF-8'],['two-boms-version',2,'1.1','UTF-8'],
] as const) {
  const base={id,name:`Strict XML declaration: ${id}`,tier:'quick' as const,bytes:()=>makeZip(epubEntries().map((e)=>e.name==='Book/Text/main.xhtml'?{...e,text:'\ufeff'.repeat(boms)+`<?xml version="${version}" encoding="${encoding}"?>`+e.text!}:e))};
  cases.push(id==='one-bom'?{...base,expected:'accepted',output:STANDARD_BOOK}:{...base,expected:'xml'});
}
export const CORPUS = Object.freeze(cases);
export const PERFORMANCE_CASES = ['dense-valid', 'long-text', 'ratio', 'namespace-scopes'] as const;
export type PerformanceCase = typeof PERFORMANCE_CASES[number];
// Fixtures are generated in-process; no private binary or ignored generator is required.
export const corpusFingerprintInput = () => utf8(CORPUS.map((c) => `${c.id}:${c.expected}`).join('\n'));
