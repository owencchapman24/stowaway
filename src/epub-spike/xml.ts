import { parseXml, XmlElement, type XmlNode, type XmlDocument } from '@rgrove/parse-xml';
import { decodeXmlUtf8 } from './bytes';
import { LIMITS, EpubFailure, requireEpub, checkpoint, measureSync, measureStage, type Context } from './limits';

export const NS = { xhtml: 'http://www.w3.org/1999/xhtml', opf: 'http://www.idpf.org/2007/opf',
  dc: 'http://purl.org/dc/elements/1.1/', container: 'urn:oasis:names:tc:opendocument:xmlns:container',
  ncx: 'http://www.daisy.org/z3986/2005/ncx/', xml: 'http://www.w3.org/XML/1998/namespace', xmlns: 'http://www.w3.org/2000/xmlns/' };
/** Persistent scopes avoid copying thousands of inherited bindings for each sibling. */
class NamespaceScope {
  private values = new Map<string, string>();
  constructor(private parent?: NamespaceScope) {}
  set(key: string, value: string) { this.values.set(key, value); }
  get(key: string): string | undefined { return this.values.has(key) ? this.values.get(key) : this.parent?.get(key); }
  has(key: string): boolean { return this.values.has(key) || !!this.parent?.has(key); }
}
export interface Names { uri: string; local: string; bindings: NamespaceScope; }
const names = new WeakMap<XmlElement, Names>();
export const nameOf = (e: XmlElement) => names.get(e)!;
export const elements = (e: XmlElement) => e.children.filter((n): n is XmlElement => n instanceof XmlElement);
export const children = (e: XmlElement, uri: string, local: string) => elements(e).filter((n) => nameOf(n).uri === uri && nameOf(n).local === local);
export function descendants(e: XmlElement): XmlElement[] {
  const result: XmlElement[] = []; function visit(n: XmlElement) { result.push(n); for (const c of elements(n)) visit(c); } visit(e); return result;
}
export function namespacedAttribute(e: XmlElement, uri: string, local: string): string | undefined {
  for (const [key, value] of Object.entries(e.attributes)) {
    const parts = key.split(':'); if (parts.length === 2 && parts[1] === local && nameOf(e).bindings.get(parts[0]!) === uri) return value;
  }
}
function qname(value: string): [string, string] {
  const parts = value.split(':');
  requireEpub(parts.length <= 2 && parts.every((p) => /^[\p{L}_][\p{L}\p{N}\p{M}_.\-\u00b7]*$/u.test(p)), 'namespace');
  return parts.length === 2 ? [parts[0]!, parts[1]!] : ['', value];
}

/** Conservative lexical allocation guard, followed by the full well-formedness parser.
 * It rejects declarations before parsing and caps nesting/start tokens/attribute literals.
 * It does not promise a total tree/heap bound or validate XML by itself. */
async function preflight(source: string, ctx: Context) {
  let at = 0, depth = 0, tokens = 0;
  while (at < source.length) {
    await checkpoint(ctx, 'xml');
    const next = source.indexOf('<', at); if (next < 0) break;
    at = next;
    let terminator: string | null = null;
    if (source.startsWith('<!--', at)) terminator = '-->';
    else if (source.startsWith('<![CDATA[', at)) terminator = ']]>';
    else if (source.startsWith('<?', at)) terminator = '?>';
    else requireEpub(!source.startsWith('<!', at), 'xml'); // No DTD/entity declarations.
    if (terminator) {
      requireEpub(++tokens <= LIMITS.nodes, 'budget');
      const end = source.indexOf(terminator, at + 2); requireEpub(end >= 0, 'xml'); at = end + terminator.length; continue;
    }
    const closing = source[at + 1] === '/'; let quote = '', valueStart = 0, attributes = 0;
    if (!closing) requireEpub(++tokens <= LIMITS.nodes, 'budget');
    let end = at + 1;
    for (; end < source.length; end++) {
      if ((end - at) % 4096 === 0) await checkpoint(ctx, 'xml');
      const c = source[end]!;
      if (quote) {
        requireEpub(end - valueStart <= LIMITS.attribute, 'budget');
        if (c === quote) quote = '';
      } else if (c === '"' || c === "'") { quote = c; valueStart = end + 1; requireEpub(++attributes <= LIMITS.attributes, 'budget'); }
      else if (c === '>') break;
    }
    requireEpub(end < source.length && !quote, 'xml');
    if (closing) depth--;
    else { requireEpub(depth + 1 <= LIMITS.depth, 'budget'); if (source[end - 1] !== '/') depth++; }
    requireEpub(depth >= 0, 'xml'); at = end + 1;
  }
  requireEpub(depth === 0, 'xml');
}

/** XML 1.0 section 2.11: normalize literal CR/CRLF before parsing references.
 * Fixed 4K code-unit chunks avoid the dependency's repeated whole-string copies.
 * Chunks and joined output are each <= input.length; the input also remains live.
 * References such as &#13; are untouched. This is not a total parser heap bound.
 */
async function normalizeLiteralLineEndings(source: string, ctx: Context): Promise<string> {
  if (!source.includes('\r')) return source;
  const buffer = new Uint16Array(4096), chunks: string[] = []; let used = 0;
  for (let at = 0; at < source.length; at++) {
    let unit = source.charCodeAt(at);
    if (unit === 13) { if (source.charCodeAt(at + 1) === 10) at++; unit = 10; }
    buffer[used++] = unit;
    if (used === buffer.length) {
      chunks.push(String.fromCharCode(...buffer)); used = 0;
      await checkpoint(ctx, 'xml');
    }
  }
  if (used) chunks.push(String.fromCharCode(...buffer.subarray(0, used)));
  return chunks.join('');
}

export async function strictXml(bytes: Uint8Array, ctx: Context): Promise<XmlElement> {
  const start = performance.now();
  try {
  let source = await decodeXmlUtf8(bytes, LIMITS.string, ctx); if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  // Exactly one optional leading UTF-8 BOM. The dependency must not strip another.
  requireEpub(source.charCodeAt(0) !== 0xfeff, 'xml');
  requireEpub(source.length <= LIMITS.string, 'budget');
  source = await measureStage(ctx, 'xmlNormalize', () => normalizeLiteralLineEndings(source, ctx));
  // Encoding declaration is inspected before allocation by the document parser.
  const declaration = /^<\?xml\s[^?]*\?>/.exec(source)?.[0];
  if (declaration) {
    const encoding = /\bencoding\s*=\s*(['"])(.*?)\1/.exec(declaration)?.[2];
    requireEpub(!encoding || /^utf-8$/i.test(encoding), 'xml');
    requireEpub(/\bversion\s*=\s*(['"])1\.0\1/.test(declaration), 'xml');
  }
  await measureStage(ctx, 'xmlPreflight', () => preflight(source, ctx));
  await checkpoint(ctx, 'xml', true);
  let doc: XmlDocument;
  const parseStart = performance.now();
  try { doc = measureSync(ctx, 'xmlParse', () => parseXml(source, { preserveComments: true, preserveXmlDeclaration: true })); }
  catch { throw new EpubFailure('xml'); } // Never export parser errors containing private prose.
  finally { ctx.timings.xmlParse += performance.now() - parseStart; }
  requireEpub(doc.root, 'xml');
  let count = 0;
  async function visit(node: XmlNode, inherited: NamespaceScope, depth: number) {
    if (count % 128 === 0) await checkpoint(ctx, 'xml');
    requireEpub(++count <= LIMITS.nodes && depth <= LIMITS.depth, 'budget');
    if (!(node instanceof XmlElement)) return;
    const entries = Object.entries(node.attributes); requireEpub(entries.length <= LIMITS.attributes, 'budget');
    const bindings = entries.some(([key]) => key === 'xmlns' || key.startsWith('xmlns:')) ? new NamespaceScope(inherited) : inherited;
    for (const [key, value] of entries) {
      requireEpub(value.length <= LIMITS.attribute, 'budget');
      if (key === 'xmlns' || key.startsWith('xmlns:')) {
        const prefix = key === 'xmlns' ? '' : qname(key)[1];
        requireEpub(prefix !== 'xmlns' && value !== NS.xmlns && (prefix === 'xml' ? value === NS.xml : value !== NS.xml), 'namespace');
        requireEpub(!prefix || !!value, 'namespace'); bindings.set(prefix, value);
      }
    }
    const [prefix, local] = qname(node.name);
    requireEpub(prefix !== 'xmlns' && (!prefix || bindings.has(prefix)), 'namespace');
    const uri = bindings.get(prefix) ?? '';
    requireEpub(uri !== 'http://www.w3.org/2001/XInclude', 'unsupported');
    names.set(node, { uri, local, bindings });
    const expanded = new Set<string>();
    for (const [key] of entries) {
      if (key === 'xmlns' || key.startsWith('xmlns:')) continue;
      const [p, l] = qname(key); requireEpub(!p || bindings.has(p), 'namespace');
      const u = p ? bindings.get(p)! : '';
      requireEpub(!(u === NS.xml && l === 'base'), 'unsupported');
      const full = `${u}\0${l}`; requireEpub(!expanded.has(full), 'namespace'); expanded.add(full);
    }
    for (const child of node.children) await visit(child, bindings, depth + (child instanceof XmlElement ? 1 : 0));
  }
  const initial = new NamespaceScope(); initial.set('xml', NS.xml);
  await measureStage(ctx, 'xmlNamespaces', async () => {
    for (const node of doc.children) await visit(node, initial, node instanceof XmlElement ? 1 : 0);
  });
  await checkpoint(ctx, 'xml'); return doc.root;
  } finally { ctx.timings.xml += performance.now() - start; }
}
