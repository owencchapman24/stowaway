// Independent synthetic goldens. Never derive expected HTML by calling the sanitizer.
import type { canonicalChapter } from './canonical';
import type { ChapterSummary, PackageResult } from './package';
export type CanonicalChapter = Awaited<ReturnType<typeof canonicalChapter>>;
export interface OutputExpectation {
  chapterCount: number;
  chapter: (content: CanonicalChapter, summary: ChapterSummary) => boolean;
  package: (result: PackageResult) => boolean;
}
const block = (tag: string, n: number, text: string) => `<${tag} id="block-${String(n).padStart(4,'0')}" data-block="true">${text}</${tag}>`;
const front = block('h1',1,'Front matter') + block('p',2,'A synthetic preface.');
const end = block('h2',1,'End matter') + block('p',2,'Auxiliary notes remain in order.');
const omitted = '[Image omitted: external or unsupported asset]';
const main = block('h1',1,'Harbor notes') + block('p',2,'Unicode: café 航海. <em>Emphasis</em> and <strong>strength</strong>.') +
  '<ul>' + block('li',3,'One list item') + '</ul>' + block('blockquote',4,'A short quotation.') + '<hr id="block-0005" data-block="true" />' +
  block('p',6,'<a href="https://example.org/reading" data-link="link-1" rel="noreferrer noopener">Safe link</a> Inert internal link') + block('p',7,omitted) + block('p',8,omitted);
/** Linear scans only: do not search the entire HTML once per block. */
export function canonicalShape(c: CanonicalChapter): boolean {
  const ids = Array.from(c.html.matchAll(/\sid="(block-\d+)" data-block="true"/g), (m)=>m[1]);
  return c.html.trim().length > 0 && c.sanitizerVersion === 's0-allowlist-1' && /^[a-f0-9]{64}$/.test(c.contentHash) &&
    ids.length === c.blockIds.length && ids.every((id,i)=>id===c.blockIds[i] && id===`block-${String(i+1).padStart(4,'0')}`) &&
    !/<(?:script|iframe|object|embed|form|style|img)\b|\son\w+\s*=|\ssrc\s*=|\shref\s*=\s*["'](?:javascript:|file:|fixture:)|\sdata-(?:stowaway[\w-]*|epub-slot)\s*=/i.test(c.html);
}
function basePackage(r: PackageResult): boolean {
  return r.metadata.title === 'Synthetic Café 航海' && r.metadata.creators[0] === 'Stowaway Test Author' && r.metadata.identifier === 'synthetic-001' &&
    r.chapters.length === 3 && r.chapters.every((s,i)=>s.ordinal===i && s.role===(i===2?'auxiliary':'primary')) &&
    r.chapters[0]?.title==='Front matter' && r.chapters[1]?.title==='Main label' && r.chapters[2]?.title==='End matter';
}
export function expectedBook(mainHtml: () => string = () => main, sharedImages = false): OutputExpectation {
  return { chapterCount:3, package: (r)=>basePackage(r) && r.acceptedImages===(sharedImages?1:0), chapter(c,s) {
    if (!canonicalShape(c) || s.ordinal<0 || s.ordinal>2 || s.role!==(s.ordinal===2?'auxiliary':'primary')) return false;
    if (c.html !== (s.ordinal===0?front:s.ordinal===2?end:mainHtml())) return false;
    const images = sharedImages && s.ordinal===1;
    if (JSON.stringify(c.links)!==JSON.stringify(images?{'link-1':'https://example.org/reading'}:{})) return false;
    return images ? c.images.length===2 && c.images.every((r,i)=>r.reference==='../Images/pixel.png' && r.blockId===`block-000${7+i}`) &&
      s.images.length===2 && s.images.every((i)=>i.state==='accepted' && i.format==='png' && i.width===1 && i.height===1) : c.images.length===0 && s.images.length===0;
  } };
}
export const STANDARD_BOOK = expectedBook(undefined,true);
export const paragraphExpected = (text: string) => block('p',1,text);
export const denseExpected = () => Array.from({length:9000},(_,i)=>block('p',i+1,'original prose')).join('');
export const scopesExpected = () => Array.from({length:40},(_,i)=>`<div id="block-${String(i+1).padStart(4,'0')}" data-block="true">`).join('') +
  Array.from({length:3000},(_,i)=>block('p',i+41,'Scoped prose')).join('') + '</div>'.repeat(40);

const hostileHtml = block('p',1,'Safe synthetic <em>formatting</em>.') + 'Inert bad link' + block('p',2,omitted) + block('p',3,omitted) + block('p',4,omitted);
const hostileBase = expectedBook(()=>hostileHtml);
export const HOSTILE_BOOK: OutputExpectation = { ...hostileBase, chapter(c,s) {
  if (s.ordinal!==1) return hostileBase.chapter(c,s);
  const refs=['fixture://harbor.png','file:///private','https://example.org/remote.png'];
  return canonicalShape(c) && c.html===hostileHtml && Object.keys(c.links).length===0 && c.images.length===3 &&
    c.images.every((r,i)=>r.reference===refs[i] && r.blockId===`block-000${i+2}`) && s.images.length===3 && s.images.every((i)=>i.state==='omitted');
} };

export function observeOutput(expectation: OutputExpectation) {
  let count=0, valid=true;
  return { chapter(c: CanonicalChapter,s: ChapterSummary) { valid = s.ordinal===count && expectation.chapter(c,s) && valid; count++; },
    finish(result: PackageResult) { return valid && count===expectation.chapterCount && count===result.chapters.length && expectation.package(result); } };
}
