import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StoryMetadata } from '../src/domain/types';
import type { Repository } from '../src/storage/repository';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('../src/sources/spacebattles/diagnostic', () => ({ runDiagnostic: jest.fn() }));
jest.mock('../src/importing/native', () => ({ importNativeStory: jest.fn(), updateNativeStory: jest.fn() }));
jest.mock('../src/images/native', () => ({ downloadNativeImages: jest.fn(), getSourceImageFiles: jest.fn() }));
jest.mock('../src/storage/management-native', () => ({ manageNativeStory: jest.fn(), cleanupNativeStoryFiles: jest.fn() }));

const envKey = 'EXPO_PUBLIC_STOWAWAY_BUILD_AUDIENCE';
const original = process.env.EXPO_PUBLIC_STOWAWAY_BUILD_AUDIENCE, originalDev = __DEV__;
beforeEach(() => { jest.resetModules(); jest.clearAllMocks(); });
afterEach(() => {
  if (original === undefined) delete process.env[envKey]; else process.env[envKey] = original;
  Reflect.set(global, '__DEV__', originalDev);
});
const story: StoryMetadata = { id: 'spacebattles:thread:9001', source: 'spacebattles', threadId: '9001',
  sourceUrl: 'https://forums.spacebattles.com/threads/9001/', title: 'Synthetic M0', author: null, categoryId: '9' };

test.each(['public', undefined, '', 'preview', 'internal-personal '])('native composition denies audience %p before all native acquisition and file delegates', async (value) => {
  if (value === undefined) delete process.env[envKey]; else process.env[envKey] = value;
  const { BUILD_AUDIENCE } = jest.requireActual<typeof import('../src/config/build-audience')>('../src/config/build-audience');
  expect(BUILD_AUDIENCE).toBe(value === 'public' ? 'public' : 'unconfigured');
  const { sourceOperations } = jest.requireActual<typeof import('../src/sources/native-operations')>('../src/sources/native-operations');
  const repository = new Proxy({} as Repository, { get() { throw new Error('Denied native call touched storage.'); } });
  const onSettled = jest.fn(async () => {});
  for (const promise of [sourceOperations.importStory(story.sourceUrl, repository, { onSettled }),
    sourceOperations.resumeStory(story, repository, { onSettled }), sourceOperations.updateStory(story, repository, { onSettled }),
    sourceOperations.downloadImages(story, repository, { onSettled })]) {
    expect((await promise).failure).toMatchObject({ code: 'policy-disabled' });
  }
  expect(onSettled).toHaveBeenCalledTimes(4);
  const importing = jest.requireMock('../src/importing/native'); const images = jest.requireMock('../src/images/native');
  for (const delegate of [...Object.values(importing), ...Object.values(images)]) expect(delegate).not.toHaveBeenCalled();
  expect(jest.requireMock('expo/fetch').fetch).not.toHaveBeenCalled();
});

test.each([
  ['internal-personal', true, true], ['internal-personal', false, false], ['public', true, false],
  ['public', false, false], [undefined, true, false], ['preview', true, false],
] as const)('native S1 requires both explicit internal audience (%p) and development (%p)', (audience, dev, allowed) => {
  if (audience === undefined) delete process.env[envKey]; else process.env[envKey] = audience;
  Reflect.set(global, '__DEV__', dev);
  const { runNativeDiagnostic, sourceClient } = jest.requireActual<typeof import('../src/sources/spacebattles/native')>('../src/sources/spacebattles/native');
  const run = jest.requireMock('../src/sources/spacebattles/diagnostic').runDiagnostic as jest.Mock;
  const options = { signal: new AbortController().signal, onProgress: jest.fn() };
  const result = Promise.resolve({ synthetic: true }); run.mockReturnValue(result);
  if (allowed) {
    expect(runNativeDiagnostic(story.sourceUrl, options)).toBe(result);
    expect(run).toHaveBeenCalledTimes(1); expect(run).toHaveBeenCalledWith(story.sourceUrl, sourceClient, options);
  } else {
    expect(() => runNativeDiagnostic(story.sourceUrl, options)).toThrow(); expect(run).not.toHaveBeenCalled();
  }
  expect(jest.requireMock('expo/fetch').fetch).not.toHaveBeenCalled();
});

test('EAS audiences are explicit and existing version/build settings are retained', () => {
  const eas = JSON.parse(readFileSync(join(__dirname, '../eas.json'), 'utf8'));
  expect(eas.cli).toEqual({ version: '>= 24.12.1', appVersionSource: 'remote' });
  for (const profile of ['development', 'preview']) {
    expect(eas.build[profile].distribution).toBe('internal');
    expect(eas.build[profile].env[envKey]).toBe('internal-personal');
  }
  expect(eas.build.development.developmentClient).toBe(true);
  expect(eas.build.production).toEqual({ autoIncrement: true, distribution: 'store', env: { [envKey]: 'public' } });
  expect(eas.submit).toEqual({ production: {} });
});

test('internal standalone release JS retains acquisition independently of __DEV__', async () => {
  process.env[envKey] = 'internal-personal'; Reflect.set(global, '__DEV__', false);
  const { sourceOperations } = jest.requireActual<typeof import('../src/sources/native-operations')>('../src/sources/native-operations');
  const run = jest.requireMock('../src/importing/native').importNativeStory as jest.Mock;
  const result = { story: null, failure: null }; run.mockResolvedValue(result);
  const repo = {} as Repository;
  expect(await sourceOperations.importStory(story.sourceUrl, repo)).toBe(result); expect(run).toHaveBeenCalledTimes(1);
});
