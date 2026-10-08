import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '../../src/storage/migrations';
import { compileFixture, createRepository } from '../../src/storage/repository';
import type { Locator } from '../../src/domain/types';
import { hostSqlite } from './host-sqlite';
import { exclusiveTransaction } from '../../src/storage/database';
import { PositionSession } from '../../src/reader/position';
import { ReadCompletion } from '../../src/reader/read-state';
import { READER_FONTS } from '../../src/domain/preferences';

const digest = async (value: string) => createHash('sha256').update(value).digest('hex');
const asset = { relativePath: 'assets/11111111-1111-4111-8111-111111111111.png', byteLength: 2024 };
let folder: string;
let host: ReturnType<typeof hostSqlite>;
beforeEach(async () => {
  folder = mkdtempSync(join(tmpdir(), 'stowaway-s0-'));
  host = hostSqlite(join(folder, 'test.db'));
  await migrate(host.db);
});
afterEach(() => {
  host.close();
  if (!folder.startsWith(join(tmpdir(), 'stowaway-s0-'))) throw new Error('Unexpected test directory.');
  rmSync(folder, { recursive: true, force: true });
});

test.each([1, 6])('appearance preferences evolve legacy JSON without migrating schema v%s', async (version) => {
  host.close(); host = hostSqlite(join(folder, 'appearance.db')); await migrate(host.db, version);
  let repo = createRepository(host.db);
  expect(await repo.getAppStyle()).toBe('stowaway');
  expect(await repo.getPreferences()).toEqual({ theme: 'light', fontSize: 20, font: 'georgia' });
  await host.db.runAsync('INSERT INTO settings(key, value) VALUES (?, ?)', 'reading', JSON.stringify({ theme: 'dark', fontSize: 28 }));
  const legacy = await host.db.getAllAsync('SELECT * FROM settings');
  expect(await repo.getPreferences()).toEqual({ theme: 'dark', fontSize: 28, font: 'georgia' });
  expect(await host.db.getAllAsync('SELECT * FROM settings')).toEqual(legacy); // Reading defaults does not rewrite old settings.
  await repo.saveAppStyle('classic');
  expect(await host.db.getFirstAsync('SELECT * FROM settings WHERE key = ?', 'reading')).toEqual(legacy[0]);
  for (const font of READER_FONTS) {
    await repo.savePreferences({ theme: 'paper', fontSize: 24, font });
    host.close(); host = hostSqlite(join(folder, 'appearance.db')); repo = createRepository(host.db);
    expect(await repo.getPreferences()).toEqual({ theme: 'paper', fontSize: 24, font });
    expect(await repo.getAppStyle()).toBe('classic');
    expect(await host.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: version });
  }
  const reading = await repo.getPreferences(); await repo.saveAppStyle('stowaway');
  expect(await repo.getPreferences()).toEqual(reading);
  host.failNextCommit(); await expect(repo.saveAppStyle('classic')).rejects.toThrow();
  expect(await repo.getAppStyle()).toBe('stowaway');
});

test('unknown appearance values resolve safely without rewriting persisted settings', async () => {
  const repo = createRepository(host.db);
  await host.db.runAsync('INSERT INTO settings(key, value) VALUES (?, ?)', 'reading', JSON.stringify({ theme: 'dark', fontSize: 26, font: 'url(https://invalid.example/font)' }));
  expect(await repo.getPreferences()).toEqual({ theme: 'dark', fontSize: 26, font: 'georgia' });
  await host.db.runAsync('UPDATE settings SET value = ? WHERE key = ?', '{broken', 'reading');
  expect(await repo.getPreferences()).toEqual({ theme: 'light', fontSize: 20, font: 'georgia' });
  await host.db.runAsync('INSERT INTO settings(key, value) VALUES (?, ?)', 'app-style', 'unknown');
  expect(await repo.getAppStyle()).toBe('stowaway');
  expect(await host.db.getFirstAsync('SELECT value FROM settings WHERE key = ?', 'app-style')).toEqual({ value: 'unknown' });
});

test.each([false, true])('hardening: real locator rollback cannot resurrect older progress; Read saves independently (newer fails=%s)', async (newerFails) => {
  const fixture = await compileFixture(digest), repo = createRepository(host.db);
  await repo.seed(fixture, asset); const chapter = fixture.chapters[0]!;
  const before = await repo.getChapter(chapter.id);
  const locator: Locator = { chapterId: chapter.id, contentHash: chapter.contentHash,
    blockId: chapter.blockIds[1]!, offset: 10, progression: .2, expandedSpoilers: [] };
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  const transaction = host.db.withExclusiveTransactionAsync.bind(host.db); let count = 0;
  const intercepted = jest.spyOn(host.db, 'withExclusiveTransactionAsync').mockImplementation((work) => transaction(async (tx) => {
    const call = ++count; await work(tx);
    if (call === 1) { entered(); await held; throw new Error('Older locator rollback'); }
    if (call === 2 && newerFails) throw new Error('Newer locator rollback');
  }));
  const offsets: number[] = [];
  const session = new PositionSession(async (value) => { offsets.push(value.offset); await repo.saveLocator(value); }, jest.fn());
  const identity = { session: 'test', chapterId: chapter.id, contentHash: chapter.contentHash };
  session.receive({ ...identity, type: 'ready' });
  session.receive({ ...identity, type: 'position', reason: 'scroll', locator });
  const older = session.flush().catch(() => {}); await started;
  session.receive({ ...identity, type: 'position', reason: 'scroll', locator: { ...locator, offset: 20 } });
  const newer = session.flush().catch(() => {}); release(); await Promise.all([older, newer]);
  intercepted.mockRestore();
  const read = new ReadCompletion(() => repo.markChapterRead(chapter.id));
  await read.request();
  expect((await repo.listContents(chapter.storyId)).find((entry) => entry.id === chapter.id)?.isRead).toBe(true);
  if (!newerFails) expect((await repo.getLocator(chapter.id))?.offset).toBe(20);
  await Promise.all([session.flush(), read.flush()]);
  expect((await repo.getLocator(chapter.id))?.offset).toBe(20);
  expect(offsets).toEqual(newerFails ? [10, 20, 20] : [10, 20]);
  expect(await repo.getChapter(chapter.id)).toEqual(before);
  expect(await host.db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]); session.dispose();
});

test('repeat migration/seed/reopen preserves a single story, three bodies, locator and settings', async () => {
  const fixture = await compileFixture(digest);
  let repo = createRepository(host.db);
  await repo.seed(fixture, asset);
  const chapter = fixture.chapters[0]!;
  const locator: Locator = { chapterId: chapter.id, contentHash: chapter.contentHash,
    blockId: chapter.blockIds[15]!, offset: 47.5, progression: 0.42, expandedSpoilers: [] };
  await repo.saveLocator(locator);
  await repo.savePreferences({ theme: 'dark', fontSize: 28 });
  await repo.seed(fixture, asset);
  host.close();
  host = hostSqlite(join(folder, 'test.db'));
  await migrate(host.db);
  repo = createRepository(host.db);
  await repo.seed(fixture, asset);
  expect(await host.db.getFirstAsync('SELECT count(*) AS count FROM stories')).toEqual({ count: 1 });
  expect(await repo.listChapters()).toHaveLength(3);
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
  expect(await repo.getLastChapter()).toBe(chapter.id);
  expect(await repo.getPreferences()).toEqual({ theme: 'dark', fontSize: 28, font: 'georgia' });
  expect(await repo.getChapter(chapter.id)).toMatchObject({ html: chapter.html, contentHash: chapter.contentHash,
    sanitizerVersion: chapter.sanitizerVersion, blockIds: chapter.blockIds });
});

test('a repeat launch never replaces edited metadata/content or clears a locator', async () => {
  const fixture = await compileFixture(digest);
  const repo = createRepository(host.db);
  await repo.seed(fixture, asset);
  const chapter = fixture.chapters[0]!;
  const locator: Locator = { chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[1]!,
    offset: 10, progression: 0.1, expandedSpoilers: [] };
  await repo.saveLocator(locator);
  await host.db.runAsync('UPDATE chapters SET title = ?, position = ? WHERE id = ?', 'Renamed', 9, chapter.id);
  await repo.seed(fixture, asset);
  expect(await repo.getChapter(chapter.id)).toMatchObject({ title: 'Renamed', position: 9 });
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
});

test('failed seed rolls back every reference; retry does not duplicate rows', async () => {
  const fixture = await compileFixture(digest);
  const repo = createRepository(host.db);
  host.failNextCommit();
  await expect(repo.seed(fixture, asset)).rejects.toThrow('Injected commit failure');
  expect(await repo.listChapters()).toEqual([]);
  expect(await repo.getAssetPath()).toBeNull();
  await repo.seed(fixture, asset);
  await repo.seed(fixture, asset);
  expect(await repo.listChapters()).toHaveLength(3);
});

test('failed locator commit leaves old passage intact and retry succeeds', async () => {
  const fixture = await compileFixture(digest);
  const repo = createRepository(host.db);
  await repo.seed(fixture, asset);
  const chapter = fixture.chapters[0]!;
  const locator: Locator = { chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[2]!,
    offset: 12, progression: 0.2, expandedSpoilers: [] };
  await repo.saveLocator(locator);
  host.failNextCommit();
  await expect(repo.saveLocator({ ...locator, offset: 30 })).rejects.toThrow();
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
  await repo.saveLocator({ ...locator, offset: 30 });
  expect((await repo.getLocator(chapter.id))?.offset).toBe(30);
});

test('stale/invalid locators fail, foreign keys hold and serialized writes finish in order', async () => {
  const fixture = await compileFixture(digest);
  const repo = createRepository(host.db);
  await repo.seed(fixture, asset);
  const chapter = fixture.chapters[0]!;
  const locator: Locator = { chapterId: chapter.id, contentHash: chapter.contentHash,
    blockId: chapter.blockIds[1]!, offset: 0, progression: 0, expandedSpoilers: [] };
  await expect(repo.saveLocator({ ...locator, contentHash: 'stale' })).rejects.toThrow();
  await expect(repo.saveLocator({ ...locator, blockId: 'spoof' })).rejects.toThrow();
  await expect(repo.saveLocator({ ...locator, progression: 2 })).rejects.toThrow();
  await expect(repo.saveLocator({ ...locator, offset: NaN })).rejects.toThrow();
  await expect(host.db.runAsync('DELETE FROM stories')).rejects.toThrow();
  await Promise.all([repo.saveLocator({ ...locator, offset: 10 }), repo.saveLocator({ ...locator, offset: 20 })]);
  expect((await repo.getLocator(chapter.id))?.offset).toBe(20);
});

test('fresh exclusive connections cannot commit broken foreign-key references', async () => {
  const fixture = await compileFixture(digest);
  const repo = createRepository(host.db);
  await repo.seed(fixture, asset);
  await expect(exclusiveTransaction(host.db, async (tx) => {
    expect(await tx.getFirstAsync('PRAGMA foreign_keys')).toEqual({ foreign_keys: 0 });
    await tx.runAsync('DELETE FROM stories');
  })).rejects.toThrow('Foreign key violation');
  expect(await repo.listChapters()).toHaveLength(3);
  expect(await host.db.getFirstAsync('SELECT count(*) AS count FROM stories')).toEqual({ count: 1 });
});
