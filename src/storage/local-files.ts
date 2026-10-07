import { HARBOR_SHA256, validatePng } from '../content/image';
import type { Chapter, Locator, Preferences } from '../domain/types';
import { readerDocument } from '../reader/template';
import { createSourceImageFiles } from '../images/files';
import { renderSourceImages } from '../images/render';
import type { ChapterImage } from '../images/types';
import { UUID, type LocalFiles } from './file-primitives';
import { protectRender } from './render-cleanup';

export function assetPath(path: string): string {
  if (!path.startsWith('assets/') || !UUID.test(path.slice(7, -4)) || !path.endsWith('.png')) throw new Error('Invalid asset path.');
  return path;
}
export async function checkedImageBytes(bytes: Uint8Array, digest: (bytes: Uint8Array) => Promise<string>) {
  validatePng(bytes);
  if (await digest(bytes) !== HARBOR_SHA256) throw new Error('Bundled image integrity check failed.');
  return bytes;
}
export function createLocalContentFiles(files: LocalFiles, digest: (bytes: Uint8Array) => Promise<string>,
  bundled: () => Promise<Uint8Array>, uuid: () => string) {
  async function image(path: string) { return checkedImageBytes(await files.read(assetPath(path)), digest); }
  return {
    image,
    async stage(existing: string | null, onStaging?: (path: string) => void) {
      if (existing && files.exists(assetPath(existing))) {
        try { return { relativePath: existing, byteLength: (await image(existing)).length }; }
        catch { /* Retain the old file; replacement always has a new name. */ }
      }
      const bytes = await checkedImageBytes(await bundled(), digest);
      const id = uuid();
      if (!UUID.test(id)) throw new Error('Invalid image identity.');
      const path = assetPath(`assets/${id}.png`);
      if (files.exists(path)) throw new Error('Refusing to overwrite an existing image.');
      files.mkdir('assets');
      onStaging?.(path);
      files.write(path, bytes);
      return { relativePath: path, byteLength: (await image(path)).length };
    },
    async render(chapter: Chapter, locator: Locator | null, preferences: Preferences, session: string, reference: string | null,
      sourceImages: ChapterImage[] = []) {
      if (!UUID.test(session)) throw new Error('Invalid rendering directory.');
      const directory = `reader/${session}`;
      if (files.exists(directory)) throw new Error('Rendering session already exists.');
      const release = protectRender(files, directory);
      try {
        files.mkdir(directory);
        if (reference) {
          try { files.write(`${directory}/asset-harbor.png`, await image(reference)); }
          catch { /* Canonical text remains readable; bridge supplies the image placeholder. */ }
        }
        const html = await renderSourceImages(chapter, sourceImages, files, directory, createSourceImageFiles(files, digest, uuid));
        files.write(`${directory}/index.html`, readerDocument({ ...chapter, html }, locator, preferences, session));
        if (chapter.storyId.startsWith('spacebattles:thread:')) {
          files.write(`${directory}/owner.json`, JSON.stringify({ version: 1, storyId: chapter.storyId, chapterId: chapter.id }));
        }
        return directory;
      } finally { release(); }
    },
  };
}
