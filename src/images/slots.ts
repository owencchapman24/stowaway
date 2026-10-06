import { parseDocument } from 'htmlparser2';
import type { ChildNode } from 'domhandler';
import type { Chapter } from '../domain/types';
import type { ImageSlot } from './types';

const PLACEHOLDER = '[Image omitted: external or unsupported asset]';
export function placeholderBlocks(html: string): Map<string, string> {
  const result = new Map<string, string>();
  function visit(nodes: ChildNode[]) {
    for (const node of nodes) {
      if (node.type !== 'tag') continue;
      if (node.name === 'p' && /^block-[0-9]{4,}$/.test(node.attribs.id ?? '') &&
        node.attribs['data-block'] === 'true' && node.children.length === 1 &&
        node.children[0]?.type === 'text' && node.children[0].data === PLACEHOLDER) {
        result.set(node.attribs.id!, `<p id="${node.attribs.id}" data-block="true">${PLACEHOLDER}</p>`);
      }
      visit(node.children);
    }
  }
  visit(parseDocument(html).children);
  return result;
}

export function validateSlots(content: Pick<Chapter, 'html' | 'blockIds'>, slots: ImageSlot[]) {
  const blocks = placeholderBlocks(content.html);
  if (slots.length > 3000 || new Set(slots.map((slot) => slot.blockId)).size !== slots.length) throw new Error('Invalid image slots.');
  for (const [ordinal, slot] of slots.entries()) {
    if (slot.slot !== ordinal || !content.blockIds.includes(slot.blockId) || !blocks.has(slot.blockId) ||
      slot.alt.length > 200 || (slot.sourceUrl?.length ?? 0) > 2048 ||
      !['pending', 'omitted'].includes(slot.state) || (slot.state === 'pending' && (!slot.sourceUrl || slot.reason))) throw new Error('Invalid image slot mapping.');
  }
}
