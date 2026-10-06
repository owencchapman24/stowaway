import { prepareContent } from '../content/sanitize';
import { DomUtils, parseDocument } from 'htmlparser2';
import type { ReconciliationResult, StoryMetadata, StorySummary } from '../domain/types';
import type { Repository } from '../storage/repository';
import { discoverManifest } from '../sources/spacebattles/diagnostic';
import { extractPostBody, parseStoryMetadata } from '../sources/spacebattles/parse';
import type { RequestClient } from '../sources/spacebattles/request';
import { S1Failure, type Document } from '../sources/spacebattles/types';
import { documentUrl, threadFromUrl } from '../sources/spacebattles/url';

export class ImportFailure extends Error {
  constructor(readonly code: 'storage' | 'busy', message: string) { super(message); this.name = 'ImportFailure'; }
}
export interface ImportProgress {
  phase: 'validating' | 'manifest' | 'saving' | 'reconciling' | 'downloading' | 'completed' | 'cancelled' | 'failed';
  storyId?: string;
  downloaded: number;
  total: number;
  title?: string;
}
export interface ImportResult {
  story: StorySummary | null;
  failure: S1Failure | ImportFailure | null;
}
export interface UpdateResult extends ImportResult {
  reconciliation: ReconciliationResult | null;
  bodiesDownloaded: number;
}
interface OperationOptions {
  signal?: AbortSignal; onProgress?: (progress: ImportProgress) => void;
  now?: () => number;
}
// Module-scoped ownership spans screens, repository handles and import/update/resume callers.
const activeStories = new Set<string>();
export async function importStory(value: string, repository: Repository, client: RequestClient,
  digest: (value: string) => Promise<string>, options: OperationOptions = {}): Promise<ImportResult> {
  return operateStory(value, repository, client, digest, options, false);
}
export async function updateStory(story: Pick<StoryMetadata, 'id' | 'sourceUrl'>, repository: Repository, client: RequestClient,
  digest: (value: string) => Promise<string>, options: OperationOptions = {}): Promise<UpdateResult> {
  return operateStory(story.sourceUrl, repository, client, digest, options, true, story.id);
}
async function operateStory(value: string, repository: Repository, client: RequestClient,
  digest: (value: string) => Promise<string>, options: OperationOptions, updating: boolean, expectedId?: string): Promise<UpdateResult> {
  let id: string | undefined = expectedId;
  let ownsLock = false;
  let downloaded = 0;
  let total = 0;
  let reconciliation: ReconciliationResult | null = null;
  let bodiesDownloaded = 0;
  const now = options.now ?? Date.now;
  let phase: ImportProgress['phase'] = 'validating';
  const progress = (next: ImportProgress['phase'], title?: string) => {
    phase = next; options.onProgress?.({ phase, storyId: id, downloaded, total, title });
  };
  const cancelled = () => { if (options.signal?.aborted) throw new S1Failure('cancelled', `${updating ? 'Update' : 'Import'} cancelled; committed text is retained.`); };
  const storage = async <T,>(work: () => Promise<T>): Promise<T> => {
    try { return await work(); } catch { cancelled(); throw new ImportFailure('storage', 'Local storage failed; earlier committed text is retained.'); }
  };
  let cached: Document | null = null;
  let cachedKey: string | null = null;
  try {
    progress('validating'); cancelled();
    const thread = threadFromUrl(value);
    if (updating && thread.storyId !== expectedId) throw new S1Failure('unsupported-url', 'Stored source URL does not match this story identity.');
    id = thread.storyId;
    if (activeStories.has(id)) throw new ImportFailure('busy', 'This story already has an import, update or download running.');
    activeStories.add(id); ownsLock = true;
    const get = async (url: string): Promise<Document> => {
      cancelled();
      const key = documentUrl(url, thread.threadId);
      if (cached && (cachedKey === key || cached.url === key)) return cached;
      cached = null; cachedKey = null;
      const page = await client.get(key, thread.threadId, { signal: options.signal });
      cancelled();
      cached = page; cachedKey = key;
      return page;
    };
    let story = await storage(() => repository.getStory(thread.storyId));
    if (updating) {
      if (!story || story.source !== 'spacebattles' || story.id !== thread.storyId || story.threadId !== thread.threadId) {
        throw new S1Failure('unsupported-url', 'Check for Updates requires an already imported SpaceBattles story.');
      }
      downloaded = story.downloaded; total = story.total;
      await storage(() => repository.recordUpdateAttempt(thread.storyId, now(), options.signal));
    }
    if (!story || updating) {
      progress('manifest');
      let root: Document | null = await get(thread.url);
      const metadata = parseStoryMetadata(root, thread);
      const manifest = await discoverManifest(thread, get, root, (count) => { total = count; progress('manifest'); });
      // The already fetched root may contain the first primary body. Reuse it
      // only when the observed first-entry document matches its validated URL.
      cached = manifest.state === 'COMPLETE' && manifest.entries[0] &&
        documentUrl(manifest.entries[0].url, thread.threadId) === root.url ? root : null;
      cachedKey = cached?.url ?? null; root = null;
      if (manifest.state !== 'COMPLETE') throw manifest.failure;
      cancelled(); total = manifest.entries.length; progress(updating ? 'reconciling' : 'saving');
      const incoming = { ...metadata, categoryId: manifest.category.id };
      if (updating) reconciliation = await storage(() => repository.reconcileManifest(thread.storyId, incoming, manifest, now(), options.signal));
      else await storage(() => repository.commitInitialManifest(incoming, manifest, options.signal));
      story = await storage(() => repository.getStory(thread.storyId));
    }
    if (!story || !story.categoryId) throw new ImportFailure('storage', 'Stored primary manifest is unavailable.');
    total = story.total; downloaded = story.downloaded;
    const entries = await storage(() => repository.listContents(thread.storyId));
    for (const entry of entries) {
      cancelled();
      if (entry.downloaded) continue;
      progress('downloading', entry.title);
      const page = await get(entry.sourceUrl);
      let content;
      try {
        const raw = extractPostBody(page, thread, { postId: entry.postId, chapterId: entry.id,
          title: entry.title, url: entry.sourceUrl, threadmarkId: null }, story.categoryId);
        content = await prepareContent(raw, digest);
        if (!content.blockIds.length || !DomUtils.textContent(parseDocument(content.html)).trim()) throw new Error('Empty sanitized chapter.');
      } catch (error) {
        throw error instanceof S1Failure ? error : new S1Failure('parser', 'Chapter extraction or sanitization failed.');
      }
      cancelled();
      await storage(() => repository.commitDownloadedChapter(thread.storyId, entry.postId, content, options.signal));
      bodiesDownloaded++; downloaded++; progress('downloading', entry.title);
    }
    cached = null; cancelled(); progress('completed');
    return { story: await storage(() => repository.getStory(thread.storyId)), failure: null, reconciliation, bodiesDownloaded };
  } catch (error) {
    const failure = error instanceof S1Failure || error instanceof ImportFailure ? error
      : new S1Failure('parser', `${updating ? 'Update' : 'Import'} could not parse the selected source.`);
    let story: StorySummary | null = null;
    if (id) try { story = await repository.getStory(id); } catch { /* Preserve the original typed failure. */ }
    if (story) { downloaded = story.downloaded; total = story.total; }
    progress(failure.code === 'cancelled' ? 'cancelled' : 'failed');
    return { story, failure, reconciliation, bodiesDownloaded };
  } finally {
    cached = null;
    if (id && ownsLock) activeStories.delete(id);
  }
}
