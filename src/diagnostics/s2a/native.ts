import { Directory, File, Paths } from 'expo-file-system';
import { deleteDatabaseAsync, openDatabaseAsync } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { bundledImage, createRenderFile, imageDigest, nativeFiles } from '../../storage/files';
import { assertS2AResources, S2A_DATABASE, S2A_DIRECTORY } from './isolation';
import { createS2ADiagnostic } from './recovery';

const root = new Directory(Paths.document, S2A_DIRECTORY);
const directory = new Directory(root, 'database');
const files = nativeFiles(root.uri);
let diagnostic: ReturnType<typeof createS2ADiagnostic> | null = null;

export function getS2ADiagnostic() {
  if (!__DEV__) throw new Error('S2A diagnostic is development-only.');
  diagnostic ??= createS2ADiagnostic({
    documentRoot: Paths.document.uri, files, databaseName: S2A_DATABASE, databaseDirectory: directory.uri,
    databaseExists: () => new File(directory, S2A_DATABASE).exists,
    open: async () => {
      const db = await openDatabaseAsync(S2A_DATABASE, { useNewConnection: true }, directory.uri);
      return { db, close: () => db.closeAsync() };
    },
    deleteDatabase: async () => {
      assertS2AResources(Paths.document.uri, files, S2A_DATABASE, directory.uri);
      if (new File(directory, S2A_DATABASE).exists) await deleteDatabaseAsync(S2A_DATABASE, directory.uri);
    },
    digest: (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
    imageDigest, bundled: bundledImage, uuid: Crypto.randomUUID,
  });
  return diagnostic;
}
export const renderS2A: typeof createRenderFile = (chapter, locator, preferences, session, asset) => {
  if (!__DEV__) throw new Error('S2A diagnostic is development-only.');
  assertS2AResources(Paths.document.uri, files, S2A_DATABASE, directory.uri);
  return createRenderFile(chapter, locator, preferences, session, asset, files);
};
