import { assetPath } from '../../storage/local-files';
import { UUID, type LocalFiles } from '../../storage/file-primitives';

export const S2A_DATABASE = 'stowaway-s2a.db';
export const S2A_DIRECTORY = 'stowaway-s2a';
const trim = (path: string) => path.replace(/\/+$/, '');
export function assertS2AResources(documentRoot: string, files: LocalFiles, databaseName: string, databaseDirectory: string) {
  const expected = `${trim(documentRoot)}/${S2A_DIRECTORY}`;
  if (trim(files.root) !== expected || databaseName !== S2A_DATABASE || trim(databaseDirectory) !== `${expected}/database`) {
    throw new Error('Refusing operation outside exact S2A resources.');
  }
}
export function removeS2ARenders(files: LocalFiles, assertOwned: () => void) {
  assertOwned();
  let count = 0;
  for (const name of files.list('reader')) {
    if (!UUID.test(name)) continue;
    const path = `reader/${name}`;
    if (!files.isDirectory(path)) continue;
    const children = files.list(path);
    // Refuse recursive removal if anything besides our two leaf render files is present.
    if (children.some((child) => !['index.html', 'asset-harbor.png'].includes(child) || files.isDirectory(`${path}/${child}`))) continue;
    files.remove(path);
    count++;
  }
  return count;
}
export function removeS2AOrphans(files: LocalFiles, reference: string | null, staging: ReadonlySet<string>, assertOwned: () => void) {
  assertOwned();
  if (reference) assetPath(reference);
  let count = 0;
  for (const name of files.list('assets')) {
    if (!name.endsWith('.png') || !UUID.test(name.slice(0, -4))) continue;
    const path = `assets/${name}`;
    if (path === reference || staging.has(path) || files.isDirectory(path)) continue;
    files.remove(path);
    count++;
  }
  return count;
}
