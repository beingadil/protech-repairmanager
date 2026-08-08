import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'node:path';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  readdirSync
} from 'node:fs';
import { applyMigrations, type MigrationExecutor } from '../../src/lib/migrations';
import {
  validateBackupBytes,
  validateBackupSchema,
  backupErrorMessage,
  MAX_BACKUP_BYTES
} from '../../src/lib/backup-validate';

import m001 from '../../src/db/migrations/001_initial_schema.sql?raw';
import m002 from '../../src/db/migrations/002_seed_settings.sql?raw';
import m003 from '../../src/db/migrations/003_indexes.sql?raw';
import m004 from '../../src/db/migrations/004_purge_sample_data.sql?raw';

const MIGRATIONS = [m001, m002, m003, m004];

let db: Database.Database | null = null;
let dbPath = '';

export function getDbPath(): string {
  return join(app.getPath('userData'), 'prodata.db');
}

function executor(d: Database.Database): MigrationExecutor {
  return {
    run: (sql) => d.exec(sql),
    query: (sql) => d.prepare(sql).all() as unknown[],
    transaction: (fn) => d.transaction(fn)()
  };
}

/** Copies the live database into userData/backups/ at most once per day. */
function dailyAutoBackup() {
  const backupsDir = join(app.getPath('userData'), 'backups');
  mkdirSync(backupsDir, { recursive: true });

  let newest = 0;
  for (const entry of readdirSync(backupsDir)) {
    if (entry.startsWith('prodata-') && entry.endsWith('.db')) {
      const ts = Number(entry.replace('prodata-', '').replace('.db', ''));
      if (!Number.isNaN(ts)) newest = Math.max(newest, ts);
    }
  }

  if (Date.now() - newest < 24 * 60 * 60 * 1000) return;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = join(backupsDir, `prodata-${stamp}.db`);
  try {
    exportDatabaseToFile(dest);
    // Keep the newest 10 backups
    const files = readdirSync(backupsDir)
      .filter((f) => f.startsWith('prodata-') && f.endsWith('.db'))
      .sort();
    while (files.length > 10) {
      const oldest = files.shift()!;
      rmSync(join(backupsDir, oldest), { force: true });
    }
  } catch (err) {
    console.error('Daily auto-backup failed:', err);
  }
}

/**
 * Opens (or creates) the SQLite database, applies migrations and runs the
 * daily auto-backup. Throws when the on-disk database fails its integrity
 * check so the caller can surface a recovery prompt instead of silently
 * running on a corrupt database.
 */
export function openDatabase(): Database.Database {
  dbPath = getDbPath();
  const dir = app.getPath('userData');
  mkdirSync(dir, { recursive: true });
  const fresh = !existsSync(dbPath);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  if (!fresh) {
    const row = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    if (row.integrity_check !== 'ok') {
      db.close();
      db = null;
      throw new Error(
        `The local database failed its integrity check (${row.integrity_check}). ` +
          'Restore a backup or reinstall the application to continue.'
      );
    }
  }

  applyMigrations(executor(db), MIGRATIONS);
  dailyAutoBackup();
  return db;
}

export function closeDatabase() {
  if (db) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      /* ignore */
    }
    db.close();
    db = null;
  }
}

function getDb(): Database.Database {
  if (!db) throw new Error('Database is not open.');
  return db;
}

export function query(sql: string, params: unknown[] = []): unknown[] {
  return getDb().prepare(sql).all(...params) as unknown[];
}

export function execute(sql: string, params: unknown[] = []): void {
  getDb().prepare(sql).run(...params);
}

export function executeRaw(sql: string): void {
  getDb().exec(sql);
}

/** Exports a consistent snapshot of the database to a file (VACUUM INTO). */
export function exportDatabaseToFile(destPath: string): void {
  const d = getDb();
  if (existsSync(destPath)) rmSync(destPath, { force: true });
  d.prepare('VACUUM INTO ?').run(destPath);
}

export function exportDatabaseBytes(): Uint8Array {
  const tmp = join(app.getPath('temp'), `prodata-export-${Date.now()}.db`);
  exportDatabaseToFile(tmp);
  const bytes = readFileSync(tmp);
  rmSync(tmp, { force: true });
  return bytes;
}

/**
 * Validated restore: header magic, size cap, integrity check and schema check
 * all run against the candidate before the live database is swapped. The swap
 * itself is atomic (write temp file, then rename over the live file).
 */
export function restoreDatabase(bytes: Uint8Array): void {
  const headerError = validateBackupBytes(bytes);
  if (headerError) throw new Error(backupErrorMessage(headerError));

  const tmp = join(app.getPath('temp'), `prodata-restore-${Date.now()}.db`);
  writeFileSync(tmp, bytes);

  let candidate: Database.Database | null = null;
  try {
    candidate = new Database(tmp, { readonly: true });
    const row = candidate.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    if (row.integrity_check !== 'ok') {
      throw new Error(backupErrorMessage('integrity-failed'));
    }
    const tables = (candidate
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[]).map((r) => r.name);
    const schemaError = validateBackupSchema(tables);
    if (schemaError) throw new Error(backupErrorMessage(schemaError));
    candidate.close();
    candidate = null;
  } catch (err) {
    if (candidate) candidate.close();
    rmSync(tmp, { force: true });
    throw err;
  }

  // Swap: close live DB, remove WAL/shm, atomically rename temp into place.
  closeDatabase();
  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });
  renameSync(tmp, dbPath);

  openDatabase();
}

/** Factory reset: drop everything, recreate schema, reseed defaults. */
export function resetDatabase(): void {
  closeDatabase();
  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });
  openDatabase();
}

export function getDbInfo(): { path: string; sizeBytes: number } {
  let sizeBytes = 0;
  if (existsSync(dbPath)) {
    const wal = `${dbPath}-wal`;
    sizeBytes = readFileSync(dbPath).length + (existsSync(wal) ? readFileSync(wal).length : 0);
  }
  return { path: dbPath, sizeBytes };
}

export { MAX_BACKUP_BYTES };
