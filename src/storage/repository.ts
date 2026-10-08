import type { Chapter, ChapterSummary, Locator, Preferences, StoryMetadata, StorySummary, StoryContentsEntry, ReconciliationResult, ContinueReadingTarget } from '../domain/types';
import { DEFAULT_PREFERENCES } from '../domain/types';
import { chapterId, storyId } from '../domain/identity';
import { prepareContent } from '../content/sanitize';
import { fixtureStory } from '../fixtures/story';
import { type SqlDatabase, serializeWrites } from './database';
import { documentUrl, threadFromUrl } from '../sources/spacebattles/url';
import { createImageRepository, insertImageSlots } from '../images/repository';
import type { ImageSlot } from '../images/types';
import { availableBody } from './availability';
import { createManagementRepository } from './management';
import { withLocalStoryWrite } from '../importing/ownership';

interface CompleteManifest {
  state: 'COMPLETE'; entries: { postId: string; title: string; url: string }[];
}

function validateManifest(story: StoryMetadata, manifest: CompleteManifest) {
  if (manifest.state !== 'COMPLETE' || !manifest.entries.length ||
      story.source !== 'spacebattles' || story.id !== storyId(story.source, story.threadId) ||
      threadFromUrl(story.sourceUrl).storyId !== story.id || !story.title.trim() || !story.categoryId ||
      new Set(manifest.entries.map((entry) => entry.postId)).size !== manifest.entries.length) {
    throw new Error('Invalid complete manifest.');
  }
  for (const entry of manifest.entries) {
    if (chapterId(story.id, entry.postId) !== `${story.id}:post:${entry.postId}`) throw new Error('Invalid manifest identity.');
    documentUrl(entry.url, story.threadId);
  }
}

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
  // Historical migration checks can still inspect v3/v4. No completion history
  // exists there; normal startup migrates to v6 before exposing read-state writes.
  async function readColumn() {
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    return (version?.user_version ?? 0) >= 5 ? 'e.is_read' : '0';
  }
  const storySelect = (read: string, available: string) => `SELECT s.id, s.source, s.thread_id AS threadId, s.title,
    NULLIF(s.author, '') AS author, s.source_url AS sourceUrl, s.primary_category_id AS categoryId,
    s.last_update_attempt_at AS lastUpdateAttemptAt, s.last_update_success_at AS lastUpdateSuccessAt,
    COUNT(e.post_id) AS total, COUNT(c.id) AS downloaded,
    COALESCE(SUM(e.post_id IS NOT NULL AND ${read} = 0), 0) AS unread FROM stories s
    LEFT JOIN threadmark_entries e ON e.story_id = s.id AND e.currently_listed = 1
    LEFT JOIN chapters c ON c.story_id = e.story_id AND c.post_id = e.post_id AND (${available})`;
  return {
    ...createManagementRepository(db, write),
    ...createImageRepository(db, write),
    async listStories(): Promise<StorySummary[]> {
      return db.getAllAsync(`${storySelect(await readColumn(), await availableBody(db))} GROUP BY s.id ORDER BY s.title, s.id`);
    },
    async getStory(id: string): Promise<StorySummary | null> {
      return db.getFirstAsync(`${storySelect(await readColumn(), await availableBody(db))} WHERE s.id = ? GROUP BY s.id`, id);
    },
    async listContents(id: string): Promise<StoryContentsEntry[]> {
      const rows = await db.getAllAsync<Omit<StoryContentsEntry, 'downloaded' | 'isRead'> & { downloaded: number; isRead: number }>(
        `SELECT s.id || ':post:' || e.post_id AS id, e.post_id AS postId, e.title, e.position,
          e.source_url AS sourceUrl, c.id IS NOT NULL AS downloaded, ${await readColumn()} AS isRead
         FROM threadmark_entries e JOIN stories s ON s.id = e.story_id
         LEFT JOIN chapters c ON c.story_id = e.story_id AND c.post_id = e.post_id AND (${await availableBody(db)})
         WHERE e.story_id = ? AND e.currently_listed = 1 ORDER BY e.position`, id);
      return rows.map((row) => ({ ...row, downloaded: Boolean(row.downloaded), isRead: Boolean(row.isRead) }));
    },
    async listSavedUnlisted(id: string): Promise<StoryContentsEntry[]> {
      const rows = await db.getAllAsync<Omit<StoryContentsEntry, 'downloaded' | 'isRead'> & { isRead: number }>(
        `SELECT c.id, e.post_id AS postId, e.title, e.position, e.source_url AS sourceUrl, ${await readColumn()} AS isRead
         FROM threadmark_entries e JOIN chapters c ON c.story_id = e.story_id AND c.post_id = e.post_id
         WHERE e.story_id = ? AND e.currently_listed = 0 AND (${await availableBody(db)}) ORDER BY e.position, e.post_id`, id);
      return rows.map((row) => ({ ...row, downloaded: true, isRead: Boolean(row.isRead) }));
    },
    async setEntryRead(story: string, postId: string, isRead: boolean): Promise<void> {
      if (typeof isRead !== 'boolean') throw new Error('Invalid read state.');
      await withLocalStoryWrite(story, () => write(async (tx) => {
        if (!await tx.getFirstAsync('SELECT post_id FROM threadmark_entries WHERE story_id = ? AND post_id = ?', story, postId)) {
          throw new Error('Read state requires a stored manifest entry.');
        }
        await tx.runAsync('UPDATE threadmark_entries SET is_read = ? WHERE story_id = ? AND post_id = ? AND is_read != ?',
          Number(isRead), story, postId, Number(isRead));
      }));
    },
    async markChapterRead(id: string): Promise<void> {
      await withLocalStoryWrite(id.split(':post:')[0]!, () => write(async (tx) => {
        const entry = await tx.getFirstAsync<{ story_id: string; post_id: string }>(`SELECT e.story_id, e.post_id
          FROM chapters c JOIN threadmark_entries e ON e.story_id = c.story_id AND e.post_id = c.post_id
          WHERE c.id = ? AND (${await availableBody(tx)})`, id);
        if (!entry) throw new Error('Read state requires a downloaded chapter with a stored manifest entry.');
        await tx.runAsync('UPDATE threadmark_entries SET is_read = 1 WHERE story_id = ? AND post_id = ? AND is_read = 0',
          entry.story_id, entry.post_id);
      }));
    },
    async recordUpdateAttempt(id: string, at: number, signal?: AbortSignal): Promise<void> {
      const checkCancelled = () => { if (signal?.aborted) throw new Error('Update attempt cancelled.'); };
      if (!Number.isSafeInteger(at) || at < 0) throw new Error('Invalid update timestamp.');
      await write(async (tx) => {
        checkCancelled();
        const story = await tx.getFirstAsync<{ source: string }>('SELECT source FROM stories WHERE id = ?', id);
        if (story?.source !== 'spacebattles') throw new Error('Update requires an imported story.');
        await tx.runAsync('UPDATE stories SET last_update_attempt_at = ? WHERE id = ?', at, id);
      }, checkCancelled);
    },
    async reconcileManifest(id: string, story: StoryMetadata, manifest: CompleteManifest,
      successAt: number, signal?: AbortSignal): Promise<ReconciliationResult> {
      const checkCancelled = () => { if (signal?.aborted) throw new Error('Reconciliation cancelled.'); };
      checkCancelled(); validateManifest(story, manifest);
      if (id !== story.id || !Number.isSafeInteger(successAt) || successAt < 0) throw new Error('Invalid update identity or timestamp.');
      let result!: ReconciliationResult;
      await write(async (tx) => {
        checkCancelled();
        const stored = await tx.getFirstAsync<StoryMetadata>(`SELECT id, source, thread_id AS threadId,
          title, NULLIF(author, '') AS author, source_url AS sourceUrl, primary_category_id AS categoryId
          FROM stories WHERE id = ?`, id);
        if (!stored || stored.source !== story.source || stored.threadId !== story.threadId) throw new Error('Update story identity does not match.');
        const previous = await tx.getAllAsync<{ post_id: string; title: string; currently_listed: number }>(
          'SELECT post_id, title, currently_listed FROM threadmark_entries WHERE story_id = ? ORDER BY position, post_id', id);
        const old = new Map(previous.map((entry) => [entry.post_id, entry]));
        const incoming = new Set(manifest.entries.map((entry) => entry.postId));
        const oldCommon = previous.filter((entry) => entry.currently_listed && incoming.has(entry.post_id)).map((entry) => entry.post_id);
        const newCommon = manifest.entries.filter((entry) => old.get(entry.postId)?.currently_listed).map((entry) => entry.postId);
        const author = story.author ?? stored.author;
        result = { added: 0, reactivated: 0, removed: previous.filter((entry) => entry.currently_listed && !incoming.has(entry.post_id)).length,
          renamed: 0, orderChanged: oldCommon.some((post, index) => post !== newCommon[index]),
          metadataChanged: story.title !== stored.title || author !== stored.author || story.sourceUrl !== stored.sourceUrl || story.categoryId !== stored.categoryId,
          total: manifest.entries.length, downloaded: 0, pending: 0 };
        // Temporarily unlist inside the transaction so swaps/insertions never collide
        // with current positions. Retained rows keep their last nonnegative position.
        await tx.runAsync('UPDATE threadmark_entries SET currently_listed = 0 WHERE story_id = ?', id);
        for (const [position, entry] of manifest.entries.entries()) {
          checkCancelled();
          const prior = old.get(entry.postId);
          if (!prior) result.added++;
          else {
            if (!prior.currently_listed) result.reactivated++;
            if (prior.title !== entry.title) result.renamed++;
          }
          await tx.runAsync(`INSERT INTO threadmark_entries(story_id, post_id, title, position, source_url, currently_listed)
            VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT(story_id, post_id) DO UPDATE SET
            title = excluded.title, position = excluded.position, source_url = excluded.source_url, currently_listed = 1`,
          id, entry.postId, entry.title, position, entry.url);
          await tx.runAsync(`UPDATE chapters SET title = ?, position = ? WHERE story_id = ? AND post_id = ?
            AND (title != ? OR position != ?)`, entry.title, position, id, entry.postId, entry.title, position);
        }
        checkCancelled();
        await tx.runAsync(`UPDATE stories SET title = ?, author = ?, source_url = ?, primary_category_id = ?,
          last_update_success_at = ? WHERE id = ?`, story.title, author ?? '', story.sourceUrl, story.categoryId, successAt, id);
        const counts = await tx.getFirstAsync<{ downloaded: number }>(`SELECT COUNT(c.id) AS downloaded FROM threadmark_entries e
          JOIN chapters c ON c.story_id = e.story_id AND c.post_id = e.post_id
          WHERE e.story_id = ? AND e.currently_listed = 1 AND (${await availableBody(tx)})`, id);
        result.downloaded = counts?.downloaded ?? 0; result.pending = result.total - result.downloaded;
      }, checkCancelled);
      return result;
    },
    async commitInitialManifest(story: StoryMetadata, manifest: CompleteManifest, signal?: AbortSignal): Promise<void> {
      const checkCancelled = () => { if (signal?.aborted) throw new Error('Manifest commit cancelled.'); };
      checkCancelled();
      validateManifest(story, manifest);
      await write(async (tx) => {
        checkCancelled();
        // Initial import only: never replace an existing manifest or reconcile metadata.
        if (await tx.getFirstAsync('SELECT id FROM stories WHERE id = ?', story.id)) return;
        checkCancelled();
        await tx.runAsync(`INSERT INTO stories(id, source, thread_id, title, author, source_url, primary_category_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)`, story.id, story.source, story.threadId, story.title,
          story.author ?? '', story.sourceUrl, story.categoryId);
        for (const [position, entry] of manifest.entries.entries()) {
          checkCancelled();
          await tx.runAsync(`INSERT INTO threadmark_entries(story_id, post_id, title, position, source_url)
            VALUES (?, ?, ?, ?, ?)`, story.id, entry.postId, entry.title, position, entry.url);
        }
        checkCancelled();
      }, checkCancelled);
    },
    async commitDownloadedChapter(story: string, postId: string,
      content: Pick<Chapter, 'html' | 'contentHash' | 'sanitizerVersion' | 'blockIds' | 'links'>,
      signal?: AbortSignal, images?: ImageSlot[]): Promise<void> {
      const checkCancelled = () => { if (signal?.aborted) throw new Error('Chapter commit cancelled.'); };
      await write(async (tx) => {
        checkCancelled();
        const entry = await tx.getFirstAsync<{ title: string; position: number }>(
          'SELECT title, position FROM threadmark_entries WHERE story_id = ? AND post_id = ? AND currently_listed = 1', story, postId);
        if (!entry) throw new Error('Chapter has no committed manifest entry.');
        const availability = await availableBody(tx, 'chapters');
        if (await tx.getFirstAsync(`SELECT id FROM chapters WHERE id = ? AND (${availability})`, chapterId(story, postId))) return;
        checkCancelled();
        // v6 can repopulate a retained shell without replacing its identity or locator.
        const shell = await tx.getFirstAsync('SELECT id FROM chapters WHERE id = ?', chapterId(story, postId));
        if (shell) {
          await tx.runAsync(`UPDATE chapters SET title = ?, position = ?, html = ?, content_hash = ?,
            sanitizer_version = ?, block_ids = ?, links = ?, body_available = 1, image_discovery = 'unknown' WHERE id = ?`,
          entry.title, entry.position, content.html, content.contentHash, content.sanitizerVersion,
          JSON.stringify(content.blockIds), JSON.stringify(content.links), chapterId(story, postId));
        } else {
          await tx.runAsync(`INSERT INTO chapters(id, story_id, post_id, title, position, html,
            content_hash, sanitizer_version, block_ids, links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT DO NOTHING`, chapterId(story, postId), story, postId, entry.title, entry.position,
          content.html, content.contentHash, content.sanitizerVersion, JSON.stringify(content.blockIds), JSON.stringify(content.links));
        }
        if (images) await insertImageSlots(tx, chapterId(story, postId), content, images, signal);
        checkCancelled();
      }, checkCancelled);
    },
    async replaceChapterContent(id: string, content: Pick<Chapter, 'html' | 'contentHash' | 'sanitizerVersion' | 'blockIds' | 'links'>,
      boundary?: WriteBoundary): Promise<void> {
      await write(async (tx) => {
        if (!await tx.getFirstAsync(`SELECT id FROM chapters WHERE id = ? AND (${await availableBody(tx, 'chapters')})`, id)) throw new Error('Unknown chapter.');
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
        if ((version?.user_version ?? 0) >= 4) await tx.runAsync("UPDATE chapters SET image_discovery = 'fixture' WHERE story_id = ?", fixture.id);
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
      const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if ((version?.user_version ?? 0) >= 3) {
        return db.getAllAsync(`SELECT c.id, e.title, e.position FROM chapters c JOIN threadmark_entries e
          ON e.story_id = c.story_id AND e.post_id = c.post_id WHERE e.currently_listed = 1 AND (${await availableBody(db)})
          ${story ? 'AND c.story_id = ?' : ''} ORDER BY e.position, c.id`, ...(story ? [story] : []));
      }
      // S2A's deliberately isolated v1 has no manifest table.
      return story ? db.getAllAsync('SELECT id, title, position FROM chapters WHERE story_id = ? ORDER BY position, id', story)
        : db.getAllAsync('SELECT id, title, position FROM chapters ORDER BY position, id');
    },
    async getChapter(id: string): Promise<Chapter | null> {
      const row = await db.getFirstAsync<ChapterRow>(`SELECT * FROM chapters WHERE id = ? AND (${await availableBody(db, 'chapters')})`, id);
      return row && { id: row.id, storyId: row.story_id, title: row.title, position: row.position,
        html: row.html, contentHash: row.content_hash, sanitizerVersion: row.sanitizer_version,
        blockIds: JSON.parse(row.block_ids), links: JSON.parse(row.links) };
    },
    async getLocator(id: string): Promise<Locator | null> {
      const row = await db.getFirstAsync<LocatorRow>('SELECT * FROM reading_positions WHERE chapter_id = ?', id);
      return row && { chapterId: row.chapter_id, contentHash: row.content_hash, blockId: row.block_id,
        offset: row.block_offset, progression: row.progression, expandedSpoilers: JSON.parse(row.expanded_spoilers) };
    },
    async getContinueReading(story?: string): Promise<ContinueReadingTarget | null> {
      const row = await db.getFirstAsync<Omit<ContinueReadingTarget, 'currentlyListed'> & { currentlyListed: number }>(
        `SELECT s.id AS storyId, s.title AS storyTitle, c.id AS chapterId, e.title AS chapterTitle,
          e.currently_listed AS currentlyListed FROM reading_positions p
          JOIN chapters c ON c.id = p.chapter_id JOIN stories s ON s.id = c.story_id
          JOIN threadmark_entries e ON e.story_id = c.story_id AND e.post_id = c.post_id
          WHERE (${await availableBody(db)}) ${story ? 'AND s.id = ?' : ''}
          ORDER BY p.updated_at DESC, c.id LIMIT 1`, ...(story ? [story] : []));
      return row ? { ...row, currentlyListed: Boolean(row.currentlyListed) } : null;
    },
    async getReaderPosition(id: string): Promise<{ position: number; total: number } | null> {
      const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if ((version?.user_version ?? 0) < 3) return db.getFirstAsync(`SELECT c.position,
        (SELECT COUNT(*) FROM chapters n WHERE n.story_id = c.story_id) AS total FROM chapters c WHERE c.id = ?`, id);
      return db.getFirstAsync(`SELECT e.position, (SELECT COUNT(*) FROM threadmark_entries n
        WHERE n.story_id = e.story_id AND n.currently_listed = 1) AS total
        FROM chapters c JOIN threadmark_entries e ON e.story_id = c.story_id AND e.post_id = c.post_id
        WHERE c.id = ? AND e.currently_listed = 1 AND (${await availableBody(db)})`, id);
    },
    async getLastChapter(): Promise<string | null> {
      const row = await db.getFirstAsync<{ chapter_id: string }>(`SELECT p.chapter_id FROM reading_positions p
        JOIN chapters c ON c.id = p.chapter_id WHERE (${await availableBody(db)}) ORDER BY p.updated_at DESC LIMIT 1`);
      return row?.chapter_id ?? null;
    },
    async saveLocator(locator: Locator): Promise<void> {
      await withLocalStoryWrite(locator.chapterId.split(':post:')[0]!, () => write(async (tx) => {
        // Stale callbacks must never persist against another content version.
        const chapter = await tx.getFirstAsync<{ content_hash: string; block_ids: string }>(
          `SELECT content_hash, block_ids FROM chapters WHERE id = ? AND (${await availableBody(tx, 'chapters')})`, locator.chapterId);
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
      }));
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
