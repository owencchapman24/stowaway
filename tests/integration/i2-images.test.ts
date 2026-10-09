import { createHash } from 'node:crypto';
import { DomUtils, parseDocument } from 'htmlparser2';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { migrate } from '../../src/storage/migrations';
import { compileFixture, createRepository } from '../../src/storage/repository';
import { createLocalContentFiles } from '../../src/storage/local-files';
import { createSourceImageFiles, sourceAssetPath } from '../../src/images/files';
import { downloadImages } from '../../src/images/download';
import { renderSourceImages } from '../../src/images/render';
import { extractPostContent } from '../../src/sources/spacebattles/parse';
import { RequestClient } from '../../src/sources/spacebattles/request';
import { ORIGIN, threadFromUrl } from '../../src/sources/spacebattles/url';
import { escapeHtml, prepareContent } from '../../src/content/sanitize';
import { importStory, updateStory } from '../../src/importing/import-story';
import type { StoryMetadata } from '../../src/domain/types';
import { jpeg, png, webp } from '../fixtures/images';
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
  expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 6 });
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
  const before = await snapshot(); host.failNextCommit(); await expect(migrate(host.db, 4)).rejects.toThrow('commit failure');
  expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 3 }); expect(await snapshot()).toEqual(before);
  await migrate(host.db, 4); expect(await snapshot()).toEqual(before);
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

test.each([['png', png(), 'image/jpeg'], ['jpeg', jpeg(), 'image/webp'], ['webp', webp(), 'image/jpg']] as const)('%s local extension follows validated bytes despite MIME and source filename', async (format, bytes, mime) => {
  const chapter = await seed(markup(), true), fake = source(), original = fake.client.getImage.bind(fake.client);
  jest.spyOn(fake.client, 'getImage').mockImplementation(async (url, options) => ({ ...await original(url, options), bytes, contentType: mime }));
  const result = await run(fake), image = (await repo.listChapterImages(chapterId))[0]!;
  expect(result.failure).toBeNull(); expect(image.sourceUrl).toMatch(/\.png$/);
  expect(image.file).toMatchObject({ format }); expect(image.file!.relativePath).toMatch(new RegExp(`\\.${format}$`));
  expect(await imageFiles.read(image.file!)).toEqual(bytes); expect(await repo.getChapter(chapterId)).toEqual(chapter);
  expect(result.mimeDiagnostics).toEqual([{ chapterId, slot: 0, receivedMime: mime, detectedFormat: format, accepted: true }]);
});
test('stored 58-slot/8-MIME-omission library retries only those slots, preserves text/locator, and never refetches bodies or external images', async () => {
  const body = '<p>Generated before.</p>' + '<img src="https://example.com/external.png">'.repeat(50) + markup(8);
  const chapter = await seed(body, true), locator = await repo.getLocator(chapterId);
  await repo.commitImageResults(id, chapterId, Array.from({ length: 8 }, (_, i) => ({ slot: i + 50, reason: 'content-type-mismatch' as const })));
  const slots = await repo.listChapterImages(chapterId);
  host.close(); host = hostSqlite(join(folder, 'test.db')); await migrate(host.db); repo = createRepository(host.db);
  expect(await repo.getImageSummary(id)).toMatchObject({ local: 0, omitted: 58, pending: 0, mimeRetryable: 8 });
  const fake = source(), original = fake.client.getImage.bind(fake.client);
  jest.spyOn(fake.client, 'getImage').mockImplementation(async (url, options) => ({ ...await original(url, options), contentType: 'image/jpg' }));
  const result = await run(fake);
  expect(result.failure).toBeNull(); expect(result.summary).toMatchObject({ local: 8, omitted: 50, pending: 0, mimeRetryable: 0 });
  expect(fake.calls).toHaveLength(8); expect(fake.calls.every((url) => url.startsWith(`${ORIGIN}/attachments/`))).toBe(true);
  const after = await repo.listChapterImages(chapterId); expect(after).toHaveLength(58); expect(after.slice(0, 50)).toEqual(slots.slice(0, 50));
  expect(after.map(({ slot, blockId, sourceUrl }) => ({ slot, blockId, sourceUrl }))).toEqual(slots.map(({ slot, blockId, sourceUrl }) => ({ slot, blockId, sourceUrl })));
  expect(await repo.getChapter(chapterId)).toEqual(chapter); expect(await repo.getLocator(chapterId)).toEqual(locator);
  expect(await repo.getStory(id)).toMatchObject({ downloaded: 1, total: 1 }); expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 6 });
  expect(result.mimeDiagnostics).toHaveLength(8);
  const retry = source(); await run(retry); expect(retry.calls).toEqual([]);
});
test('MIME diagnostics are transient and capped at eight, with no persisted headers or rejected files', async () => {
  await seed(markup(12), true); const fake = source(), original = fake.client.getImage.bind(fake.client);
  jest.spyOn(fake.client, 'getImage').mockImplementation(async (url, options) => ({ ...await original(url, options), contentType: ' TEXT/HTML ; token=secret; filename=private.jpg' }));
  const result = await run(fake);
  expect(result.mimeDiagnostics).toHaveLength(8);
  expect(result.mimeDiagnostics![0]).toEqual({ chapterId, slot: 0, receivedMime: 'text/html', detectedFormat: 'png', accepted: false });
  expect(JSON.stringify(result.mimeDiagnostics)).not.toMatch(/secret|private|filename|token/);
  expect(await repo.getImageSummary(id)).toMatchObject({ local: 0, omitted: 12, mimeRetryable: 12 });
  expect(JSON.stringify(await repo.listChapterImages(chapterId))).not.toContain('text/html'); expect(files.list('source-assets')).toEqual([]);
});
test('a later MIME veto stays visible after eight successful raster diagnostics fill the sample', async () => {
  await seed(markup(10), true); const fake = source(), original = fake.client.getImage.bind(fake.client);
  jest.spyOn(fake.client, 'getImage').mockImplementation(async (url, options) => ({ ...await original(url, options),
    contentType: url.endsWith('generated-9.png') ? 'image/svg+xml' : 'image/jpg' }));
  const result = await run(fake);
  expect(result.summary).toMatchObject({ local: 9, omitted: 1, mimeRetryable: 1 }); expect(result.mimeDiagnostics).toHaveLength(8);
  expect(result.mimeDiagnostics).toContainEqual({ chapterId, slot: 9, receivedMime: 'image/svg+xml', detectedFormat: 'png', accepted: false });
});
test('non-MIME omissions remain permanent at both the downloader and reference transaction boundary', async () => {
  await seed(markup(2), true);
  await repo.commitImageResults(id, chapterId, [{ slot: 0, reason: 'invalid-bytes' }, { slot: 1, reason: 'animated' }]);
  const before = await repo.listChapterImages(chapterId), fake = source();
  expect((await run(fake)).failure).toBeNull(); expect(fake.calls).toEqual([]);
  expect(await repo.getImageSummary(id)).toMatchObject({ omitted: 2, mimeRetryable: 0 });
  const staged = await imageFiles.stage(png());
  try {
    await expect(repo.commitImageResults(id, chapterId, [{ slot: 0, file: staged.file }])).rejects.toThrow('permanently omitted');
    await expect(repo.commitImageResults(id, chapterId, [{ slot: 1, reason: 'content-type-mismatch' }])).rejects.toThrow('permanently omitted');
  } finally { staged.release(); }
  expect(await repo.listChapterImages(chapterId)).toEqual(before);
});
test('cancelled MIME retry keeps earlier commits and untouched remaining omissions for explicit retry', async () => {
  const chapter = await seed(markup(3), true), locator = await repo.getLocator(chapterId);
  await repo.commitImageResults(id, chapterId, [0, 1, 2].map((slot) => ({ slot, reason: 'content-type-mismatch' as const })));
  const controller = new AbortController(); let requested = 0;
  const fake = source(undefined, async () => { if (++requested === 2) controller.abort(); });
  expect((await run(fake, controller.signal)).failure?.code).toBe('cancelled');
  expect(await repo.getImageSummary(id)).toMatchObject({ local: 1, omitted: 2, pending: 0, mimeRetryable: 2 });
  const retry = source(); await run(retry); expect(retry.calls).toHaveLength(2);
  expect(await repo.getChapter(chapterId)).toEqual(chapter); expect(await repo.getLocator(chapterId)).toEqual(locator);
});
test('safe raster MIME cannot hide a login/challenge while retrying an old MIME omission', async () => {
  await seed(markup(), true); await repo.commitImageResults(id, chapterId, [{ slot: 0, reason: 'content-type-mismatch' }]);
  const transport = jest.fn(async (url) => ({ url, status: 200, bodyUsed: true, headers: { get: () => 'image/jpg' }, text: async () => '',
    arrayBuffer: async () => new Uint8Array(Buffer.from('<html><title>Log in</title></html>')).buffer }));
  const client = new RequestClient(transport, { now: () => 0, sleep: async () => {} });
  expect((await run({ calls: [], client })).failure?.code).toBe('challenge'); expect(transport).toHaveBeenCalledTimes(1);
  expect(await repo.getImageSummary(id)).toMatchObject({ local: 0, omitted: 1, mimeRetryable: 1 }); expect(files.list('source-assets')).toEqual([]);
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

async function renderHostileAlts(alts: string[]) {
  const body = '<p>Generated before.</p>' + alts.map((alt, i) => `<img src="/attachments/generated-${i}.png" alt="${escapeHtml(alt)}">`).join('') + '<p>Generated after.</p>';
  const chapter = await seed(body, true), locator = await repo.getLocator(chapterId);
  expect((await run()).failure).toBeNull();
  const images = await repo.listChapterImages(chapterId), directory = `reader/${uuid()}`;
  files.mkdir(directory);
  const html = await renderSourceImages(chapter, images, files, directory, imageFiles);
  const dom = parseDocument(html), rendered = DomUtils.getElementsByTagName('img', dom.children, true);
  expect(rendered).toHaveLength(alts.length);
  for (const [slot, alt] of alts.entries()) {
    expect(rendered[slot]!.attribs).toEqual({ src: `source-image-${slot}.png`, width: '2', height: '3', alt });
    expect(await files.read(`${directory}/source-image-${slot}.png`)).toEqual(png());
  }
  for (const blockId of chapter.blockIds) expect(DomUtils.findAll((node) => node.attribs.id === blockId, dom.children)).toHaveLength(1);
  for (const prose of ['Generated before.', 'Generated after.']) expect(html.split(prose)).toHaveLength(2);
  expect(DomUtils.getElementsByTagName('script', dom.children, true)).toEqual([]);
  expect(html).not.toContain(`${ORIGIN}/attachments/`);
  // Every replacement adds fixed markup plus at most six escaped chars per alt char.
  expect(html.length).toBeLessThanOrEqual(chapter.html.length + alts.reduce((sum, alt) => sum + 200 + 6 * alt.length, 0));
  expect(await repo.getChapter(chapterId)).toEqual(chapter); expect(await repo.getLocator(chapterId)).toEqual(locator);
}
test.each(['$&', '$`', "$'", '$$', '$& $` $\' $$ "><img src="https://outside.invalid/x" onload="bad()"> &'])('source alt %s is literal escaped local-image content', async (alt) => {
  await renderHostileAlts([alt]);
});
test('ten hostile replacement-token slots retain one copy of each prose/block and bounded output', async () => {
  await renderHostileAlts(Array.from({ length: 10 }, () => '$` $& $\' $$'));
});

function binarySource(bytes: Uint8Array, mime: string) {
  const calls: string[] = []; let time = 0;
  const client = new RequestClient(async (url) => {
    calls.push(url);
    return { url, status: 200, bodyUsed: true, headers: { get: (name) => name === 'content-type' ? mime : null },
      text: async () => '', arrayBuffer: async () => new Uint8Array(bytes).buffer };
  }, { now: () => time, sleep: async (ms) => { time += ms; } });
  return { calls, client };
}
test.each([
  ['invalid-bytes', png().slice(0, -1), 'image/png'], ['content-type-mismatch', png(), 'text/html'],
] as const)('rejected %s repair retains historical ownership through cleanup/offline render, then replaces only at valid commit', async (reason, bytes, mime) => {
  const chapter = await seed(markup(), true), locator = await repo.getLocator(chapterId); await run();
  const prior = (await repo.listChapterImages(chapterId))[0]!, ref = prior.file!;
  let failOnce = true;
  const unreliable = createSourceImageFiles({ ...files, read: async (path) => {
    if (path === ref.relativePath && failOnce) { failOnce = false; throw new Error('Original synthetic one-shot read failure.'); }
    return files.read(path);
  } }, digest, uuid);
  const rejected = binarySource(bytes, mime);
  const result = await downloadImages(id, repo, rejected.client, digest, unreliable);
  expect(result.failure).toMatchObject({ code: 'storage', message: expect.stringContaining(`Image repair rejected: ${reason}`) });
  expect(rejected.calls).toEqual([prior.sourceUrl]);
  expect((await repo.listChapterImages(chapterId))[0]).toEqual(prior);
  expect(await repo.getImageSummary(id)).toMatchObject({ local: 1, pending: 0, omitted: 0 });
  await imageFiles.cleanup(() => repo.listSourceAssetReferences());
  expect(await imageFiles.read(ref)).toEqual(png()); expect(await repo.listSourceAssetReferences()).toContain(ref.relativePath);
  const render = createLocalContentFiles(files, digest, async () => { throw new Error('No fixture/source access.'); }, uuid);
  const directory = await render.render(chapter, locator, { theme: 'dark', fontSize: 24 }, uuid(), null, await repo.listChapterImages(chapterId));
  expect(await files.read(`${directory}/source-image-0.png`)).toEqual(png());
  expect(Buffer.from(await files.read(`${directory}/index.html`)).toString()).toContain('Generated before.');
  expect(rejected.calls).toHaveLength(1); // Offline render performs no repair request.

  failOnce = true;
  const commit = repo.commitImageResults.bind(repo);
  const committing = jest.spyOn(repo, 'commitImageResults').mockImplementationOnce(async (...args) => {
    expect((await repo.listChapterImages(chapterId))[0]).toEqual(prior);
    expect(files.exists(ref.relativePath)).toBe(true);
    await imageFiles.cleanup(() => repo.listSourceAssetReferences());
    expect(files.exists(ref.relativePath)).toBe(true); // Both old SQL ref and active new stage survive.
    await commit(...args);
  });
  const replacement = binarySource(jpeg(), 'image/jpeg');
  expect((await downloadImages(id, repo, replacement.client, digest, unreliable)).failure).toBeNull();
  expect(committing).toHaveBeenCalledTimes(1); committing.mockRestore();
  const next = (await repo.listChapterImages(chapterId))[0]!.file!;
  expect(next.relativePath).not.toBe(ref.relativePath); expect(next.format).toBe('jpeg');
  expect(next.digest).not.toBe(ref.digest); expect(await imageFiles.read(next)).toEqual(jpeg());
  expect(files.exists(ref.relativePath)).toBe(true);
  expect(await repo.listSourceAssetReferences()).not.toContain(ref.relativePath);
  expect(await imageFiles.cleanup(() => repo.listSourceAssetReferences())).toBe(1);
  expect(files.exists(ref.relativePath)).toBe(false); expect(files.exists(next.relativePath)).toBe(true);
  expect(await repo.getChapter(chapterId)).toEqual(chapter); expect(await repo.getLocator(chapterId)).toEqual(locator);
});
test('reference transaction rejects downloaded-to-omitted demotion and rolls back earlier batch changes', async () => {
  await seed(markup(2), true); await run(); const prior = await repo.listChapterImages(chapterId);
  const candidate = await imageFiles.stage(jpeg(), 'image/jpeg');
  try {
    await expect(repo.commitImageResults(id, chapterId, [{ slot: 0, file: candidate.file }, { slot: 1, reason: 'invalid-bytes' }])).rejects.toThrow('validated replacement');
  } finally { candidate.release(); }
  expect(await repo.listChapterImages(chapterId)).toEqual(prior);
  await imageFiles.cleanup(() => repo.listSourceAssetReferences());
  for (const image of prior) expect(await imageFiles.read(image.file!)).toEqual(png());
  expect(files.exists(candidate.file.relativePath)).toBe(false);
});
test('completed pending work commits before a later historical repair rejection without demoting the old reference', async () => {
  const chapter = await seed(markup(2), true), candidate = await imageFiles.stage(png());
  await repo.commitImageResults(id, chapterId, [{ slot: 1, file: candidate.file }]); candidate.release();
  const prior = (await repo.listChapterImages(chapterId))[1]!;
  const unavailable = createSourceImageFiles({ ...files, read: async (path) => {
    if (path === prior.file!.relativePath) throw new Error('Original synthetic local access failure.');
    return files.read(path);
  } }, digest, uuid);
  const fake = source(), get = fake.client.getImage.bind(fake.client);
  jest.spyOn(fake.client, 'getImage').mockImplementation(async (...args) => ({ ...await get(...args),
    contentType: args[0].endsWith('generated-1.png') ? 'text/html' : 'image/png' }));
  expect((await downloadImages(id, repo, fake.client, digest, unavailable)).failure?.code).toBe('storage');
  expect((await repo.listChapterImages(chapterId))[1]).toEqual(prior);
  expect(await repo.getImageSummary(id)).toMatchObject({ local: 2, pending: 0, omitted: 0 });
  await imageFiles.cleanup(() => repo.listSourceAssetReferences());
  for (const image of await repo.listChapterImages(chapterId)) expect(await imageFiles.read(image.file!)).toEqual(png());
  expect(await repo.getChapter(chapterId)).toEqual(chapter);
});
test.each(['missing', 'corrupt'])('rejected repair preserves a truly %s historical reference for a later successful explicit retry', async (kind) => {
  const chapter = await seed(markup(), true), locator = await repo.getLocator(chapterId); await run();
  const prior = (await repo.listChapterImages(chapterId))[0]!;
  if (kind === 'missing') files.remove(prior.file!.relativePath); else files.write(prior.file!.relativePath, png().slice(0, 30));
  const rejected = binarySource(png(), 'image/svg+xml');
  expect((await run(rejected)).failure?.code).toBe('storage');
  expect((await repo.listChapterImages(chapterId))[0]).toEqual(prior);
  const render = createLocalContentFiles(files, digest, async () => { throw new Error('No source request.'); }, uuid);
  const directory = await render.render(chapter, locator, { theme: 'light', fontSize: 20 }, uuid(), null, [prior]);
  expect(Buffer.from(await files.read(`${directory}/index.html`)).toString()).toContain('[Local image unavailable:');
  expect((await run(binarySource(jpeg(), 'image/jpeg'))).failure).toBeNull();
  const next = (await repo.listChapterImages(chapterId))[0]!.file!;
  expect(next.relativePath).not.toBe(prior.file!.relativePath); expect(await imageFiles.read(next)).toEqual(jpeg());
  expect(await repo.getChapter(chapterId)).toEqual(chapter); expect(await repo.getLocator(chapterId)).toEqual(locator);
});

test.each(['slot', 'final guard'] as const)('UI D3: cancellation during legacy discovery at %s stays cancelled and rolls back', async (point) => {
  const chapter = await seed(markup(2), false), locator = await repo.getLocator(chapterId);
  const controller = new AbortController(), transaction = host.db.withExclusiveTransactionAsync;
  host.db.withExclusiveTransactionAsync = (work) => transaction((tx) => work({
    ...tx,
    runAsync: async (sql, ...args) => {
      const result = await tx.runAsync(sql, ...args);
      if (point === 'slot' && sql.includes('INSERT INTO chapter_images')) controller.abort();
      return result;
    },
    getFirstAsync: async <T,>(sql: string, ...args: Parameters<typeof tx.getFirstAsync> extends [string, ...infer P] ? P : never) => {
      const result = await tx.getFirstAsync<T>(sql, ...args);
      if (point === 'final guard' && sql === 'PRAGMA foreign_key_check') controller.abort();
      return result;
    },
  }));
  const result = await run(source({ '101': markup(2) }), controller.signal);
  expect(result.failure).toMatchObject({ code: 'cancelled' });
  expect(await repo.listChapterImages(chapterId)).toEqual([]);
  expect(await repo.getImageSummary(id)).toMatchObject({ unknown: 1, scanned: 0 });
  expect(await repo.getChapter(chapterId)).toEqual(chapter); expect(await repo.getLocator(chapterId)).toEqual(locator);
  host.db.withExclusiveTransactionAsync = transaction;
  expect((await run(source({ '101': markup(2) }))).failure).toBeNull();
  expect(await repo.getImageSummary(id)).toMatchObject({ local: 2, pending: 0 });
});

test('UI D3: actual legacy discovery commit failure is still storage, with readable text and explicit retry', async () => {
  const chapter = await seed(), locator = await repo.getLocator(chapterId);
  host.failNextCommit();
  expect((await run()).failure).toMatchObject({ code: 'storage' });
  expect(await repo.listChapterImages(chapterId)).toEqual([]);
  expect(await repo.getChapter(chapterId)).toEqual(chapter); expect(await repo.getLocator(chapterId)).toEqual(locator);
  expect((await run()).failure).toBeNull();
});
