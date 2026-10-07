import type { SqlConnection } from './database';

/** Historical diagnostics/migration tests can still use v1–v5. */
export async function availableBody(db: SqlConnection, alias = 'c'): Promise<string> {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return (version?.user_version ?? 0) >= 6 ? `${alias}.body_available = 1` : '1';
}
