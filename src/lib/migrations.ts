/**
 * Ordered, versioned migration runner shared by the web (sql.js) and Electron
 * (better-sqlite3) adapters. Applied migrations are tracked in a
 * `schema_version` table; each migration runs inside a transaction.
 *
 * NOTE: legacy databases created before this runner had no schema_version
 * table. On first run all migrations re-apply — they are all idempotent
 * (CREATE IF NOT EXISTS / INSERT OR IGNORE / guarded DELETEs), so this is safe.
 */

export interface MigrationExecutor {
  /** Runs arbitrary (multi-statement) SQL. */
  run: (sql: string) => void;
  /** Returns rows as plain objects for the given SELECT. */
  query: (sql: string) => unknown[];
  /** Runs `fn` inside a transaction. */
  transaction: (fn: () => void) => void;
}

export interface MigrationResult {
  applied: number;
  total: number;
}

export function applyMigrations(
  exec: MigrationExecutor,
  migrations: string[]
): MigrationResult {
  exec.run(
    `CREATE TABLE IF NOT EXISTS schema_version (
       version INTEGER PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  );

  const rows = exec.query(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );
  const applied = rows.length > 0 ? Number((rows[0] as { version: number }).version) : 0;

  let appliedCount = 0;
  for (let i = applied; i < migrations.length; i++) {
    const version = i + 1;
    exec.transaction(() => {
      exec.run(migrations[i]);
      exec.run(
        `INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (${version}, datetime('now'))`
      );
    });
    appliedCount++;
  }

  return { applied: appliedCount, total: migrations.length };
}
