import { parseDocument } from 'htmlparser2';
import type { ChildNode, Element } from 'domhandler';

export const SANITIZER_VERSION = 's0-allowlist-1';
const allowed = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'em', 'strong', 'b', 'i', 'u', 's',
  'ul', 'ol', 'li', 'blockquote', 'hr', 'br', 'table', 'thead', 'tbody', 'tr',
  'th', 'td', 'pre', 'code', 'details', 'summary', 'a', 'img', 'div', 'span',
]);
const discard = new Set([
  'script', 'style', 'svg', 'math', 'template', 'form', 'input', 'button',
  'iframe', 'frame', 'frameset', 'object', 'embed', 'video', 'audio', 'canvas',
  'link', 'meta', 'base', 'noscript', 'textarea', 'select',
]);
const blocks = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'hr', 'table',
  'tr', 'th', 'td', 'pre', 'details', 'summary', 'img', 'div',
]);

export interface SanitizedContent {
  html: string;
  blockIds: string[];
  links: Record<string, string>;
  sanitizerVersion: string;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function safeLink(value: string): string | null {
  // The parser has already decoded HTML entities. Reject controls before URL parsing.
  if (/[\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/** No source attribute survives except explicitly validated link/image values. */
export function sanitize(source: string, onImage?: (blockId: string, attributes: Readonly<Record<string, string>>) => void): SanitizedContent {
  if (source.length > 1_000_000) throw new Error('Fixture exceeds content budget.');
  const blockIds: string[] = [];
  const links: Record<string, string> = {};
  let linkCount = 0;
  let count = 0;
  function serialize(node: ChildNode, depth: number): string {
    if (++count > 30_000 || depth > 100) throw new Error('Markup exceeds structural budget.');
    if (node.type === 'text') return escapeHtml(node.data);
    if (node.type !== 'tag' && node.type !== 'script' && node.type !== 'style') return '';
    const element = node as Element;
    const tag = element.name.toLowerCase();
    if (discard.has(tag)) return '';
    const children = () => element.children.map((child) => serialize(child, depth + 1)).join('');
    if (!allowed.has(tag)) return children();
    let attributes = '';
    if (blocks.has(tag)) {
      const id = `block-${String(blockIds.length + 1).padStart(4, '0')}`;
      blockIds.push(id);
      attributes += ` id="${id}" data-block="true"`;
    }
    if (tag === 'a') {
      const href = safeLink(element.attribs.href ?? '');
      if (!href) return children();
      const id = `link-${++linkCount}`;
      links[id] = href;
      attributes += ` href="${escapeHtml(href)}" data-link="${id}" rel="noreferrer noopener"`;
    }
    if (tag === 'img') {
      onImage?.(blockIds[blockIds.length - 1]!, element.attribs);
      if (element.attribs.src !== 'fixture://harbor.png') {
        return `<p${attributes}>[Image omitted: external or unsupported asset]</p>`;
      }
      return `<img${attributes} src="asset-harbor.png" width="480" height="240" alt="${escapeHtml(element.attribs.alt ?? 'Synthetic harbor illustration')}" />`;
    }
    if (tag === 'hr' || tag === 'br') return `<${tag}${attributes} />`;
    const firstChild = element.children.find((child) => child.type !== 'text' || child.data.trim());
    const prefix = tag === 'details' && !(firstChild?.type === 'tag' &&
      (firstChild as Element).name === 'summary') ? '<summary>Spoiler</summary>' : '';
    return `<${tag}${attributes}>${prefix}${children()}</${tag}>`;
  }
  const html = parseDocument(source, { decodeEntities: true }).children
    .map((child) => serialize(child, 0)).join('');
  return { html, blockIds, links, sanitizerVersion: SANITIZER_VERSION };
}

export async function prepareContent(source: string, digest: (value: string) => Promise<string>) {
  const content = sanitize(source);
  return { ...content, contentHash: await digest(`${content.sanitizerVersion}\n${content.html}`) };
}
