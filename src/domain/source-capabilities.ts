import type { StoryMetadata } from './types';

export type BuildAudience = 'internal-personal' | 'public' | 'unconfigured';
export type DistributionStatus = 'internal-only' | 'public-approved' | 'public-file-import-only' | 'disabled';

export function parseBuildAudience(value: unknown): BuildAudience {
  return value === 'internal-personal' || value === 'public' ? value : 'unconfigured';
}

export type SourceOrigin =
  | { readonly kind: 'fixture'; readonly source: 'fixture' }
  | { readonly kind: 'remote'; readonly source: 'spacebattles' };
export type StoryOrigin = SourceOrigin & Pick<StoryMetadata, 'id' | 'threadId'>;

/** Projection only: never constructs, normalizes or replaces persisted identities. */
export function storyOrigin(story: Pick<StoryMetadata, 'id' | 'source' | 'threadId'>): StoryOrigin | null {
  if (story.source === 'fixture') return { kind: 'fixture', source: story.source, id: story.id, threadId: story.threadId };
  if (story.source === 'spacebattles') return { kind: 'remote', source: story.source, id: story.id, threadId: story.threadId };
  return null;
}

export type AcquisitionOperation = 'import' | 'resume' | 'update' | 'images' | 'diagnostic';
export type LocalOperation = 'read' | 'read-state' | 'locator' | 'continue' | 'view-source' | 'remove-downloads' | 'remove-story' | 'cleanup';
export type SourceOperation = AcquisitionOperation | LocalOperation;

export type Eligibility =
  | { status: 'allowed' }
  | { status: 'policy-disabled'; message: string }
  | { status: 'unsupported'; reason: 'source' | 'operation'; message: string };
export type SourceDenial = Exclude<Eligibility, { status: 'allowed' }>;
