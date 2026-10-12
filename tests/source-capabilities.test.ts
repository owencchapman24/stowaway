import { parseBuildAudience, storyOrigin, type SourceOperation } from '../src/domain/source-capabilities';
import { sourceDescriptor, sourceEligibility, SPACEBATTLES_ORIGIN } from '../src/sources/registry';

const fixture = { kind: 'fixture', source: 'fixture' };
const acquisition = ['import', 'resume', 'update', 'images', 'diagnostic'] as const;
test.each(['internal-personal', 'public', undefined, '', 'preview', ' internal-personal', null, 1])('capability matrix with audience %p', (audience) => {
  for (const operation of acquisition) {
    expect(sourceEligibility(fixture, operation, audience)).toMatchObject({ status: 'unsupported', reason: 'operation' });
    expect(sourceEligibility(SPACEBATTLES_ORIGIN, operation, audience).status).toBe(audience === 'internal-personal' ? 'allowed' : 'policy-disabled');
  }
  for (const operation of ['read', 'read-state', 'locator', 'continue'] as const) {
    expect(sourceEligibility(fixture, operation, audience).status).toBe('allowed');
    expect(sourceEligibility(SPACEBATTLES_ORIGIN, operation, audience).status).toBe('allowed');
  }
  for (const operation of ['view-source', 'remove-downloads', 'remove-story', 'cleanup'] as const) {
    expect(sourceEligibility(fixture, operation, audience).status).toBe('unsupported');
    expect(sourceEligibility(SPACEBATTLES_ORIGIN, operation, audience).status).toBe('allowed');
  }
});
test('audience parsing is exact and fail closed', () => {
  expect(parseBuildAudience('public')).toBe('public'); expect(parseBuildAudience('internal-personal')).toBe('internal-personal');
  for (const value of [undefined, null, '', 'development', 'INTERNAL-PERSONAL', 'internal-personal ', {}, true]) {
    expect(parseBuildAudience(value)).toBe('unconfigured');
  }
});
test('projection retains legacy identity without constructing new IDs', () => {
  for (const source of ['fixture', 'spacebattles'] as const) {
    const story = { source, id: `${source}:thread:9001`, threadId: '9001' };
    expect(storyOrigin(story)).toEqual({ ...story, kind: source === 'fixture' ? 'fixture' : 'remote' });
  }
});
test('unknown origins, operations and declared file provenance cannot grant acquisition', () => {
  for (const origin of [null, {}, { kind: 'remote', source: 'ao3' }, { kind: 'remote', source: 'fixture' },
    { kind: 'file', source: 'spacebattles', declaredSource: SPACEBATTLES_ORIGIN },
    { kind: 'file', importerId: 'epub', declaredSource: { site: 'spacebattles' } }]) {
    expect(sourceDescriptor(origin)).toBeNull();
    expect(sourceEligibility(origin, 'import', 'internal-personal')).toMatchObject({ status: 'unsupported', reason: 'source' });
  }
  expect(sourceEligibility(SPACEBATTLES_ORIGIN, 'restore-package' as SourceOperation, 'internal-personal'))
    .toMatchObject({ status: 'unsupported', reason: 'operation' });
  expect(storyOrigin({ source: 'epub', id: 'file:1', threadId: '1' } as never)).toBeNull();
});
