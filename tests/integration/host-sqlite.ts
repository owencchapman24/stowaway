import { DatabaseSync } from 'node:sqlite';
import type { SqlConnection, SqlDatabase, SqlValue } from '../../src/storage/database';

/** Real SQLite, not a mock of the repository. Expo's iOS driver remains a device check. */
export function hostSqlite(path: string) {
  const native = new DatabaseSync(path);
  let failBeforeCommit = false;
  function connection(handle: DatabaseSync): SqlConnection {
    return {
      async execAsync(sql) { handle.exec(sql); },
      async runAsync(sql, ...params: SqlValue[]) { return handle.prepare(sql).run(...params); },
      async getFirstAsync<T>(sql: string, ...params: SqlValue[]) { return (handle.prepare(sql).get(...params) as T | undefined) ?? null; },
      async getAllAsync<T>(sql: string, ...params: SqlValue[]) { return handle.prepare(sql).all(...params) as T[]; },
    };
  }
  const db: SqlDatabase = {
    ...connection(native),
    async withExclusiveTransactionAsync(work) {
      // Match Expo: new transaction connection, default foreign-key switch off.
      const transaction = new DatabaseSync(path, { enableForeignKeyConstraints: false });
      transaction.exec('BEGIN');
      try {
        await work(connection(transaction));
        if (failBeforeCommit) { failBeforeCommit = false; throw new Error('Injected commit failure'); }
        transaction.exec('COMMIT');
      } catch (error) {
        transaction.exec('ROLLBACK');
        throw error;
      } finally { transaction.close(); }
    },
  };
  return { db, close: () => native.close(), failNextCommit: () => { failBeforeCommit = true; } };
}
