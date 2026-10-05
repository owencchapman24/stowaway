export type SqlValue = string | number | null;

/** The small SQL surface shared by Expo SQLite and the real host SQLite tests. */
export interface SqlConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqlValue[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
}

export interface SqlDatabase extends SqlConnection {
  withExclusiveTransactionAsync(work: (transaction: SqlConnection) => Promise<void>): Promise<void>;
}

export async function exclusiveTransaction(db: SqlDatabase, work: (transaction: SqlConnection) => Promise<void>) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    await work(tx);
    // Expo opens a fresh connection and starts BEGIN before our callback. Setting
    // foreign_keys inside BEGIN is a no-op; validate references before COMMIT.
    const violation = await tx.getFirstAsync('PRAGMA foreign_key_check');
    if (violation) throw new Error('Foreign key violation; transaction rolled back.');
  });
}

// No async transaction may capture work issued outside its callback.
export function serializeWrites(db: SqlDatabase) {
  let tail: Promise<void> = Promise.resolve();
  return function write(work: (transaction: SqlConnection) => Promise<void>): Promise<void> {
    const result = tail.then(() => exclusiveTransaction(db, work));
    tail = result.catch(() => undefined);
    return result;
  };
}
