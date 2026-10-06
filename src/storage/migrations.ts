import { exclusiveTransaction, type SqlDatabase } from './database';

// S2A deliberately keeps its existing diagnostic schema; normal storage uses v4.
export async function migrate(db: SqlDatabase, supportedVersion = 4): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  await exclusiveTransaction(db, async (tx) => {
    const version = await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((version?.user_version ?? 0) > supportedVersion) throw new Error('Database is newer than this app.');
    if ((version?.user_version ?? 0) < 1) await tx.execAsync(`
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
    if (supportedVersion >= 2 && (version?.user_version ?? 0) < 2) await tx.execAsync(`
      ALTER TABLE stories ADD COLUMN source_url TEXT NOT NULL DEFAULT '';
      ALTER TABLE stories ADD COLUMN primary_category_id TEXT;
      CREATE TABLE threadmark_entries (
        story_id TEXT NOT NULL REFERENCES stories(id), post_id TEXT NOT NULL,
        title TEXT NOT NULL, position INTEGER NOT NULL CHECK(position >= 0),
        source_url TEXT NOT NULL,
        PRIMARY KEY(story_id, post_id), UNIQUE(story_id, position)
      );
      INSERT INTO threadmark_entries(story_id, post_id, title, position, source_url)
        SELECT story_id, post_id, title,
          ROW_NUMBER() OVER (PARTITION BY story_id ORDER BY position, id) - 1, ''
        FROM chapters;
      PRAGMA user_version = 2;
    `);
    if (supportedVersion >= 3 && (version?.user_version ?? 0) < 3) await tx.execAsync(`
      ALTER TABLE stories ADD COLUMN last_update_attempt_at INTEGER;
      ALTER TABLE stories ADD COLUMN last_update_success_at INTEGER;
      CREATE TABLE threadmark_entries_v3 (
        story_id TEXT NOT NULL REFERENCES stories(id), post_id TEXT NOT NULL,
        title TEXT NOT NULL, position INTEGER NOT NULL CHECK(position >= 0),
        source_url TEXT NOT NULL, currently_listed INTEGER NOT NULL DEFAULT 1
          CHECK(currently_listed IN (0, 1)), PRIMARY KEY(story_id, post_id)
      );
      INSERT INTO threadmark_entries_v3(story_id, post_id, title, position, source_url)
        SELECT story_id, post_id, title, position, source_url FROM threadmark_entries;
      DROP TABLE threadmark_entries;
      ALTER TABLE threadmark_entries_v3 RENAME TO threadmark_entries;
      CREATE UNIQUE INDEX current_threadmark_positions ON threadmark_entries(story_id, position)
        WHERE currently_listed = 1;
      PRAGMA user_version = 3;
    `);
    if (supportedVersion >= 4 && (version?.user_version ?? 0) < 4) await tx.execAsync(`
      ALTER TABLE chapters ADD COLUMN image_discovery TEXT NOT NULL DEFAULT 'unknown'
        CHECK(image_discovery IN ('unknown', 'scanned', 'saved-text-mismatch', 'fixture'));
      UPDATE chapters SET image_discovery = 'fixture'
        WHERE story_id IN (SELECT id FROM stories WHERE source = 'fixture');
      CREATE TABLE chapter_images (
        chapter_id TEXT NOT NULL REFERENCES chapters(id), slot INTEGER NOT NULL CHECK(slot >= 0),
        block_id TEXT NOT NULL, source_url TEXT, alt TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('pending', 'downloaded', 'omitted')), reason TEXT,
        relative_path TEXT, format TEXT CHECK(format IN ('png', 'jpeg', 'webp')),
        byte_length INTEGER, width INTEGER, height INTEGER, digest TEXT,
        PRIMARY KEY(chapter_id, slot), UNIQUE(chapter_id, block_id),
        CHECK((state = 'downloaded' AND relative_path IS NOT NULL AND format IS NOT NULL
          AND byte_length IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL
          AND byte_length > 0 AND width > 0 AND height > 0 AND digest IS NOT NULL AND reason IS NULL)
          OR (state != 'downloaded' AND relative_path IS NULL AND format IS NULL
          AND byte_length IS NULL AND width IS NULL AND height IS NULL AND digest IS NULL))
      );
      PRAGMA user_version = 4;
    `);
  });
}
