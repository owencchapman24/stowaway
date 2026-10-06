import type { Chapter } from '../domain/types';
import type { SqlConnection, SqlDatabase, serializeWrites } from '../storage/database';
import { classifyImageUrl } from './source-url';
import { validateImageReference } from './files';
import { validateSlots } from './slots';
import type { ChapterImage, ImageDiscovery, ImageFile, ImageReason, ImageSlot, ImageSummary } from './types';

function cancelled(signal?: AbortSignal) { if (signal?.aborted) throw new Error('Image commit cancelled.'); }
export async function insertImageSlots(tx: SqlConnection, id: string, content: Pick<Chapter, 'html' | 'blockIds'>,
  slots: ImageSlot[], signal?: AbortSignal) {
  validateSlots(content, slots);
  for (const slot of slots) {
    cancelled(signal);
    if (slot.state === 'pending' && classifyImageUrl(slot.sourceUrl!).reason) throw new Error('Ineligible pending source image.');
    await tx.runAsync(`INSERT INTO chapter_images(chapter_id, slot, block_id, source_url, alt, state, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, id, slot.slot, slot.blockId, slot.sourceUrl, slot.alt, slot.state, slot.reason);
  }
  await tx.runAsync("UPDATE chapters SET image_discovery = 'scanned' WHERE id = ?", id);
}
interface ImageRow {
  chapter_id: string; slot: number; block_id: string; source_url: string | null; alt: string;
  state: ChapterImage['state']; reason: ImageReason | null;
  relative_path: string | null; format: ImageFile['format']; byte_length: number; width: number; height: number; digest: string;
}
export type ImageChange = { slot: number; file: ImageFile } | { slot: number; reason: ImageReason };
export function createImageRepository(db: SqlDatabase, write: ReturnType<typeof serializeWrites>) {
  return {
    async listChapterImages(id: string): Promise<ChapterImage[]> {
      // Reader is also used by isolated S2A v1, which has no source image model.
      const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if ((version?.user_version ?? 0) < 4) return [];
      const rows = await db.getAllAsync<ImageRow>('SELECT * FROM chapter_images WHERE chapter_id = ? ORDER BY slot', id);
      return rows.map((row) => ({ chapterId: row.chapter_id, slot: row.slot, blockId: row.block_id,
        sourceUrl: row.source_url, alt: row.alt, state: row.state, reason: row.reason,
        file: row.relative_path ? { relativePath: row.relative_path, format: row.format,
          byteLength: row.byte_length, width: row.width, height: row.height, digest: row.digest } : null }));
    },
    async listImageWork(storyId: string): Promise<{ id: string; postId: string; title: string; sourceUrl: string; discovery: ImageDiscovery }[]> {
      return db.getAllAsync(`SELECT c.id, c.post_id AS postId, e.title, e.source_url AS sourceUrl, c.image_discovery AS discovery
        FROM chapters c JOIN threadmark_entries e ON e.story_id = c.story_id AND e.post_id = c.post_id
        JOIN stories s ON s.id = c.story_id WHERE c.story_id = ? AND e.currently_listed = 1
        AND s.source = 'spacebattles' ORDER BY e.position`, storyId);
    },
    async getImageSummary(storyId: string): Promise<ImageSummary> {
      const discovery = await db.getFirstAsync<{ unknown: number; mismatch: number; scanned: number }>(`SELECT
        COALESCE(SUM(c.image_discovery = 'unknown'), 0) AS unknown,
        COALESCE(SUM(c.image_discovery = 'saved-text-mismatch'), 0) AS mismatch,
        COALESCE(SUM(c.image_discovery = 'scanned'), 0) AS scanned
        FROM chapters c JOIN threadmark_entries e ON e.story_id = c.story_id AND e.post_id = c.post_id
        WHERE c.story_id = ? AND e.currently_listed = 1`, storyId);
      const counts = await db.getFirstAsync<{ local: number; pending: number; omitted: number }>(`SELECT
        COALESCE(SUM(i.state = 'downloaded'), 0) AS local, COALESCE(SUM(i.state = 'pending'), 0) AS pending,
        COALESCE(SUM(i.state = 'omitted'), 0) AS omitted FROM chapter_images i
        JOIN chapters c ON c.id = i.chapter_id JOIN threadmark_entries e ON e.story_id = c.story_id AND e.post_id = c.post_id
        WHERE c.story_id = ? AND e.currently_listed = 1`, storyId);
      return { unknown: 0, mismatch: 0, scanned: 0, local: 0, pending: 0, omitted: 0, ...discovery, ...counts };
    },
    async commitImageDiscovery(id: string, expectedHash: string, slots: ImageSlot[] | null, signal?: AbortSignal) {
      await write(async (tx) => {
        cancelled(signal);
        const chapter = await tx.getFirstAsync<{ html: string; block_ids: string; content_hash: string; image_discovery: ImageDiscovery }>(
          `SELECT c.html, c.block_ids, c.content_hash, c.image_discovery FROM chapters c
           JOIN stories s ON s.id = c.story_id JOIN threadmark_entries e ON e.story_id = c.story_id AND e.post_id = c.post_id
           WHERE c.id = ? AND s.source = 'spacebattles' AND e.currently_listed = 1`, id);
        if (!chapter || chapter.content_hash !== expectedHash) throw new Error('Image discovery identity changed.');
        if (chapter.image_discovery !== 'unknown') return;
        if (slots) await insertImageSlots(tx, id, { html: chapter.html, blockIds: JSON.parse(chapter.block_ids) }, slots, signal);
        else await tx.runAsync("UPDATE chapters SET image_discovery = 'saved-text-mismatch' WHERE id = ?", id);
      }, () => cancelled(signal));
    },
    async commitImageResults(storyId: string, chapter: string, changes: ImageChange[], signal?: AbortSignal) {
      if (new Set(changes.map((change) => change.slot)).size !== changes.length) throw new Error('Duplicate image result.');
      await write(async (tx) => {
        cancelled(signal);
        const owner = await tx.getFirstAsync(`SELECT c.id FROM chapters c JOIN stories s ON s.id = c.story_id
          JOIN threadmark_entries e ON e.story_id = c.story_id AND e.post_id = c.post_id
          WHERE c.id = ? AND c.story_id = ? AND s.source = 'spacebattles' AND e.currently_listed = 1`, chapter, storyId);
        if (!owner) throw new Error('Image result belongs to a different or unlisted story/chapter.');
        for (const change of changes) {
          cancelled(signal);
          const slot = await tx.getFirstAsync<{ state: string }>('SELECT state FROM chapter_images WHERE chapter_id = ? AND slot = ?', chapter, change.slot);
          if (!slot || slot.state === 'omitted') throw new Error('Unknown or permanently omitted image slot.');
          if ('file' in change) {
            validateImageReference(change.file);
            const file = change.file;
            await tx.runAsync(`UPDATE chapter_images SET state = 'downloaded', reason = NULL, relative_path = ?, format = ?,
              byte_length = ?, width = ?, height = ?, digest = ? WHERE chapter_id = ? AND slot = ?`,
            file.relativePath, file.format, file.byteLength, file.width, file.height, file.digest, chapter, change.slot);
          } else await tx.runAsync(`UPDATE chapter_images SET state = 'omitted', reason = ?, relative_path = NULL, format = NULL,
            byte_length = NULL, width = NULL, height = NULL, digest = NULL WHERE chapter_id = ? AND slot = ?`, change.reason, chapter, change.slot);
        }
      }, () => cancelled(signal));
    },
    async listSourceAssetReferences(): Promise<string[]> {
      const rows = await db.getAllAsync<{ relative_path: string }>('SELECT relative_path FROM chapter_images WHERE relative_path IS NOT NULL');
      return rows.map((row) => row.relative_path);
    },
  };
}
