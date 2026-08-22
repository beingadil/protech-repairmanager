import { app } from 'electron';
import Database from 'better-sqlite3';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Native SQLite engine living in the MAIN process. The renderer talks to it
// over IPC (see ipc.ts) — no more sql.js WASM snapshots into IndexedDB.
let dbInstance: Database.Database | null = null;
let migrationsRan = false;

// SQL migration scripts — kept byte-identical to the legacy renderer schema
// (src/lib/db.ts) so migrated shop data keeps working unchanged.
const MIGRATIONS = [
  `
  -- Table: customers
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mobile TEXT,
    address TEXT,
    party_type TEXT DEFAULT 'customer',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
  CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

  -- Table: jobs
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    job_type TEXT NOT NULL DEFAULT 'laptop',
    serial_no TEXT,
    model TEXT,
    ram TEXT,
    hard TEXT,
    processor TEXT,
    symptoms TEXT,
    receive_date TEXT NOT NULL,
    return_date TEXT,
    charges REAL DEFAULT 0,
    has_charger INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'due',
    deliver_status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    reference_token TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_token ON jobs(token_number);
  CREATE INDEX IF NOT EXISTS idx_jobs_receive_date ON jobs(receive_date);
  CREATE INDEX IF NOT EXISTS idx_jobs_payment ON jobs(payment_status);
  CREATE INDEX IF NOT EXISTS idx_jobs_deliver ON jobs(deliver_status);
  CREATE INDEX IF NOT EXISTS idx_jobs_deleted ON jobs(deleted_at);

  -- Table: job_notifications
  CREATE TABLE IF NOT EXISTS job_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    channel TEXT NOT NULL,
    message TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'sent'
  );

  -- Table: backup_log
  CREATE TABLE IF NOT EXISTS backup_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    size_bytes INTEGER,
    backup_type TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Table: settings
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  `
  -- Default system configuration settings
  INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_name', 'ProTech Services');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_slogan', 'Professional Laptop & Desktop Hardware Repair Center');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_address', 'Jamil Ahmad Computer Market, Munir Chowk, Gujranwala / Flat 1, Sadiq Plaza, Lahore');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_mobile', '0300-0404004');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_whatsapp', '0300-0404004');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_email', 'support@protechservices.pk');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('logo_path', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'dark');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('thermal_size', '80');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('default_charges', '1500');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('currency_symbol', 'PKR');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('receipt_header_msg', 'Thank you for choosing ProTech Services.');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('receipt_footer_msg', 'Warranty claims require original receipt. No returns after 30 days.');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('receipt_terms', '1. Repaired equipment must be collected within 30 days.\n2. Shop is not responsible for software or data loss.\n3. Warranty void if seal broken.');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('show_qr_on_receipt', '1');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('show_logo_on_receipt', '1');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('default_warranty_days', '30');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('default_turnaround_days', '2');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('token_prefix', 'PTS');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('twilio_sid', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('twilio_token', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('twilio_from', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_backup', '1');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('token_counter', '1');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('has_seeded', '1');
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_jobs_search ON jobs(token_number, serial_no, model);
  CREATE INDEX IF NOT EXISTS idx_customers_search ON customers(name, mobile);
  `,
  `
  -- Table: inventory_items
  CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_threshold INTEGER NOT NULL DEFAULT 2,
    unit_cost REAL NOT NULL DEFAULT 0,
    selling_price REAL NOT NULL DEFAULT 0,
    location TEXT DEFAULT 'Shelf A1',
    supplier_info TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);
  CREATE INDEX IF NOT EXISTS idx_inventory_part ON inventory_items(part_number);
  CREATE INDEX IF NOT EXISTS idx_inventory_qty ON inventory_items(quantity);

  -- Table: inventory_transactions
  CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    quantity_changed INTEGER NOT NULL,
    unit_cost REAL,
    job_id INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_trans_item ON inventory_transactions(item_id);

  -- Table: financial_transactions (Double Entry / Credit & Debit Accounting)
  CREATE TABLE IF NOT EXISTS financial_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    customer_id INTEGER,
    customer_name TEXT,
    supplier_name TEXT,
    reference_job_id INTEGER,
    token_number TEXT,
    description TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_fin_date ON financial_transactions(date);
  CREATE INDEX IF NOT EXISTS idx_fin_type ON financial_transactions(type);
  CREATE INDEX IF NOT EXISTS idx_fin_category ON financial_transactions(category);
  CREATE INDEX IF NOT EXISTS idx_fin_token ON financial_transactions(token_number);
  `,
  `
  -- Index party-ledger lookups (party history drawer, ledger, payments by name)
  CREATE INDEX IF NOT EXISTS idx_fin_customer_name ON financial_transactions(customer_name);
  CREATE INDEX IF NOT EXISTS idx_fin_supplier_name ON financial_transactions(supplier_name);
  CREATE INDEX IF NOT EXISTS idx_fin_reference_job ON financial_transactions(reference_job_id);
  `,
  `
  -- Performance indexes for common module queries
  CREATE INDEX IF NOT EXISTS idx_jobs_filtered ON jobs(deleted_at, payment_status, deliver_status);
  CREATE INDEX IF NOT EXISTS idx_jobs_due_sort ON jobs(deleted_at, deliver_status, return_date);
  CREATE INDEX IF NOT EXISTS idx_fin_token_type ON financial_transactions(token_number, type);
  CREATE INDEX IF NOT EXISTS idx_trans_created_at ON inventory_transactions(created_at);
  `
];

function cleanDemoSeededData(db: Database.Database): void {
  try {
    // Purge any legacy sample jobs/inventory/customers from early dev iterations
    db.exec(`
      DELETE FROM job_notifications WHERE job_id IN (SELECT id FROM jobs WHERE token_number IN ('TK-1001', 'TK-1002', 'TK-1003', 'TK-1004', 'TK-1005'));
      DELETE FROM jobs WHERE token_number IN ('TK-1001', 'TK-1002', 'TK-1003', 'TK-1004', 'TK-1005');
      DELETE FROM customers WHERE name IN ('Ahmad Hassan', 'Bilal Tariq', 'Usman Khalid', 'Zainab Raza', 'Kamran Ali');
      DELETE FROM inventory_items WHERE part_number IN ('RAM-DDR4-8GB', 'RAM-DDR4-16GB', 'SSD-NVME-256GB', 'SSD-NVME-512GB', 'LCD-156-FHD', 'BAT-DELL-5580', 'CHG-65W-TYPEC', 'PASTE-MX4-4G');
      INSERT OR REPLACE INTO settings (key, value) VALUES ('has_seeded', '1');
    `);
  } catch {
    // Ignore cleanup failures — non-fatal
  }
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  dbInstance = new Database(getDbPath());
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  if (!migrationsRan) {
    for (const sql of MIGRATIONS) {
      try {
        dbInstance.exec(sql);
      } catch (err) {
        console.warn('[db] Migration warning:', err);
      }
    }
    // Safe column additions for older databases
    try {
      dbInstance.exec('ALTER TABLE jobs ADD COLUMN reference_token TEXT;');
    } catch { /* already exists */ }
    try {
      dbInstance.exec("ALTER TABLE customers ADD COLUMN party_type TEXT DEFAULT 'customer';");
    } catch { /* already exists */ }

    cleanDemoSeededData(dbInstance);
    migrationsRan = true;
  }

  return dbInstance;
}

export function getDbPath(): string {
  return join(app.getPath('userData'), 'prodata.db');
}

export function query<T = unknown>(sql: string, params: unknown[] = []): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  return (params.length > 0 ? stmt.all(...params) : stmt.all()) as T[];
}

export function execute(sql: string, params: unknown[] = []): void {
  const db = getDb();
  if (params.length > 0) {
    db.prepare(sql).run(...params);
  } else {
    db.exec(sql);
  }
}

// Consistent on-disk snapshot: fold WAL back into the main file, then read it.
export function exportBinary(): Buffer {
  const db = getDb();
  db.pragma('wal_checkpoint(TRUNCATE)');
  return readDbFile();
}

function readDbFile(): Buffer {
  return readFileSync(getDbPath());
}

// Replace the live database file with the given bytes (legacy-data import and
// backup restore share this path). Atomic-ish: temp file + rename.
export function importBinary(buf: Buffer): void {
  closeDb();
  const target = getDbPath();
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, buf);
  rmSidecars(target);
  renameSync(tmp, target);
  const reopened = getDb();
  const check = reopened.pragma('integrity_check', { simple: true });
  if (check !== 'ok') {
    throw new Error(`Imported database failed integrity check: ${String(check)}`);
  }
}

// Wipe back to a fresh production schema.
export function resetToProduction(): void {
  closeDb();
  const target = getDbPath();
  rmSidecars(target);
  if (existsSync(target)) rmSync(target);
  migrationsRan = false;
  getDb();
}

function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.pragma('wal_checkpoint(TRUNCATE)');
      dbInstance.close();
    } catch (err) {
      console.warn('[db] Close warning:', err);
    }
    dbInstance = null;
  }
}

function rmSidecars(target: string): void {
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${target}${suffix}`;
    if (existsSync(sidecar)) rmSync(sidecar);
  }
}
