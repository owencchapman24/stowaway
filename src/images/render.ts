import { escapeHtml } from '../content/sanitize';
import type { Chapter } from '../domain/types';
import type { LocalFiles } from '../storage/file-primitives';
import type { SourceImageFiles } from './files';
import { placeholderBlocks } from './slots';
import type { ChapterImage } from './types';

/** Only local names minted here can become active image src values. */
export async function renderSourceImages(chapter: Chapter, images: ChapterImage[], files: LocalFiles,
  directory: string, source: SourceImageFiles): Promise<string> {
  let html = chapter.html;
  const blocks = placeholderBlocks(chapter.html);
  const used = new Set<string>();
  for (const image of images) {
    const placeholder = blocks.get(image.blockId);
    if (image.chapterId !== chapter.id || !placeholder || used.has(image.blockId) ||
      !Number.isSafeInteger(image.slot) || image.slot < 0 || image.slot >= 3000) continue;
    used.add(image.blockId);
    let replacement = escapeHtml(`[Image unavailable: ${image.state === 'omitted' ? image.reason ?? 'unsupported' : 'not downloaded'}]`);
    if (image.state === 'downloaded' && image.file) {
      try {
        const bytes = await source.read(image.file);
        const name = `source-image-${image.slot}.${image.file.format}`;
        files.writeNew(`${directory}/${name}`, bytes);
        replacement = `<img src="${name}" width="${image.file.width}" height="${image.file.height}" alt="${escapeHtml(image.alt || 'Source image')}" />`;
      } catch { replacement = '[Local image unavailable: missing or invalid file. Use Retry Images in Contents.]'; }
    }
    html = html.replace(placeholder, () => `<div id="${image.blockId}" data-block="true">${replacement}</div>`);
  }
  return html;
}
