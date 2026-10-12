import { createSourceOperations, SourceOperationFailure, type SourceServices } from '../src/sources/operations';
import type { StoryMetadata } from '../src/domain/types';
import type { Repository } from '../src/storage/repository';
import { importStory } from '../src/importing/import-story';
import { isStoryBusy, subscribeStoryOperations } from '../src/importing/ownership';
import { RequestClient } from '../src/sources/spacebattles/request';
import { S1Failure } from '../src/sources/spacebattles/types';

const story: StoryMetadata = { source: 'spacebattles', id: 'spacebattles:thread:9001', threadId: '9001',
  sourceUrl: 'https://forums.spacebattles.com/threads/9001/', categoryId: '9', title: 'Synthetic M0', author: null };
const repository = new Proxy({} as Repository, { get() { throw new Error('Unexpected repository access before dispatch.'); } });
function delegates(): jest.Mocked<SourceServices> {
  return { importStory: jest.fn(), updateStory: jest.fn(), downloadImages: jest.fn(), manageStory: jest.fn(), cleanupStoryFiles: jest.fn() };
}
type Operations = ReturnType<typeof createSourceOperations>;
type Options = Parameters<SourceServices['importStory']>[2];
type Acquisition = 'import' | 'resume' | 'update' | 'images';
function invoke(operations: Operations, operation: Acquisition, options?: Options, target = story) {
  if (operation === 'import') return operations.importStory(target.sourceUrl, repository, options);
  if (operation === 'resume') return operations.resumeStory(target, repository, options);
  if (operation === 'update') return operations.updateStory(target, repository, options);
  return operations.downloadImages(target, repository, options as Parameters<Operations['downloadImages']>[2]);
}
function gate() { let release!: () => void; const promise = new Promise<void>((resolve) => { release = resolve; }); return { promise, release }; }
const acquisitions: Acquisition[] = ['import', 'resume', 'update', 'images'];

test.each(acquisitions)('%s delegates once with the same options, callback ownership, result and returned failure', async (operation) => {
  const services = delegates(), operations = createSourceOperations('internal-personal', services);
  const failure = new S1Failure('network', 'Synthetic failure');
  const result = { story: null, storyId: story.id, failure, summary: null, reconciliation: null, bodiesDownloaded: 0 };
  const held = gate(), entered = gate();
  const options = { signal: new AbortController().signal, onProgress: jest.fn(), now: () => 42,
    imageFiles: {} as NonNullable<Options>['imageFiles'], onSettled: jest.fn(async () => { entered.release(); await held.promise; }) };
  const progress = { phase: 'completed' as const, downloaded: 0, total: 0 };
  const delegate = operation === 'images' ? services.downloadImages : operation === 'update' ? services.updateStory : services.importStory;
  delegate.mockImplementation(async (_target, _repo, received) => {
    expect(received).toBe(options); options.onProgress(progress); await received?.onSettled?.(); return result;
  });
  let resolved = false;
  const pending = invoke(operations, operation, options).then((value) => { resolved = true; return value; });
  await entered.promise;
  expect(resolved).toBe(false); expect(delegate).toHaveBeenCalledTimes(1);
  expect(delegate.mock.calls[0]![0]).toBe(operation === 'images' ? story.id : operation === 'update' ? story : story.sourceUrl);
  expect(delegate.mock.calls[0]![1]).toBe(repository); expect(delegate.mock.calls[0]![2]).toBe(options);
  expect(options.onProgress).toHaveBeenCalledWith(progress);
  held.release(); expect(await pending).toBe(result); expect(options.onSettled).toHaveBeenCalledTimes(1);
});

test.each(acquisitions)('%s forwards thrown errors without catching, relabeling or adding settlement', async (operation) => {
  const services = delegates(), operations = createSourceOperations('internal-personal', services);
  const failure = new Error('Unchanged delegate error'), onSettled = jest.fn(async () => {});
  const delegate = operation === 'images' ? services.downloadImages : operation === 'update' ? services.updateStory : services.importStory;
  delegate.mockRejectedValue(failure);
  await expect(invoke(operations, operation, { onSettled })).rejects.toBe(failure);
  expect(delegate).toHaveBeenCalledTimes(1); expect(onSettled).not.toHaveBeenCalled();
});

test.each(['public', 'unconfigured', undefined, '', 'preview'])('audience %p denies every acquisition before delegates/IO/ownership and awaits settlement once', async (audience) => {
  const services = delegates(), operations = createSourceOperations(audience, services);
  const changed = jest.fn(), unsubscribe = subscribeStoryOperations(changed);
  try {
    for (const operation of acquisitions) {
      const entered = gate(), held = gate(); let resolved = false;
      const onSettled = jest.fn(async () => { expect(isStoryBusy(story.id)).toBe(false); entered.release(); await held.promise; });
      const pending = invoke(operations, operation, { onSettled }).then((value) => { resolved = true; return value; });
      await entered.promise; expect(resolved).toBe(false); held.release();
      const outcome = await pending;
      expect(outcome.failure).toBeInstanceOf(SourceOperationFailure);
      expect(outcome.failure).toMatchObject({ code: 'policy-disabled' }); expect(onSettled).toHaveBeenCalledTimes(1);
    }
    for (const delegate of Object.values(services)) expect(delegate).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  } finally { unsubscribe(); }
});

test('unsupported fixture/unknown stories cannot dispatch; declared provenance cannot enable a delegate', async () => {
  const services = delegates(), operations = createSourceOperations('internal-personal', services);
  for (const source of ['fixture', 'epub', 'ao3']) {
    const target = { ...story, source, declaredSource: { site: 'spacebattles', url: story.sourceUrl } } as StoryMetadata;
    for (const operation of ['resume', 'update', 'images'] as const) {
      const onSettled = jest.fn(async () => {});
      expect((await invoke(operations, operation, { onSettled }, target)).failure)
        .toMatchObject({ code: source === 'fixture' ? 'unsupported-operation' : 'unsupported-source' });
      expect(onSettled).toHaveBeenCalledTimes(1);
    }
  }
  for (const delegate of Object.values(services)) expect(delegate).not.toHaveBeenCalled();
});

test('denied settlement failure is awaited and never re-invoked', async () => {
  const services = delegates(), operations = createSourceOperations('public', services);
  const error = new Error('Refresh failed'), onSettled = jest.fn(async () => { throw error; });
  await expect(operations.updateStory(story, repository, { onSettled })).rejects.toBe(error);
  expect(onSettled).toHaveBeenCalledTimes(1); expect(services.updateStory).not.toHaveBeenCalled();
});

test.each(['internal-personal', 'public', undefined])('local management/cleanup remain independent under %p', async (audience) => {
  const services = delegates(), operations = createSourceOperations(audience, services);
  const result = { warning: 'Synthetic cleanup warning' }, onSettled = jest.fn(async () => {});
  services.manageStory.mockImplementation(async (_story, _action, _repo, settled) => { await settled(); return result; });
  for (const action of ['downloads', 'story'] as const) {
    expect(await operations.manageStory(story, action, repository, onSettled)).toBe(result);
    const args = services.manageStory.mock.calls.at(-1)!;
    expect(args[0]).toBe(story); expect(args[1]).toBe(action); expect(args[2]).toBe(repository); expect(args[3]).toBe(onSettled);
  }
  expect(onSettled).toHaveBeenCalledTimes(2);
  await operations.cleanupStoryFiles(story.id, repository);
  expect(services.cleanupStoryFiles.mock.calls[0]![0]).toBe(story.id); expect(services.cleanupStoryFiles.mock.calls[0]![1]).toBe(repository);
  expect(services.importStory).not.toHaveBeenCalled(); expect(services.updateStory).not.toHaveBeenCalled(); expect(services.downloadImages).not.toHaveBeenCalled();
});

test('fixture management is unsupported and settles once without native delegation', async () => {
  const services = delegates(), onSettled = jest.fn(async () => {});
  await expect(createSourceOperations('public', services).manageStory({ ...story, source: 'fixture' }, 'story', repository, onSettled))
    .rejects.toMatchObject({ code: 'unsupported-operation' });
  expect(services.manageStory).not.toHaveBeenCalled(); expect(onSettled).toHaveBeenCalledTimes(1);
});

test('unknown management operation is rejected before delegation', async () => {
  const services = delegates(), onSettled = jest.fn(async () => {});
  await expect(createSourceOperations('internal-personal', services).manageStory(story, 'restore-package' as never, repository, onSettled))
    .rejects.toMatchObject({ code: 'unsupported-operation' });
  expect(services.manageStory).not.toHaveBeenCalled(); expect(onSettled).toHaveBeenCalledTimes(1);
});

test('actual duplicate-import service retains sole ownership through settlement; no second facade lock or request', async () => {
  const services = delegates(), held = gate(), entered = gate();
  const transport = jest.fn(), client = new RequestClient(transport);
  const saved = { ...story, total: 1, downloaded: 1, unread: 1, lastUpdateAttemptAt: null, lastUpdateSuccessAt: null };
  const repo = { getStory: jest.fn(async () => saved), listContents: jest.fn(async () => []) } as unknown as Repository;
  services.importStory.mockImplementation((value, repository, options) => importStory(value, repository, client, async () => 'unused', options));
  const onSettled = jest.fn(async () => { expect(isStoryBusy(story.id)).toBe(true); entered.release(); await held.promise; });
  const pending = createSourceOperations('internal-personal', services).resumeStory(story, repo, { onSettled });
  await entered.promise; expect(isStoryBusy(story.id)).toBe(true); held.release();
  expect((await pending).failure).toBeNull(); expect(isStoryBusy(story.id)).toBe(false);
  expect(onSettled).toHaveBeenCalledTimes(1); expect(services.importStory).toHaveBeenCalledTimes(1); expect(transport).not.toHaveBeenCalled();
});
