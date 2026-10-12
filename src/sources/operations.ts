import { storyOrigin, type SourceDenial } from '../domain/source-capabilities';
import type { StoryMetadata } from '../domain/types';
import type { importNativeStory, updateNativeStory } from '../importing/native';
import type { downloadNativeImages } from '../images/native';
import type { cleanupNativeStoryFiles, manageNativeStory } from '../storage/management-native';
import { sourceEligibility, SPACEBATTLES_ORIGIN } from './registry';

export class SourceOperationFailure extends Error {
  readonly code: 'policy-disabled' | 'unsupported-source' | 'unsupported-operation';
  constructor(readonly denial: SourceDenial) {
    super(denial.message); this.name = 'SourceOperationFailure';
    this.code = denial.status === 'policy-disabled' ? denial.status : denial.reason === 'source' ? 'unsupported-source' : 'unsupported-operation';
  }
}
export interface SourceServices {
  importStory: typeof importNativeStory;
  updateStory: typeof updateNativeStory;
  downloadImages: typeof downloadNativeImages;
  manageStory: typeof manageNativeStory;
  cleanupStoryFiles: typeof cleanupNativeStoryFiles;
}
type WithDenial<T extends { failure: unknown }> = Omit<T, 'failure'> & { failure: T['failure'] | SourceOperationFailure };
export type SourceImportResult = WithDenial<Awaited<ReturnType<SourceServices['importStory']>>>;
export type SourceUpdateResult = WithDenial<Awaited<ReturnType<SourceServices['updateStory']>>>;
export type SourceImageResult = WithDenial<Awaited<ReturnType<SourceServices['downloadImages']>>>;

/** No native imports, IO or ownership here. Legacy services own allowed-path settlement. */
export function createSourceOperations(audience: unknown, services: SourceServices) {
  function denial(origin: unknown, operation: Parameters<typeof sourceEligibility>[1]) {
    const eligibility = sourceEligibility(origin, operation, audience);
    return eligibility.status === 'allowed' ? null : new SourceOperationFailure(eligibility);
  }
  async function importStory(...args: Parameters<SourceServices['importStory']>): Promise<SourceImportResult> {
    const failure = denial(SPACEBATTLES_ORIGIN, 'import');
    if (!failure) return services.importStory(...args);
    await args[2]?.onSettled?.();
    return { story: null, failure };
  }
  return {
    importStory,
    async resumeStory(story: StoryMetadata, repository: Parameters<SourceServices['importStory']>[1],
      options?: Parameters<SourceServices['importStory']>[2]): Promise<SourceImportResult> {
      const failure = denial(storyOrigin(story), 'resume');
      if (!failure) return services.importStory(story.sourceUrl, repository, options);
      await options?.onSettled?.();
      return { story: null, failure };
    },
    async updateStory(story: StoryMetadata, repository: Parameters<SourceServices['updateStory']>[1],
      options?: Parameters<SourceServices['updateStory']>[2]): Promise<SourceUpdateResult> {
      const failure = denial(storyOrigin(story), 'update');
      if (!failure) return services.updateStory(story, repository, options);
      await options?.onSettled?.();
      return { story: null, reconciliation: null, bodiesDownloaded: 0, failure };
    },
    async downloadImages(story: StoryMetadata, repository: Parameters<SourceServices['downloadImages']>[1],
      options?: Parameters<SourceServices['downloadImages']>[2]): Promise<SourceImageResult> {
      const failure = denial(storyOrigin(story), 'images');
      if (!failure) return services.downloadImages(story.id, repository, options);
      await options?.onSettled?.();
      return { storyId: story.id, summary: null, failure };
    },
    async manageStory(...args: Parameters<SourceServices['manageStory']>) {
      const failure = args[1] !== 'downloads' && args[1] !== 'story'
        ? new SourceOperationFailure({ status: 'unsupported', reason: 'operation', message: 'This library operation is not supported.' })
        : denial(storyOrigin(args[0]), args[1] === 'downloads' ? 'remove-downloads' : 'remove-story');
      if (!failure) return services.manageStory(...args);
      await args[3]();
      throw failure;
    },
    // Cleanup may follow full deletion, when no metadata remains. It is entirely local;
    // keep the existing caller's ownership and the native cleanup's path protections.
    cleanupStoryFiles: services.cleanupStoryFiles,
  };
}
