import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hostSqlite } from './host-sqlite';
import { migrate } from '../../src/storage/migrations';
import { createRepository, compileFixture } from '../../src/storage/repository';
import { importStory, updateStory } from '../../src/importing/import-story';
import { prepareContent } from '../../src/content/sanitize';
import { RequestClient, type Transport } from '../../src/sources/spacebattles/request';
import type { SqlValue } from '../../src/storage/database';
import type { StoryMetadata } from '../../src/domain/types';
import { bodyArticle, importRootUrl, storyHeader } from '../fixtures/import';
import { index, indexUrl, page, row, tabs, threadUrl } from '../fixtures/spacebattles';

const digest = async (value: string) => createHash('sha256').update(value).digest('hex');
const id = 'spacebattles:thread:9001';
const metadata: StoryMetadata = { id, source: 'spacebattles', threadId: '9001',
  title: 'The Synthetic Orchard & Sea', author: 'Generated Author', sourceUrl: importRootUrl, categoryId: '9' };
const asset = { relativePath: 'assets/11111111-1111-4111-8111-111111111111.png', byteLength: 2024 };
const postUrl = (post: string) => `https://forums.spacebattles.com/posts/${post}/`;
const title = (post: string) => `Original synthetic entry ${post}`;
const manifest = (posts: string[], titles: Record<string, string> = {}) => ({ state: 'COMPLETE' as const,
  entries: posts.map((postId) => ({ postId, title: titles[postId] ?? title(postId), url: postUrl(postId) })) });
function documents(posts: string[], titles: Record<string, string> = {}) {
  return new Map([
    [importRootUrl, page(storyHeader + tabs)],
    [indexUrl, index(posts.map((post) => row(post).replace(`${threadUrl}#post-${post}`, postUrl(post))
      .replace(title(post), titles[post] ?? title(post))).join(''), { expected: posts.length })],
    ...posts.map((post): [string, string] => [postUrl(post), page(bodyArticle(post, `<p>Generated body ${post}.</p>`))]),
  ]);
}
function source(docs: Map<string, string>, status = 200) {
  const requests: string[] = []; let time = 0;
  const transport: Transport = async (url, init) => {
    expect(init.credentials).toBe('omit'); requests.push(url);
    const html = docs.get(url);
    if (html === undefined) throw new Error('Unmapped generated document.');
    return { status, url, bodyUsed: true, headers: { get: () => null }, text: async () => html };
  };
  return { requests, client: new RequestClient(transport, { now: () => time, sleep: async (ms) => { time += ms; } }) };
}
let folder: string;
let host: ReturnType<typeof hostSqlite>;
let repo: ReturnType<typeof createRepository>;
beforeEach(async () => {
  folder = mkdtempSync(join(tmpdir(), 'stowaway-i1-'));
  host = hostSqlite(join(folder, 'test.db')); await migrate(host.db); repo = createRepository(host.db);
});
afterEach(() => {
  jest.restoreAllMocks(); host.close();
  if (!folder.startsWith(join(tmpdir(), 'stowaway-i1-'))) throw new Error('Unexpected test directory.');
  rmSync(folder, { recursive: true, force: true });
});
async function initial(downloaded = ['101', '102', '103'], posts = ['101', '102', '103']) {
  await repo.commitInitialManifest(metadata, manifest(posts));
  for (const post of downloaded) {
    await repo.commitDownloadedChapter(id, post, await prepareContent(`<p>Saved original ${post}.</p><details><summary>Generated spoiler</summary><p>Generated disclosure.</p></details>`, digest));
  }
  if (downloaded.includes('101')) {
    const chapter = (await repo.getChapter(`${id}:post:101`))!;
    await repo.saveLocator({ chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[0]!,
      offset: 9, progression: .3, expandedSpoilers: [chapter.blockIds[1]!] });
  }
}
async function retained() {
  return { bodies: await host.db.getAllAsync(`SELECT id, story_id, post_id, html, content_hash, sanitizer_version,
    block_ids, links FROM chapters ORDER BY id`), positions: await host.db.getAllAsync('SELECT * FROM reading_positions ORDER BY chapter_id') };
}
async function state() {
  const story = await repo.getStory(id);
  return { entries: await host.db.getAllAsync('SELECT * FROM threadmark_entries ORDER BY story_id, post_id'),
    chapterMetadata: await host.db.getAllAsync('SELECT id, title, position FROM chapters ORDER BY id'),
    bodies: await retained(), story: story && { ...story, lastUpdateAttemptAt: null } };
}
async function check(posts: string[], titles: Record<string, string> = {}, at = 200) {
  const fake = source(documents(posts, titles));
  const result = await updateStory(metadata, repo, fake.client, digest, { now: () => at });
  return { ...fake, result };
}

test('v2 -> v3 preserves stories, manifests, bodies, locators, preferences and bundled asset; rebuild rolls back on failure', async () => {
  host.close(); host = hostSqlite(join(folder, 'legacy.db')); await migrate(host.db, 2); repo = createRepository(host.db);
  const fixture = await compileFixture(digest); await repo.seed(fixture, asset);
  await repo.commitInitialManifest(metadata, manifest(['101', '102']));
  const chapter = fixture.chapters[0]!;
  await host.db.runAsync(`INSERT INTO chapters SELECT ?, ?, ?, title, position, html, content_hash,
    sanitizer_version, block_ids, links FROM chapters WHERE id = ?`, `${id}:post:101`, id, '101', chapter.id);
  await repo.saveLocator({ chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[2]!, offset: 22,
    progression: .4, expandedSpoilers: [] });
  await repo.savePreferences({ theme: 'dark', fontSize: 26 });
  const old = { stories: await host.db.getAllAsync('SELECT * FROM stories ORDER BY id'),
    entries: await host.db.getAllAsync('SELECT * FROM threadmark_entries ORDER BY story_id, post_id'),
    chapters: await host.db.getAllAsync('SELECT * FROM chapters ORDER BY id'),
    retained: await retained(), settings: await host.db.getAllAsync('SELECT * FROM settings'), assets: await host.db.getAllAsync('SELECT * FROM assets') };
  host.failNextCommit(); await expect(migrate(host.db, 3)).rejects.toThrow('Injected commit failure');
  expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 2 });
  expect(await host.db.getAllAsync('SELECT * FROM threadmark_entries ORDER BY story_id, post_id')).toEqual(old.entries);
  await migrate(host.db, 3); await migrate(host.db, 3);
  expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 3 });
  // Explicit columns refresh the host connection's schema after external DDL;
  // Node SQLite captures SELECT * column names before SQLite's step/reprepare.
  expect(await host.db.getFirstAsync('SELECT last_update_attempt_at, last_update_success_at FROM stories LIMIT 1'))
    .toEqual({ last_update_attempt_at: null, last_update_success_at: null });
  expect(await host.db.getAllAsync('SELECT * FROM stories ORDER BY id')).toEqual(old.stories.map((s) => ({ ...(s as object), last_update_attempt_at: null, last_update_success_at: null })));
  expect(await host.db.getAllAsync('SELECT * FROM threadmark_entries ORDER BY story_id, post_id')).toEqual(old.entries.map((e) => ({ ...(e as object), currently_listed: 1 })));
  expect(await retained()).toEqual(old.retained);
  expect(await host.db.getAllAsync('SELECT * FROM chapters ORDER BY id')).toEqual(old.chapters);
  expect(await host.db.getAllAsync('SELECT * FROM settings')).toEqual(old.settings);
  expect(await host.db.getAllAsync('SELECT * FROM assets')).toEqual(old.assets);
  expect(await repo.getChapterAssetPath(chapter.id)).toBe(asset.relativePath);
  expect(await repo.getStory(id)).toMatchObject({ total: 2, downloaded: 1 });
  expect(await host.db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
  expect(await host.db.getAllAsync<{ table: string }>('PRAGMA foreign_key_list(reading_positions)')).toMatchObject([{ table: 'chapters' }]);
});

test.each([0, 1, 2])('fresh / v%s path reaches v3 without resetting data', async (version) => {
  host.close(); host = hostSqlite(join(folder, 'path.db'));
  if (version) await migrate(host.db, version);
  await migrate(host.db, 3);
  expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 3 });
  expect(await host.db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
});

test('S2A explicit v1 stays isolated without creating a manifest or migrating data', async () => {
  host.close(); host = hostSqlite(join(folder, 's2a.db')); await migrate(host.db, 1);
  repo = createRepository(host.db); const fixture = await compileFixture(digest); await repo.seed(fixture, asset);
  const before = await retained(); await migrate(host.db, 1);
  expect(await retained()).toEqual(before);
  expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 1 });
  expect(await host.db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'threadmark_entries'")).toBeNull();
  expect(await repo.listChapters(fixture.id)).toHaveLength(3);
});

test('identical COMPLETE check and repeat are idempotent, advance timestamps and make no body request/write', async () => {
  await initial(); const old = await retained();
  const sql: string[] = [];
  const original = host.db.withExclusiveTransactionAsync.bind(host.db);
  jest.spyOn(host.db, 'withExclusiveTransactionAsync').mockImplementation((work) => original(async (tx) => {
    await work({ ...tx, async runAsync(statement, ...params) { sql.push(statement); return tx.runAsync(statement, ...params); } });
  }));
  const first = await check(['101', '102', '103'], {}, 200);
  const second = await check(['101', '102', '103'], {}, 300);
  expect(first.result.failure).toBeNull(); expect(second.result.failure).toBeNull();
  expect(second.result.reconciliation).toEqual({ added: 0, reactivated: 0, removed: 0, renamed: 0, orderChanged: false,
    metadataChanged: false, total: 3, downloaded: 3, pending: 0 });
  expect(first.requests).toEqual([importRootUrl, indexUrl]); expect(second.requests).toEqual(first.requests);
  expect(await retained()).toEqual(old); expect(await repo.listContents(id)).toHaveLength(3);
  expect(await repo.getStory(id)).toMatchObject({ lastUpdateAttemptAt: 300, lastUpdateSuccessAt: 300 });
  expect(sql.some((s) => /INSERT INTO chapters|SET html|SET content_hash/.test(s))).toBe(false);
  // Ordinary duplicate Add Story still makes zero source calls, rather than checking updates.
  const duplicate = source(new Map()); expect((await importStory(importRootUrl, repo, duplicate.client, digest)).failure).toBeNull();
  expect(duplicate.requests).toEqual([]);
});

test.each([
  ['append', ['101', '102', '103', '104']],
  ['middle insertion', ['101', '104', '102', '103']],
] as const)('%s fetches only new text; identity and reading state survive', async (_label, posts) => {
  await initial(); const old = await retained(); const checked = await check([...posts]);
  expect(checked.result.failure).toBeNull(); expect(checked.result.reconciliation).toMatchObject({ added: 1, removed: 0, orderChanged: false });
  expect(checked.requests).toEqual([importRootUrl, indexUrl, postUrl('104')]);
  expect((await repo.listContents(id)).map((e) => e.postId)).toEqual(posts);
  expect((await repo.listChapters(id)).map((e) => e.id)).toEqual(posts.map((post) => `${id}:post:${post}`));
  const after = await retained(); expect(after.bodies.slice(0, 3)).toEqual(old.bodies); expect(after.positions).toEqual(old.positions);
  expect(await repo.getStory(id)).toMatchObject({ total: 4, downloaded: 4 });
});

test('rename/reorder refreshes reader metadata and current navigation without body/hash/locator changes', async () => {
  await initial(); const old = await retained();
  const checked = await check(['103', '101', '102'], { '101': 'Renamed generated first' });
  expect(checked.result.reconciliation).toMatchObject({ renamed: 1, orderChanged: true });
  expect(checked.requests).toEqual([importRootUrl, indexUrl]); expect(await retained()).toEqual(old);
  expect(await repo.getChapter(`${id}:post:101`)).toMatchObject({ title: 'Renamed generated first', position: 1 });
  // Navigation must ignore chapters.position, even if another caller leaves it stale.
  await host.db.runAsync('UPDATE chapters SET position = 100 - position');
  expect((await repo.listChapters(id)).map((c) => c.id)).toEqual(['103', '101', '102'].map((post) => `${id}:post:${post}`));
});

test.each(['rename', 'reorder'] as const)('%s alone updates only metadata and current source ordering', async (kind) => {
  await initial(); const old = await retained();
  const posts = kind === 'rename' ? ['101', '102', '103'] : ['102', '103', '101'];
  const checked = await check(posts, kind === 'rename' ? { '101': 'Rename only' } : {});
  expect(checked.result.reconciliation).toMatchObject({ added: 0, removed: 0,
    renamed: kind === 'rename' ? 1 : 0, orderChanged: kind === 'reorder' });
  expect(checked.requests).toEqual([importRootUrl, indexUrl]); expect(await retained()).toEqual(old);
  expect((await repo.listContents(id)).map((entry) => entry.postId)).toEqual(posts);
  expect((await repo.listChapters(id)).map((entry) => entry.id)).toEqual(posts.map((post) => `${id}:post:${post}`));
});

test('downloaded removal is saved/readable, leaves locator intact and frees its old position for a current entry', async () => {
  await initial(); const old = await retained(); const checked = await check(['102', '103']);
  expect(checked.result.reconciliation).toMatchObject({ removed: 1, total: 2, downloaded: 2 });
  expect(checked.requests).toEqual([importRootUrl, indexUrl]); expect(await retained()).toEqual(old);
  expect(await repo.getStory(id)).toMatchObject({ total: 2, downloaded: 2 });
  expect(await repo.listSavedUnlisted(id)).toMatchObject([{ postId: '101', downloaded: true }]);
  expect((await repo.listChapters(id)).map((c) => c.id)).toEqual(['102', '103'].map((post) => `${id}:post:${post}`));
  expect(await repo.getChapter(`${id}:post:101`)).not.toBeNull();
  expect(await host.db.getAllAsync('SELECT position, currently_listed FROM threadmark_entries ORDER BY post_id')).toEqual([
    { position: 0, currently_listed: 0 }, { position: 0, currently_listed: 1 }, { position: 1, currently_listed: 1 },
  ]);
  await expect(host.db.runAsync('UPDATE threadmark_entries SET position = 0 WHERE post_id = ?', '103')).rejects.toThrow('UNIQUE');
  await expect(host.db.runAsync('UPDATE threadmark_entries SET currently_listed = 2 WHERE post_id = ?', '101')).rejects.toThrow('CHECK');
});

test('pending removal is retained internally, excluded from saved contents/counts/resume and not fetched', async () => {
  await initial(['101', '103']); const checked = await check(['101', '103']);
  expect(checked.requests).toEqual([importRootUrl, indexUrl]);
  expect(await repo.listSavedUnlisted(id)).toEqual([]); expect(await repo.getStory(id)).toMatchObject({ total: 2, downloaded: 2 });
  const resumed = source(new Map()); expect((await importStory(importRootUrl, repo, resumed.client, digest)).failure).toBeNull();
  expect(resumed.requests).toEqual([]);
  expect(await host.db.getFirstAsync('SELECT currently_listed FROM threadmark_entries WHERE post_id = ?', '102')).toEqual({ currently_listed: 0 });
});

test.each([true, false])('reappearing post reuses identity and %s existing body or downloads its missing body', async (downloaded) => {
  await initial(downloaded ? ['101', '102', '103'] : ['102', '103']); const old = await retained();
  await check(['102', '103']); const checked = await check(['103', '101', '102'], { '101': 'Returned first' });
  expect(checked.result.reconciliation).toMatchObject({ added: 0, reactivated: 1, total: 3 });
  expect(checked.requests).toEqual([importRootUrl, indexUrl, ...downloaded ? [] : [postUrl('101')]]);
  expect(await repo.getChapter(`${id}:post:101`)).toMatchObject({ id: `${id}:post:101`, title: 'Returned first', position: 1 });
  expect(await repo.listSavedUnlisted(id)).toEqual([]); expect(await repo.getStory(id)).toMatchObject({ total: 3, downloaded: 3 });
  expect((await retained()).positions).toEqual(old.positions);
  if (downloaded) expect(await retained()).toEqual(old);
});

test.each(['incomplete', 'blocked', 'challenge', 'parser', 'network', 'wrong-thread'] as const)('%s update changes only attempt time; prior authoritative state/readability survive', async (failure) => {
  await initial(); await check(['101', '102', '103'], {}, 100); const old = await state();
  const docs = documents(['103', '104']);
  if (failure === 'incomplete') docs.set(indexUrl, index(row('104'), { expected: 3 }));
  if (failure === 'challenge') docs.set(importRootUrl, '<title>Access denied</title>');
  if (failure === 'parser') docs.set(importRootUrl, page(tabs));
  if (failure === 'network') docs.delete(indexUrl);
  if (failure === 'wrong-thread') docs.set(importRootUrl, page(storyHeader + tabs).replace('thread-9001', 'thread-9999'));
  const fake = source(docs, failure === 'blocked' ? 403 : 200);
  const result = await updateStory(metadata, repo, fake.client, digest, { now: () => 200 });
  expect(result.failure?.code).toBe(failure === 'wrong-thread' ? 'parser' : failure);
  expect(result.reconciliation).toBeNull(); expect(await state()).toEqual(old);
  expect(await repo.getStory(id)).toMatchObject({ lastUpdateAttemptAt: 200, lastUpdateSuccessAt: 100 });
  expect((await repo.getChapter(`${id}:post:101`))?.html).toContain('Saved original');
  expect(fake.requests).not.toContain(postUrl('104'));
});

test('successful same-thread metadata refresh preserves known author when missing from later parse', async () => {
  await initial(); const docs = documents(['101', '102', '103']);
  docs.set(importRootUrl, page(storyHeader.replace('The Synthetic Orchard &amp; Sea', 'New generated story title').replace(/<div class="p-description">.*?<\/div>/, '') + tabs));
  const result = await updateStory(metadata, repo, source(docs).client, digest, { now: () => 500 });
  expect(result.failure).toBeNull(); expect(result.reconciliation?.metadataChanged).toBe(true);
  expect(await repo.getStory(id)).toMatchObject({ title: 'New generated story title', author: 'Generated Author', threadId: '9001' });
});

test('cancel during manifest retrieval never reconciles and preserves last success', async () => {
  await initial(); const old = await state(); const abort = new AbortController(); const fake = source(documents(['104']));
  const get = fake.client.get.bind(fake.client);
  jest.spyOn(fake.client, 'get').mockImplementation(async (...args) => { const result = await get(...args); if (args[0] === indexUrl) abort.abort(); return result; });
  const result = await updateStory(metadata, repo, fake.client, digest, { signal: abort.signal });
  expect(result.failure?.code).toBe('cancelled'); expect(await state()).toEqual(old); expect(result.reconciliation).toBeNull();
});

test('cancel while reconciliation is queued rolls back and leaves the serialized queue usable', async () => {
  await initial(); const old = await state(); const abort = new AbortController();
  let release!: () => void; let reached!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; }); const ready = new Promise<void>((resolve) => { reached = resolve; });
  const body = (await repo.getChapter(`${id}:post:101`))!;
  const held = repo.replaceChapterContent(body.id, body, async (phase) => { if (phase === 'before-write') { reached(); await gate; } });
  await ready;
  const queued = repo.reconcileManifest(id, metadata, manifest(['103', '104']), 200, abort.signal);
  const rejected = expect(queued).rejects.toThrow('cancelled'); abort.abort(); release(); await held; await rejected;
  expect(await state()).toEqual(old); expect((await check(['101', '102', '103'])).result.failure).toBeNull();
});

test.each(['unlisting', 'entry', 'final-fk', 'commit-failure'] as const)('%s reconciliation boundary rolls back every row/metadata/success and retry succeeds', async (boundary) => {
  await initial(); const old = await state(); const abort = new AbortController();
  const transaction = host.db.withExclusiveTransactionAsync.bind(host.db);
  const spy = jest.spyOn(host.db, 'withExclusiveTransactionAsync');
  const fake = source(documents(['103', '104']));
  const result = await updateStory(metadata, repo, fake.client, digest, { signal: abort.signal, now: () => 200, onProgress(p) {
    if (p.phase !== 'reconciling') return;
    if (boundary === 'commit-failure') { host.failNextCommit(); return; }
    spy.mockImplementationOnce((work) => transaction(async (tx) => {
      await work({ ...tx, async runAsync(sql, ...params) {
        const value = await tx.runAsync(sql, ...params);
        if ((boundary === 'unlisting' && sql.startsWith('UPDATE threadmark_entries')) ||
            (boundary === 'entry' && sql.startsWith('INSERT INTO threadmark_entries'))) abort.abort();
        return value;
      }, async getFirstAsync<T>(sql: string, ...params: SqlValue[]) {
        const value = await tx.getFirstAsync<T>(sql, ...params);
        if (boundary === 'final-fk' && sql === 'PRAGMA foreign_key_check') abort.abort();
        return value;
      } });
    }));
  } });
  spy.mockRestore();
  expect(result.failure?.code).toBe(boundary === 'commit-failure' ? 'storage' : 'cancelled');
  expect(result.reconciliation).toBeNull(); expect(await state()).toEqual(old);
  expect((await check(['103', '104'])).result.failure).toBeNull();
  expect(await repo.getStory(id)).toMatchObject({ total: 2, downloaded: 2, lastUpdateSuccessAt: 200 });
});

test('cancel after reconciliation/body commit; real close/reopen exposes current pending state; explicit resume fetches only missing', async () => {
  await initial(); const old = await retained(); const abort = new AbortController();
  const fake = source(documents(['102', '104', '105']));
  const result = await updateStory(metadata, repo, fake.client, digest, { signal: abort.signal, now: () => 400, onProgress(p) {
    if (p.phase === 'downloading' && p.downloaded === 2) abort.abort();
  } });
  expect(result.failure?.code).toBe('cancelled'); expect(result.reconciliation).toMatchObject({ added: 2, removed: 2 });
  expect(result.story).toMatchObject({ total: 3, downloaded: 2, lastUpdateSuccessAt: 400 });
  expect(fake.requests).toEqual([importRootUrl, indexUrl, postUrl('104')]);
  host.close(); host = hostSqlite(join(folder, 'test.db')); await migrate(host.db); repo = createRepository(host.db);
  expect((await repo.listContents(id)).map((e) => [e.postId, e.downloaded])).toEqual([['102', true], ['104', true], ['105', false]]);
  expect((await repo.listSavedUnlisted(id)).map((e) => e.postId)).toEqual(['101', '103']);
  expect((await retained()).positions).toEqual(old.positions);
  const resumed = source(documents(['102', '104', '105']));
  expect((await importStory(importRootUrl, repo, resumed.client, digest)).story?.downloaded).toBe(3);
  expect(resumed.requests).toEqual([postUrl('105')]);
  expect(await repo.getStory(id)).toMatchObject({ lastUpdateAttemptAt: 400, lastUpdateSuccessAt: 400 });
});

test('body download failure retains successful complete-check time and current pending manifest', async () => {
  await initial(); const docs = documents(['101', '104']); docs.delete(postUrl('104'));
  const result = await updateStory(metadata, repo, source(docs).client, digest, { now: () => 500 });
  expect(result.failure?.code).toBe('network'); expect(result.reconciliation).not.toBeNull();
  expect(result.story).toMatchObject({ total: 2, downloaded: 1, lastUpdateSuccessAt: 500 });
  expect(await repo.listSavedUnlisted(id)).toHaveLength(2);
});

test('cancel during new body preparation retains reconciliation but commits no unfinished body, then resumes explicitly', async () => {
  await initial(); const abort = new AbortController(); const old = await retained();
  const fake = source(documents(['101', '104']));
  const result = await updateStory(metadata, repo, fake.client, async (text) => { abort.abort(); return digest(text); }, { signal: abort.signal, now: () => 600 });
  expect(result.failure?.code).toBe('cancelled'); expect(result.reconciliation).toMatchObject({ added: 1, removed: 2 });
  expect(result.story).toMatchObject({ total: 2, downloaded: 1, lastUpdateSuccessAt: 600 });
  expect(await repo.getChapter(`${id}:post:104`)).toBeNull(); expect(await retained()).toEqual(old);
  const resumed = source(documents(['101', '104']));
  expect((await importStory(importRootUrl, repo, resumed.client, digest)).failure).toBeNull(); expect(resumed.requests).toEqual([postUrl('104')]);
});

test('cancellation after unavoidable reconciliation COMMIT retains that completed manifest and success time', async () => {
  await initial(); const abort = new AbortController(); const transaction = host.db.withExclusiveTransactionAsync.bind(host.db);
  const spy = jest.spyOn(host.db, 'withExclusiveTransactionAsync');
  const result = await updateStory(metadata, repo, source(documents(['101', '104'])).client, digest, { signal: abort.signal, now: () => 700,
    onProgress(p) { if (p.phase === 'reconciling') spy.mockImplementationOnce(async (work) => { await transaction(work); abort.abort(); }); } });
  expect(result.failure?.code).toBe('cancelled'); expect(result.reconciliation).not.toBeNull();
  expect(result.story).toMatchObject({ total: 2, downloaded: 1, lastUpdateSuccessAt: 700 });
  expect((await repo.listContents(id)).map((entry) => entry.postId)).toEqual(['101', '104']);
});

test('update pins expected story identity before source traffic; missing stories and fixtures cannot check', async () => {
  await initial(); const old = await state(); const fake = source(documents(['101']));
  const mismatch = await updateStory({ ...metadata, sourceUrl: 'https://forums.spacebattles.com/threads/9002/' }, repo, fake.client, digest);
  expect(mismatch.failure?.code).toBe('unsupported-url'); expect(mismatch.story?.id).toBe(id); expect(await state()).toEqual(old);
  expect((await updateStory({ id: 'spacebattles:thread:9003', sourceUrl: 'https://forums.spacebattles.com/threads/9003/' }, repo, fake.client, digest)).failure?.code).toBe('unsupported-url');
  expect((await updateStory({ id: 'fixture:thread:1001', sourceUrl: importRootUrl }, repo, fake.client, digest)).failure?.code).toBe('unsupported-url');
  expect(fake.requests).toEqual([]);
});

test.each(['update', 'resume'] as const)('active check excludes competing %s across repository handles, then releases ownership', async (operation) => {
  await initial(); const fake = source(documents(['101', '102', '103']));
  let release!: () => void; let reached!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; }); const ready = new Promise<void>((resolve) => { reached = resolve; });
  const get = fake.client.get.bind(fake.client);
  jest.spyOn(fake.client, 'get').mockImplementation(async (...args) => { reached(); await gate; return get(...args); });
  const first = updateStory(metadata, repo, fake.client, digest); await ready;
  const otherRepo = createRepository(host.db);
  const second = operation === 'update' ? await updateStory(metadata, otherRepo, fake.client, digest) : await importStory(importRootUrl, otherRepo, fake.client, digest);
  expect(second.failure?.code).toBe('busy'); release(); expect((await first).failure).toBeNull();
  expect((await check(['101', '102', '103'])).result.failure).toBeNull();
});

test('initial import also excludes same-story Check for Updates', async () => {
  const fake = source(documents(['101'])); let release!: () => void; let reached!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; }); const ready = new Promise<void>((resolve) => { reached = resolve; });
  const get = fake.client.get.bind(fake.client);
  jest.spyOn(fake.client, 'get').mockImplementation(async (...args) => { reached(); await gate; return get(...args); });
  const importing = importStory(importRootUrl, repo, fake.client, digest); await ready;
  expect((await updateStory(metadata, createRepository(host.db), fake.client, digest)).failure?.code).toBe('busy');
  release(); expect((await importing).failure).toBeNull();
});

test('story A update cannot mutate story B and repository rejects mismatched incoming identity/partial manifests', async () => {
  await initial(); const other = { ...metadata, id: 'spacebattles:thread:9002', threadId: '9002', sourceUrl: 'https://forums.spacebattles.com/threads/9002/' };
  await repo.commitInitialManifest(other, { state: 'COMPLETE', entries: [{ postId: '101', title: 'Other first', url: other.sourceUrl + '#post-101' }] });
  await repo.commitDownloadedChapter(other.id, '101', await prepareContent('<p>Generated other body.</p>', digest));
  const before = await repo.getStory(other.id); const chapter = await repo.getChapter(`${other.id}:post:101`);
  await check(['103', '104']); expect(await repo.getStory(other.id)).toEqual(before); expect(await repo.getChapter(`${other.id}:post:101`)).toEqual(chapter);
  const old = await state();
  await expect(repo.reconcileManifest(id, other, manifest(['103']), 800)).rejects.toThrow();
  await expect(repo.reconcileManifest(id, { ...metadata, sourceUrl: other.sourceUrl }, manifest(['103']), 800)).rejects.toThrow();
  await expect(repo.reconcileManifest(id, metadata, { ...manifest(['104']), state: 'INCOMPLETE' } as unknown as Parameters<typeof repo.reconcileManifest>[2], 800)).rejects.toThrow();
  expect(await state()).toEqual(old);
});

test('generated 1,000-entry reconciliation handles insertion, reorder, removal, saved body and locator without collisions', async () => {
  const posts = Array.from({ length: 1000 }, (_, index) => String(1001 + index));
  await initial(['1001', '1500', '2000'], posts);
  const body = (await repo.getChapter(`${id}:post:1500`))!;
  await repo.saveLocator({ chapterId: body.id, contentHash: body.contentHash, blockId: body.blockIds[0]!, offset: 10, progression: .5, expandedSpoilers: [] });
  const old = await retained();
  const next = ['2000', ...posts.filter((post) => post !== '1001' && post !== '2000')]; next.splice(400, 0, '3000');
  const result = await repo.reconcileManifest(id, metadata, manifest(next, { '1500': 'Renamed midpoint' }), 900);
  expect(result).toMatchObject({ added: 1, removed: 1, renamed: 1, orderChanged: true, total: 1000, downloaded: 2, pending: 998 });
  expect((await repo.listContents(id)).map((e) => e.postId)).toEqual(next);
  expect(await retained()).toEqual(old); expect(await repo.listSavedUnlisted(id)).toMatchObject([{ postId: '1001' }]);
  expect(await repo.reconcileManifest(id, metadata, manifest(next, { '1500': 'Renamed midpoint' }), 901)).toMatchObject({ added: 0, removed: 0, renamed: 0, orderChanged: false });
  expect(await host.db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
});
