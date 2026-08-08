import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { applyMigrations, type MigrationExecutor } from '../migrations';

import m001 from '../../db/migrations/001_initial_schema.sql?raw';
import m002 from '../../db/migrations/002_seed_settings.sql?raw';
import m003 from '../../db/migrations/003_indexes.sql?raw';
import m004 from '../../db/migrations/004_purge_sample_data.sql?raw';

const MIGRATIONS = [m001, m002, m003, m004];

function makeExecutor(db: Database.Database): MigrationExecutor {
  return {
    run: (sql) => db.exec(sql),
    query: (sql) => db.prepare(sql).all() as unknown[],
    transaction: (fn) => db.transaction(fn)()
  };
}

describe('applyMigrations', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  it('applies all migrations on a fresh database and records versions', () => {
    const result = applyMigrations(makeExecutor(db), MIGRATIONS);
    expect(result.applied).toBe(4);
    expect(result.total).toBe(4);

    const versions = db.prepare('SELECT version FROM schema_version ORDER BY version').all() as {
      version: number;
    }[];
    expect(versions.map((v) => v.version)).toEqual([1, 2, 3, 4]);
  });

  it('creates the expected tables', () => {
    applyMigrations(makeExecutor(db), MIGRATIONS);
    const tables = (db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[]).map((t) => t.name);
    expect(tables).toEqual(
      expect.arrayContaining(['customers', 'jobs', 'job_notifications', 'backup_log', 'settings', 'schema_version'])
    );
  });

  it('is idempotent: re-applying does nothing and does not duplicate seed data', () => {
    applyMigrations(makeExecutor(db), MIGRATIONS);
    const before = (db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number }).c;

    const second = applyMigrations(makeExecutor(db), MIGRATIONS);
    expect(second.applied).toBe(0);

    const after = (db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number }).c;
    expect(after).toBe(before);
  });

  it('seeds the default settings exactly once', () => {
    applyMigrations(makeExecutor(db), MIGRATIONS);
    const rows = db.prepare("SELECT key FROM settings WHERE key IN ('shop_name','theme','token_counter')").all() as {
      key: string;
    }[];
    expect(rows.map((r) => r.key).sort()).toEqual(['shop_name', 'theme', 'token_counter']);
  });

  it('does not leave twilio rows in the settings table', () => {
    // Simulate a legacy database that still has twilio settings.
    db.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    db.exec("INSERT INTO settings VALUES ('twilio_sid', 'AC123'), ('twilio_token', 'abc'), ('shop_name', 'Old')");
    db.exec('DROP TABLE IF EXISTS schema_version');

    applyMigrations(makeExecutor(db), MIGRATIONS);
    const rows = db.prepare("SELECT key FROM settings WHERE key LIKE 'twilio_%'").all();
    expect(rows).toHaveLength(0);
    // Legacy values are preserved (INSERT OR IGNORE does not overwrite).
    expect(db.prepare("SELECT value FROM settings WHERE key='shop_name'").get()).toEqual({
      value: 'Old'
    });
  });

  it('rolls back a failing migration, leaving no partial state', () => {
    // Migration 2 references a table that migration 1 creates; break migration 1
    // by making it fail mid-way so nothing after it can apply.
    const broken = ['CREATE TABLE a (x INTEGER); THIS IS NOT SQL;', 'CREATE TABLE b (y INTEGER);'];
    let threw = false;
    try {
      applyMigrations(makeExecutor(db), broken);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    // schema_version has no rows — nothing was recorded as applied.
    expect(db.prepare('SELECT COUNT(*) as c FROM schema_version').get()).toEqual({ c: 0 });
  });
});
