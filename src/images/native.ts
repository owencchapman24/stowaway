import * as Crypto from 'expo-crypto';
import { sourceClient } from '../sources/spacebattles/native';
import { imageDigest, nativeFiles } from '../storage/files';
import type { Repository } from '../storage/repository';
import { createSourceImageFiles } from './files';
import { downloadImages, type ImageOptions } from './download';

let sourceImageFiles: ReturnType<typeof createSourceImageFiles> | null = null;
export function getSourceImageFiles() {
  return sourceImageFiles ??= createSourceImageFiles(nativeFiles(), imageDigest, Crypto.randomUUID);
}
export function downloadNativeImages(id: string, repository: Repository, options?: ImageOptions) {
  return downloadImages(id, repository, sourceClient,
    (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text), getSourceImageFiles(), options);
}
