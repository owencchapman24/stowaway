import type { StoryMetadata } from '../domain/types';
import { storyId } from '../domain/identity';
import { acquireStory, ImportFailure } from '../importing/ownership';
import type { SqlDatabase, serializeWrites } from './database';

export type ManagementAction = 'downloads' | 'story';
export type ManagementIdentity = Pick<StoryMetadata, 'id' | 'source' | 'threadId'>;
export interface ManagementOptions {
  cleanup: (paths: string[]) => Promise<void>;
  /** Ownership includes the screen's final authoritative refresh, even on rollback. */
  onSettled?: () => Promise<void>;
}
export const CLEANUP_WARNING = 'Local removal completed. Some unused local files may remain because local cleanup could not finish. Retry local cleanup is available.';
export const REMOVAL_ROLLBACK = 'Local storage failure: removal was not saved. The previous story data and downloads are retained; please retry.';

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
        try {
          await write(async (tx) => {
            const version = await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
            if (version?.user_version !== 6) throw new Error('Library management requires normal schema v6.');
            const actual = await tx.getFirstAsync<{ source: string; thread_id: string }>('SELECT source, thread_id FROM stories WHERE id = ?', expected.id);
            if (!actual) throw new ImportFailure('storage', 'This story is no longer in the local library. Nothing was removed or recreated.');
            if (actual.source !== expected.source || actual.thread_id !== expected.threadId) throw new ImportFailure('storage', 'Stored story identity changed. Nothing was removed; reopen contents before retrying.');
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
        } catch (error) { throw error instanceof ImportFailure ? error : new ImportFailure('storage', REMOVAL_ROLLBACK); }
        // Only a committed mutation can reach filesystem cleanup. Failure leaves harmless orphans.
        try { await options.cleanup(paths); return { warning: null }; }
        catch { return { warning: CLEANUP_WARNING }; }
      } finally {
        try { await options.onSettled?.(); } finally { release(); }
      }
    },
  };
}
