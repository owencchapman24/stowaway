import { XmlElement, type XmlNode } from '@rgrove/parse-xml';
import { sanitize, safeLink, escapeHtml } from '../content/sanitize';
import { hashText } from './hash';
import { children, nameOf, NS } from './xml';
import { LIMITS, requireEpub, checkpoint, measureSync, measureStage, type Context } from './limits';

export interface ImageReference { reference: string; blockId: string; }
const discard = new Set(['script','style','form','input','button','iframe','frame','object','embed','video','audio','canvas','link','meta','base','noscript','template','textarea','select']);
const allowed = new Set(['p','h1','h2','h3','h4','h5','h6','em','strong','b','i','u','s','ul','ol','li','blockquote','hr','br','table','thead','tbody','tr','th','td','pre','code','details','summary','a','img','div','span']);
export async function canonicalChapter(root: XmlElement, ctx: Context) {
  const start = performance.now();
  try {
  requireEpub(nameOf(root).uri === NS.xhtml && nameOf(root).local === 'html', 'package');
  const bodies = children(root, NS.xhtml, 'body'); requireEpub(bodies.length === 1, 'package');
  const references: string[] = []; let unsupported = false, rewritten = 0, visibleText = false;
  function bounded(s: string) { rewritten += s.length; requireEpub(rewritten <= LIMITS.string, 'budget'); return s; }
  let visited = 0;
  async function serialize(node: XmlNode): Promise<string> {
    if (visited++ % 128 === 0) await checkpoint(ctx, 'chapter');
    if (node.type === 'text') {
      const text = (node as { text?: string }).text ?? ''; if (text.trim()) visibleText = true;
      const escaped: string[] = [];
      for (let at = 0; at < text.length; at += 16_384) {
        await checkpoint(ctx, 'chapter');
        escaped.push(bounded(measureSync(ctx, 'canonicalEscape', () => escapeHtml(text.slice(at, at + 16_384)))));
      }
      return measureSync(ctx, 'canonicalJoin', () => escaped.join(''));
    }
    if (!(node instanceof XmlElement)) return '';
    const { uri, local: tag } = nameOf(node);
    if (uri !== NS.xhtml || discard.has(tag)) { unsupported = true; return ''; }
    if (tag === 'img') {
      const slot = references.length; references.push(node.attributes.src ?? '');
      return bounded(`<img src="" data-epub-slot="${slot}"/>`);
    }
    const parts: string[] = []; for (const child of node.children) parts.push(await serialize(child));
    const content = measureSync(ctx, 'canonicalJoin', () => parts.join(''));
    if (!allowed.has(tag)) return content;
    if (tag === 'a') {
      const href = safeLink(node.attributes.href ?? ''); if (!href) return content;
      return bounded(`<a href="${escapeHtml(href)}">`) + content + bounded('</a>');
    }
    return bounded(`<${tag}>`) + content + (tag === 'br' || tag === 'hr' ? '' : bounded(`</${tag}>`));
  }
  const parts: string[] = []; for (const child of bodies[0]!.children) parts.push(await serialize(child));
  let source = measureSync(ctx, 'canonicalJoin', () => parts.join(''));
  if (!visibleText && !references.length) { requireEpub(!unsupported, 'unsupported'); source = '<p>[Empty section]</p>'; }
  requireEpub(source.length <= LIMITS.string, 'budget');
  ctx.timings.canonicalRewrite += performance.now() - start;
  const images: ImageReference[] = [];
  await checkpoint(ctx, 'chapter', true); const sanitizeStart = performance.now();
  const content = measureSync(ctx, 'sanitize', () => sanitize(source, (blockId, attributes) => {
    const n = Number(attributes['data-epub-slot']); requireEpub(Number.isInteger(n) && references[n] !== undefined, 'package');
    images.push({ reference: references[n]!, blockId });
  }));
  ctx.timings.sanitize += performance.now() - sanitizeStart;
  await checkpoint(ctx, 'chapter', true);
  const contentHash = await measureStage(ctx, 'contentHash', () => hashText(`${content.sanitizerVersion}\n${content.html}`, ctx));
  return { ...content, contentHash, images };
  } finally { ctx.timings.canonical += performance.now() - start; }
}
