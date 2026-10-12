import { parseBuildAudience, type AcquisitionOperation, type DistributionStatus, type Eligibility, type LocalOperation, type SourceOperation, type SourceOrigin } from '../domain/source-capabilities';

interface SourceDescriptor {
  readonly origin: SourceOrigin;
  readonly distribution: DistributionStatus;
  readonly acquisition: readonly AcquisitionOperation[];
  readonly local: readonly LocalOperation[];
}

export const SPACEBATTLES_ORIGIN = Object.freeze({ kind: 'remote', source: 'spacebattles' } as const);
const reading = ['read', 'read-state', 'locator', 'continue'] as const;
// Descriptors list implemented operations only. Provenance is never a registry key.
const fixture: SourceDescriptor = Object.freeze({
  origin: Object.freeze({ kind: 'fixture', source: 'fixture' } as const), distribution: 'public-approved',
  acquisition: Object.freeze([]), local: Object.freeze([...reading]),
});
const spacebattles: SourceDescriptor = Object.freeze({
  origin: SPACEBATTLES_ORIGIN, distribution: 'internal-only',
  acquisition: Object.freeze(['import', 'resume', 'update', 'images', 'diagnostic'] as const),
  local: Object.freeze([...reading, 'view-source', 'remove-downloads', 'remove-story', 'cleanup'] as const),
});

export function sourceDescriptor(origin: unknown): SourceDescriptor | null {
  if (!origin || typeof origin !== 'object') return null;
  const candidate = origin as { kind?: unknown; source?: unknown };
  if (candidate.kind === 'fixture' && candidate.source === 'fixture') return fixture;
  if (candidate.kind === 'remote' && candidate.source === 'spacebattles') return spacebattles;
  return null;
}

/** Pure support/policy decision. Runtime busy, identity and source validators remain separate. */
export function sourceEligibility(origin: unknown, operation: SourceOperation, audience: unknown): Eligibility {
  const descriptor = sourceDescriptor(origin);
  if (!descriptor) return { status: 'unsupported', reason: 'source', message: 'This source is not supported by Stowaway.' };
  if (descriptor.local.includes(operation as LocalOperation)) return { status: 'allowed' };
  if (!descriptor.acquisition.includes(operation as AcquisitionOperation)) {
    return { status: 'unsupported', reason: 'operation', message: 'This operation is not supported for this source.' };
  }
  const build = parseBuildAudience(audience);
  if (build !== 'unconfigured' && (descriptor.distribution === 'public-approved' ||
      descriptor.distribution === 'internal-only' && build === 'internal-personal')) return { status: 'allowed' };
  return { status: 'policy-disabled', message: build === 'unconfigured'
    ? 'Source downloads are unavailable because this build has no valid acquisition audience. Existing local reading and removal remain available.'
    : 'SpaceBattles downloads are available only in the internal personal build. Existing local reading and removal remain available.' };
}
