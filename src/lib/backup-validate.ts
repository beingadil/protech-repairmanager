/**
 * Backup / restore validation.
 *
 * Pure, framework-agnostic logic shared by the web (sql.js) and Electron
 * (better-sqlite3) database adapters. A restored file is only accepted when:
 *  1. It is a real SQLite database (magic header, size cap).
 *  2. It passes PRAGMA integrity_check (checked by the caller against a real engine).
 *  3. Its schema contains every table this app requires.
 * This prevents a crafted or corrupt .db file from crashing the app or
 * executing malicious triggers/views on the next query.
 */

/** SQLite file magic header (first 16 bytes of every SQLite database). */
export const SQLITE_HEADER = 'SQLite format 3\u0000';

/** Maximum accepted backup size (512 MB). */
export const MAX_BACKUP_BYTES = 512 * 1024 * 1024;

/** Tables this application requires in any restored database. */
export const REQUIRED_TABLES = [
  'customers',
  'jobs',
  'job_notifications',
  'backup_log',
  'settings'
] as const;

export type BackupErrorCode =
  | 'empty'
  | 'too-large'
  | 'not-sqlite'
  | 'integrity-failed'
  | 'schema-mismatch';

export const BACKUP_ERROR_MESSAGES: Record<BackupErrorCode, string> = {
  empty: 'The selected file is empty.',
  'too-large': 'The selected file is too large (max 512 MB).',
  'not-sqlite': 'The selected file is not a valid SQLite database.',
  'integrity-failed': 'The database failed its integrity check and may be corrupt.',
  'schema-mismatch': 'The database is missing tables required by this app. It may be from another program.'
};

/**
 * Synchronous structural checks on the raw bytes. Returns an error code or
 * null when the bytes look like a SQLite database of acceptable size.
 */
export function validateBackupBytes(bytes: Uint8Array): BackupErrorCode | null {
  if (!bytes || bytes.length === 0) return 'empty';
  if (bytes.length > MAX_BACKUP_BYTES) return 'too-large';

  const header = new TextDecoder('latin1').decode(bytes.slice(0, 16));
  if (header !== SQLITE_HEADER) return 'not-sqlite';

  return null;
}

/**
 * Checks that the candidate database contains every table the app needs.
 * Pass the table names from `sqlite_master` of the candidate database.
 */
export function validateBackupSchema(tables: string[]): BackupErrorCode | null {
  const missing = REQUIRED_TABLES.filter((t) => !tables.includes(t));
  return missing.length > 0 ? 'schema-mismatch' : null;
}

/** Maps an error code to a user-facing message. */
export function backupErrorMessage(code: BackupErrorCode): string {
  return BACKUP_ERROR_MESSAGES[code];
}
