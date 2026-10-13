/** Original, deterministic diagnostic content. No downloads or production fixtures. */
import { deflateRaw } from 'pako';
import { crc32, utf8 } from './bytes';

export interface FixtureEntry { name: string; text?: string; bytes?: Uint8Array; deflate?: boolean; descriptor?: 'signed' | 'unsigned'; }
export function makeZip(entries: FixtureEntry[]): Uint8Array {
  const locals: Uint8Array[] = [], central: Uint8Array[] = []; let offset = 0;
  for (const e of entries) {
    const name = utf8(e.name), raw = e.bytes ?? utf8(e.text ?? ''), body = e.deflate ? deflateRaw(raw) : raw;
    const crc = crc32(raw), flags = 0x800 | (e.descriptor ? 8 : 0);
    const local = new Uint8Array(30 + name.length + body.length + (e.descriptor ? (e.descriptor === 'signed' ? 16 : 12) : 0));
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, flags, true); l.setUint16(8, e.deflate ? 8 : 0, true);
    if (!e.descriptor) { l.setUint32(14, crc, true); l.setUint32(18, body.length, true); l.setUint32(22, raw.length, true); }
    l.setUint16(26, name.length, true); local.set(name, 30); local.set(body, 30 + name.length);
    if (e.descriptor) {
      let d = 30 + name.length + body.length;
      if (e.descriptor === 'signed') { l.setUint32(d, 0x08074b50, true); d += 4; }
      l.setUint32(d, crc, true); l.setUint32(d + 4, body.length, true); l.setUint32(d + 8, raw.length, true);
    }
    const c = new Uint8Array(46 + name.length), v = new DataView(c.buffer);
    v.setUint32(0, 0x02014b50, true); v.setUint16(4, 20, true); v.setUint16(6, 20, true);
    v.setUint16(8, flags, true); v.setUint16(10, e.deflate ? 8 : 0, true);
    v.setUint32(16, crc, true); v.setUint32(20, body.length, true); v.setUint32(24, raw.length, true);
    v.setUint16(28, name.length, true); v.setUint32(42, offset, true); c.set(name, 46);
    locals.push(local); central.push(c); offset += local.length;
  }
  const cdSize = central.reduce((n, b) => n + b.length, 0), result = new Uint8Array(offset + cdSize + 22);
  let at = 0; for (const part of [...locals, ...central]) { result.set(part, at); at += part.length; }
  const v = new DataView(result.buffer); v.setUint32(at, 0x06054b50, true);
  v.setUint16(at + 8, entries.length, true); v.setUint16(at + 10, entries.length, true);
  v.setUint32(at + 12, cdSize, true); v.setUint32(at + 16, offset, true); return result;
}
export const XHTML = 'http://www.w3.org/1999/xhtml';
export const xhtml = (body: string) => `<html xmlns="${XHTML}"><head><title>Section title</title></head><body>${body}</body></html>`;
// A complete original 1x1 PNG; CRCs generated instead of copied from a book.
export function tinyPng(): Uint8Array {
  const chunk = (name: string, data: Uint8Array) => {
    const b = new Uint8Array(data.length + 12), v = new DataView(b.buffer);
    v.setUint32(0, data.length); b.set(utf8(name), 4); b.set(data, 8); v.setUint32(b.length - 4, crc32(b.subarray(4, b.length - 4))); return b;
  };
  const ihdr = new Uint8Array(13); new DataView(ihdr.buffer).setUint32(0, 1); new DataView(ihdr.buffer).setUint32(4, 1); ihdr[8] = 8; ihdr[9] = 2;
  // zlib stream containing one filter byte and one black RGB pixel.
  const parts = [new Uint8Array([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', new Uint8Array([120,1,1,4,0,251,255,0,0,0,0,0,4,0,1])), chunk('IEND', new Uint8Array())];
  const result = new Uint8Array(parts.reduce((n, b) => n + b.length, 0)); let at = 0;
  for (const b of parts) { result.set(b, at); at += b.length; } return result;
}
export function epubEntries(version: 2 | 3 = 3): FixtureEntry[] {
  return [
    { name: 'mimetype', text: 'application/epub+zip' },
    { name: 'META-INF/container.xml', text: '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="Book/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>' },
    { name: 'Book/package.opf', deflate: true, descriptor: 'signed', text: `<package xmlns="http://www.idpf.org/2007/opf" version="${version}.0" unique-identifier="book"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Synthetic Café 航海</dc:title><dc:creator>Stowaway Test Author</dc:creator><dc:language>en</dc:language><dc:identifier id="book">synthetic-001</dc:identifier><dc:description>Original diagnostic prose.</dc:description><dc:rights>Original synthetic fixture.</dc:rights></metadata><manifest><item id="front" href="Text/front.xhtml" media-type="application/xhtml+xml"/><item id="main" href="Text/main.xhtml" media-type="application/xhtml+xml"/><item id="end" href="Text/end.xhtml" media-type="application/xhtml+xml"/><item id="picture" href="Images/pixel.png" media-type="image/png"/><item id="nav" href="${version === 3 ? 'nav.xhtml' : 'toc.ncx'}" media-type="${version === 3 ? 'application/xhtml+xml' : 'application/x-dtbncx+xml'}" ${version === 3 ? 'properties="nav"' : ''}/></manifest><spine ${version === 2 ? 'toc="nav"' : ''}><itemref idref="front"/><itemref idref="main"/><itemref idref="end" linear="no"/></spine></package>` },
    { name: 'Book/Text/front.xhtml', text: xhtml('<h1>Front matter</h1><p>A synthetic preface.</p>') },
    { name: 'Book/Text/main.xhtml', deflate: true, descriptor: 'unsigned', text: xhtml('<h1>Harbor notes</h1><p>Unicode: café 航海. <em>Emphasis</em> and <strong>strength</strong>.</p><ul><li>One list item</li></ul><blockquote>A short quotation.</blockquote><hr/><p><a href="https://example.org/reading">Safe link</a> <a href="end.xhtml#note">Inert internal link</a></p><img src="../Images/pixel.png" alt="Pixel"/><img src="../Images/pixel.png"/>') },
    { name: 'Book/Text/end.xhtml', text: xhtml('<h2>End matter</h2><p>Auxiliary notes remain in order.</p>') },
    { name: version === 3 ? 'Book/nav.xhtml' : 'Book/toc.ncx', text: version === 3 ? xhtml('<nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc"><ol><li><a href="Text/main.xhtml">Main label</a></li></ol></nav>') : '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap><navPoint id="a"><navLabel><text>Main label</text></navLabel><content src="Text/main.xhtml"/></navPoint></navMap></ncx>' },
    { name: 'Book/Images/pixel.png', bytes: tinyPng() },
  ];
}

/** Bounded adversarial line endings, generated only when the case runs. */
export const LINE_ENDINGS = [
  {id:'cr-text',body:()=>'<p>'+'x\r'.repeat(200000)+'</p>',text:()=>'x\n'.repeat(200000)},
  {id:'crlf-text',body:()=>'<p>'+'x\r\n'.repeat(133333)+'</p>',text:()=>'x\n'.repeat(133333)},
  {id:'mixed-lines',body:()=>'<p>left'+'\r\r\n\n'.repeat(80000)+'right</p>',text:()=>'left'+'\n\n\n'.repeat(80000)+'right'},
  {id:'cr-comment',body:()=>'<p>Comment survivor</p><!--'+'x\r'.repeat(200000)+'-->',text:()=>'Comment survivor'},
  {id:'cr-cdata',body:()=>'<p><![CDATA['+'x\r'.repeat(200000)+']]></p>',text:()=>'x\n'.repeat(200000)},
  {id:'cr-pi',body:()=>'<?probe '+'x\r'.repeat(200000)+'?><p>PI survivor</p>',text:()=>'PI survivor'},
] as const;
