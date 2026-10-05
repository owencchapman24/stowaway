import { exclusiveTransaction, type SqlDatabase } from './database';

export async function migrate(db: SqlDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  await exclusiveTransaction(db, async (tx) => {
    const version = await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((version?.user_version ?? 0) > 1) throw new Error('Database is newer than this app.');
    if (version?.user_version === 1) return;
    await tx.execAsync(`
      CREATE TABLE stories (
        id TEXT PRIMARY KEY, source TEXT NOT NULL, thread_id TEXT NOT NULL,
        title TEXT NOT NULL, author TEXT NOT NULL, UNIQUE(source, thread_id)
      );
      CREATE TABLE chapters (
        id TEXT PRIMARY KEY, story_id TEXT NOT NULL REFERENCES stories(id),
        post_id TEXT NOT NULL, title TEXT NOT NULL, position INTEGER NOT NULL,
        html TEXT NOT NULL, content_hash TEXT NOT NULL, sanitizer_version TEXT NOT NULL,
        block_ids TEXT NOT NULL, links TEXT NOT NULL, UNIQUE(story_id, post_id)
      );
      CREATE TABLE reading_positions (
        chapter_id TEXT PRIMARY KEY REFERENCES chapters(id), content_hash TEXT NOT NULL,
        block_id TEXT NOT NULL, block_offset REAL NOT NULL CHECK(block_offset >= 0),
        progression REAL NOT NULL CHECK(progression >= 0 AND progression <= 1),
        expanded_spoilers TEXT NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE assets (
        id TEXT PRIMARY KEY, relative_path TEXT NOT NULL, byte_length INTEGER NOT NULL
      );
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      PRAGMA user_version = 1;
    `);
  });
}
