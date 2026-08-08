import { describe, it, expect } from 'vitest';
import {
  validateBackupBytes,
  validateBackupSchema,
  REQUIRED_TABLES,
  SQLITE_HEADER
} from '../backup-validate';

describe('validateBackupBytes', () => {
  it('rejects empty input', () => {
    expect(validateBackupBytes(new Uint8Array(0))).toBe('empty');
  });

  it('rejects files that are not SQLite databases', () => {
    const junk = new TextEncoder().encode(
      'definitely not a database file, just plain text bytes padding padding padding padding padding'
    );
    expect(validateBackupBytes(junk)).toBe('not-sqlite');
  });

  it('accepts bytes with a valid SQLite header', () => {
    const bytes = new Uint8Array(64);
    bytes.set(new TextEncoder().encode(SQLITE_HEADER), 0);
    expect(validateBackupBytes(bytes)).toBeNull();
  });

  it('rejects backups larger than the size cap', () => {
    const bytes = new Uint8Array(600 * 1024 * 1024); // 600 MB > 512 MB cap
    bytes.set(new TextEncoder().encode(SQLITE_HEADER), 0);
    expect(validateBackupBytes(bytes)).toBe('too-large');
  });
});

describe('validateBackupSchema', () => {
  it('accepts a database containing all required tables', () => {
    expect(validateBackupSchema([...REQUIRED_TABLES, 'sqlite_sequence'])).toBeNull();
  });

  it('rejects a database missing required tables', () => {
    expect(validateBackupSchema(['customers', 'jobs'])).toBe('schema-mismatch');
  });

  it('rejects an empty database', () => {
    expect(validateBackupSchema([])).toBe('schema-mismatch');
  });
});
