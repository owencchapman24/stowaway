import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { migrate } from '../../src/storage/migrations';
import { compileFixture, createRepository } from '../../src/storage/repository';
import { createLocalContentFiles } from '../../src/storage/local-files';
import { createSourceImageFiles, sourceAssetPath } from '../../src/images/files';
import { downloadImages } from '../../src/images/download';
import { extractPostContent } from '../../src/sources/spacebattles/parse';
import { RequestClient } from '../../src/sources/spacebattles/request';
import { ORIGIN, threadFromUrl } from '../../src/sources/spacebattles/url';
import { prepareContent } from '../../src/content/sanitize';
import { importStory, updateStory } from '../../src/importing/import-story';
import type { StoryMetadata } from '../../src/domain/types';
import { png } from '../fixtures/images';
import { bodyArticle, storyHeader } from '../fixtures/import';
import { threadUrl, page, index, indexUrl, tabs, row } from '../fixtures/spacebattles';
import { hostSqlite } from './host-sqlite';
import { hostFiles } from './host-files';

const digest = async (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const thread = threadFromUrl(threadUrl), id = thread.storyId, chapterId = `${id}:post:101`;
const metadata: StoryMetadata = { id, source: 'spacebattles', threadId: '9001', title: 'Generated story', author: null, sourceUrl: thread.url, categoryId: '9' };
const sourceUrl = (post: string) => `${ORIGIN}/posts/${post}/`;
const manifest = (posts = ['101']) => ({ state: 'COMPLETE' as const, entries: posts.map((postId) => ({ postId, title: `Generated ${postId}`, url: sourceUrl(postId) })) });
const markup = (count = 1) => '<p>Generated before.</p>' + Array.from({ length: count }, (_, i) => `<img src="/attachments/generated-${i}.png" alt="Synthetic ${i}">`).join('') + '<p>Generated after.</p>';
function extracted(body = markup(), post = '101') {
  return extractPostContent({ html: page(bodyArticle(post, body)), url: sourceUrl(post), status: 200 }, thread,
    { postId: post, chapterId: `${id}:post:${post}`, url: sourceUrl(post), title: `Generated ${post}`, threadmarkId: null }, '9');
}
let folder: string, host: ReturnType<typeof hostSqlite>, repo: ReturnType<typeof createRepository>;
let files: ReturnType<typeof hostFiles>, imageFiles: ReturnType<typeof createSourceImageFiles>, count: number;
const uuid = () => `11111111-1111-4111-8111-${String(++count).padStart(12, '0')}`;
beforeEach(async () => {
  folder = mkdtempSync(join(tmpdir(), 'stowaway-i2-')); count = 0;
  host = hostSqlite(join(folder, 'test.db')); await migrate(host.db); repo = createRepository(host.db);
  files = hostFiles(join(folder, 'documents')); imageFiles = createSourceImageFiles(files, digest, uuid);
});
afterEach(() => {
  host.close(); const target = resolve(folder);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('stowaway-i2-')) throw new Error('Unexpected test root.');
  rmSync(target, { recursive: true, force: true });
});
async function seed(body = markup(), discovered = false, post = '101') {
  await repo.commitInitialManifest(metadata, manifest());
  const source = extracted(body, post), content = await prepareContent(source.sourceHtml, digest);
  await repo.commitDownloadedChapter(id, post, content, undefined, discovered ? source.images : undefined);
  const chapter = (await repo.getChapter(`${id}:post:${post}`))!;
  await repo.saveLocator({ chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds.at(-1)!, offset: 7, progression: .6, expandedSpoilers: [] });
  return chapter;
}
function source(bodies: Record<string, string> = { '101': markup() }, request?: (url: string) => Promise<void>) {
  const calls: string[] = []; let time = 0;
  const client = new RequestClient(async (url) => {
    calls.push(url); await request?.(url);
    const match = /\/posts\/(\d+)\//.exec(url);
    const html = url === thread.url ? page(storyHeader + tabs) : url === indexUrl ? index(Object.keys(bodies).map((post) => row(post).replace(/href="[^"]*"/, `href="${sourceUrl(post)}"`)).join(''), { expected: Object.keys(bodies).length })
      : match ? page(bodyArticle(match[1]!, bodies[match[1]!] ?? '<p>Generated missing</p>')) : '';
    return { url, status: 200, bodyUsed: true, headers: { get: (name) => name === 'content-type' ? (html ? 'text/html' : 'image/png') : null },
      text: async () => html, arrayBuffer: async () => new Uint8Array(png()).buffer };
  }, { now: () => time, sleep: async (ms) => { time += ms; } });
  return { calls, client };
}
async function run(fake = source(), signal?: AbortSignal) { return downloadImages(id, repo, fake.client, digest, imageFiles, { signal }); }

test.each([0, 1, 2, 3])('fresh/v%s migrates to latest non-destructively; S2A v1 remains isolated', async (version) => {
  host.close(); host = hostSqlite(join(folder, 'historical.db'));
  if (version) {
    await migrate(host.db, version); repo = createRepository(host.db);
    const fixture = await compileFixture(digest); await repo.seed(fixture, { relativePath: `assets/${uuid()}.png`, byteLength: 2024 });
    const chapter = fixture.chapters[0]!;
    await repo.saveLocator({ chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[1]!, offset: 9, progression: .2, expandedSpoilers: [] });
    await repo.savePreferences({ theme: 'dark', fontSize: 28 });
  }
  const before = version ? { stories: await host.db.getAllAsync('SELECT id, source, thread_id, title, author FROM stories ORDER BY id'),
    bodies: await host.db.getAllAsync('SELECT id, story_id, post_id, title, position, html, content_hash, sanitizer_version, block_ids, links FROM chapters ORDER BY id'),
    positions: await host.db.getAllAsync('SELECT * FROM reading_positions'), settings: await host.db.getAllAsync('SELECT * FROM settings'), assets: await host.db.getAllAsync('SELECT * FROM assets') } : null;
  await migrate(host.db); await migrate(host.db);
  expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 4 });
  if (before) {
    expect(await host.db.getAllAsync('SELECT id, source, thread_id, title, author FROM stories ORDER BY id')).toEqual(before.stories);
    expect(await host.db.getAllAsync('SELECT id, story_id, post_id, title, position, html, content_hash, sanitizer_version, block_ids, links FROM chapters ORDER BY id')).toEqual(before.bodies);
    expect(await host.db.getAllAsync('SELECT * FROM reading_positions')).toEqual(before.positions);
    expect(await host.db.getAllAsync('SELECT * FROM settings')).toEqual(before.settings);
    expect(await host.db.getAllAsync('SELECT * FROM assets')).toEqual(before.assets);
  }
  expect(await host.db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
});
test('populated v3 -> v4 preserves current/unlisted entries, timestamps, entire bodies/locators/preferences/fixture reference; failure rolls back', async () => {
  host.close(); host = hostSqlite(join(folder, 'v3.db')); await migrate(host.db, 3); repo = createRepository(host.db);
  const fixture = await compileFixture(digest); await repo.seed(fixture, { relativePath: `assets/${uuid()}.png`, byteLength: 2024 });
  await repo.commitInitialManifest(metadata, manifest(['101', '102'])); await seed();
  await repo.recordUpdateAttempt(id, 123); await repo.reconcileManifest(id, metadata, manifest(['102']), 456);
  await repo.savePreferences({ theme: 'dark', fontSize: 26 });
  const snapshot = async () => ({ stories: await host.db.getAllAsync('SELECT * FROM stories ORDER BY id'), entries: await host.db.getAllAsync('SELECT * FROM threadmark_entries ORDER BY story_id, post_id'),
    chapters: await host.db.getAllAsync('SELECT id, story_id, post_id, title, position, html, content_hash, sanitizer_version, block_ids, links FROM chapters ORDER BY id'),
    locators: await host.db.getAllAsync('SELECT * FROM reading_positions'), settings: await host.db.getAllAsync('SELECT * FROM settings'), assets: await host.db.getAllAsync('SELECT * FROM assets') });
  const before = await snapshot(); host.failNextCommit(); await expect(migrate(host.db)).rejects.toThrow('commit failure');
  expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 3 }); expect(await snapshot()).toEqual(before);
  await migrate(host.db); expect(await snapshot()).toEqual(before);
  expect(await host.db.getAllAsync('SELECT id, image_discovery FROM chapters ORDER BY id')).toEqual([
    ...fixture.chapters.map((chapter) => ({ id: chapter.id, image_discovery: 'fixture' })), { id: chapterId, image_discovery: 'unknown' },
  ].sort((a, b) => a.id.localeCompare(b.id)));
  expect(await repo.listSavedUnlisted(id)).toHaveLength(1); expect(await repo.getChapterAssetPath(chapterId)).toBeNull();
});
test('isolated S2A v1 never creates source image schema and its reader returns no source refs', async () => {
  host.close(); host = hostSqlite(join(folder, 's2a.db')); await migrate(host.db, 1); repo = createRepository(host.db);
  await migrate(host.db, 1);
  expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 1 });
  expect(await host.db.getFirstAsync("SELECT name FROM sqlite_master WHERE name='chapter_images'")).toBeNull();
  expect(await repo.listChapterImages('fixture:thread:1001:post:2001')).toEqual([]);
});
test('legacy match attaches slots only, downloads local bytes, preserves whole body/hash/locator and never leaks harbor', async () => {
  const chapter = await seed(), locator = await repo.getLocator(chapterId), fake = source();
  expect(await repo.getImageSummary(id)).toMatchObject({ unknown: 1 });
  expect((await run(fake)).failure).toBeNull();
  expect(await repo.getChapter(chapterId)).toEqual(chapter); expect(await repo.getLocator(chapterId)).toEqual(locator);
  expect(await repo.getImageSummary(id)).toMatchObject({ unknown: 0, scanned: 1, local: 1, pending: 0 });
  expect(fake.calls).toEqual([sourceUrl('101'), `${ORIGIN}/attachments/generated-0.png`]);
  expect(await repo.getChapterAssetPath(chapterId)).toBeNull();
  const second = source(); await run(second); expect(second.calls).toEqual([]);
});
test('legacy mismatch persists bounded unavailability, never guesses slots/replaces old text/locator or retries body', async () => {
  const chapter = await seed(), locator = await repo.getLocator(chapterId);
  const fake = source({ '101': markup().replace('Generated before.', 'Different saved text.') });
  await run(fake); expect(await repo.getImageSummary(id)).toMatchObject({ mismatch: 1, local: 0, pending: 0 });
  expect(await repo.listChapterImages(chapterId)).toEqual([]); expect(await repo.getChapter(chapterId)).toEqual(chapter); expect(await repo.getLocator(chapterId)).toEqual(locator);
  const retry = source(); await run(retry); expect(retry.calls).toEqual([]);
});
test('legacy image-only change remains compatible while prose/hash/locator stay unchanged', async () => {
  const chapter = await seed(); const fake = source({ '101': markup().replace('generated-0.png', 'changed.png') });
  await run(fake); expect(await repo.getChapter(chapterId)).toEqual(chapter);
  expect(fake.calls).toContain(`${ORIGIN}/attachments/changed.png`);
});
test('zero images is persistently scanned and external images are permanently omitted with zero asset requests', async () => {
  await seed('<p>Generated text.</p>', false); await run(source({ '101': '<p>Generated text.</p>' }));
  expect(await repo.getImageSummary(id)).toMatchObject({ scanned: 1, unknown: 0, local: 0, pending: 0, omitted: 0 });
  await repo.commitInitialManifest({ ...metadata, id: 'spacebattles:thread:9002', threadId: '9002', sourceUrl: `${ORIGIN}/threads/9002/` }, manifest());
  const ext = extracted('<p>Text.</p><img src="https://example.com/a.png">');
  const content = await prepareContent(ext.sourceHtml, digest);
  await repo.commitDownloadedChapter('spacebattles:thread:9002', '101', content, undefined, ext.images);
  expect(await repo.getImageSummary('spacebattles:thread:9002')).toMatchObject({ omitted: 1, pending: 0 });
  const fake = source();
  expect((await downloadImages('spacebattles:thread:9002', repo, fake.client, digest, imageFiles)).failure).toBeNull();
  expect(fake.calls).toEqual([]);
});
test('new import and update discover from their already fetched body; ordinary updates never backfill old bodies', async () => {
  const fake = source(); const result = await importStory(thread.url, repo, fake.client, digest, { imageFiles });
  expect(result.failure).toBeNull(); expect(fake.calls.filter((url) => url === sourceUrl('101'))).toHaveLength(1);
  expect(await repo.getImageSummary(id)).toMatchObject({ scanned: 1, local: 1 });
  const updated = source({ '101': markup(), '102': markup() });
  const update = await updateStory(metadata, repo, updated.client, digest, { imageFiles });
  expect(update.failure).toBeNull(); expect(update.bodiesDownloaded).toBe(1); expect(updated.calls).not.toContain(sourceUrl('101'));
  expect(updated.calls.filter((url) => url === sourceUrl('102'))).toHaveLength(1); expect(await repo.getStory(id)).toMatchObject({ downloaded: 2, total: 2 });
});
test('ordinary unchanged update and duplicate import leave legacy unknown chapters unscanned without body/image traffic', async () => {
  await seed(); const fake = source(); await updateStory(metadata, repo, fake.client, digest, { imageFiles });
  expect(fake.calls).toEqual([thread.url, indexUrl]); expect(await repo.getImageSummary(id)).toMatchObject({ unknown: 1 });
  const duplicate = source(); await importStory(thread.url, repo, duplicate.client, digest, { imageFiles }); expect(duplicate.calls).toEqual([]);
});

test('legacy discovery reuses one transient consecutive source document for exact neighboring post bodies', async () => {
  await repo.commitInitialManifest(metadata, { state: 'COMPLETE', entries: ['101', '102'].map((postId) => ({ postId, title: 'Generated', url: `${threadUrl}#post-${postId}` })) });
  for (const post of ['101', '102']) await repo.commitDownloadedChapter(id, post, await prepareContent(extracted('<p>Generated only.</p>', post).sourceHtml, digest));
  const transport = jest.fn(async (url) => ({ url, status: 200, bodyUsed: true, headers: { get: () => 'text/html' },
    text: async () => page(bodyArticle('101', '<p>Generated only.</p>') + bodyArticle('102', '<p>Generated only.</p>')) }));
  const client = new RequestClient(transport, { now: () => 0, sleep: async () => {} });
  expect((await downloadImages(id, repo, client, digest, imageFiles)).failure).toBeNull();
  expect(transport).toHaveBeenCalledTimes(1); expect(await repo.getImageSummary(id)).toMatchObject({ scanned: 2, unknown: 0 });
});
test('cancellation after completed images preserves authoritative refs/text; reopening never resumes; retry skips valid assets', async () => {
  const chapter = await seed(markup(30), true), locator = await repo.getLocator(chapterId), cancel = new AbortController();
  let images = 0;
  const fake = source({ '101': markup(30) }, async (url) => { if (url.includes('/attachments/') && ++images === 10) cancel.abort(); });
  expect((await run(fake, cancel.signal)).failure?.code).toBe('cancelled');
  expect(await repo.getImageSummary(id)).toMatchObject({ local: 9, pending: 21 });
  expect(await repo.getChapter(chapterId)).toEqual(chapter); expect(await repo.getLocator(chapterId)).toEqual(locator);
  host.close(); host = hostSqlite(join(folder, 'test.db')); repo = createRepository(host.db); await migrate(host.db);
  expect(await repo.getImageSummary(id)).toMatchObject({ local: 9, pending: 21 });
  const retry = source({ '101': markup(30) }); expect((await run(retry)).failure).toBeNull();
  expect(retry.calls).toHaveLength(21); expect(retry.calls.every((url) => url.includes('/attachments/'))).toBe(true);
  expect(await repo.listChapterImages(chapterId)).toHaveLength(30); expect(await repo.getStory(id)).toMatchObject({ downloaded: 1, total: 1 });
});
test.each(['network', 'blocked', 'challenge', 'transient'])('%s leaves pending work, prior text/local refs intact', async (failure) => {
  await seed(markup(2), true);
  let time = 0; const client = new RequestClient(async (url) => {
    if (failure === 'network') throw new Error('Injected transport failure.');
    const status = failure === 'blocked' ? 403 : failure === 'transient' ? 503 : 200;
    return { url, status, headers: { get: () => null }, text: async () => '', bodyUsed: true,
      arrayBuffer: async () => new Uint8Array(failure === 'challenge' ? Buffer.from('<html><title>Log in</title></html>') : png()).buffer };
  }, { now: () => time, sleep: async (ms) => { time += ms; } });
  expect((await run({ calls: [], client })).failure?.code).toBe(failure);
  expect(await repo.getImageSummary(id)).toMatchObject({ pending: 2, local: 0 }); expect(await repo.getStory(id)).toMatchObject({ downloaded: 1 });
});
test('invalid image bytes are an omission, successful new text remains committed', async () => {
  const fake = source(); const original = fake.client.getImage.bind(fake.client);
  jest.spyOn(fake.client, 'getImage').mockImplementation(async (url, options) => ({ ...await original(url, options), bytes: Buffer.from('<svg>Invalid raster</svg>') }));
  const result = await importStory(thread.url, repo, fake.client, digest, { imageFiles });
  expect(result.failure).toBeNull(); expect(await repo.getStory(id)).toMatchObject({ downloaded: 1, total: 1 }); expect(await repo.getImageSummary(id)).toMatchObject({ omitted: 1, local: 0 });
});
test('same-story images reject import/update/resume overlap; story A cannot mutate story B', async () => {
  await seed(); let reached!: () => void, release!: () => void;
  const ready = new Promise<void>((r) => { reached = r; }), held = new Promise<void>((r) => { release = r; });
  const fake = source(undefined, async (url) => { if (url === sourceUrl('101')) { reached(); await held; } });
  const operation = run(fake); await ready;
  expect((await importStory(thread.url, repo, fake.client, digest)).failure?.code).toBe('busy');
  expect((await updateStory(metadata, repo, fake.client, digest)).failure?.code).toBe('busy');
  expect((await run(fake)).failure?.code).toBe('busy'); release(); await operation;
  const staged = await imageFiles.stage(png());
  await expect(repo.commitImageResults('spacebattles:thread:9002', chapterId, [{ slot: 0, file: staged.file }])).rejects.toThrow('different'); staged.release();
});
test('saved-unlisted retains local assets, is never fetched by image work; reappearance reuses valid reference/body/locator', async () => {
  await repo.commitInitialManifest(metadata, manifest(['101', '102'])); const chapter = await seed(), locator = await repo.getLocator(chapterId);
  await repo.commitDownloadedChapter(id, '102', await prepareContent(extracted('<p>Other.</p>', '102').sourceHtml, digest), undefined, []);
  await run(); const images = await repo.listChapterImages(chapterId);
  await repo.reconcileManifest(id, metadata, manifest(['102']), 200);
  const absent = source(); await run(absent); expect(absent.calls).toEqual([]); expect(await repo.listChapterImages(chapterId)).toEqual(images);
  const render = createLocalContentFiles(files, digest, async () => { throw new Error('No fixture'); }, uuid);
  const directory = await render.render(chapter, locator, { theme: 'light', fontSize: 20 }, uuid(), null, images);
  expect(files.exists(`${directory}/source-image-0.png`)).toBe(true);
  await repo.reconcileManifest(id, metadata, manifest(['101', '102']), 300);
  const reappeared = source(); await run(reappeared); expect(reappeared.calls).toEqual([]); expect(await repo.listChapterImages(chapterId)).toEqual(images); expect(await repo.getLocator(chapterId)).toEqual(locator);
});
test('staged files reread before reference; corruption cannot obtain a DB reference; exclusive destination refuses overwrite', async () => {
  await seed(markup(), true);
  const corrupt = createSourceImageFiles({ ...files, writeNew(path, bytes) { files.writeNew(path, bytes.slice(0, 30)); } }, digest, uuid);
  await expect(corrupt.stage(png())).rejects.toThrow(); expect((await repo.listChapterImages(chapterId))[0]!.file).toBeNull();
  const fixed = uuid(); files.mkdir('source-assets'); files.writeNew(`source-assets/${fixed}.png`, png());
  await expect(createSourceImageFiles(files, digest, () => fixed).stage(png())).rejects.toThrow('overwrite');
});

test('valid source bytes corrupted during local staging stay pending for explicit retry rather than permanent omission', async () => {
  await seed(markup(), true);
  const corrupt = createSourceImageFiles({ ...files, writeNew(path, bytes) { files.writeNew(path, bytes.slice(0, 30)); } }, digest, uuid);
  const fake = source();
  const result = await downloadImages(id, repo, fake.client, digest, corrupt);
  expect(result.failure?.code).toBe('storage'); expect(await repo.getImageSummary(id)).toMatchObject({ pending: 1, omitted: 0, local: 0 });
  expect((await run()).failure).toBeNull(); expect(await repo.getImageSummary(id)).toMatchObject({ local: 1, pending: 0 });
});
test('failed DB reference retains prior reference; new completed file is orphan; explicit retry uses a fresh file', async () => {
  await seed(markup(), true); await run(); const prior = (await repo.listChapterImages(chapterId))[0]!.file!;
  const staged = await imageFiles.stage(png()); host.failNextCommit();
  await expect(repo.commitImageResults(id, chapterId, [{ slot: 0, file: staged.file }])).rejects.toThrow('commit failure'); staged.release();
  expect((await repo.listChapterImages(chapterId))[0]!.file).toEqual(prior); expect(files.exists(staged.file.relativePath)).toBe(true);
  files.remove(prior.relativePath); const fake = source(); await run(fake);
  const next = (await repo.listChapterImages(chapterId))[0]!.file!; expect(next.relativePath).not.toBe(prior.relativePath); expect(next.relativePath).not.toBe(staged.file.relativePath);
  expect(await imageFiles.read(next)).toEqual(png());
});

test('reference failure in the foreground pipeline is not silently retried/promoted; completed stage stays orphaned', async () => {
  await seed(markup(), true);
  const commit = repo.commitImageResults.bind(repo);
  const writes = jest.spyOn(repo, 'commitImageResults').mockImplementationOnce(async (...args) => { host.failNextCommit(); return commit(...args); });
  expect((await run()).failure?.code).toBe('storage'); expect(writes).toHaveBeenCalledTimes(1);
  expect(await repo.getImageSummary(id)).toMatchObject({ local: 0, pending: 1 }); expect(files.list('source-assets')).toHaveLength(1);
  expect((await run()).failure).toBeNull(); expect(await repo.getImageSummary(id)).toMatchObject({ local: 1, pending: 0 });
});
test('new body/discovery transaction rolls back coherently and SQL refuses partial downloaded metadata', async () => {
  await repo.commitInitialManifest(metadata, manifest());
  const source = extracted(), content = await prepareContent(source.sourceHtml, digest);
  host.failNextCommit();
  await expect(repo.commitDownloadedChapter(id, '101', content, undefined, source.images)).rejects.toThrow('commit failure');
  expect(await repo.getChapter(chapterId)).toBeNull(); expect(await repo.listChapterImages(chapterId)).toEqual([]);
  await repo.commitDownloadedChapter(id, '101', content, undefined, source.images);
  await expect(host.db.runAsync(`UPDATE chapter_images SET state='downloaded', relative_path=?, format='png', digest=?,
    width=2, height=3, byte_length=NULL WHERE chapter_id=?`, `source-assets/${uuid()}.png`, '0'.repeat(64), chapterId)).rejects.toThrow('CHECK');
  expect(await repo.getImageSummary(id)).toMatchObject({ pending: 1, local: 0 });
});
test.each(['missing', 'corrupt', 'wrong-digest', 'wrong-format', 'oversize'])('%s local ref becomes explicit reader placeholder while text/hash/locator survive; retry repairs missing/corrupt file', async (kind) => {
  const chapter = await seed(markup(), true), locator = await repo.getLocator(chapterId); await run();
  const images = await repo.listChapterImages(chapterId), ref = images[0]!.file!;
  if (kind === 'missing') files.remove(ref.relativePath);
  else if (kind === 'corrupt') files.write(ref.relativePath, png().slice(0, 30));
  else if (kind === 'oversize') files.write(ref.relativePath, new Uint8Array(2_000_001));
  else if (kind === 'wrong-digest') images[0]!.file = { ...ref, digest: '0'.repeat(64) };
  else images[0]!.file = { ...ref, format: 'jpeg' };
  const content = createLocalContentFiles(files, digest, async () => { throw new Error('No bundle/source'); }, uuid);
  const directory = await content.render(chapter, locator, { theme: 'dark', fontSize: 26 }, uuid(), null, images);
  const html = Buffer.from(await files.read(`${directory}/index.html`)).toString();
  expect(html).toContain('[Local image unavailable:'); expect(html).toContain('Generated before.'); expect(html).not.toMatch(/<img[^>]+https?:|https?:[^<]+(?:\.png|\.jpeg|\.webp)/);
  expect(await repo.getChapter(chapterId)).toEqual(chapter); expect(await repo.getLocator(chapterId)).toEqual(locator);
  if (['missing', 'corrupt', 'oversize'].includes(kind)) { await run(); expect((await repo.listChapterImages(chapterId))[0]!.file!.relativePath).not.toBe(ref.relativePath); }
});
test('local-only render copies validated bytes, preserves block and locator config, regenerates without source after disposable directory loss', async () => {
  const chapter = await seed(markup(), true), locator = await repo.getLocator(chapterId); await run();
  const images = await repo.listChapterImages(chapterId), content = createLocalContentFiles(files, digest, async () => { throw new Error('No bundle/source'); }, uuid);
  const first = await content.render(chapter, locator, { theme: 'dark', fontSize: 24 }, uuid(), null, images);
  const html = Buffer.from(await files.read(`${first}/index.html`)).toString();
  expect(html).toContain('src="source-image-0.png"'); expect(html).toContain(`id="${images[0]!.blockId}" data-block="true"`);
  expect(html).toContain(JSON.stringify(locator)); expect(html).not.toContain(`${ORIGIN}/attachments/`); expect(html).toContain("img-src 'self' file:; connect-src 'none'");
  expect(await files.read(`${first}/source-image-0.png`)).toEqual(png());
  files.remove(first); const second = await content.render(chapter, locator, { theme: 'dark', fontSize: 24 }, uuid(), null, images);
  expect(await files.read(`${second}/source-image-0.png`)).toEqual(png()); expect(await repo.getChapter(chapterId)).toEqual(chapter);
});
test('cleanup preserves all referenced/current/unlisted/staged/foreign/directory/fixture/S2A files and snapshot races', async () => {
  await seed(markup(), true); await run(); const ref = (await repo.listChapterImages(chapterId))[0]!.file!;
  const stage = await imageFiles.stage(png()), orphan = await imageFiles.stage(png()); orphan.release();
  files.write('source-assets/foreign.png', 'foreign'); const directory = `source-assets/${uuid()}.png`; files.mkdir(directory);
  files.mkdir('assets'); files.write(`assets/${uuid()}.png`, png()); files.mkdir('stowaway-s2a/assets'); files.write('stowaway-s2a/assets/keep.png', png());
  files.mkdir('reader/keep'); files.write('reader/keep/index.html', 'keep');
  expect(await imageFiles.cleanup(() => repo.listSourceAssetReferences())).toBe(1);
  for (const path of [ref.relativePath, stage.file.relativePath, 'source-assets/foreign.png', directory, 'stowaway-s2a/assets/keep.png', 'reader/keep/index.html']) expect(files.exists(path)).toBe(true);
  const protection = imageFiles.cleanup(async () => { stage.release(); return []; });
  // Active-at-snapshot stage is preserved even when it finishes while query resolves.
  await protection; expect(files.exists(stage.file.relativePath)).toBe(true);
});
test.each(['../asset.png', '/absolute.png', 'source-assets/../fixture.png', 'source-assets/x.svg', 'assets/11111111-1111-4111-8111-111111111111.png'])('source file path %s is rejected before filesystem operations', (path) => {
  expect(() => sourceAssetPath(path)).toThrow();
});

test('generated many-chapter/image story cancels and retries with batched refs and no timing assertion', async () => {
  const posts = Array.from({ length: 30 }, (_, i) => String(101 + i));
  await repo.commitInitialManifest(metadata, manifest(posts));
  for (const post of posts) {
    const source = extracted(markup(12), post);
    await repo.commitDownloadedChapter(id, post, await prepareContent(source.sourceHtml, digest), undefined, source.images);
  }
  const abort = new AbortController(); let requested = 0;
  const fake = source(undefined, async (url) => { if (url.includes('/attachments/') && ++requested === 25) abort.abort(); });
  expect((await run(fake, abort.signal)).failure?.code).toBe('cancelled');
  expect(await repo.getImageSummary(id)).toMatchObject({ local: 24, pending: 336 });
  const commit = jest.spyOn(repo, 'commitImageResults'), retry = source();
  expect((await run(retry)).failure).toBeNull();
  expect(retry.calls).toHaveLength(336); expect(commit).toHaveBeenCalledTimes(56);
  expect(await repo.getImageSummary(id)).toMatchObject({ local: 360, pending: 0 }); expect(await repo.getStory(id)).toMatchObject({ downloaded: 30, total: 30 });
});
