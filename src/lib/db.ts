import initSqlJs, { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { validateBackupBytes, validateBackupSchema, backupErrorMessage } from './backup-validate';

let dbInstance: Database | null = null;
let dbInitPromise: Promise<Database> | null = null;

const DB_STORAGE_KEY = 'prodata_repair_manager_sqlite_db';
const IDB_NAME = 'prodata_repair_db_store';
const IDB_STORE = 'files';
const IDB_KEY = 'sqlite_db';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToIndexedDB(data: Uint8Array): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(data.buffer, IDB_KEY);
  } catch (err) {
    console.warn('IndexedDB save warning:', err);
  }
}

async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        if (req.result) {
          resolve(new Uint8Array(req.result));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('IndexedDB load warning:', err);
    return null;
  }
}

async function clearIndexedDB(): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.clear();
  } catch (err) {
    console.warn('IndexedDB clear warning:', err);
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function loadDbFromStorage(): Promise<Uint8Array | null> {
  // 1. IndexedDB is the primary store (no strict size limits).
  const idbData = await loadFromIndexedDB();
  if (idbData && idbData.length > 0) {
    return idbData;
  }

  // 2. One-time migration from the legacy localStorage formats (base64 or
  //    legacy JSON array). We read but never write localStorage again —
  //    writing the whole database there duplicated PII and hit the 5 MB quota.
  if (typeof window === 'undefined') return null;
  const savedData = localStorage.getItem(DB_STORAGE_KEY);
  if (!savedData) return null;

  try {
    let uInt8Array: Uint8Array;
    if (savedData.startsWith('[')) {
      const arr = JSON.parse(savedData);
      uInt8Array = new Uint8Array(arr);
    } else {
      uInt8Array = base64ToUint8Array(savedData);
    }
    await saveToIndexedDB(uInt8Array);
    return uInt8Array;
  } catch (e) {
    console.error('Failed decoding stored DB:', e);
    return null;
  }
}

// SQL migration scripts
const MIGRATIONS = [
  `
  -- Table: customers
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mobile TEXT,
    address TEXT,
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
  -- Seed settings if empty
  INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_name', 'ProTech Services');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_address', 'Jamil Ahmad Computer Market, Munir Chowk, Gujranwala / Flat 1, Sadiq Plaza, Lahore');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_mobile', '0300-0404004');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('logo_path', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'dark');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('thermal_size', '80');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('default_charges', '1500');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_backup', '1');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('token_counter', '1000');
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_jobs_search ON jobs(token_number, serial_no, model);
  CREATE INDEX IF NOT EXISTS idx_customers_search ON customers(name, mobile);
  `,
  `
  -- Purge initial dummy/seeded sample data if present
  DELETE FROM job_notifications WHERE job_id IN (SELECT id FROM jobs WHERE token_number IN ('TK-1001', 'TK-1002', 'TK-1003', 'TK-1004', 'TK-1005'));
  DELETE FROM jobs WHERE token_number IN ('TK-1001', 'TK-1002', 'TK-1003', 'TK-1004', 'TK-1005');
  DELETE FROM customers WHERE name IN ('Ahmad Hassan', 'Bilal Tariq', 'Usman Khalid', 'Zainab Raza', 'Kamran Ali');
  `
];

async function initSql(): Promise<ReturnType<typeof initSqlJs>> {
  // Local WASM only. No CDN fallbacks: this app must work fully offline and
  // must not load third-party code at runtime (supply-chain risk).
  return initSqlJs({
    locateFile: () => sqlWasmUrl
  });
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    const SQL = await initSql();

    const savedData = await loadDbFromStorage();
    if (savedData) {
      try {
        dbInstance = new SQL.Database(savedData);
      } catch (e) {
        console.error('Failed to load DB from storage, creating new instance:', e);
        dbInstance = new SQL.Database();
      }
    } else {
      dbInstance = new SQL.Database();
    }

    // Run migrations
    for (const sql of MIGRATIONS) {
      dbInstance.run(sql);
    }

    // Seed sample data if database is brand new and hasn't been seeded yet
    seedSampleDataIfEmpty(dbInstance);

    saveDbToStorage();
    return dbInstance;
  })();

  return dbInitPromise;
}

export async function resetDatabaseToProduction(): Promise<void> {
  const db = await getDb();

  // Drop all existing tables
  db.run(`
    DROP TABLE IF EXISTS job_notifications;
    DROP TABLE IF EXISTS jobs;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS backup_log;
    DROP TABLE IF EXISTS settings;
  `);

  // Re-run migrations
  for (const sql of MIGRATIONS) {
    db.run(sql);
  }

  // Explicitly mark as seeded so seedSampleDataIfEmpty does not re-populate sample jobs
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('has_seeded', '1');");

  // Clear storage
  await clearIndexedDB();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(DB_STORAGE_KEY);
    localStorage.removeItem('app_theme');
  }

  // Save fresh empty state
  saveDbToStorage();
}

export function saveDbToStorage() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    saveToIndexedDB(data);
  } catch (e) {
    console.warn('Failed to persist DB to storage:', e);
  }
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);

  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export async function execute(sql: string, params: any[] = []): Promise<void> {
  const db = await getDb();
  db.run(sql, params);
  saveDbToStorage();
}

/**
 * Internal only: raw SQL execution used by migrations. App code should use
 * the parameterized `execute` / `query` helpers instead.
 */
export async function executeRaw(sql: string): Promise<void> {
  const db = await getDb();
  db.run(sql);
  saveDbToStorage();
}

export async function exportDatabaseBinary(): Promise<Uint8Array> {
  const db = await getDb();
  return db.export();
}

/**
 * Validated restore: only real, intact SQLite databases with the required
 * schema are accepted. A crafted .db file must not be able to crash the app
 * or smuggle in triggers/views that run on the next query.
 */
export async function restoreDatabaseBinary(uint8Array: Uint8Array): Promise<void> {
  const headerError = validateBackupBytes(uint8Array);
  if (headerError) {
    throw new Error(backupErrorMessage(headerError));
  }

  const SQL = await initSql();
  const candidate = new SQL.Database(uint8Array);

  // Integrity check (PRAGMA integrity_check returns a single 'ok' row).
  const integrity = candidate.exec('PRAGMA integrity_check');
  const integrityResult: unknown = integrity?.[0]?.values?.[0]?.[0];
  if (integrityResult !== 'ok') {
    candidate.close();
    throw new Error(backupErrorMessage('integrity-failed'));
  }

  // Schema check: the candidate must contain every required table.
  const tableRows = candidate.exec(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
  );
  const tables = (tableRows?.[0]?.values ?? []).map((row) => String(row[0]));
  const schemaError = validateBackupSchema(tables);
  if (schemaError) {
    candidate.close();
    throw new Error(backupErrorMessage(schemaError));
  }

  // Everything checks out — swap the live instance and apply any newer
  // migrations the restored database may be missing.
  dbInstance?.close();
  dbInstance = candidate;
  for (const sql of MIGRATIONS) {
    dbInstance.run(sql);
  }
  seedSampleDataIfEmpty(dbInstance);
  saveDbToStorage();
}

function seedSampleDataIfEmpty(db: Database) {
  // Completely clear any remaining sample seed jobs
  try {
    db.run(`
      DELETE FROM job_notifications WHERE job_id IN (SELECT id FROM jobs WHERE token_number IN ('TK-1001', 'TK-1002', 'TK-1003', 'TK-1004', 'TK-1005'));
      DELETE FROM jobs WHERE token_number IN ('TK-1001', 'TK-1002', 'TK-1003', 'TK-1004', 'TK-1005');
      DELETE FROM customers WHERE name IN ('Ahmad Hassan', 'Bilal Tariq', 'Usman Khalid', 'Zainab Raza', 'Kamran Ali');
      INSERT OR REPLACE INTO settings (key, value) VALUES ('has_seeded', '1');
    `);
  } catch (e) {
    // Ignore error if cleanup fails
  }
}
