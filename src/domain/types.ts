export interface Locator {
  chapterId: string;
  contentHash: string;
  blockId: string;
  /** CSS pixels into the block, recomputed from the live layout on restore. */
  offset: number;
  progression: number;
  expandedSpoilers: string[];
}

export interface ChapterSummary {
  id: string;
  title: string;
  position: number;
}

export interface Chapter extends ChapterSummary {
  storyId: string;
  html: string;
  contentHash: string;
  sanitizerVersion: string;
  blockIds: string[];
  links: Record<string, string>;
}

export interface Preferences {
  theme: 'light' | 'dark';
  fontSize: number;
}

export const DEFAULT_PREFERENCES: Preferences = { theme: 'light', fontSize: 20 };
