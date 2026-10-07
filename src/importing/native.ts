import * as Crypto from 'expo-crypto';
import { sourceClient } from '../sources/spacebattles/native';
import { importStory, updateStory } from './import-story';
import type { Repository } from '../storage/repository';
import { getSourceImageFiles } from '../images/native';

export function importNativeStory(value: string, repository: Repository, options?: Parameters<typeof importStory>[4]) {
  return importStory(value, repository, sourceClient,
    (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text), { ...options, imageFiles: getSourceImageFiles() });
}

export function updateNativeStory(story: Parameters<typeof updateStory>[0], repository: Repository, options?: Parameters<typeof updateStory>[4]) {
  return updateStory(story, repository, sourceClient,
    (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text), { ...options, imageFiles: getSourceImageFiles() });
}
