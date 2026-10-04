import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import type { Chapter, Locator, Preferences } from '../domain/types';
import { HARBOR_SHA256, validatePng } from '../content/image';
import { readerDocument } from '../reader/template';

export function resolveAsset(relativePath: string): File {
  if (!/^assets\/[a-f0-9-]{36}\.png$/.test(relativePath)) throw new Error('Invalid asset path.');
  return new File(Paths.document, relativePath);
}

async function checkedImage(file: File) {
  const bytes = await file.bytes();
  validatePng(bytes);
  const hash = Array.from(new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes)))
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== HARBOR_SHA256) throw new Error('Bundled image integrity check failed.');
  return bytes.length;
}

/** Finish and validate a new file before committing its relative database reference. */
export async function stageBundledImage(existing: string | null) {
  if (existing) {
    const file = resolveAsset(existing);
    if (file.exists) {
      try { return { relativePath: existing, byteLength: await checkedImage(file) }; }
      catch { /* Recover into a fresh file; never overwrite an old reference. */ }
    }
  }
  const asset = Asset.fromModule(require('../../assets/harbor.png'));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Bundled image is unavailable.');
  const source = new File(asset.localUri);
  await checkedImage(source);
  new Directory(Paths.document, 'assets').create({ idempotent: true, intermediates: true });
  const relativePath = `assets/${Crypto.randomUUID()}.png`;
  const target = resolveAsset(relativePath);
  await source.copy(target);
  return { relativePath, byteLength: await checkedImage(target) };
}

export async function createRenderFile(chapter: Chapter, locator: Locator | null, preferences: Preferences,
  session: string, assetPath: string | null) {
  if (!/^[a-f0-9-]{36}$/.test(session)) throw new Error('Invalid rendering directory.');
  const directory = new Directory(Paths.document, 'reader', session);
  directory.create({ intermediates: true, idempotent: true });
  if (assetPath) {
    try {
      const image = resolveAsset(assetPath);
      await checkedImage(image);
      await image.copy(new File(directory, 'asset-harbor.png'));
    } catch { /* Text survives missing images; the trusted bridge shows a placeholder. */ }
  }
  const file = new File(directory, 'index.html');
  file.create({ overwrite: true });
  file.write(readerDocument(chapter, locator, preferences, session));
  return { uri: file.uri, readAccess: directory.uri, directory };
}
