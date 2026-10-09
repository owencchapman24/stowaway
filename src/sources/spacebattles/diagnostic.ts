import { parseIndex, parseRange, primaryIndex, samplePost, type Range } from './parse';
import { RequestClient } from './request';
import { assertManifestContinuation, documentUrl, threadFromUrl } from './url';
import { S1Failure, type Category, type Diagnostic, type Document, type Entry, type Manifest, type RequestEvent, type Thread } from './types';

const active = new WeakSet<RequestClient>();

// Stowaway limits, not source quotas: twice the existing 10,000-entry budget
// permits one index plus one range document per supported entry. Transport
// retries/redirect hops remain separately bounded by RequestClient.
export const MAX_MANIFEST_DOCUMENTS = 20_000;
export const MAX_MANIFEST_NO_PROGRESS = 32;

export async function discoverManifest(thread: Thread, get: (url: string) => Promise<Document>, root: Document,
  onProgress?: (count: number, category: Category) => void): Promise<Manifest> {
  const entries: Entry[] = [];
  const duplicates: string[] = [];
  const ids = new Set<string>();
  const visited = new Set<string>();
  let category: Category | null = null;
  let pages = 0;
  let noProgress = 0;
  let incompleteContinuation = false;
  function verifyContinuation(requested: string, returned: string, kind: 'index' | 'range', primary?: string) {
    try { assertManifestContinuation(requested, returned, thread.threadId, kind, primary); }
    catch (error) { incompleteContinuation = true; throw error; }
  }
  async function consume(url: string): Promise<Document> {
    if (pages >= MAX_MANIFEST_DOCUMENTS) throw new S1Failure('incomplete', 'Manifest traversal document limit reached.');
    const page = await get(url);
    pages++;
    return page;
  }
  async function expand(items: (Entry | Range)[], depth = 0): Promise<void> {
    if (depth > 20) throw new S1Failure('incomplete', 'Range nesting exceeds the spike budget.');
    const before = ids.size;
    for (const item of items) {
      if ('kind' in item) {
        if (visited.has(item.url)) throw new S1Failure('incomplete', 'Range continuation repeats or cycles.');
        visited.add(item.url);
        const response = await consume(item.url);
        verifyContinuation(item.url, response.url, 'range', category!.id);
        await expand(parseRange(response, thread, category!.id), depth + 1);
      } else if (ids.has(item.postId)) duplicates.push(item.postId);
      else {
        ids.add(item.postId); entries.push(item);
        noProgress = 0;
        if (entries.length > 10000) throw new S1Failure('incomplete', 'Manifest exceeds 10,000 unique entries.');
      }
    }
    // Count resolved index/range documents, including terminal responses.
    // Productive wrappers do not count again or erase a later duplicate streak
    // on unwind. Only adding a new post ID above resets the counter.
    if (ids.size === before) noProgress++;
    if (noProgress >= MAX_MANIFEST_NO_PROGRESS) throw new S1Failure('incomplete', 'Manifest traversal made no new post progress.');
    if (category) onProgress?.(entries.length, category);
  }
  try {
    let url: string | null = primaryIndex(root, thread);
    let advertisedLast = 1;
    let pageNumber = 0;
    while (url) {
      if (visited.has(url)) throw new S1Failure('incomplete', 'Pagination repeats or cycles.');
      visited.add(url);
      const page = await consume(url);
      verifyContinuation(url, page.url, 'index', category?.id);
      if (visited.has(page.url) && page.url !== url) throw new S1Failure('incomplete', 'Source redirects to an already traversed page.');
      visited.add(page.url);
      const parsed = parseIndex(page, thread, category ?? undefined);
      verifyContinuation(url, page.url, 'index', parsed.category.id);
      category = parsed.category;
      pageNumber = Number(new URL(page.url).searchParams.get('page') ?? 1);
      advertisedLast = Math.max(advertisedLast, parsed.lastPage);
      await expand(parsed.items);
      url = parsed.next;
    }
    if (!category || !entries.length || pageNumber !== advertisedLast ||
        (category.expected !== null && entries.length !== category.expected)) {
      throw new S1Failure('incomplete', 'Primary traversal or unique count did not match the source completion evidence.');
    }
    return { state: 'COMPLETE', category, entries, duplicates, pages };
  } catch (error) {
    const failure = error instanceof S1Failure ? error : new S1Failure('parser', 'Source parsing failed.');
    return { state: entries.length || category || incompleteContinuation ? 'INCOMPLETE' : 'FAILED', category, entries, duplicates, pages, failure };
  }
}

export async function runDiagnostic(value: string, client: RequestClient, options: {
  laterSample?: boolean; signal?: AbortSignal; onEvent?: (event: RequestEvent) => void;
  onProgress?: (count: number, category: Category) => void;
} = {}): Promise<Diagnostic> {
  const thread = threadFromUrl(value);
  if (active.has(client)) throw new S1Failure('transient', 'Another diagnostic is still finishing or cancelling.');
  active.add(client);
  const start = Date.now();
  const initialCount = client.requestCount;
  const cache = new Map<string, Document>();
  const get = async (url: string) => {
    const key = documentUrl(url, thread.threadId);
    const old = cache.get(key);
    if (old) return old;
    const page = await client.get(key, thread.threadId, { signal: options.signal, limit: initialCount + 80,
      onEvent: (event) => options.onEvent?.({ ...event, count: event.count - initialCount }) });
    cache.set(key, page); cache.set(page.url, page);
    return page;
  };
  const result: Diagnostic = { thread, manifest: null, samples: [], requests: 0, elapsedMs: 0, failure: null };
  try {
    const root = await get(thread.url);
    result.manifest = await discoverManifest(thread, get, root, options.onProgress);
    if (result.manifest.state !== 'COMPLETE') result.failure = result.manifest.failure;
    else {
      const selected = [result.manifest.entries[0]!];
      if (options.laterSample && result.manifest.entries.length > 1) selected.push(result.manifest.entries.at(-1)!);
      for (const entry of selected) result.samples.push(samplePost(await get(entry.url), thread, entry, result.manifest.category.id));
    }
  } catch (error) {
    result.failure = error instanceof S1Failure ? error : new S1Failure('parser', 'Source diagnostic failed.');
  } finally {
    cache.clear();
    active.delete(client);
    result.requests = client.requestCount - initialCount;
    result.elapsedMs = Date.now() - start;
  }
  return result;
}
