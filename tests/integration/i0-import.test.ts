import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hostSqlite } from './host-sqlite';
import { migrate } from '../../src/storage/migrations';
import { createRepository, compileFixture } from '../../src/storage/repository';
import { importStory } from '../../src/importing/import-story';
import { RequestClient, type Transport } from '../../src/sources/spacebattles/request';
import { bodyArticle, importDocuments, importRootUrl } from '../fixtures/import';
import { page, threadUrl, indexUrl, index, row, range, rangeUrl } from '../fixtures/spacebattles';
import { threadFromUrl } from '../../src/sources/spacebattles/url';
import { prepareContent } from '../../src/content/sanitize';
import { runDiagnostic } from '../../src/sources/spacebattles/diagnostic';
import type { SqlValue } from '../../src/storage/database';

const digest = async (value: string) => createHash('sha256').update(value).digest('hex');
const asset = { relativePath: 'assets/11111111-1111-4111-8111-111111111111.png', byteLength: 2024 };
let folder: string;
let host: ReturnType<typeof hostSqlite>;
let repo: ReturnType<typeof createRepository>;
beforeEach(async () => {
  folder = mkdtempSync(join(tmpdir(), 'stowaway-i0-'));
  host = hostSqlite(join(folder, 'test.db'));
  await migrate(host.db);
  repo = createRepository(host.db);
});
afterEach(() => {
  host.close();
  if (!folder.startsWith(join(tmpdir(), 'stowaway-i0-'))) throw new Error('Unexpected test directory.');
  rmSync(folder, { recursive: true, force: true });
});
function source(documents = importDocuments(), fail?: string) {
  const requests: string[] = []; const starts: number[] = [];
  let now = 0; let inFlight = 0; let maxFlight = 0;
  const transport: Transport = async (url, init) => {
    expect(init.credentials).toBe('omit');
    requests.push(url); starts.push(now); inFlight++; maxFlight = Math.max(maxFlight, inFlight);
    if (url === fail) { inFlight--; throw new Error('Injected network failure'); }
    if (!documents.has(url)) throw new Error(`Unmapped synthetic request: ${url}`);
    return { status: 200, url, bodyUsed: true, headers: { get: () => null },
      text: async () => { inFlight--; return documents.get(url)!; } };
  };
  const client = new RequestClient(transport, { now: () => now, sleep: async (ms) => { now += ms; } });
  return { client, requests, starts, maxFlight: () => maxFlight };
}
const id = threadFromUrl(threadUrl).storyId;

test('actual v1 migration preserves fixture bodies/IDs, locator, settings and asset without reseed', async () => {
  // Create the exact historical v1 schema with the same migration path used by S2A.
  host.close();
  host = hostSqlite(join(folder, 'legacy.db'));
  await migrate(host.db, 1); repo = createRepository(host.db);
  const fixture = await compileFixture(digest);
  await repo.seed(fixture, asset);
  const chapter = fixture.chapters[0]!;
  const locator = { chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[2]!, offset: 24, progression: .4, expandedSpoilers: [] };
  await repo.saveLocator(locator); await repo.savePreferences({ theme: 'dark', fontSize: 26 });
  await host.db.runAsync('UPDATE chapters SET title = ?, position = ? WHERE id = ?', 'Renamed old chapter', 8, chapter.id);
  const bodies = await host.db.getAllAsync('SELECT * FROM chapters ORDER BY id');
  await migrate(host.db); await migrate(host.db);
  expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 3 });
  expect(await host.db.getAllAsync('SELECT * FROM chapters ORDER BY id')).toEqual(bodies);
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
  expect(await repo.getPreferences()).toEqual({ theme: 'dark', fontSize: 26 });
  expect(await repo.getChapterAssetPath(chapter.id)).toBe(asset.relativePath);
  expect(await repo.listStories()).toMatchObject([{ id: fixture.id, total: 3, downloaded: 3 }]);
  expect((await repo.listContents(fixture.id)).map((e) => e.title)).toContain('Renamed old chapter');
  expect(await host.db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
  await host.db.execAsync('PRAGMA user_version = 4');
  await expect(migrate(host.db)).rejects.toThrow('newer');
  expect(await host.db.getAllAsync('SELECT * FROM chapters ORDER BY id')).toEqual(bodies);
});

test('complete manifest commits before bodies; shared document reused; repeat complete import makes zero requests', async () => {
  await repo.seed(await compileFixture(digest), asset);
  const fake = source();
  let checked = false;
  const get = fake.client.get.bind(fake.client);
  jest.spyOn(fake.client, 'get').mockImplementation(async (...args) => {
    if (args[0] === threadUrl + 'page-2') {
      expect(await repo.getStory(id)).toMatchObject({ total: 3, downloaded: 0 });
      expect(await repo.listContents(id)).toHaveLength(3);
    }
    return get(...args);
  });
  const result = await importStory(threadUrl, repo, fake.client, digest, { onProgress(p) {
    if (p.phase === 'downloading' && p.downloaded === 0) checked = true;
  } });
  expect(checked).toBe(true); expect(result.failure).toBeNull();
  expect(result.story).toMatchObject({ total: 3, downloaded: 3, author: 'Generated Author' });
  expect(fake.requests).toEqual([importRootUrl, indexUrl, threadUrl + 'page-2', threadUrl + 'page-3']);
  expect(fake.starts.slice(1).every((time, n) => time - fake.starts[n]! >= 2000)).toBe(true);
  expect(fake.maxFlight()).toBe(1);
  const repeated = await importStory(threadUrl + '?page=2#post-101', repo, fake.client, digest);
  expect(repeated.story?.downloaded).toBe(3); expect(fake.requests).toHaveLength(4);
  expect(await repo.listStories()).toHaveLength(2);
  expect(await repo.listChapters(id)).toHaveLength(3);
  expect(await repo.getChapterAssetPath(id + ':post:101')).toBeNull();
});

test('incomplete and failed manifests never create a persistent story', async () => {
  const incomplete = await importStory(threadUrl, repo, source(importDocuments(4)).client, digest);
  expect(incomplete.failure?.code).toBe('incomplete'); expect(await repo.listStories()).toEqual([]);
  const documents = importDocuments(); documents.set(indexUrl, page('<p>No supported index</p>'));
  expect((await importStory(threadUrl, repo, source(documents).client, digest)).failure).not.toBeNull();
  expect(await repo.listStories()).toEqual([]);
});

test('conflicting-thread range persists nothing; corrected fresh import stores only the correct stable entries', async () => {
  const documents = importDocuments();
  documents.set(indexUrl, index(row('101', 2) + range(), { expected: 2 }));
  documents.set(rangeUrl, page(row('202', 2)).replace('thread-9001', 'thread-9999'));
  const refused = source(documents);
  const failed = await importStory(threadUrl, repo, refused.client, digest);
  expect(failed.failure?.code).toBe('incomplete'); expect(failed.story).toBeNull();
  expect(await repo.listStories()).toEqual([]);
  expect(await host.db.getAllAsync('SELECT * FROM threadmark_entries')).toEqual([]);
  expect(await repo.listChapters()).toEqual([]);
  expect(refused.requests).toEqual([importRootUrl, indexUrl, rangeUrl]);

  documents.set(rangeUrl, page(row('102', 2)));
  const corrected = source(documents);
  const result = await importStory(threadUrl, repo, corrected.client, digest);
  expect(result.failure).toBeNull(); expect(result.story).toMatchObject({ total: 2, downloaded: 2 });
  expect((await repo.listContents(id)).map((entry) => entry.postId)).toEqual(['101', '102']);
  expect((await repo.listChapters(id)).map((entry) => entry.id)).toEqual([id + ':post:101', id + ':post:102']);
  expect((await importStory(threadUrl, repo, corrected.client, digest)).failure).toBeNull();
  expect(corrected.requests).toEqual([importRootUrl, indexUrl, rangeUrl, threadUrl + 'page-2']);
});

test('the validated root is reused for primary bodies whose observed links target that document', async () => {
  const documents = importDocuments();
  documents.set(importRootUrl, documents.get(importRootUrl)!.replace('</body>', bodyArticle('101') + bodyArticle('102') + '</body>'));
  documents.set(indexUrl, documents.get(indexUrl)!.replaceAll(threadUrl + 'page-2', importRootUrl));
  const fake = source(documents);
  expect((await importStory(threadUrl, repo, fake.client, digest)).story?.downloaded).toBe(3);
  expect(fake.requests).toEqual([importRootUrl, indexUrl, threadUrl + 'page-3']);
});

test('cancel after one commit; close/reopen; resume only missing bodies; locator and idempotency preserved', async () => {
  const fake = source(); const abort = new AbortController();
  const first = await importStory(threadUrl, repo, fake.client, digest, { signal: abort.signal, onProgress(p) {
    if (p.downloaded === 1) abort.abort();
  } });
  expect(first.failure?.code).toBe('cancelled');
  expect(first.story).toMatchObject({ total: 3, downloaded: 1 });
  expect(await repo.listContents(id)).toMatchObject([{ downloaded: true }, { downloaded: false }, { downloaded: false }]);
  const chapter = (await repo.getChapter(id + ':post:101'))!;
  const locator = { chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[0]!, offset: 7, progression: .3, expandedSpoilers: [] };
  await repo.saveLocator(locator);
  host.close(); host = hostSqlite(join(folder, 'test.db')); await migrate(host.db); repo = createRepository(host.db);
  const resumed = source();
  expect((await importStory(threadUrl, repo, resumed.client, digest)).story?.downloaded).toBe(3);
  expect(resumed.requests).toEqual([threadUrl + 'page-2', threadUrl + 'page-3']);
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
  expect(await repo.listStories()).toHaveLength(1); expect(await repo.listContents(id)).toHaveLength(3);
  expect(await repo.listChapters(id)).toHaveLength(3);
  expect((await importStory(threadUrl, repo, resumed.client, digest)).failure).toBeNull();
  expect(resumed.requests).toHaveLength(2);
});

test('cancel during unfinished content preparation commits no current body and starts no later request', async () => {
  const fake = source(); const abort = new AbortController();
  const result = await importStory(threadUrl, repo, fake.client, async (value) => { abort.abort(); return digest(value); }, { signal: abort.signal });
  expect(result.failure?.code).toBe('cancelled'); expect(result.story).toMatchObject({ total: 3, downloaded: 0 });
  expect(await repo.listChapters(id)).toEqual([]);
  expect(fake.requests).toEqual([importRootUrl, indexUrl, threadUrl + 'page-2']);
  expect((await importStory(threadUrl, repo, source().client, digest)).story?.downloaded).toBe(3);
});

test('cancellation at saving creates no story/manifest and retry succeeds on the same write queue', async () => {
  const abort = new AbortController();
  const fake = source();
  const result = await importStory(threadUrl, repo, fake.client, digest, { signal: abort.signal, onProgress(p) {
    if (p.phase === 'saving') abort.abort();
  } });
  expect(result.failure?.code).toBe('cancelled'); expect(result.story).toBeNull();
  expect(await repo.listStories()).toEqual([]);
  expect(await host.db.getAllAsync('SELECT * FROM threadmark_entries')).toEqual([]);
  expect(fake.requests).toEqual([importRootUrl, indexUrl]);
  expect((await importStory(threadUrl, repo, source().client, digest)).story?.downloaded).toBe(3);
});

test('cancellation while manifest storage is queued preserves the fixture and commits no new manifest', async () => {
  const fixture = await compileFixture(digest); await repo.seed(fixture, asset);
  const chapter = fixture.chapters[0]!;
  let release!: () => void; let reached!: () => void; let saving!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const ready = new Promise<void>((resolve) => { reached = resolve; });
  const queued = new Promise<void>((resolve) => { saving = resolve; });
  const held = repo.replaceChapterContent(chapter.id, chapter, async (phase) => {
    if (phase === 'before-write') { reached(); await gate; }
  });
  await ready;
  const abort = new AbortController();
  const importing = importStory(threadUrl, repo, source().client, digest, { signal: abort.signal,
    onProgress(p) { if (p.phase === 'saving') saving(); } });
  await queued; abort.abort(); release(); await held;
  const result = await importing;
  expect(result.failure?.code).toBe('cancelled'); expect(await repo.getStory(id)).toBeNull();
  expect(await repo.listContents(id)).toEqual([]);
  expect(await repo.getChapter(chapter.id)).toMatchObject({ html: chapter.html, contentHash: chapter.contentHash });
  expect(await repo.getStory(fixture.id)).toMatchObject({ total: 3, downloaded: 3 });
  expect((await importStory(threadUrl, repo, source().client, digest)).story?.downloaded).toBe(3);
});

test('cancellation during manifest entry insertion rolls back the story and every entry; retry succeeds', async () => {
  const abort = new AbortController();
  const transaction = host.db.withExclusiveTransactionAsync.bind(host.db);
  const boundary = jest.spyOn(host.db, 'withExclusiveTransactionAsync').mockImplementationOnce((work) => transaction(async (tx) => {
    await work({ ...tx, async runAsync(sql, ...params) {
      const result = await tx.runAsync(sql, ...params);
      if (sql.startsWith('INSERT INTO threadmark_entries')) {
        expect(await tx.getFirstAsync('SELECT COUNT(*) AS count FROM threadmark_entries')).toEqual({ count: 1 });
        abort.abort();
      }
      return result;
    } });
  }));
  const result = await importStory(threadUrl, repo, source().client, digest, { signal: abort.signal });
  boundary.mockRestore();
  expect(result.failure?.code).toBe('cancelled'); expect(result.story).toBeNull();
  expect(await repo.listStories()).toEqual([]);
  expect(await host.db.getAllAsync('SELECT * FROM threadmark_entries')).toEqual([]);
  expect((await importStory(threadUrl, repo, source().client, digest)).story?.downloaded).toBe(3);
});

test('cancellation during final chapter FK validation rolls back only the current body and allows missing-only retry', async () => {
  const abort = new AbortController();
  const transaction = host.db.withExclusiveTransactionAsync.bind(host.db);
  let checked = false;
  const boundary = jest.spyOn(host.db, 'withExclusiveTransactionAsync');
  const result = await importStory(threadUrl, repo, source().client, digest, { signal: abort.signal, onProgress(p) {
    if (p.downloaded === 1 && !checked) {
      checked = true;
      boundary.mockImplementationOnce((work) => transaction(async (tx) => {
        await work({ ...tx, async getFirstAsync<T>(sql: string, ...params: SqlValue[]) {
          const row = await tx.getFirstAsync<T>(sql, ...params);
          if (sql === 'PRAGMA foreign_key_check') {
            expect(row).toBeNull();
            expect(await tx.getFirstAsync('SELECT COUNT(*) AS count FROM chapters')).toEqual({ count: 2 });
            abort.abort();
          }
          return row;
        } });
      }));
    }
  } });
  boundary.mockRestore();
  expect(checked).toBe(true); expect(result.failure?.code).toBe('cancelled');
  expect(result.story).toMatchObject({ total: 3, downloaded: 1 });
  expect((await repo.listContents(id)).map((entry) => entry.downloaded)).toEqual([true, false, false]);
  const retained = await repo.getChapter(id + ':post:101');
  expect(retained).not.toBeNull(); expect(await repo.getChapter(id + ':post:102')).toBeNull();
  const retry = source();
  expect((await importStory(threadUrl, repo, retry.client, digest)).story?.downloaded).toBe(3);
  expect(retry.requests).toEqual([threadUrl + 'page-2', threadUrl + 'page-3']);
  expect(await repo.getChapter(id + ':post:101')).toEqual(retained);
  expect(await host.db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
});

test('a source body with no readable sanitized text fails without marking it downloaded', async () => {
  const documents = importDocuments();
  documents.set(threadUrl + 'page-2', page(bodyArticle('101', '<form>Discarded form text</form>')));
  const result = await importStory(threadUrl, repo, source(documents).client, digest);
  expect(result.failure?.code).toBe('parser'); expect(result.story?.downloaded).toBe(0);
});

test.each(['network', 'parser', 'storage'] as const)('%s failure retains prior commits and permits retry', async (failure) => {
  const docs = importDocuments();
  if (failure === 'parser') docs.set(threadUrl + 'page-3', page(bodyArticle('999')));
  const fake = source(docs, failure === 'network' ? threadUrl + 'page-3' : undefined);
  let injected = false;
  const result = await importStory(threadUrl, repo, fake.client, digest, { onProgress(p) {
    if (failure === 'storage' && p.downloaded === 2 && !injected) { injected = true; host.failNextCommit(); }
  } });
  expect(result.failure?.code).toBe(failure); expect(result.story?.downloaded).toBe(2);
  expect(await repo.listChapters(id)).toHaveLength(2);
  const retry = source();
  expect((await importStory(threadUrl, repo, retry.client, digest)).story?.downloaded).toBe(3);
  expect(retry.requests).toEqual([threadUrl + 'page-3']);
});

test('failed manifest commit rolls back every story/entry; retry and conflict-safe body insertion work', async () => {
  host.failNextCommit();
  const result = await importStory(threadUrl, repo, source().client, digest);
  expect(result.failure?.code).toBe('storage'); expect(await repo.listStories()).toEqual([]);
  expect(await host.db.getAllAsync('SELECT * FROM threadmark_entries')).toEqual([]);
  await importStory(threadUrl, repo, source().client, digest);
  const chapter = (await repo.getChapter(id + ':post:101'))!;
  await repo.commitDownloadedChapter(id, '101', { ...chapter, html: 'Must not replace committed body' });
  expect(await repo.getChapter(chapter.id)).toEqual(chapter);
});

test('missing author imports successfully; simultaneous diagnostic/import share serialized client cooldown', async () => {
  const documents = importDocuments();
  documents.set(importRootUrl, documents.get(importRootUrl)!.replace(/<div class="p-description">.*?<\/div>/, ''));
  const fake = source(documents);
  const [imported, diagnostic] = await Promise.all([
    importStory(threadUrl, repo, fake.client, digest),
    runDiagnostic(threadUrl, fake.client, { laterSample: true }),
  ]);
  expect(imported.failure).toBeNull(); expect(imported.story?.author).toBeNull(); expect(diagnostic.failure).toBeNull();
  expect(fake.maxFlight()).toBe(1);
  expect(fake.starts.slice(1).every((time, n) => time - fake.starts[n]! >= 2000)).toBe(true);
});

test('simultaneous imports of the same stable story cannot race, even across repository handles', async () => {
  let release!: () => void; let reached!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const ready = new Promise<void>((resolve) => { reached = resolve; });
  const fake = source();
  const original = fake.client.get.bind(fake.client);
  jest.spyOn(fake.client, 'get').mockImplementation(async (...args) => { reached(); await gate; return original(...args); });
  const first = importStory(threadUrl, repo, fake.client, digest);
  await ready;
  const second = await importStory(threadUrl, createRepository(host.db), fake.client, digest);
  expect(second.failure?.code).toBe('busy');
  release(); expect((await first).failure).toBeNull();
  expect(await repo.listStories()).toHaveLength(1);
});

test('1,000 generated entries preserve source order, listing/count coherence and stable locator despite metadata rename', async () => {
  const entries = Array.from({ length: 1000 }, (_, i) => ({ postId: String(1001 + i), title: `Generated ${i}`, url: `${threadUrl}page-2#post-${1001 + i}` }));
  await repo.commitInitialManifest({ id, source: 'spacebattles', threadId: '9001', title: 'Generated scale', author: null, sourceUrl: importRootUrl, categoryId: '9' }, { state: 'COMPLETE', entries });
  const content = await prepareContent('<p>Generated scale passage</p>', digest);
  await repo.commitDownloadedChapter(id, entries[0]!.postId, content);
  const chapter = (await repo.getChapter(id + ':post:1001'))!;
  const locator = { chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[0]!, offset: 5, progression: .2, expandedSpoilers: [] };
  await repo.saveLocator(locator);
  await host.db.runAsync('UPDATE threadmark_entries SET title = ? WHERE story_id = ? AND post_id = ?', 'Renamed', id, '1001');
  const contents = await repo.listContents(id);
  expect(contents).toHaveLength(1000); expect(contents.map((e) => e.postId)).toEqual(entries.map((e) => e.postId));
  expect(contents[0]?.title).toBe('Renamed'); expect(await repo.getLocator(chapter.id)).toEqual(locator);
  expect(await repo.getStory(id)).toMatchObject({ author: null, total: 1000, downloaded: 1 });
});
