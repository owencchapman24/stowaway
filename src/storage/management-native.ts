import type { Repository } from './repository';
import type { ManagementAction, ManagementIdentity } from './management';
import { nativeFiles } from './files';
import { getSourceImageFiles } from '../images/native';
import { cleanupStoryRenders } from './render-cleanup';

export async function cleanupNativeStoryFiles(story: string, repository: Repository, paths?: string[]) {
  // Every cleanup snapshot sees all stories, and shares I2's staged-file protection.
  const results = await Promise.allSettled([
    getSourceImageFiles().cleanup(() => repository.listSourceAssetReferences(), paths),
    cleanupStoryRenders(nativeFiles(), story),
  ]);
  if (results.some((result) => result.status === 'rejected')) throw new Error('Local file cleanup incomplete.');
}
export function manageNativeStory(story: ManagementIdentity, action: ManagementAction, repository: Repository,
  onSettled: () => Promise<void>) {
  const expected = { id: story.id, source: story.source, threadId: story.threadId };
  return repository.manageStory(expected, action, { cleanup: (paths) => cleanupNativeStoryFiles(expected.id, repository, paths), onSettled });
}
