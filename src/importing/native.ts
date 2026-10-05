import * as Crypto from 'expo-crypto';
import { sourceClient } from '../sources/spacebattles/native';
import { importStory } from './import-story';
import type { Repository } from '../storage/repository';

export function importNativeStory(value: string, repository: Repository, options?: Parameters<typeof importStory>[4]) {
  return importStory(value, repository, sourceClient,
    (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text), options);
}
