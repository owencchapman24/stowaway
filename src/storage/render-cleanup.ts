import { chapterId } from '../domain/identity';
import { UUID, type LocalFiles } from './file-primitives';

const active = new Map<string, Map<string, number>>();
function owners(files: LocalFiles) {
  const root = files.root.replace(/\\/g, '/').replace(/\/$/, '');
  let paths = active.get(root);
  if (!paths) { paths = new Map(); active.set(root, paths); }
  return paths;
}
export function protectRender(files: LocalFiles, directory: string): () => void {
  const paths = owners(files);
  paths.set(directory, (paths.get(directory) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = paths.get(directory)! - 1;
    if (remaining) paths.set(directory, remaining); else paths.delete(directory);
  };
}

/** Only new, explicitly tagged app render output is identifiable. Legacy/foreign output stays. */
export async function cleanupStoryRenders(files: LocalFiles, story: string) {
  const paths = owners(files);
  for (const session of files.list('reader')) {
    if (!UUID.test(session)) continue;
    const directory = `reader/${session}`, marker = `${directory}/owner.json`;
    if (paths.has(directory) || !files.isDirectory(directory) || !files.exists(marker) || files.isDirectory(marker)) continue;
    if (files.size(marker) > 1024) continue;
    const bytes = await files.read(marker); // I/O failure must become a post-commit cleanup warning.
    let owner: { storyId?: string; chapterId?: string; version?: number };
    try { owner = JSON.parse(String.fromCharCode(...bytes)); } catch { continue; }
    if (!owner || Object.keys(owner).sort().join(',') !== 'chapterId,storyId,version' || owner.version !== 1 ||
        owner.storyId !== story || typeof owner.chapterId !== 'string') continue;
    const post = owner.chapterId.slice(`${story}:post:`.length);
    if (!/^[1-9][0-9]*$/.test(post) || owner.chapterId !== chapterId(story, post)) continue;
    const children = files.list(directory);
    if (paths.has(directory) || children.some((name) =>
      !/^(index\.html|owner\.json|asset-harbor\.png|source-image-[0-9]+\.(png|jpeg|webp))$/.test(name) ||
      files.isDirectory(`${directory}/${name}`))) continue;
    files.remove(directory);
  }
}
