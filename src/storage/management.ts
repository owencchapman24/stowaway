import type { StoryMetadata } from '../domain/types';
import { storyId } from '../domain/identity';
import { acquireStory, ImportFailure } from '../importing/ownership';
import type { SqlConnection, SqlDatabase, serializeWrites } from './database';

export type ManagementAction = 'downloads' | 'story';
export type ManagementIdentity = Pick<StoryMetadata, 'id' | 'source' | 'threadId'>;
export interface ManagementOptions {
  cleanup: (paths: string[]) => Promise<void>;
  /** Ownership includes the screen's final authoritative refresh, even on rollback. */
  onSettled?: () => Promise<void>;
}
export const CLEANUP_WARNING = 'Local removal completed. Some unused local files may remain because local cleanup could not finish. Retry local cleanup is available.';
export const REMOVAL_ROLLBACK = 'Local storage failure: removal was not saved. The previous story data and downloads are retained; please retry.';

export const REMOVAL_UNCERTAIN = 'Could not confirm the final local state. Reopen this story before retrying.';

async function managementSnapshot(connection: SqlConnection, id: string) {
  const story = await connection.getFirstAsync<{ source: string; thread_id: string }>('SELECT source, thread_id FROM stories WHERE id = ?', id);
  const chapters = await connection.getAllAsync<{ id: string; body_available: number; html_length: number; content_hash: string; sanitizer_version: string; block_ids: string; links: string; image_discovery: string }>(
    'SELECT id, body_available, length(html) AS html_length, content_hash, sanitizer_version, block_ids, links, image_discovery FROM chapters WHERE story_id = ? ORDER BY id', id);
  const images = await connection.getAllAsync('SELECT i.* FROM chapter_images i JOIN chapters c ON c.id = i.chapter_id WHERE c.story_id = ? ORDER BY i.chapter_id, i.slot', id);
  const entries = await connection.getFirstAsync('SELECT COUNT(*) AS count FROM threadmark_entries WHERE story_id = ?', id);
  const positions = await connection.getFirstAsync('SELECT COUNT(*) AS count FROM reading_positions p JOIN chapters c ON c.id = p.chapter_id WHERE c.story_id = ?', id);
  return { story, chapters, images, entries, positions };
}

export function createManagementRepository(db: SqlDatabase, write: ReturnType<typeof serializeWrites>) {
  return {
    async manageStory(identity: ManagementIdentity, action: ManagementAction, options: ManagementOptions): Promise<{ warning: string | null }> {
      const expected = { id: identity.id, source: identity.source, threadId: identity.threadId };
      // Never accept fixture IDs, malformed identity, or a retained handler's substituted story.
      if (expected.source !== 'spacebattles' || expected.id !== storyId(expected.source, expected.threadId) ||
          (action !== 'downloads' && action !== 'story')) throw new Error('Invalid library management identity or action.');
      const release = acquireStory(expected.id);
      try {
        let paths: string[] = [];
        let before: Awaited<ReturnType<typeof managementSnapshot>> | null = null;
        try {
          await write(async (tx) => {
            const version = await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
            if (version?.user_version !== 6) throw new Error('Library management requires normal schema v6.');
            const actual = await tx.getFirstAsync<{ source: string; thread_id: string }>('SELECT source, thread_id FROM stories WHERE id = ?', expected.id);
            if (!actual) throw new ImportFailure('storage', 'This story is no longer in the local library. Nothing was removed or recreated.');
            if (actual.source !== expected.source || actual.thread_id !== expected.threadId) throw new ImportFailure('storage', 'Stored story identity changed. Nothing was removed; reopen contents before retrying.');
            before = await managementSnapshot(tx, expected.id);
            paths = (await tx.getAllAsync<{ relative_path: string }>(`SELECT DISTINCT i.relative_path FROM chapter_images i
              JOIN chapters c ON c.id = i.chapter_id WHERE c.story_id = ? AND i.relative_path IS NOT NULL`, expected.id))
              .map((row) => row.relative_path);
            await tx.runAsync('DELETE FROM chapter_images WHERE chapter_id IN (SELECT id FROM chapters WHERE story_id = ?)', expected.id);
            if (action === 'downloads') {
              // Retain the stable shell/FK target. Only the locator retains old content identity.
              await tx.runAsync(`UPDATE chapters SET body_available = 0, html = '', content_hash = '',
                sanitizer_version = '', block_ids = '[]', links = '{}', image_discovery = 'unknown' WHERE story_id = ?`, expected.id);
            } else {
              await tx.runAsync('DELETE FROM reading_positions WHERE chapter_id IN (SELECT id FROM chapters WHERE story_id = ?)', expected.id);
              await tx.runAsync('DELETE FROM chapters WHERE story_id = ?', expected.id);
              await tx.runAsync('DELETE FROM threadmark_entries WHERE story_id = ?', expected.id);
              await tx.runAsync('DELETE FROM stories WHERE id = ?', expected.id);
            }
          });
        } catch (error) {
          if (error instanceof ImportFailure) throw error;
          // A driver may reject after COMMIT (for example while closing). Keep
          // ownership and inspect SQLite before making any rollback promise.
          let after: Awaited<ReturnType<typeof managementSnapshot>>;
          try { after = await managementSnapshot(db, expected.id); }
          catch { throw new ImportFailure('storage', REMOVAL_UNCERTAIN); }
          const sameIdentity = after.story?.source === expected.source && after.story.thread_id === expected.threadId;
          const committed = before !== null && (action === 'story' ? after.story === null
            : sameIdentity && after.images.length === 0 && after.chapters.every((c) => c.body_available === 0 && c.html_length === 0
              && c.content_hash === '' && c.sanitizer_version === '' && c.block_ids === '[]' && c.links === '{}' && c.image_discovery === 'unknown'));
          if (!committed) throw new ImportFailure('storage', before && JSON.stringify(before) === JSON.stringify(after) ? REMOVAL_ROLLBACK : REMOVAL_UNCERTAIN);
        }
        // Only a committed mutation can reach filesystem cleanup. Failure leaves harmless orphans.
        try { await options.cleanup(paths); return { warning: null }; }
        catch { return { warning: CLEANUP_WARNING }; }
      } finally {
        try { await options.onSettled?.(); } finally { release(); }
      }
    },
  };
}
