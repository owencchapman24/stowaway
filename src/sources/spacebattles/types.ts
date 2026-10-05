export type FailureCode = 'unsupported-url' | 'blocked' | 'challenge' | 'network' |
  'transient' | 'parser' | 'incomplete' | 'unsupported-structure' | 'cancelled';

export class S1Failure extends Error {
  constructor(readonly code: FailureCode, message: string, readonly status?: number) {
    super(message);
    this.name = 'S1Failure';
  }
}

export interface Thread {
  threadId: string;
  storyId: string;
  url: string;
}

export interface Entry {
  postId: string;
  chapterId: string;
  threadmarkId: string | null;
  title: string;
  url: string;
}

export interface Category {
  id: string;
  url: string;
  expected: number | null;
}

export type Manifest = {
  state: 'COMPLETE'; category: Category; entries: Entry[]; duplicates: string[]; pages: number;
} | {
  state: 'INCOMPLETE' | 'FAILED'; category: Category | null; entries: Entry[];
  duplicates: string[]; pages: number; failure: S1Failure;
};

export interface Document { url: string; html: string; status: number }
export interface RequestEvent { state: 'waiting' | 'requesting' | 'response'; count: number; status?: number }
export interface Sample { postId: string; bodyCharacters: number; formattingTags: string[] }
export interface Diagnostic {
  thread: Thread; manifest: Manifest | null; samples: Sample[]; requests: number;
  elapsedMs: number; failure: S1Failure | null;
}
