import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

import m001 from '../../db/migrations/001_initial_schema.sql?raw';
import m002 from '../../db/migrations/002_seed_settings.sql?raw';
import m003 from '../../db/migrations/003_indexes.sql?raw';
import m004 from '../../db/migrations/004_purge_sample_data.sql?raw';

/**
 * Regression guard for the Electron engine switch.
 *
 * sql.js (browser) tolerates double-quoted string literals like
 * datetime("now") via SQLite's DQS misfeature, but better-sqlite3 compiles
 * SQLite in strict mode and rejects them ("no such column: now"). Every
 * mutation below mirrors the exact SQL the app pages run, so a reintroduced
 * double-quoted literal fails this test on the strict engine.
 */
describe('app mutation SQL runs on strict better-sqlite3', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    for (const m of [m001, m002, m003, m004]) db.exec(m);
  });

  it('adds a new customer and registers a repair job (AddJobPage)', () => {
    db.prepare(
      `INSERT INTO customers (name, mobile, address, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))`
    ).run('Test Customer', '03001234567', 'Test Address');
    const customerId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    db.prepare(
      `INSERT INTO jobs (
        token_number, customer_id, job_type, serial_no, model, ram, hard, processor,
        symptoms, receive_date, return_date, charges, has_charger, payment_status, deliver_status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run(
      'TK-1000',
      customerId,
      'laptop',
      'SN123',
      'HP EliteBook',
      '8GB',
      '512GB SSD',
      'i5',
      'not booting',
      '2026-08-08',
      '2026-08-11',
      1500,
      1,
      'due',
      'pending',
      ''
    );

    const job = db.prepare('SELECT * FROM jobs WHERE token_number = ?').get('TK-1000') as {
      id: number;
      customer_id: number;
    };
    expect(job.customer_id).toBe(customerId);
  });

  it('updates customer and job fields (EditJobPage)', () => {
    const customerId = (
      db
        .prepare(`INSERT INTO customers (name, mobile, address) VALUES (?, ?, ?)`)
        .run('Old', '03000000000', 'Addr') as unknown as { lastInsertRowid: number }
    ).lastInsertRowid;
    db.prepare('INSERT INTO jobs (token_number, customer_id, receive_date) VALUES (?, ?, ?)').run(
      'TK-1000',
      customerId,
      '2026-08-08'
    );

    db.prepare(
      `UPDATE customers SET name = ?, mobile = ?, address = ?, updated_at = datetime('now') WHERE id = ?`
    ).run('New', '03111111111', 'New Addr', customerId);

    db.prepare(
      `UPDATE jobs SET
        job_type = ?, serial_no = ?, model = ?, ram = ?, hard = ?, processor = ?,
        symptoms = ?, receive_date = ?, return_date = ?, charges = ?, has_charger = ?,
        payment_status = ?, deliver_status = ?, notes = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run('pc', 'SN9', 'Dell', '16GB', '1TB', 'i7', '', '2026-08-08', '2026-08-12', 2500, 0, 'due', 'pending', 'x', 1);

    const job = db.prepare('SELECT job_type, model FROM jobs WHERE id = 1').get() as {
      job_type: string;
      model: string;
    };
    expect(job).toEqual({ job_type: 'pc', model: 'Dell' });
  });

  it('toggles payment, delivery and soft-deletes (JobListPage / JobDetailPage)', () => {
    const customerId = (
      db.prepare('INSERT INTO customers (name, mobile) VALUES (?, ?)').run('C', '0300') as unknown as {
        lastInsertRowid: number;
      }
    ).lastInsertRowid;
    db.prepare('INSERT INTO jobs (token_number, customer_id, receive_date) VALUES (?, ?, ?)').run(
      'TK-1000',
      customerId,
      '2026-08-08'
    );

    db.prepare(`UPDATE jobs SET payment_status = ?, updated_at = datetime('now') WHERE id = ?`).run('paid', 1);
    db.prepare(`UPDATE jobs SET deliver_status = ?, updated_at = datetime('now') WHERE id = ?`).run('delivered', 1);
    db.prepare(`UPDATE jobs SET deleted_at = datetime('now') WHERE id = ?`).run(1);

    const job = db.prepare('SELECT payment_status, deliver_status, deleted_at FROM jobs WHERE id = 1').get() as {
      payment_status: string;
      deliver_status: string;
      deleted_at: string | null;
    };
    expect(job.payment_status).toBe('paid');
    expect(job.deliver_status).toBe('delivered');
    expect(job.deleted_at).toBeTruthy();
  });

  it('logs a WhatsApp notification (JobDetailPage)', () => {
    const customerId = (
      db.prepare('INSERT INTO customers (name, mobile) VALUES (?, ?)').run('C', '0300') as unknown as {
        lastInsertRowid: number;
      }
    ).lastInsertRowid;
    db.prepare('INSERT INTO jobs (token_number, customer_id, receive_date) VALUES (?, ?, ?)').run(
      'TK-1000',
      customerId,
      '2026-08-08'
    );

    db.prepare(
      `INSERT INTO job_notifications (job_id, channel, message, sent_at, status) VALUES (?, 'whatsapp', ?, datetime('now'), 'sent')`
    ).run(1, 'Hello');

    const n = db.prepare('SELECT channel, status FROM job_notifications WHERE job_id = 1').get() as {
      channel: string;
      status: string;
    };
    expect(n).toEqual({ channel: 'whatsapp', status: 'sent' });
  });

  it('logs a manual backup (BackupPage)', () => {
    db.prepare(
      `INSERT INTO backup_log (file_path, file_name, size_bytes, backup_type, created_at) VALUES (?, ?, ?, 'manual', datetime('now'))`
    ).run('C:\\backups\\x.db', 'x.db', 1234);

    const log = db.prepare('SELECT backup_type FROM backup_log').get() as { backup_type: string };
    expect(log.backup_type).toBe('manual');
  });
});
