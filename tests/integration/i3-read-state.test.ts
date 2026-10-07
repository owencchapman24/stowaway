import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { migrate } from '../../src/storage/migrations';
import { compileFixture, createRepository } from '../../src/storage/repository';
import { prepareContent } from '../../src/content/sanitize';
import { importStory, updateStory } from '../../src/importing/import-story';
import { RequestClient } from '../../src/sources/spacebattles/request';
import { downloadImages } from '../../src/images/download';
import { createSourceImageFiles } from '../../src/images/files';
import { createLocalContentFiles } from '../../src/storage/local-files';
import { hostSqlite } from './host-sqlite';
import { hostFiles } from './host-files';
import { bodyArticle, importRootUrl, storyHeader } from '../fixtures/import';
import { index, indexUrl, page, row, tabs } from '../fixtures/spacebattles';
import { png } from '../fixtures/images';
import type { StoryMetadata } from '../../src/domain/types';
import type { SqlValue } from '../../src/storage/database';

const digest = async (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const id = 'spacebattles:thread:9001';
const metadata: StoryMetadata = { id, source: 'spacebattles', threadId: '9001', title: 'Generated I3',
  author: null, sourceUrl: importRootUrl, categoryId: '9' };
const url = (post: string) => `https://forums.spacebattles.com/posts/${post}/`;
const manifest = (posts = ['101', '102', '103'], renamed = false) => ({ state: 'COMPLETE' as const,
  entries: posts.map((postId) => ({ postId, title: `${renamed ? 'Renamed' : 'Generated'} ${postId}`, url: url(postId) })) });
const asset = { relativePath: 'assets/11111111-1111-4111-8111-111111111111.png', byteLength: 2024 };
let folder: string, host: ReturnType<typeof hostSqlite>, repo: ReturnType<typeof createRepository>;
beforeEach(async () => {
  folder = mkdtempSync(join(tmpdir(), 'stowaway-i3-')); host = hostSqlite(join(folder, 'test.db'));
  await migrate(host.db); repo = createRepository(host.db);
});
afterEach(() => {
  jest.restoreAllMocks(); host.close(); const target = resolve(folder);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('stowaway-i3-')) throw new Error('Unexpected test root.');
  rmSync(target, { recursive: true, force: true });
});
async function initial(downloaded = ['101', '102']) {
  await repo.commitInitialManifest(metadata, manifest());
  for (const post of downloaded) await repo.commitDownloadedChapter(id, post, await prepareContent(`<p>Synthetic ${post}.</p>`, digest));
}
async function states() { return host.db.getAllAsync('SELECT story_id, post_id, is_read FROM threadmark_entries ORDER BY story_id, post_id'); }
async function preserved() {
  return { stories: await host.db.getAllAsync('SELECT * FROM stories ORDER BY id'),
    chapters: await host.db.getAllAsync('SELECT * FROM chapters ORDER BY id'),
    images: await host.db.getAllAsync('SELECT * FROM chapter_images ORDER BY chapter_id, slot'),
    positions: await host.db.getAllAsync('SELECT * FROM reading_positions ORDER BY chapter_id'),
    settings: await host.db.getAllAsync('SELECT * FROM settings'), assets: await host.db.getAllAsync('SELECT * FROM assets') };
}
function source(posts = ['101', '102', '103'], options: { incomplete?: boolean; blocked?: boolean; image?: boolean } = {}) {
  const calls: string[] = []; let time = 0;
  const client = new RequestClient(async (request) => {
    calls.push(request);
    const post = /\/posts\/(\d+)\//.exec(request)?.[1];
    const html = request === importRootUrl ? page(storyHeader + tabs) : request === indexUrl ?
      index(posts.map((p) => row(p).replace(/href="[^"]*"/, `href="${url(p)}"`)).join(''), { expected: posts.length + Number(!!options.incomplete) }) :
      post ? page(bodyArticle(post, `<p>Synthetic ${post}.</p>${options.image ? '<img src="/attachments/i3.png" alt="Synthetic">' : ''}`)) : '';
    return { status: options.blocked ? 403 : 200, url: request, bodyUsed: true,
      headers: { get: (name) => name === 'content-type' ? (html ? 'text/html' : 'image/png') : null },
      text: async () => html, arrayBuffer: async () => new Uint8Array(png()).buffer };
  }, { now: () => time, sleep: async (ms) => { time += ms; } });
  return { client, calls };
}

test('populated v4 -> v5 adds only Unread, preserving every field/reference; failed migration rolls back and retry is idempotent', async () => {
  host.close(); host = hostSqlite(join(folder, 'v4.db')); await migrate(host.db, 4); repo = createRepository(host.db);
  await repo.seed(await compileFixture(digest), asset); await initial();
  const body = (await repo.getChapter(`${id}:post:101`))!;
  await repo.saveLocator({ chapterId: body.id, contentHash: body.contentHash, blockId: body.blockIds[0]!, offset: 7, progression: 1, expandedSpoilers: [] });
  await repo.savePreferences({ theme: 'dark', fontSize: 26 }); await repo.recordUpdateAttempt(id, 123);
  await repo.reconcileManifest(id, metadata, manifest(['102', '103']), 456);
  await host.db.runAsync("UPDATE chapters SET image_discovery = 'scanned' WHERE id = ?", body.id);
  await host.db.runAsync(`INSERT INTO chapter_images(chapter_id, slot, block_id, source_url, alt, state, relative_path, format, byte_length, width, height, digest)
    VALUES (?, 0, ?, ?, 'Synthetic', 'downloaded', 'source-assets/22222222-2222-4222-8222-222222222222.png', 'png', 100, 10, 10, 'digest')`, body.id, body.blockIds[0]!, 'https://forums.spacebattles.com/attachments/i3.png');
  const old = await preserved(), entries = await host.db.getAllAsync('SELECT * FROM threadmark_entries ORDER BY story_id, post_id');
  host.failNextCommit(); await expect(migrate(host.db, 5)).rejects.toThrow('commit failure');
  expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 4 });
  expect(await preserved()).toEqual(old); expect(await host.db.getAllAsync('SELECT * FROM threadmark_entries ORDER BY story_id, post_id')).toEqual(entries);
  await migrate(host.db, 5); await migrate(host.db, 5);
  await host.db.getFirstAsync('SELECT is_read FROM threadmark_entries LIMIT 1'); // Refresh host schema metadata after DDL.
  expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 5 });
  expect(await preserved()).toEqual(old);
  expect(await host.db.getAllAsync('SELECT * FROM threadmark_entries ORDER BY story_id, post_id')).toEqual(entries.map((e) => ({ ...(e as object), is_read: 0 })));
  expect(await repo.listSavedUnlisted(id)).toMatchObject([{ postId: '101', isRead: false }]);
  await expect(host.db.runAsync('UPDATE threadmark_entries SET is_read = 2')).rejects.toThrow('CHECK');
  await expect(host.db.runAsync('UPDATE threadmark_entries SET is_read = NULL')).rejects.toThrow('NOT NULL');
  expect(await host.db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
});
test.each([0, 1, 2, 3, 4])('fresh/v%s -> latest retains fixture passage/settings/asset and initializes all entries Unread', async (version) => {
  host.close(); host = hostSqlite(join(folder, 'path.db'));
  if (version) {
    await migrate(host.db, version); repo = createRepository(host.db); await repo.seed(await compileFixture(digest), asset);
    await repo.savePreferences({ theme: 'dark', fontSize: 24 });
    const body = (await repo.listChapters())[0]!;
    const chapter = (await repo.getChapter(body.id))!;
    await repo.saveLocator({ chapterId: body.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[0]!, offset: 4, progression: 1, expandedSpoilers: [] });
  }
  const positions = await host.db.getAllAsync("SELECT name FROM sqlite_master WHERE name = 'reading_positions'");
  const old = positions.length ? await host.db.getAllAsync('SELECT * FROM reading_positions') : [];
  await migrate(host.db); repo = createRepository(host.db);
  expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 6 });
  expect(await host.db.getAllAsync('SELECT * FROM reading_positions')).toEqual(old);
  expect((await states()).every((e) => (e as { is_read: number }).is_read === 0)).toBe(true);
  if (version) { expect(await repo.getPreferences()).toEqual({ theme: 'dark', fontSize: 24 }); expect(await repo.getAssetPath()).toBe(asset.relativePath); expect(await repo.listContents('fixture:thread:1001')).toHaveLength(3); }
});
test('S2A v1 keeps no manifest/read schema and uses its existing reader APIs only', async () => {
  host.close(); host = hostSqlite(join(folder, 's2a.db')); await migrate(host.db, 1); repo = createRepository(host.db);
  await repo.seed(await compileFixture(digest), asset); await migrate(host.db, 1);
  expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 1 });
  expect(await host.db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'threadmark_entries'")).toBeNull();
  expect(await repo.listChapters()).toHaveLength(3); expect(await repo.listChapterImages('anything')).toEqual([]);
});
test('new manifest is Unread before bodies; body commits and duplicate import never reset corrections', async () => {
  await repo.commitInitialManifest(metadata, manifest());
  expect(await repo.getStory(id)).toMatchObject({ total: 3, downloaded: 0, unread: 3 });
  expect((await repo.listContents(id)).map((e) => [e.downloaded, e.isRead])).toEqual([[false, false], [false, false], [false, false]]);
  await repo.setEntryRead(id, '101', true); await initial();
  expect(await repo.listContents(id)).toMatchObject([{ postId: '101', isRead: true }, { postId: '102', isRead: false }, { postId: '103', isRead: false }]);
  const fake = source(); await importStory(importRootUrl, repo, fake.client, digest);
  const complete = await states(); const duplicate = source([]); await importStory(importRootUrl, repo, duplicate.client, digest);
  expect(duplicate.calls).toEqual([]); expect(await states()).toEqual(complete); expect(await repo.getStory(id)).toMatchObject({ unread: 2 });
});
test('cancel/resume import preserves corrections including pending text, across close/reopen', async () => {
  const fake = source(), abort = new AbortController();
  const result = await importStory(importRootUrl, repo, fake.client, digest, { signal: abort.signal, onProgress(p) { if (p.phase === 'downloading' && p.downloaded === 1) abort.abort(); } });
  expect(result.failure?.code).toBe('cancelled'); await repo.setEntryRead(id, '103', true);
  host.close(); host = hostSqlite(join(folder, 'test.db')); await migrate(host.db); repo = createRepository(host.db);
  const next = source(); expect((await importStory(importRootUrl, repo, next.client, digest)).failure).toBeNull();
  expect(next.calls).toEqual([url('102'), url('103')]); expect(await repo.getStory(id)).toMatchObject({ downloaded: 3, unread: 2 });
  expect((await repo.listContents(id))[2]).toMatchObject({ postId: '103', isRead: true });
});
test('current-only totals include pending and exclude saved-unlisted; reappearance restores prior states', async () => {
  await initial(); await repo.setEntryRead(id, '102', true);
  expect(await repo.getStory(id)).toMatchObject({ total: 3, downloaded: 2, unread: 2 });
  await repo.reconcileManifest(id, metadata, manifest(['102']), 1);
  expect(await repo.listSavedUnlisted(id)).toMatchObject([{ postId: '101', isRead: false }]);
  expect(await repo.listStories()).toMatchObject([{ unread: 0 }]);
  await repo.reconcileManifest(id, metadata, manifest(), 2);
  expect(await repo.getStory(id)).toMatchObject({ unread: 2 });
});
test.each(['current', 'pending', 'saved'] as const)('%s manual corrections persist, repeat idempotently and preserve all non-read state', async (kind) => {
  await initial(); if (kind === 'saved') await repo.reconcileManifest(id, metadata, manifest(['102', '103']), 1);
  const post = kind === 'pending' ? '103' : '101', old = await preserved();
  for (const value of [true, true, false, false, true]) await repo.setEntryRead(id, post, value);
  expect(await host.db.getFirstAsync('SELECT is_read FROM threadmark_entries WHERE story_id = ? AND post_id = ?', id, post)).toEqual({ is_read: 1 });
  expect(await preserved()).toEqual(old);
  host.close(); host = hostSqlite(join(folder, 'test.db')); repo = createRepository(host.db);
  expect((await host.db.getFirstAsync<{ is_read: number }>('SELECT is_read FROM threadmark_entries WHERE story_id = ? AND post_id = ?', id, post))?.is_read).toBe(1);
});
test('manual/automatic storage failures roll back Read without corrupting locator/text; queue and retry remain usable', async () => {
  await initial(); const old = await preserved();
  for (const save of [() => repo.setEntryRead(id, '101', true), () => repo.markChapterRead(`${id}:post:101`)]) {
    host.failNextCommit(); await expect(save()).rejects.toThrow('commit failure');
    expect((await repo.listContents(id))[0]?.isRead).toBe(false); expect(await preserved()).toEqual(old);
  }
  await repo.markChapterRead(`${id}:post:101`); await repo.markChapterRead(`${id}:post:101`);
  expect((await repo.listContents(id))[0]?.isRead).toBe(true);
});
test('story/post writes and chapter lookup cannot affect another story or an unknown entry', async () => {
  await initial(); const other = { ...metadata, id: 'spacebattles:thread:9002', threadId: '9002', sourceUrl: 'https://forums.spacebattles.com/threads/9002/' };
  await repo.commitInitialManifest(other, manifest()); await repo.setEntryRead(id, '101', true);
  expect(await repo.getStory(other.id)).toMatchObject({ unread: 3 });
  await expect(repo.setEntryRead('unknown', '101', true)).rejects.toThrow('stored manifest');
  await expect(repo.setEntryRead(id, '999', true)).rejects.toThrow('stored manifest');
  await expect(repo.markChapterRead(`${id}:post:103`)).rejects.toThrow('downloaded chapter');
  await expect(repo.markChapterRead(`${id}:post:101:other`)).rejects.toThrow('downloaded chapter');
  await expect(repo.setEntryRead(id, '101', 1 as unknown as boolean)).rejects.toThrow('Invalid');
  expect(await repo.getStory(id)).toMatchObject({ unread: 2 });
});
test.each(['unchanged', 'rename', 'reorder', 'append', 'insertion'] as const)('%s COMPLETE reconciliation preserves old state and initializes only new IDs Unread', async (kind) => {
  await initial(); await repo.setEntryRead(id, '101', true); await repo.setEntryRead(id, '103', true);
  const posts = kind === 'reorder' ? ['103', '102', '101'] : kind === 'append' ? ['101', '102', '103', '104'] : kind === 'insertion' ? ['101', '104', '102', '103'] : ['101', '102', '103'];
  await repo.reconcileManifest(id, metadata, manifest(posts, kind === 'rename'), 1);
  expect((await repo.listContents(id)).map((e) => [e.postId, e.isRead])).toEqual(posts.map((post) => [post, post === '101' || post === '103']));
  expect(await repo.getStory(id)).toMatchObject({ unread: posts.length - 2 });
});
test.each([true, false])('removal/reappearance preserves %s downloaded and undownloaded Read/Unread exactly', async (read) => {
  await initial(); await repo.setEntryRead(id, '101', read); await repo.setEntryRead(id, '103', read);
  const old = await states(); await repo.reconcileManifest(id, metadata, manifest(['102']), 1); expect(await states()).toEqual(old);
  await repo.reconcileManifest(id, metadata, manifest(), 2); expect(await states()).toEqual(old);
  expect(await repo.getStory(id)).toMatchObject({ unread: read ? 1 : 3 });
});
test.each(['incomplete', 'blocked', 'cancelled', 'transaction-failure'] as const)('%s update cannot partially insert/reset Read state', async (kind) => {
  await initial(); await repo.setEntryRead(id, '101', true); await repo.setEntryRead(id, '103', true); const old = await states();
  const fake = source(['102', '104'], { incomplete: kind === 'incomplete', blocked: kind === 'blocked' }), abort = new AbortController();
  const result = await updateStory(metadata, repo, fake.client, digest, { signal: abort.signal, onProgress(p) {
    if (p.phase === 'reconciling') { if (kind === 'cancelled') abort.abort(); if (kind === 'transaction-failure') host.failNextCommit(); }
  } });
  expect(result.failure).not.toBeNull(); expect(await states()).toEqual(old);
});
test('cancellation during entry upsert rolls back temporary unlisting, inserted rows and prior read flags', async () => {
  await initial(); await repo.setEntryRead(id, '101', true); const old = await states(), abort = new AbortController();
  const transaction = host.db.withExclusiveTransactionAsync.bind(host.db);
  jest.spyOn(host.db, 'withExclusiveTransactionAsync').mockImplementationOnce((work) => transaction(async (tx) => work({ ...tx,
    async runAsync(sql: string, ...params: SqlValue[]) { const value = await tx.runAsync(sql, ...params); if (sql.startsWith('INSERT INTO threadmark_entries')) abort.abort(); return value; } })));
  await expect(repo.reconcileManifest(id, metadata, manifest(['104', '101']), 1, abort.signal)).rejects.toThrow('cancelled');
  expect(await states()).toEqual(old); expect(await repo.getStory(id)).toMatchObject({ total: 3, unread: 2 });
});
test('I2 discovery/download/repair, local render regeneration and saved-unlisted images leave Read/locator/text unchanged', async () => {
  let count = 0; const uuid = () => `22222222-2222-4222-8222-${String(++count).padStart(12, '0')}`;
  const files = hostFiles(join(folder, 'documents')), images = createSourceImageFiles(files, digest, uuid), fake = source(['101'], { image: true });
  // A v4-style body has no descriptors yet. Correct progress before discovery.
  await repo.commitInitialManifest(metadata, manifest(['101']));
  await repo.commitDownloadedChapter(id, '101', await prepareContent('<div><p>Synthetic 101.</p><img src="/attachments/i3.png" alt="Synthetic"></div>', digest));
  await repo.setEntryRead(id, '101', true);
  const old = await states(), body = (await repo.getChapter(`${id}:post:101`))!;
  const locator = { chapterId: body.id, contentHash: body.contentHash, blockId: body.blockIds[0]!, offset: 0, progression: .5, expandedSpoilers: [] };
  await repo.saveLocator(locator); await downloadImages(id, repo, fake.client, digest, images);
  expect(await repo.getImageSummary(id)).toMatchObject({ unknown: 0, scanned: 1, local: 1 });
  expect(fake.calls).toEqual([url('101'), 'https://forums.spacebattles.com/attachments/i3.png']);
  const reference = (await repo.listChapterImages(body.id))[0]!.file!; await files.remove(reference.relativePath);
  await downloadImages(id, repo, fake.client, digest, images); expect(await states()).toEqual(old);
  await repo.reconcileManifest(id, metadata, manifest(['102']), 1);
  const local = createLocalContentFiles(files, digest, () => Promise.reject(new Error('No bundle access')), uuid);
  await local.render(body, locator, { theme: 'dark', fontSize: 26 }, uuid(), null, await repo.listChapterImages(body.id));
  expect(await states()).toEqual([...old, { story_id: id, post_id: '102', is_read: 0 }]);
  expect(await repo.listSavedUnlisted(id)).toMatchObject([{ isRead: true }]);
  expect(await repo.getChapter(body.id)).toEqual(body); expect(await repo.getLocator(body.id)).toEqual(locator);
});
test.each(['committed', 'uncommitted'] as const)('abrupt host-process exit with %s state preserves the last completed Read write', async (kind) => {
  await initial(); await repo.setEntryRead(id, '101', true); host.close();
  const path = join(folder, 'test.db');
  execFileSync(process.execPath, ['--no-warnings', '-e', `const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(process.argv[1]); db.exec('BEGIN'); db.prepare('UPDATE threadmark_entries SET is_read = 0 WHERE story_id = ? AND post_id = ?').run(process.argv[2], '101'); if (process.argv[3] === 'committed') db.exec('COMMIT'); process.exit(0);`, path, id, kind]);
  host = hostSqlite(path); await migrate(host.db); repo = createRepository(host.db);
  expect((await repo.listContents(id))[0]?.isRead).toBe(kind !== 'committed');
});
test('1,000-entry current totals remain correct across read, saved-unlisted, inserted and reappearing entries without source access', async () => {
  const posts = Array.from({ length: 1000 }, (_, i) => String(1001 + i)); await repo.commitInitialManifest(metadata, manifest(posts));
  for (const post of posts.slice(0, 400)) await repo.setEntryRead(id, post, true);
  expect(await repo.getStory(id)).toMatchObject({ unread: 600, downloaded: 0 });
  const next = [...posts.slice(100, 900), '3000']; await repo.reconcileManifest(id, metadata, manifest(next), 1);
  expect(await repo.getStory(id)).toMatchObject({ total: 801, unread: 501 });
  await repo.reconcileManifest(id, metadata, manifest([...next, '1001', '2000']), 2);
  expect(await repo.getStory(id)).toMatchObject({ total: 803, unread: 502 });
});
