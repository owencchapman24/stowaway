import { prepareContent } from '../content/sanitize';
import { acquireStory, ImportFailure } from '../importing/ownership';
import { extractPostContent } from '../sources/spacebattles/parse';
import type { RequestClient } from '../sources/spacebattles/request';
import { S1Failure, type Document } from '../sources/spacebattles/types';
import { documentUrl, threadFromUrl } from '../sources/spacebattles/url';
import type { Repository } from '../storage/repository';
import type { SourceImageFiles } from './files';
import type { ImageChange } from './repository';
import { ImageRejected, normalizeImageMime } from './validate';
import type { ImageMimeDiagnostic, ImageSummary } from './types';

export interface ImageProgress { phase: 'discovering' | 'downloading' | 'completed' | 'cancelled' | 'failed'; title?: string; slot?: number; completed: number; total: number }
export interface ImageResult { storyId: string; summary: ImageSummary | null; failure: S1Failure | ImportFailure | null; mimeDiagnostics?: ImageMimeDiagnostic[] }
export interface ImageOptions { signal?: AbortSignal; onProgress?: (progress: ImageProgress) => void }
function cancelled(signal?: AbortSignal) { if (signal?.aborted) throw new S1Failure('cancelled', 'Image work cancelled; text and completed local images are retained.'); }
async function storage<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch (error) {
    if (error instanceof S1Failure || error instanceof ImportFailure || error instanceof ImageRejected) throw error;
    throw new ImportFailure('storage', 'Image storage failed; text and prior local references are retained.');
  }
}

/** Caller owns the story. Batch up to eight completed references per transaction. */
export async function downloadChapterImages(storyId: string, chapterId: string, repository: Repository,
  client: RequestClient, files: SourceImageFiles, options: ImageOptions & { onMime?: (diagnostic: ImageMimeDiagnostic) => void } = {}) {
  const images = await storage(() => repository.listChapterImages(chapterId));
  let completed = 0;
  const changes: ImageChange[] = [];
  const releases: (() => void)[] = [];
  let referenceFailed = false;
  async function flush() {
    if (!changes.length) return;
    // These candidates already completed validation. They may finish committing
    // during cancellation settlement; no new request or stage begins afterward.
    try { await storage(() => repository.commitImageResults(storyId, chapterId, changes)); }
    catch (error) { referenceFailed = true; throw error; }
    changes.length = 0;
    releases.splice(0).forEach((release) => release());
  }
  try {
    for (const image of images) {
      cancelled(options.signal);
      // Explicit image work can reconsider only the old MIME compatibility veto.
      // Other omissions remain permanent and still cause zero asset requests.
      if (image.state === 'omitted' && image.reason !== 'content-type-mismatch') continue;
      if (image.state === 'downloaded' && image.file) {
        try { await files.read(image.file); completed++; continue; }
        catch { /* Explicit retry stages a fresh replacement; old reference stays until commit. */ }
      }
      options.onProgress?.({ phase: 'downloading', slot: image.slot + 1, completed, total: images.length });
      try {
        if (!image.sourceUrl) throw new ImageRejected('invalid-url');
        const response = await client.getImage(image.sourceUrl, { signal: options.signal });
        cancelled(options.signal);
        const staged = await storage(() => files.stage(response.bytes, response.contentType).catch((error) => {
          if (error instanceof ImageRejected) throw error;
          throw new ImportFailure('storage', 'Could not stage a local source image; text is retained.');
        }));
        releases.push(staged.release);
        changes.push({ slot: image.slot, file: staged.file });
        options.onMime?.({ chapterId, slot: image.slot, receivedMime: normalizeImageMime(response.contentType), detectedFormat: staged.file.format, accepted: true });
      } catch (error) {
        if (!(error instanceof ImageRejected)) throw error;
        if (error.mime) options.onMime?.({ chapterId, slot: image.slot, ...error.mime, accepted: false });
        if (image.state === 'downloaded') {
          throw new ImportFailure('storage', `Image repair rejected: ${error.reason}. Previous local reference retained; use Retry Images.`);
        }
        changes.push({ slot: image.slot, reason: error.reason });
      }
      completed++;
      if (changes.length >= 8) await flush();
    }
    await flush();
    options.onProgress?.({ phase: 'downloading', completed, total: images.length });
  } catch (error) {
    // Retain completed earlier candidates even when a later request fails or cancels.
    if (!referenceFailed) await flush();
    throw error;
  } finally { releases.forEach((release) => release()); }
}

export async function downloadImages(storyId: string, repository: Repository, client: RequestClient,
  digest: (text: string) => Promise<string>, files: SourceImageFiles, options: ImageOptions = {}): Promise<ImageResult> {
  let release: (() => void) | null = null;
  let cached: Document | null = null;
  let cachedKey: string | null = null;
  let failure: ImageResult['failure'] = null;
  const mimeDiagnostics: ImageMimeDiagnostic[] = [];
  try {
    cancelled(options.signal); release = acquireStory(storyId);
    const story = await storage(() => repository.getStory(storyId));
    if (!story || story.source !== 'spacebattles' || !story.categoryId) throw new S1Failure('unsupported-url', 'Images require an imported SpaceBattles story.');
    const thread = threadFromUrl(story.sourceUrl);
    if (thread.storyId !== storyId || thread.threadId !== story.threadId) throw new S1Failure('unsupported-url', 'Stored story identity does not match.');
    // Cleanup is deliberate-operation-only, best effort, and sees every story's refs.
    try { await files.cleanup(() => repository.listSourceAssetReferences()); } catch { /* Orphans are harmless. */ }
    const chapters = await storage(() => repository.listImageWork(storyId));
    for (const entry of chapters) {
      cancelled(options.signal);
      if (entry.discovery === 'unknown') {
        options.onProgress?.({ phase: 'discovering', title: entry.title, completed: 0, total: 0 });
        const key = documentUrl(entry.sourceUrl, thread.threadId);
        if (!cached || (cachedKey !== key && cached.url !== key)) {
          cached = null; cachedKey = null;
          cached = await client.get(key, thread.threadId, { signal: options.signal }); cachedKey = key;
        }
        const page = cached;
        cancelled(options.signal);
        const extracted = extractPostContent(page, thread, { ...entry, postId: entry.postId, chapterId: entry.id,
          url: entry.sourceUrl, threadmarkId: null }, story.categoryId);
        const current = await prepareContent(extracted.sourceHtml, digest);
        const saved = await storage(() => repository.getChapter(entry.id));
        if (!saved) throw new ImportFailure('storage', 'Saved chapter is unavailable.');
        const matches = current.contentHash === saved.contentHash && current.html === saved.html &&
          current.sanitizerVersion === saved.sanitizerVersion && JSON.stringify(current.blockIds) === JSON.stringify(saved.blockIds) &&
          JSON.stringify(current.links) === JSON.stringify(saved.links);
        cancelled(options.signal);
        await storage(() => repository.commitImageDiscovery(entry.id, saved.contentHash, matches ? extracted.images : null, options.signal));
        if (!matches) continue;
      }
      if (entry.discovery === 'saved-text-mismatch') continue;
      await downloadChapterImages(storyId, entry.id, repository, client, files, { ...options,
        onMime: (diagnostic) => {
          // Keep later MIME vetoes visible even after the success sample fills.
          if (!diagnostic.accepted && mimeDiagnostics.length === 8) {
            const success = mimeDiagnostics.findIndex((item) => item.accepted);
            if (success >= 0) mimeDiagnostics.splice(success, 1);
          }
          if (mimeDiagnostics.length < 8) mimeDiagnostics.push(diagnostic);
        },
        onProgress: (progress) => options.onProgress?.({ ...progress, title: entry.title }) });
    }
    cancelled(options.signal);
  } catch (error) {
    failure = error instanceof S1Failure || error instanceof ImportFailure ? error : new S1Failure('parser', 'Image discovery could not parse the selected chapter.');
  } finally { cached = null; release?.(); }
  let summary: ImageSummary | null = null;
  try { summary = await repository.getImageSummary(storyId); } catch { /* Retain typed operation failure. */ }
  options.onProgress?.({ phase: failure ? (failure.code === 'cancelled' ? 'cancelled' : 'failed') : 'completed', completed: 0, total: 0 });
  return { storyId, summary, failure, mimeDiagnostics };
}
