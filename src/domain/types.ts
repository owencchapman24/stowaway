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

export type AppStyle = 'stowaway' | 'classic';
export type ReaderFont =
  | "baskerville" | "charter" | "cochin" | "didot" | "georgia" | "hoefler-text" | "palatino" | "times" | "serif"
  | "avenir" | "avenir-next" | "futura" | "gill-sans" | "helvetica-neue" | "optima" | "sans"
  | "american-typewriter" | "courier-new" | "menlo"
  | "bradley-hand" | "chalkboard-se" | "marker-felt" | "noteworthy"
  | "copperplate" | "papyrus" | "snell-roundhand";
export interface Preferences {
  theme: 'light' | 'paper' | 'dark';
  fontSize: number;
  /** Missing in legacy callers/settings; resolves to Georgia. */
  font?: ReaderFont;
}

export const DEFAULT_PREFERENCES: Preferences = { theme: 'light', fontSize: 20, font: 'georgia' };

export interface StoryMetadata {
  id: string;
  source: 'fixture' | 'spacebattles';
  threadId: string;
  title: string;
  author: string | null;
  sourceUrl: string;
  categoryId: string | null;
}
export interface StorySummary extends StoryMetadata {
  total: number;
  downloaded: number;
  unread: number;
  lastUpdateAttemptAt: number | null;
  lastUpdateSuccessAt: number | null;
}
export interface StoryContentsEntry extends ChapterSummary {
  postId: string;
  sourceUrl: string;
  downloaded: boolean;
  isRead: boolean;
}

export interface ReconciliationResult {
  added: number;
  reactivated: number;
  removed: number;
  renamed: number;
  orderChanged: boolean;
  metadataChanged: boolean;
  total: number;
  downloaded: number;
  pending: number;
}

/** A saved passage with an available local body; never inferred from Read state. */
export interface ContinueReadingTarget {
  storyId: string; storyTitle: string; chapterId: string; chapterTitle: string; currentlyListed: boolean;
}
