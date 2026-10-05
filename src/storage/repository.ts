import type { Chapter, ChapterSummary, Locator, Preferences, StoryMetadata, StorySummary, StoryContentsEntry } from '../domain/types';
import { DEFAULT_PREFERENCES } from '../domain/types';
import { chapterId, storyId } from '../domain/identity';
import { prepareContent } from '../content/sanitize';
import { fixtureStory } from '../fixtures/story';
import { type SqlDatabase, serializeWrites } from './database';

export async function compileFixture(digest: (value: string) => Promise<string>) {
  const id = storyId(fixtureStory.source, fixtureStory.threadId);
  const chapters = await Promise.all(fixtureStory.chapters.map(async (chapter, position) => ({
    ...await prepareContent(chapter.sourceHtml, digest),
    id: chapterId(id, chapter.postId), storyId: id,
    postId: chapter.postId, title: chapter.title, position,
  })));
  return { ...fixtureStory, id, chapters };
}

interface ChapterRow {
  id: string; story_id: string; title: string; position: number; html: string;
  content_hash: string; sanitizer_version: string; block_ids: string; links: string;
}
interface LocatorRow {
  chapter_id: string; content_hash: string; block_id: string; block_offset: number;
  progression: number; expanded_spoilers: string;
}

/** Optional diagnostic boundary; exceptions are handled by the real transaction. */
export type WriteBoundary = (phase: 'before-write' | 'after-html-write' | 'before-commit') => Promise<void>;

export function createRepository(db: SqlDatabase) {
  const write = serializeWrites(db);
  const storySelect = `SELECT s.id, s.source, s.thread_id AS threadId, s.title,
    NULLIF(s.author, '') AS author, s.source_url AS sourceUrl, s.primary_category_id AS categoryId,
    COUNT(e.post_id) AS total, COUNT(c.id) AS downloaded FROM stories s
    LEFT JOIN threadmark_entries e ON e.story_id = s.id
    LEFT JOIN chapters c ON c.story_id = e.story_id AND c.post_id = e.post_id`;
  return {
    async listStories(): Promise<StorySummary[]> {
      return db.getAllAsync(`${storySelect} GROUP BY s.id ORDER BY s.title, s.id`);
    },
    async getStory(id: string): Promise<StorySummary | null> {
      return db.getFirstAsync(`${storySelect} WHERE s.id = ? GROUP BY s.id`, id);
    },
    async listContents(id: string): Promise<StoryContentsEntry[]> {
      const rows = await db.getAllAsync<Omit<StoryContentsEntry, 'downloaded'> & { downloaded: number }>(
        `SELECT s.id || ':post:' || e.post_id AS id, e.post_id AS postId, e.title, e.position,
          e.source_url AS sourceUrl, c.id IS NOT NULL AS downloaded
         FROM threadmark_entries e JOIN stories s ON s.id = e.story_id
         LEFT JOIN chapters c ON c.story_id = e.story_id AND c.post_id = e.post_id
         WHERE e.story_id = ? ORDER BY e.position`, id);
      return rows.map((row) => ({ ...row, downloaded: Boolean(row.downloaded) }));
    },
    async commitInitialManifest(story: StoryMetadata, manifest: {
      state: 'COMPLETE'; entries: { postId: string; title: string; url: string }[];
    }): Promise<void> {
      if (manifest.state !== 'COMPLETE' || !manifest.entries.length ||
          story.source !== 'spacebattles' || story.id !== storyId(story.source, story.threadId) ||
          !story.title.trim() || !story.categoryId || !story.sourceUrl ||
          new Set(manifest.entries.map((entry) => entry.postId)).size !== manifest.entries.length) {
        throw new Error('Invalid complete initial manifest.');
      }
      for (const entry of manifest.entries) {
        if (chapterId(story.id, entry.postId) !== `${story.id}:post:${entry.postId}` || !entry.url) throw new Error('Invalid manifest entry.');
      }
      await write(async (tx) => {
        // Initial import only: never replace an existing manifest or reconcile metadata.
        if (await tx.getFirstAsync('SELECT id FROM stories WHERE id = ?', story.id)) return;
        await tx.runAsync(`INSERT INTO stories(id, source, thread_id, title, author, source_url, primary_category_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)`, story.id, story.source, story.threadId, story.title,
          story.author ?? '', story.sourceUrl, story.categoryId);
        for (const [position, entry] of manifest.entries.entries()) {
          await tx.runAsync(`INSERT INTO threadmark_entries(story_id, post_id, title, position, source_url)
            VALUES (?, ?, ?, ?, ?)`, story.id, entry.postId, entry.title, position, entry.url);
        }
      });
    },
    async commitDownloadedChapter(story: string, postId: string,
      content: Pick<Chapter, 'html' | 'contentHash' | 'sanitizerVersion' | 'blockIds' | 'links'>,
      signal?: AbortSignal): Promise<void> {
      await write(async (tx) => {
        if (signal?.aborted) throw new Error('Chapter commit cancelled.');
        const entry = await tx.getFirstAsync<{ title: string; position: number }>(
          'SELECT title, position FROM threadmark_entries WHERE story_id = ? AND post_id = ?', story, postId);
        if (!entry) throw new Error('Chapter has no committed manifest entry.');
        await tx.runAsync(`INSERT INTO chapters(id, story_id, post_id, title, position, html,
          content_hash, sanitizer_version, block_ids, links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT DO NOTHING`, chapterId(story, postId), story, postId, entry.title, entry.position,
          content.html, content.contentHash, content.sanitizerVersion, JSON.stringify(content.blockIds), JSON.stringify(content.links));
        if (signal?.aborted) throw new Error('Chapter commit cancelled.');
      });
    },
    async replaceChapterContent(id: string, content: Pick<Chapter, 'html' | 'contentHash' | 'sanitizerVersion' | 'blockIds' | 'links'>,
      boundary?: WriteBoundary): Promise<void> {
      await write(async (tx) => {
        if (!await tx.getFirstAsync('SELECT id FROM chapters WHERE id = ?', id)) throw new Error('Unknown chapter.');
        await boundary?.('before-write');
        await tx.runAsync('UPDATE chapters SET html = ?, content_hash = ? WHERE id = ?', content.html, content.contentHash, id);
        await boundary?.('after-html-write');
        await tx.runAsync('UPDATE chapters SET sanitizer_version = ?, block_ids = ?, links = ? WHERE id = ?',
          content.sanitizerVersion, JSON.stringify(content.blockIds), JSON.stringify(content.links), id);
        await boundary?.('before-commit');
      });
    },
    async commitAssetReference(asset: { relativePath: string; byteLength: number }, boundary?: WriteBoundary): Promise<void> {
      // Caller must finish and validate staging before supplying this reference.
      if (!/^assets\/[a-f0-9-]{36}\.png$/.test(asset.relativePath) || !Number.isSafeInteger(asset.byteLength) || asset.byteLength <= 0) throw new Error('Invalid asset reference.');
      await write(async (tx) => {
        await boundary?.('before-write');
        await tx.runAsync('INSERT INTO assets(id, relative_path, byte_length) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET relative_path = excluded.relative_path, byte_length = excluded.byte_length',
          'harbor', asset.relativePath, asset.byteLength);
        await boundary?.('before-commit');
      });
    },
    async seed(fixture: Awaited<ReturnType<typeof compileFixture>>, asset: { relativePath: string; byteLength: number }) {
      await write(async (tx) => {
        await tx.runAsync('INSERT INTO stories(id, source, thread_id, title, author) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
          fixture.id, fixture.source, fixture.threadId, fixture.title, fixture.author);
        for (const chapter of fixture.chapters) {
          await tx.runAsync(`INSERT INTO chapters(id, story_id, post_id, title, position, html,
            content_hash, sanitizer_version, block_ids, links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
          chapter.id, fixture.id, chapter.postId, chapter.title, chapter.position, chapter.html,
          chapter.contentHash, chapter.sanitizerVersion, JSON.stringify(chapter.blockIds), JSON.stringify(chapter.links));
        }
        const version = await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
        if ((version?.user_version ?? 0) >= 2) {
          for (const chapter of fixture.chapters) await tx.runAsync(`INSERT INTO threadmark_entries(
            story_id, post_id, title, position, source_url) VALUES (?, ?, ?, ?, '') ON CONFLICT DO NOTHING`,
          fixture.id, chapter.postId, chapter.title, chapter.position);
        }
        if (asset.relativePath) {
          await tx.runAsync('INSERT INTO assets(id, relative_path, byte_length) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET relative_path = excluded.relative_path, byte_length = excluded.byte_length',
            'harbor', asset.relativePath, asset.byteLength);
        }
      });
    },
    async listChapters(story?: string): Promise<ChapterSummary[]> {
      return story ? db.getAllAsync('SELECT id, title, position FROM chapters WHERE story_id = ? ORDER BY position, id', story)
        : db.getAllAsync('SELECT id, title, position FROM chapters ORDER BY position, id');
    },
    async getChapter(id: string): Promise<Chapter | null> {
      const row = await db.getFirstAsync<ChapterRow>('SELECT * FROM chapters WHERE id = ?', id);
      return row && { id: row.id, storyId: row.story_id, title: row.title, position: row.position,
        html: row.html, contentHash: row.content_hash, sanitizerVersion: row.sanitizer_version,
        blockIds: JSON.parse(row.block_ids), links: JSON.parse(row.links) };
    },
    async getLocator(id: string): Promise<Locator | null> {
      const row = await db.getFirstAsync<LocatorRow>('SELECT * FROM reading_positions WHERE chapter_id = ?', id);
      return row && { chapterId: row.chapter_id, contentHash: row.content_hash, blockId: row.block_id,
        offset: row.block_offset, progression: row.progression, expandedSpoilers: JSON.parse(row.expanded_spoilers) };
    },
    async getLastChapter(): Promise<string | null> {
      const row = await db.getFirstAsync<{ chapter_id: string }>('SELECT chapter_id FROM reading_positions ORDER BY updated_at DESC LIMIT 1');
      return row?.chapter_id ?? null;
    },
    async saveLocator(locator: Locator): Promise<void> {
      await write(async (tx) => {
        // Stale callbacks must never persist against another content version.
        const chapter = await tx.getFirstAsync<{ content_hash: string; block_ids: string }>(
          'SELECT content_hash, block_ids FROM chapters WHERE id = ?', locator.chapterId);
        const blockIds: string[] = chapter ? JSON.parse(chapter.block_ids) : [];
        if (!chapter || chapter.content_hash !== locator.contentHash || !blockIds.includes(locator.blockId) ||
          !Number.isFinite(locator.offset) || locator.offset < 0 || !Number.isFinite(locator.progression) ||
          locator.progression < 0 || locator.progression > 1 ||
          locator.expandedSpoilers.some((id) => !blockIds.includes(id))) {
          throw new Error('Invalid or stale reading locator.');
        }
        await tx.runAsync(`INSERT INTO reading_positions(chapter_id, content_hash, block_id, block_offset,
          progression, expanded_spoilers, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(chapter_id) DO UPDATE SET content_hash = excluded.content_hash,
          block_id = excluded.block_id, block_offset = excluded.block_offset,
          progression = excluded.progression, expanded_spoilers = excluded.expanded_spoilers,
          updated_at = excluded.updated_at`, locator.chapterId, locator.contentHash,
        locator.blockId, locator.offset, locator.progression, JSON.stringify(locator.expandedSpoilers), Date.now());
      });
    },
    async getPreferences(): Promise<Preferences> {
      const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'reading');
      if (!row) return DEFAULT_PREFERENCES;
      const parsed: Preferences = JSON.parse(row.value);
      if ((parsed.theme !== 'light' && parsed.theme !== 'dark') || !Number.isFinite(parsed.fontSize) ||
        parsed.fontSize < 14 || parsed.fontSize > 32) return DEFAULT_PREFERENCES;
      return parsed;
    },
    async savePreferences(value: Preferences): Promise<void> {
      await write(async (tx) => {
        await tx.runAsync('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          'reading', JSON.stringify(value));
      });
    },
    async getAssetPath(): Promise<string | null> {
      const row = await db.getFirstAsync<{ relative_path: string }>('SELECT relative_path FROM assets WHERE id = ?', 'harbor');
      return row?.relative_path ?? null;
    },
    async getChapterAssetPath(id: string): Promise<string | null> {
      const row = await db.getFirstAsync<{ relative_path: string }>(`SELECT a.relative_path FROM chapters c
        JOIN stories s ON s.id = c.story_id JOIN assets a ON a.id = 'harbor'
        WHERE c.id = ? AND s.id = ?`, id, storyId(fixtureStory.source, fixtureStory.threadId));
      return row?.relative_path ?? null;
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;
