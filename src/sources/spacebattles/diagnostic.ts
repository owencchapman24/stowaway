import { parseIndex, parseRange, primaryIndex, samplePost, type Range } from './parse';
import { RequestClient } from './request';
import { documentUrl, threadFromUrl } from './url';
import { S1Failure, type Category, type Diagnostic, type Document, type Entry, type Manifest, type RequestEvent, type Thread } from './types';

const active = new WeakSet<RequestClient>();

export async function discoverManifest(thread: Thread, get: (url: string) => Promise<Document>, root: Document,
  onProgress?: (count: number, category: Category) => void): Promise<Manifest> {
  const entries: Entry[] = [];
  const duplicates: string[] = [];
  const ids = new Set<string>();
  const visited = new Set<string>();
  let category: Category | null = null;
  let pages = 0;
  async function expand(items: (Entry | Range)[], depth = 0): Promise<void> {
    if (depth > 20) throw new S1Failure('incomplete', 'Range nesting exceeds the spike budget.');
    for (const item of items) {
      if ('kind' in item) {
        if (visited.has(item.url)) throw new S1Failure('incomplete', 'Range continuation repeats or cycles.');
        visited.add(item.url);
        const response = await get(item.url);
        pages++;
        await expand(parseRange(response, thread, category!.id), depth + 1);
      } else if (ids.has(item.postId)) duplicates.push(item.postId);
      else {
        ids.add(item.postId); entries.push(item);
        if (entries.length > 10000) throw new S1Failure('incomplete', 'Manifest exceeds 10,000 unique entries.');
      }
    }
    if (category) onProgress?.(entries.length, category);
  }
  try {
    let url: string | null = primaryIndex(root, thread);
    let advertisedLast = 1;
    let pageNumber = 0;
    while (url) {
      if (visited.has(url)) throw new S1Failure('incomplete', 'Pagination repeats or cycles.');
      visited.add(url);
      const page = await get(url);
      pages++;
      if (visited.has(page.url) && page.url !== url) throw new S1Failure('incomplete', 'Source redirects to an already traversed page.');
      visited.add(page.url);
      const parsed = parseIndex(page, thread, category ?? undefined);
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
    return { state: entries.length || category ? 'INCOMPLETE' : 'FAILED', category, entries, duplicates, pages, failure };
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
