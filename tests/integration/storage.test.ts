import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '../../src/storage/migrations';
import { compileFixture, createRepository } from '../../src/storage/repository';
import type { Locator } from '../../src/domain/types';
import { hostSqlite } from './host-sqlite';
import { exclusiveTransaction } from '../../src/storage/database';

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
  expect(await repo.getPreferences()).toEqual({ theme: 'dark', fontSize: 28 });
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
