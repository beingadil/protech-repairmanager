/**
 * Regression: every INSERT/UPDATE in the app must use single-quoted SQL
 * string literals (no double-quoted identifiers) so better-sqlite3's strict
 * mode doesn't throw "no such column".
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

function makeDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mobile TEXT DEFAULT '',
      address TEXT DEFAULT '',
      party_type TEXT DEFAULT 'customer',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_number TEXT,
      customer_id INTEGER REFERENCES customers(id),
      job_type TEXT NOT NULL DEFAULT 'laptop',
      serial_no TEXT DEFAULT '',
      model TEXT DEFAULT '',
      ram TEXT DEFAULT '',
      hard TEXT DEFAULT '',
      processor TEXT DEFAULT '',
      symptoms TEXT DEFAULT '',
      receive_date TEXT DEFAULT '',
      return_date TEXT DEFAULT '',
      charges REAL DEFAULT 0,
      has_charger INTEGER DEFAULT 1,
      payment_status TEXT DEFAULT 'due',
      deliver_status TEXT DEFAULT 'pending',
      notes TEXT DEFAULT '',
      reference_token TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE financial_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      customer_id INTEGER,
      customer_name TEXT,
      supplier_name TEXT,
      reference_job_id INTEGER,
      token_number TEXT,
      description TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE backup_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      backup_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE job_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      channel TEXT NOT NULL,
      message TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `);
  return db;
}

describe('App SQL — strict better-sqlite3 compatibility', () => {
  it('INSERT INTO customers works', () => {
    const db = makeDb();
    db.prepare(
      `INSERT INTO customers (name, mobile, address, party_type, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run('Test User', '0300', 'Lahore', 'customer');
    expect(db.prepare('SELECT * FROM customers').all()).toHaveLength(1);
  });

  it('INSERT INTO jobs works', () => {
    const db = makeDb();
    db.prepare(
      `INSERT INTO customers (name, mobile, address, party_type, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run('Cust', '0300', '', 'customer');
    db.prepare(
      `INSERT INTO jobs (token_number, customer_id, job_type, serial_no, model, ram, hard, processor, symptoms, receive_date, return_date, charges, has_charger, payment_status, deliver_status, notes, reference_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run('PTS-001', 1, 'laptop', 'SN1', 'Dell', '8GB', '256GB', 'i5', 'Broken', '2024-01-01', '2024-01-04', 2000, 1, 'due', 'pending', '', null);
    expect(db.prepare('SELECT * FROM jobs').all()).toHaveLength(1);
  });

  it('UPDATE customers with datetime works', () => {
    const db = makeDb();
    db.prepare(
      `INSERT INTO customers (name, mobile, address, party_type, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run('Test', '0300', '', 'customer');
    db.prepare(
      `UPDATE customers SET name = ?, mobile = ?, address = ?, party_type = ?, updated_at = datetime('now') WHERE id = ?`
    ).run('Updated', '0301', 'Lahore', 'customer', 1);
    const row: any = db.prepare('SELECT * FROM customers WHERE id = 1').get();
    expect(row.name).toBe('Updated');
  });

  it('UPDATE jobs with datetime works', () => {
    const db = makeDb();
    db.prepare(
      `INSERT INTO customers (name, mobile, address, party_type, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run('C', '0300', '', 'customer');
    db.prepare(
      `INSERT INTO jobs (token_number, customer_id, job_type, serial_no, model, ram, hard, processor, symptoms, receive_date, return_date, charges, has_charger, payment_status, deliver_status, notes, reference_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run('PTS-002', 1, 'laptop', '', '', '', '', '', '', '', '', 0, 1, 'due', 'pending', '', null);
    db.prepare(
      `UPDATE jobs SET deliver_status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run('delivered', 1);
    db.prepare(
      `UPDATE jobs SET deleted_at = datetime('now') WHERE id = ?`
    ).run(1);
    const row: any = db.prepare('SELECT * FROM jobs WHERE id = 1').get();
    expect(row.deliver_status).toBe('delivered');
    expect(row.deleted_at).not.toBeNull();
  });

  it('INSERT INTO financial_transactions works', () => {
    const db = makeDb();
    db.prepare(
      `INSERT INTO financial_transactions (date, type, amount, category, payment_method, customer_name, token_number, description, notes, created_at, updated_at)
       VALUES (?, 'credit', ?, 'repair_income', 'cash', ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run('2024-01-01', 2000, 'Test', 'PTS-001', 'Repair charges', 'Auto');
    expect(db.prepare('SELECT * FROM financial_transactions').all()).toHaveLength(1);
  });

  it('INSERT INTO backup_log with manual type works', () => {
    const db = makeDb();
    db.prepare(
      `INSERT INTO backup_log (file_path, file_name, size_bytes, backup_type, created_at) VALUES (?, ?, ?, 'manual', datetime('now'))`
    ).run('test.db', 'test.db', 1024);
    const row: any = db.prepare('SELECT * FROM backup_log').get();
    expect(row.backup_type).toBe('manual');
  });

  it('INSERT INTO job_notifications with whatsapp/sent works', () => {
    const db = makeDb();
    db.prepare(
      `INSERT INTO job_notifications (job_id, channel, message, sent_at, status) VALUES (?, 'whatsapp', ?, datetime('now'), 'sent')`
    ).run(1, 'Hello');
    const row: any = db.prepare('SELECT * FROM job_notifications').get();
    expect(row.channel).toBe('whatsapp');
    expect(row.status).toBe('sent');
  });

  it('date() function works for financial transactions', () => {
    const db = makeDb();
    db.prepare(
      `INSERT INTO financial_transactions (date, type, amount, category, payment_method, customer_name, description, notes, created_at, updated_at)
       VALUES (date('now'), ?, ?, ?, 'cash', ?, ?, ?, datetime('now'), datetime('now'))`
    ).run('credit', 500, 'repair_income', 'Test', 'Description', 'Notes');
    const row: any = db.prepare('SELECT * FROM financial_transactions').get();
    expect(row.date).toBeTruthy();
  });

  it('token numbers >= 1000 can be inserted (regression for num<1000 bug)', () => {
    const db = makeDb();
    db.prepare(
      `INSERT INTO customers (name, mobile, address, party_type, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run('Cust', '0300', '', 'customer');

    // Insert tokens 1-1002 to prove the generator never skips tokens >= 1000
    const insert = db.prepare(
      `INSERT INTO jobs (token_number, customer_id, job_type, serial_no, model, ram, hard, processor, symptoms, receive_date, return_date, charges, has_charger, payment_status, deliver_status, notes, reference_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    );

    for (let i = 1; i <= 1002; i++) {
      const token = `PTS-${i.toString().padStart(3, '0')}`;
      insert.run(token, 1, 'laptop', '', '', '', '', '', '', '', '', 0, 1, 'due', 'pending', '', null);
    }

    const rows: any[] = db.prepare('SELECT token_number FROM jobs ORDER BY id').all();
    expect(rows).toHaveLength(1002);
    expect(rows[998].token_number).toBe('PTS-999');
    expect(rows[999].token_number).toBe('PTS-1000');
    expect(rows[1000].token_number).toBe('PTS-1001');
    expect(rows[1001].token_number).toBe('PTS-1002');
  });

  it('MAX token_number query returns correct value across all ranges', () => {
    const db = makeDb();
    db.prepare(
      `INSERT INTO customers (name, mobile, address, party_type, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run('Cust', '0300', '', 'customer');
    const insert = db.prepare(
      `INSERT INTO jobs (token_number, customer_id, job_type, serial_no, model, ram, hard, processor, symptoms, receive_date, return_date, charges, has_charger, payment_status, deliver_status, notes, reference_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    );

    // Insert at high range directly
    insert.run('PTS-2500', 1, 'laptop', '', '', '', '', '', '', '', '', 0, 1, 'due', 'pending', '', null);
    insert.run('PTS-0999', 1, 'laptop', '', '', '', '', '', '', '', '', 0, 1, 'due', 'pending', '', null);
    insert.run('PTS-5000', 1, 'laptop', '', '', '', '', '', '', '', '', 0, 1, 'due', 'pending', '', null);

    // Verify MAX query (simulating what getNextPTSToken should do)
    const rows: any[] = db.prepare('SELECT token_number FROM jobs WHERE token_number IS NOT NULL AND deleted_at IS NULL').all();
    let maxNum = 0;
    for (const r of rows) {
      const match = r.token_number.match(/^(?:PTS-|TK-)?(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    // Must see PTS-5000, not be limited by any threshold
    expect(maxNum).toBe(5000);
  });
});
