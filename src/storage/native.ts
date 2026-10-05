import { openDatabaseAsync } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { migrate } from './migrations';
import { compileFixture, createRepository } from './repository';
import { stageBundledImage } from './files';

let initialization: ReturnType<typeof initialize> | null = null;

async function initialize() {
  const db = await openDatabaseAsync('stowaway-s0.db');
  try {
    await migrate(db);
    const repository = createRepository(db);
    const fixture = await compileFixture((value) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value));
    let asset = { relativePath: '', byteLength: 0 };
    let imageWarning: string | null = null;
    try { asset = await stageBundledImage(await repository.getAssetPath()); }
    catch { imageWarning = 'Local image unavailable; chapter text is still readable.'; }
    await repository.seed(fixture, asset);
    return { repository, imageWarning };
  } catch (error) {
    await db.closeAsync();
    throw error;
  }
}

export function openStorage() {
  initialization ??= initialize().catch((error) => { initialization = null; throw error; });
  return initialization;
}
