import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { migrate } from '../../src/storage/migrations';
import { compileFixture, createRepository } from '../../src/storage/repository';
import { CLEANUP_WARNING, REMOVAL_ROLLBACK, type ManagementAction } from '../../src/storage/management';
import { createSourceImageFiles } from '../../src/images/files';
import { cleanupStoryRenders, protectRender } from '../../src/storage/render-cleanup';
import { createLocalContentFiles } from '../../src/storage/local-files';
import { acquireStory } from '../../src/importing/ownership';
import { importStory, updateStory } from '../../src/importing/import-story';
import { downloadImages } from '../../src/images/download';
import { prepareContent } from '../../src/content/sanitize';
import { extractPostContent } from '../../src/sources/spacebattles/parse';
import { threadFromUrl } from '../../src/sources/spacebattles/url';
import { RequestClient } from '../../src/sources/spacebattles/request';
import { readerDocument } from '../../src/reader/template';
import { hostSqlite } from './host-sqlite';
import { hostFiles } from './host-files';
import { png } from '../fixtures/images';
import { bodyArticle, importRootUrl, storyHeader } from '../fixtures/import';
import { page, tabs, index, indexUrl, row } from '../fixtures/spacebattles';
import type { StoryMetadata } from '../../src/domain/types';

const digest = async (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const id = 'spacebattles:thread:9001', otherId = 'spacebattles:thread:9002', cid = `${id}:post:101`;
const metadata: StoryMetadata = { id, source: 'spacebattles', threadId: '9001', title: 'Synthetic I4', author: 'Generated', sourceUrl: importRootUrl, categoryId: '9' };
const other = { ...metadata, id: otherId, threadId: '9002', sourceUrl: 'https://forums.spacebattles.com/threads/9002/' };
const url = (post: string) => `https://forums.spacebattles.com/posts/${post}/`;
const manifest = (posts = ['101', '102', '103']) => ({ state: 'COMPLETE' as const, entries: posts.map((postId) => ({ postId, title: `Generated ${postId}`, url: url(postId) })) });
const markup = (post: string) => `<p>Synthetic ${post}.</p><img src="/attachments/generated.png" alt="Generated">`;
let folder: string, host: ReturnType<typeof hostSqlite>, repo: ReturnType<typeof createRepository>;
let files: ReturnType<typeof hostFiles>, images: ReturnType<typeof createSourceImageFiles>, count: number;
const uuid = () => `11111111-1111-4111-8111-${String(++count).padStart(12, '0')}`;
beforeEach(async () => {
  count = 0; folder = mkdtempSync(join(tmpdir(), 'stowaway-i4-'));
  host = hostSqlite(join(folder, 'test.db')); await migrate(host.db); repo = createRepository(host.db);
  files = hostFiles(join(folder, 'documents')); images = createSourceImageFiles(files, digest, uuid);
});
afterEach(() => {
  jest.restoreAllMocks(); host.close(); const target = resolve(folder);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('stowaway-i4-')) throw new Error('Unexpected test root.');
  rmSync(target, { recursive: true, force: true });
});
async function body(story = metadata, post = '101') {
  const extracted = extractPostContent({ html: page(bodyArticle(post, markup(post))).replaceAll('thread-9001', `thread-${story.threadId}`), url: url(post), status: 200 }, threadFromUrl(story.sourceUrl),
    { postId: post, chapterId: `${story.id}:post:${post}`, title: 'Generated', url: url(post), threadmarkId: null }, '9');
  const content = await prepareContent(extracted.sourceHtml, digest);
  await repo.commitDownloadedChapter(story.id, post, content, undefined, extracted.images);
  const staged = await images.stage(png());
  await repo.commitImageResults(story.id, `${story.id}:post:${post}`, [{ slot: 0, file: staged.file }]); staged.release();
  const locator = { chapterId: `${story.id}:post:${post}`, contentHash: content.contentHash, blockId: content.blockIds[0]!, offset: 12.5, progression: .64, expandedSpoilers: [] };
  await repo.saveLocator(locator); return { content, locator, path: staged.file.relativePath };
}
async function initial() {
  await repo.seed(await compileFixture(digest), { relativePath: `assets/${uuid()}.png`, byteLength: 2024 });
  const harbor = (await repo.getAssetPath())!; files.mkdir('assets'); files.write(harbor, 'fixture');
  files.mkdir('stowaway-s2a/assets'); files.write('stowaway-s2a/assets/keep.png', 'S2A');
  files.mkdir('source-assets'); files.write('source-assets/foreign.png', 'foreign');
  await repo.commitInitialManifest(metadata, manifest()); await repo.commitInitialManifest(other, manifest(['101']));
  const a = await body(), b = await body(other), removed = await body(metadata, '102');
  await repo.setEntryRead(id, '101', true); await repo.setEntryRead(id, '102', true); await repo.setEntryRead(id, '103', true);
  await repo.recordUpdateAttempt(id, 123); await repo.reconcileManifest(id, metadata, manifest(['101', '103']), 456);
  await repo.savePreferences({ theme: 'dark', fontSize: 26 });
  return { a, b, removed, harbor };
}
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const table of ['stories', 'threadmark_entries', 'chapters', 'reading_positions', 'chapter_images', 'settings', 'assets']) {
    result[table] = await host.db.getAllAsync(`SELECT * FROM ${table} ORDER BY 1, 2`);
  }
  return result;
}
const cleanup = async (paths: string[]) => { await images.cleanup(() => repo.listSourceAssetReferences(), paths); await cleanupStoryRenders(files, id); };
const remove = (action: ManagementAction = 'downloads') => repo.manageStory(metadata, action, { cleanup });
function source(posts = ['101', '103'], changed = false) {
  const calls: string[] = []; let time = 0;
  const client = new RequestClient(async (request) => {
    calls.push(request); const post = /\/posts\/(\d+)\//.exec(request)?.[1];
    const html = request === importRootUrl ? page(storyHeader + tabs) : request === indexUrl ?
      index(posts.map((p) => row(p).replace(/href="[^"]*"/, `href="${url(p)}"`)).join(''), { expected: posts.length }) :
      post ? page(bodyArticle(post, markup(post).replace('Synthetic', changed ? 'Changed' : 'Synthetic'))) : '';
    return { url: request, status: 200, bodyUsed: true, headers: { get: () => html ? 'text/html' : 'image/png' },
      text: async () => html, arrayBuffer: async () => new Uint8Array(png()).buffer };
  }, { now: () => time, sleep: async (ms) => { time += ms; } });
  return { client, calls };
}
function gate() { let release!: () => void; const promise = new Promise<void>((resolve) => { release = resolve; }); return { promise, release }; }

test.each([0, 1, 2, 3, 4, 5])('fresh/v%s -> v6 preserves available chapters, passage, preferences and fixture; retry is idempotent', async (version) => {
  host.close(); host = hostSqlite(join(folder, 'migration.db'));
  let baseline: unknown = null;
  if (version) {
    await migrate(host.db, version); repo = createRepository(host.db);
    await repo.seed(await compileFixture(digest), { relativePath: `assets/${uuid()}.png`, byteLength: 2024 });
    const chapter = (await repo.getChapter((await repo.listChapters())[0]!.id))!;
    await repo.saveLocator({ chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[0]!, offset: 5, progression: .6, expandedSpoilers: [] });
    await repo.savePreferences({ theme: 'dark', fontSize: 26 });
    baseline = { chapter, locator: await repo.getLocator(chapter.id), settings: await repo.getPreferences(), asset: await repo.getAssetPath() };
  }
  await migrate(host.db); await migrate(host.db); repo = createRepository(host.db);
  expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 6 });
  if (version) {
    const chapter = (await repo.getChapter((await repo.listChapters())[0]!.id))!;
    expect({ chapter, locator: await repo.getLocator(chapter.id), settings: await repo.getPreferences(), asset: await repo.getAssetPath() }).toEqual(baseline);
    expect(await host.db.getAllAsync('SELECT body_available FROM chapters')).toEqual([{ body_available: 1 }, { body_available: 1 }, { body_available: 1 }]);
  }
  expect(await host.db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
});

test('populated v5 migration preserves every old field, images, flags, timestamps and locators; rollback/retry and newer rejection', async () => {
  host.close(); host = hostSqlite(join(folder, 'v5.db')); await migrate(host.db, 5); repo = createRepository(host.db);
  await initial(); const before = await snapshot(); host.failNextCommit();
  await expect(migrate(host.db)).rejects.toThrow('commit failure');
  expect(await snapshot()).toEqual(before); expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 5 });
  await migrate(host.db); await migrate(host.db);
  const after = await snapshot();
  expect(after).toEqual({ ...before, chapters: (before.chapters as object[]).map((chapter) => ({ ...chapter, body_available: 1 })) });
  await expect(host.db.runAsync('UPDATE chapters SET body_available = 2')).rejects.toThrow('CHECK');
  await expect(host.db.runAsync('UPDATE chapters SET body_available = NULL')).rejects.toThrow('NOT NULL');
  await host.db.execAsync('PRAGMA user_version = 7'); await expect(migrate(host.db)).rejects.toThrow('newer'); expect(await snapshot()).toEqual(after);
});

test('remove downloads retains exact metadata/current+unlisted identities/read flags/locators/history, clears all body/image data and is idempotent', async () => {
  await initial(); const before = await snapshot(), story = (await repo.getStory(id))!;
  expect(await repo.listSavedUnlisted(id)).toHaveLength(1);
  await remove();
  expect(await repo.getStory(id)).toEqual({ ...story, downloaded: 0 });
  expect(await host.db.getAllAsync('SELECT * FROM stories ORDER BY 1, 2')).toEqual(before.stories);
  expect(await host.db.getAllAsync('SELECT * FROM threadmark_entries ORDER BY 1, 2')).toEqual(before.threadmark_entries);
  expect(await host.db.getAllAsync('SELECT * FROM reading_positions ORDER BY 1, 2')).toEqual(before.reading_positions);
  expect(await host.db.getAllAsync('SELECT html, content_hash, sanitizer_version, block_ids, links, image_discovery, body_available FROM chapters WHERE story_id = ?', id)).toEqual(
    Array.from({ length: 2 }, () => ({ html: '', content_hash: '', sanitizer_version: '', block_ids: '[]', links: '{}', image_discovery: 'unknown', body_available: 0 })));
  expect(await repo.getChapter(cid)).toBeNull(); expect(await repo.listChapters(id)).toEqual([]);
  expect(await repo.listContents(id)).toMatchObject([{ postId: '101', downloaded: false, isRead: true }, { postId: '103', downloaded: false, isRead: true }]);
  expect(await repo.listSavedUnlisted(id)).toEqual([]); expect(await repo.listChapterImages(cid)).toEqual([]); expect(await repo.listImageWork(id)).toEqual([]);
  expect(await repo.getImageSummary(id)).toEqual({ unknown: 0, mismatch: 0, scanned: 0, local: 0, pending: 0, omitted: 0, mimeRetryable: 0 });
  const after = await snapshot(); await remove(); expect(await snapshot()).toEqual(after);
  const fake = source(); await downloadImages(id, repo, fake.client, digest, images); expect(fake.calls).toEqual([]);
});

test.each(['downloads', 'story'] as const)('%s deletes only captured, unreferenced owned source files AFTER commit; other/fixture/S2A/staged/foreign files survive', async (action) => {
  const { a, b, removed, harbor } = await initial();
  const staged = await images.stage(png());
  const orphan = await images.stage(png()); orphan.release();
  await repo.manageStory(metadata, action, { cleanup: async (paths) => {
    expect(await repo.getChapter(cid)).toBeNull();
    expect(await repo.listSourceAssetReferences()).not.toContain(a.path);
    expect(files.exists(a.path)).toBe(true); expect(files.exists(removed.path)).toBe(true);
    await cleanup(paths);
  } });
  expect(files.exists(a.path)).toBe(false); expect(files.exists(removed.path)).toBe(false);
  for (const path of [b.path, harbor, 'source-assets/foreign.png', 'stowaway-s2a/assets/keep.png', staged.file.relativePath, orphan.file.relativePath]) expect(files.exists(path)).toBe(true);
  staged.release();
});

test.each(['downloads', 'story'] as const)('%s DB failure rolls back every table and makes zero filesystem calls; retry succeeds', async (action) => {
  const { a } = await initial(), before = await snapshot(), clean = jest.fn(cleanup);
  host.failNextCommit(); await expect(repo.manageStory(metadata, action, { cleanup: clean })).rejects.toThrow(REMOVAL_ROLLBACK);
  expect(clean).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before); expect(files.exists(a.path)).toBe(true); expect(await repo.getChapter(cid)).not.toBeNull();
  await remove(action); expect(await repo.getChapter(cid)).toBeNull(); expect(files.exists(a.path)).toBe(false);
});

test.each(['downloads', 'story'] as const)('%s cleanup failure keeps logical success, no references restored; safe explicit orphan retry', async (action) => {
  const { a } = await initial(); const removeFile = files.remove;
  files.remove = () => { throw new Error('Injected filesystem failure'); };
  expect(await remove(action)).toEqual({ warning: CLEANUP_WARNING });
  expect(await repo.getChapter(cid)).toBeNull(); expect(await repo.listSourceAssetReferences()).not.toContain(a.path); expect(files.exists(a.path)).toBe(true);
  expect(!!await repo.getStory(id)).toBe(action === 'downloads');
  files.remove = removeFile; await images.cleanup(() => repo.listSourceAssetReferences()); expect(files.exists(a.path)).toBe(false);
});

test.each([false, true])('explicit duplicate import resumes removed current shells, preserves Read/locator with changed content=%s and normal body-time image discovery', async (changed) => {
  const { a } = await initial(); await remove(); const fake = source(undefined, changed);
  const result = await importStory(importRootUrl, repo, fake.client, digest);
  expect(result.failure).toBeNull(); expect(fake.calls).toEqual([url('101'), url('103')]);
  const chapter = (await repo.getChapter(cid))!;
  expect(await repo.getLocator(cid)).toEqual(a.locator);
  expect(chapter.contentHash === a.locator.contentHash).toBe(!changed);
  const html = readerDocument(chapter, await repo.getLocator(cid), { theme: 'light', fontSize: 20 }, uuid());
  expect(html).toContain(JSON.stringify({ chapterId: chapter.id, contentHash: chapter.contentHash, session: `11111111-1111-4111-8111-${String(count).padStart(12, '0')}`, locator: a.locator }));
  expect(await repo.getStory(id)).toMatchObject({ downloaded: 2, total: 2, unread: 0, lastUpdateAttemptAt: 123, lastUpdateSuccessAt: 456 });
  expect(await repo.getImageSummary(id)).toMatchObject({ scanned: 2, pending: 2, unknown: 0 });
  expect(await repo.getChapter(`${id}:post:102`)).toBeNull();
});

test('unlisted unavailable identity/read/locator survives reappearance, rename/reorder and normal missing-only update download', async () => {
  const { removed } = await initial(); await remove();
  const fake = source(['102', '103', '101']);
  const result = await updateStory(metadata, repo, fake.client, digest, { now: () => 999 });
  expect(result.failure).toBeNull(); expect(result.reconciliation).toMatchObject({ reactivated: 1, renamed: 3, orderChanged: true, downloaded: 0, pending: 3 });
  expect(fake.calls).toEqual([importRootUrl, indexUrl, url('102'), url('103'), url('101')]);
  expect(await repo.getLocator(`${id}:post:102`)).toEqual(removed.locator);
  expect(await repo.listContents(id)).toMatchObject([{ postId: '102', downloaded: true, isRead: true }, { postId: '103', downloaded: true, isRead: true }, { postId: '101', downloaded: true, isRead: true }]);
});

test('stale body/locator/completion/image writes cannot expose or modify unavailable shells', async () => {
  const { a } = await initial(); await remove(); const before = await snapshot();
  await expect(repo.saveLocator(a.locator)).rejects.toThrow('stale reading locator');
  await expect(repo.markChapterRead(cid)).rejects.toThrow('downloaded chapter');
  await expect(repo.replaceChapterContent(cid, a.content)).rejects.toThrow('Unknown chapter');
  await expect(repo.commitImageDiscovery(cid, a.content.contentHash, [])).rejects.toThrow('identity changed');
  await expect(repo.commitImageResults(id, cid, [])).rejects.toThrow('different or unlisted');
  expect(await snapshot()).toEqual(before);
});

test('full deletion removes every child/state/history, preserves other story/settings/fixture, stale mutations cannot recreate, reimport is fresh Unread', async () => {
  const { b } = await initial(); const preferences = await repo.getPreferences(), asset = await repo.getAssetPath(), otherStory = await repo.getStory(otherId);
  await remove('story'); expect(await repo.getStory(id)).toBeNull(); expect((await repo.listStories()).map((s) => s.id)).not.toContain(id);
  for (const table of ['chapters', 'threadmark_entries']) expect(await host.db.getAllAsync(`SELECT * FROM ${table} WHERE story_id = ?`, id)).toEqual([]);
  expect(await repo.getLocator(cid)).toBeNull(); expect(await repo.listChapterImages(cid)).toEqual([]);
  await expect(repo.setEntryRead(id, '101', true)).rejects.toThrow(); await expect(repo.saveLocator(b.locator)).resolves.toBeUndefined();
  await expect(repo.commitDownloadedChapter(id, '101', b.content)).rejects.toThrow('manifest entry');
  await expect(repo.recordUpdateAttempt(id, 1000)).rejects.toThrow('imported story');
  await expect(repo.reconcileManifest(id, metadata, manifest(), 1000)).rejects.toThrow('identity');
  await expect(remove('story')).rejects.toThrow('no longer in the local library'); expect(await repo.getStory(id)).toBeNull();
  expect(await repo.getPreferences()).toEqual(preferences); expect(await repo.getAssetPath()).toBe(asset);
  expect(await repo.getStory(otherId)).toEqual(otherStory); expect(await repo.getChapter(b.locator.chapterId)).not.toBeNull(); expect(await repo.listChapters('fixture:thread:1001')).toHaveLength(3);
  const fake = source(['101', '102']); expect((await importStory(importRootUrl, repo, fake.client, digest)).failure).toBeNull();
  expect(fake.calls.slice(0, 2)).toEqual([importRootUrl, indexUrl]);
  expect(await repo.getStory(id)).toMatchObject({ unread: 2, lastUpdateAttemptAt: null, lastUpdateSuccessAt: null }); expect(await repo.getLocator(cid)).toBeNull();
  expect(await host.db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
});

test('management validates actual source/thread identity and rejects fixture, malformed, missing, and isolated v1 DBs without cleanup', async () => {
  await initial(); const before = await snapshot(), clean = jest.fn(cleanup);
  for (const expected of [{ ...metadata, id: otherId }, { ...metadata, source: 'fixture' as const }, { ...metadata, threadId: '9002' }, { ...metadata, id: 'spacebattles:thread:9999', threadId: '9999' }]) {
    await expect(repo.manageStory(expected, 'story', { cleanup: clean })).rejects.toThrow();
  }
  expect(await snapshot()).toEqual(before); expect(clean).not.toHaveBeenCalled();
  const isolated = hostSqlite(join(folder, 's2a.db'));
  try {
    await migrate(isolated.db, 1); const s2a = createRepository(isolated.db); await s2a.seed(await compileFixture(digest), { relativePath: '', byteLength: 0 });
    const baseline = await isolated.db.getAllAsync('SELECT * FROM chapters');
    await expect(s2a.manageStory(metadata, 'story', { cleanup: clean })).rejects.toThrow(); await migrate(isolated.db, 1);
    expect(await isolated.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 1 }); expect(await isolated.db.getAllAsync('SELECT * FROM chapters')).toEqual(baseline);
  } finally { isolated.close(); }
});

test('ownership blocks removal during import/update/images or local read/locator writes, holds through cleanup + final refresh, deduplicates removal', async () => {
  await initial(); const lease = acquireStory(id);
  await expect(remove()).rejects.toMatchObject({ code: 'busy' }); lease();
  const transaction = host.db.withExclusiveTransactionAsync, held = gate(), started = gate();
  host.db.withExclusiveTransactionAsync = (work) => transaction(async (tx) => { await work(tx); started.release(); await held.promise; });
  const writing = repo.setEntryRead(id, '101', false); await started.promise;
  await expect(remove()).rejects.toMatchObject({ code: 'busy' }); held.release(); await writing; host.db.withExclusiveTransactionAsync = transaction;
  const cleaning = gate(), refreshing = gate(), cleanStarted = gate(), refreshStarted = gate();
  const removing = repo.manageStory(metadata, 'downloads', { cleanup: async () => { cleanStarted.release(); await cleaning.promise; },
    onSettled: async () => { refreshStarted.release(); await refreshing.promise; } });
  await cleanStarted.promise;
  await expect(remove()).rejects.toMatchObject({ code: 'busy' }); await expect(repo.setEntryRead(id, '103', false)).rejects.toMatchObject({ code: 'busy' });
  await expect(repo.markChapterRead(cid)).rejects.toMatchObject({ code: 'busy' });
  const fake = source(); expect((await importStory(importRootUrl, repo, fake.client, digest)).failure?.code).toBe('busy');
  expect((await updateStory(metadata, repo, fake.client, digest)).failure?.code).toBe('busy'); expect((await downloadImages(id, repo, fake.client, digest, images)).failure?.code).toBe('busy'); expect(fake.calls).toEqual([]);
  cleaning.release(); await refreshStarted.promise; await expect(remove()).rejects.toMatchObject({ code: 'busy' }); refreshing.release(); await removing;
  await expect(repo.setEntryRead(id, '103', false)).resolves.toBeUndefined();
});

test('shared reference survives selected-story removal and in-progress generated assets survive targeted cleanup', async () => {
  const { a, b } = await initial();
  const shared = (await repo.listChapterImages(cid))[0]!.file!;
  await repo.commitImageResults(otherId, `${otherId}:post:101`, [{ slot: 0, file: shared }]);
  const staged = await images.stage(png());
  await remove(); expect(files.exists(a.path)).toBe(true); expect(files.exists(b.path)).toBe(true);
  await images.cleanup(() => repo.listSourceAssetReferences(), [staged.file.relativePath]); expect(files.exists(staged.file.relativePath)).toBe(true); staged.release();
});

test('render cleanup scopes exact marked UUID directories, protects active/other/foreign/legacy/S2A renders, and refuses foreign children', async () => {
  const { a, b } = await initial(); const content = createLocalContentFiles(files, digest, async () => png(), uuid);
  const chapter = (await repo.getChapter(cid))!, otherChapter = (await repo.getChapter(b.locator.chapterId))!;
  const target = await content.render(chapter, a.locator, { theme: 'light', fontSize: 20 }, uuid(), null);
  const keep = await content.render(otherChapter, null, { theme: 'light', fontSize: 20 }, uuid(), null);
  const live = await content.render(chapter, null, { theme: 'light', fontSize: 20 }, uuid(), null), release = protectRender(files, live);
  const generation = protectRender(files, live); generation(); generation(); // Nested generation release cannot drop the live owner's protection.
  const foreign = await content.render(chapter, null, { theme: 'light', fontSize: 20 }, uuid(), null); files.write(`${foreign}/foreign.txt`, 'keep');
  const legacy = `reader/${uuid()}`; files.mkdir(legacy); files.write(`${legacy}/index.html`, 'legacy');
  files.mkdir('stowaway-s2a/reader/keep'); files.write('stowaway-s2a/reader/keep/index.html', 'S2A');
  await remove(); expect(files.exists(target)).toBe(false);
  for (const path of [keep, live, foreign, legacy, 'stowaway-s2a/reader/keep/index.html']) expect(files.exists(path)).toBe(true);
  release(); await cleanupStoryRenders(files, id); expect(files.exists(live)).toBe(false);
});

test.each(['update', 'images'] as const)('%s ownership includes final authoritative settlement reads', async (kind) => {
  await initial(); const fake = source(), entered = gate(), held = gate();
  const onSettled = async () => { entered.release(); await held.promise; };
  const operation = kind === 'update' ? updateStory(metadata, repo, fake.client, digest, { onSettled }) :
    downloadImages(id, repo, fake.client, digest, images, { onSettled });
  await entered.promise;
  await expect(remove()).rejects.toMatchObject({ code: 'busy' });
  await expect(repo.setEntryRead(id, '101', false)).rejects.toMatchObject({ code: 'busy' });
  held.release(); expect((await operation).failure).toBeNull(); await expect(remove()).resolves.toEqual({ warning: null });
});

test('queued destructive call captures identity immediately; mutating the original object cannot redirect deletion to another story', async () => {
  await initial(); const transaction = host.db.withExclusiveTransactionAsync, held = gate(), entered = gate();
  host.db.withExclusiveTransactionAsync = (work) => transaction(async (tx) => { await work(tx); entered.release(); await held.promise; });
  const settings = repo.savePreferences({ theme: 'light', fontSize: 20 }); await entered.promise;
  const selected = { ...metadata };
  const removing = repo.manageStory(selected, 'story', { cleanup });
  Object.assign(selected, other); held.release(); await settings; await removing;
  expect(await repo.getStory(id)).toBeNull(); expect(await repo.getStory(otherId)).not.toBeNull(); expect(await repo.getChapter(`${otherId}:post:101`)).not.toBeNull();
});

test('failed body repopulation rolls back availability/discovery and preserves exact retained locator/read state; explicit retry succeeds', async () => {
  const { a } = await initial(); await remove(); const before = await snapshot(); host.failNextCommit();
  const failed = source(); expect((await importStory(importRootUrl, repo, failed.client, digest)).failure?.code).toBe('storage');
  expect(await snapshot()).toEqual(before); expect(await repo.getChapter(cid)).toBeNull(); expect(await repo.getLocator(cid)).toEqual(a.locator);
  const retry = source(); expect((await importStory(importRootUrl, repo, retry.client, digest)).failure).toBeNull(); expect(await repo.getChapter(cid)).not.toBeNull();
  expect(await repo.getLocator(cid)).toEqual(a.locator); expect(await repo.getStory(id)).toMatchObject({ unread: 0 });
});

test.each(['downloads', 'story'] as const)('%s partial cleanup failure cannot roll back logical removal or restore references to already-deleted files', async (action) => {
  const { a, b, removed } = await initial(); const removeFile = files.remove;
  files.remove = (path) => { if (path === removed.path) throw new Error('Second file cleanup failed'); removeFile(path); };
  expect(await remove(action)).toEqual({ warning: CLEANUP_WARNING });
  expect(files.exists(a.path)).toBe(false); expect(files.exists(removed.path)).toBe(true); expect(files.exists(b.path)).toBe(true);
  expect(await repo.getChapter(cid)).toBeNull(); expect(await repo.listSourceAssetReferences()).toEqual([b.path]);
});

test('render-marker I/O failure surfaces cleanup warning after logical removal, while unreadable output is safely retained', async () => {
  const { a } = await initial(); const chapter = (await repo.getChapter(cid))!;
  const content = createLocalContentFiles(files, digest, async () => png(), uuid);
  const directory = await content.render(chapter, a.locator, { theme: 'light', fontSize: 20 }, uuid(), null);
  const read = files.read; files.read = async (path) => { if (path.endsWith('/owner.json')) throw new Error('Injected read failure'); return read(path); };
  expect(await remove()).toEqual({ warning: CLEANUP_WARNING }); expect(await repo.getChapter(cid)).toBeNull(); expect(files.exists(directory)).toBe(true);
  files.read = read; await cleanupStoryRenders(files, id); expect(files.exists(directory)).toBe(false);
});
