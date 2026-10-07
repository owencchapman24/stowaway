import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import type { Chapter, Locator, Preferences } from '../domain/types';
import { assetPath, createLocalContentFiles } from './local-files';
import { relativeFile, type LocalFiles } from './file-primitives';
import type { ChapterImage } from '../images/types';
import { protectRender } from './render-cleanup';

export function nativeFiles(root = Paths.document.uri): LocalFiles {
  const file = (path: string) => new File(root, relativeFile(path));
  const directory = (path: string) => new Directory(root, relativeFile(path));
  return {
    root,
    exists: (path) => file(path).exists || directory(path).exists,
    isDirectory: (path) => directory(path).exists,
    size: (path) => file(path).size,
    mkdir: (path) => directory(path).create({ intermediates: true, idempotent: true }),
    read: (path) => file(path).bytes(),
    write: (path, bytes) => { const target = file(path); target.create({ overwrite: true }); target.write(bytes); },
    writeNew: (path, bytes) => { const target = file(path); target.create({ overwrite: false }); target.write(bytes); },
    list: (path) => directory(path).exists ? directory(path).list().map((entry) => entry.name) : [],
    remove: (path) => { if (file(path).exists) file(path).delete(); else if (directory(path).exists) directory(path).delete(); },
  };
}
export async function imageDigest(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes))))
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function bundledImage() {
  const asset = Asset.fromModule(require('../../assets/harbor.png'));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Bundled image is unavailable.');
  return new File(asset.localUri).bytes();
}
export function resolveAsset(relativePath: string): File { return new File(Paths.document, assetPath(relativePath)); }
const contentFiles = createLocalContentFiles(nativeFiles(), imageDigest, bundledImage, Crypto.randomUUID);
export const stageBundledImage = contentFiles.stage;

export async function createRenderFile(chapter: Chapter, locator: Locator | null, preferences: Preferences,
  session: string, reference: string | null, files = nativeFiles(), images: ChapterImage[] = []) {
  // Hold protection across generation, promise delivery and the live renderer lifetime.
  const release = protectRender(files, `reader/${session}`);
  try {
    const path = await createLocalContentFiles(files, imageDigest, bundledImage, Crypto.randomUUID)
      .render(chapter, locator, preferences, session, reference, images);
    const directory = new Directory(files.root, path);
    return { uri: new File(directory, 'index.html').uri, readAccess: directory.uri,
      directory: { get exists() { return directory.exists; }, delete() { try { directory.delete(); } finally { release(); } } } };
  } catch (error) { release(); throw error; }
}
