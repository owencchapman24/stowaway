import { UUID, type LocalFiles } from '../storage/file-primitives';
import { SOURCE_IMAGE_LIMITS, validateSourceImage } from './validate';
import type { ImageFile } from './types';

const pattern = /^source-assets\/([a-f0-9-]{36})\.(png|jpeg|webp)$/;
export function sourceAssetPath(value: string): string {
  const match = pattern.exec(value);
  if (!match || !UUID.test(match[1]!)) throw new Error('Invalid source asset path.');
  return value;
}
export function validateImageReference(file: ImageFile) {
  sourceAssetPath(file.relativePath);
  if (!file.relativePath.endsWith(`.${file.format}`) || !/^[a-f0-9]{64}$/.test(file.digest) ||
    ![file.byteLength, file.width, file.height].every((value) => Number.isSafeInteger(value) && value > 0) ||
    file.byteLength > SOURCE_IMAGE_LIMITS.maxBytes || file.width > SOURCE_IMAGE_LIMITS.maxDimension ||
    file.height > SOURCE_IMAGE_LIMITS.maxDimension || file.width * file.height > SOURCE_IMAGE_LIMITS.maxPixels) throw new Error('Invalid source image reference.');
}
interface RootState { active: Set<string>; cleanup: Promise<void> | null }
const roots = new Map<string, RootState>();
function state(files: LocalFiles) {
  const key = files.root.replace(/\\/g, '/').replace(/\/$/, '');
  let value = roots.get(key);
  if (!value) { value = { active: new Set(), cleanup: null }; roots.set(key, value); }
  return value;
}
export function createSourceImageFiles(files: LocalFiles, digest: (bytes: Uint8Array) => Promise<string>, uuid: () => string) {
  const ownership = state(files);
  async function read(file: ImageFile): Promise<Uint8Array> {
    validateImageReference(file);
    if (files.isDirectory(file.relativePath)) throw new Error('Source reference is not a file.');
    if (files.size(file.relativePath) > SOURCE_IMAGE_LIMITS.maxBytes) throw new Error('Local source image exceeds byte budget.');
    const bytes = await files.read(file.relativePath);
    const info = validateSourceImage(bytes);
    if (info.format !== file.format || info.byteLength !== file.byteLength || info.width !== file.width || info.height !== file.height ||
      await digest(bytes) !== file.digest) throw new Error('Local source image integrity check failed.');
    return bytes;
  }
  return {
    read,
    async stage(bytes: Uint8Array, contentType?: string | null) {
      const info = validateSourceImage(bytes, contentType);
      const hash = await digest(bytes);
      // A new stage cannot race a reference snapshot used by cleanup.
      while (ownership.cleanup) await ownership.cleanup;
      const relativePath = sourceAssetPath(`source-assets/${uuid()}.${info.format}`);
      if (files.exists(relativePath)) throw new Error('Refusing to overwrite an existing source image.');
      ownership.active.add(relativePath);
      const release = () => { ownership.active.delete(relativePath); };
      try {
        files.mkdir('source-assets');
        files.writeNew(relativePath, bytes);
        const file = { ...info, relativePath, digest: hash };
        try { await read(file); } // Re-read completed destination before any reference transaction.
        catch { throw new Error('Completed source image failed local integrity check.'); }
        return { file, release };
      } catch (error) { release(); throw error; }
    },
    async cleanup(references: () => Promise<string[]>, candidates?: string[]) {
      while (ownership.cleanup) await ownership.cleanup;
      let finish!: () => void;
      ownership.cleanup = new Promise<void>((resolve) => { finish = resolve; });
      // Capture active files before the SQL snapshot, protecting operations that
      // finish their reference commit during this cleanup as well.
      const protectedFiles = new Set(ownership.active);
      try {
        const referenced = new Set(await references());
        let removed = 0;
        const paths = candidates ?? files.list('source-assets').map((name) => `source-assets/${name}`);
        for (const path of new Set(paths)) {
          try { sourceAssetPath(path); } catch { continue; }
          if (referenced.has(path) || protectedFiles.has(path) || ownership.active.has(path) || !files.exists(path) || files.isDirectory(path)) continue;
          files.remove(path); removed++;
        }
        return removed;
      } finally { ownership.cleanup = null; finish(); }
    },
  };
}
export type SourceImageFiles = ReturnType<typeof createSourceImageFiles>;
