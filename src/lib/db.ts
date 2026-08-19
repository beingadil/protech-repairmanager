import initSqlJs, { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

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

function uint8ArrayToBase64(uint8: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    const chunk = uint8.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
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
  // 1. Try IndexedDB first (no strict size limits)
  const idbData = await loadFromIndexedDB();
  if (idbData && idbData.length > 0) {
    return idbData;
  }

  // 2. Fallback to localStorage (Base64 or legacy JSON array)
  if (typeof window === 'undefined') return null;
  const savedData = localStorage.getItem(DB_STORAGE_KEY);
  if (!savedData) return null;

  try {
    if (savedData.startsWith('[')) {
      // Legacy JSON array format
      const arr = JSON.parse(savedData);
      const uInt8Array = new Uint8Array(arr);
      saveToIndexedDB(uInt8Array);
      saveToLocalStorageBase64(uInt8Array);
      return uInt8Array;
    } else {
      // Compact Base64 format
      const uInt8Array = base64ToUint8Array(savedData);
      saveToIndexedDB(uInt8Array);
      return uInt8Array;
    }
  } catch (e) {
    console.error('Failed decoding stored DB:', e);
    return null;
  }
}

function saveToLocalStorageBase64(data: Uint8Array) {
  if (typeof window === 'undefined') return;
  try {
    const base64 = uint8ArrayToBase64(data);
    localStorage.setItem(DB_STORAGE_KEY, base64);
  } catch (e) {
    console.warn('localStorage quota reached, IndexedDB is active as primary store:', e);
  }
}

// SQL migration scripts - Pure Schema Only (No demo or dummy data)
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
  INSERT OR IGNORE INTO settings (key, value) VALUES ('receipt_terms', '1. Repaired equipment must be collected within 30 days.\n2. Shop is not responsible for software or data loss.\n3. Warranty void if seal is broken.');
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
  `
];

async function loadWasmBinary(): Promise<ArrayBuffer> {
  // Packaged Electron: fetch() is blocked on file:// URLs, so the main process
  // hands us the bundled WASM bytes over the preload bridge. Works offline.
  try {
    const bridged = (window as unknown as { prodata?: { sqlWasm: { get(): Promise<number[] | null> } } }).prodata?.sqlWasm?.get();
    if (bridged) {
      const bytes = await bridged;
      if (bytes && bytes.length > 0) {
        return Uint8Array.from(bytes).buffer as ArrayBuffer;
      }
    }
  } catch (err) {
    console.warn('Bridged WASM load failed, falling back:', err);
  }

  try {
    const res = await fetch(sqlWasmUrl);
    if (res.ok) {
      return await res.arrayBuffer();
    }
  } catch (err) {
    console.warn('Local WASM fetch warning, trying CDN fallback...', err);
  }

  try {
    const cdnRes = await fetch('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm');
    if (cdnRes.ok) {
      return await cdnRes.arrayBuffer();
    }
  } catch (err) {
    console.warn('CDN WASM fetch warning, trying unpkg fallback...', err);
  }

  const unpkgRes = await fetch('https://unpkg.com/sql.js@1.12.0/dist/sql-wasm.wasm');
  return await unpkgRes.arrayBuffer();
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    let SQL;
    try {
      const wasmBinary = await loadWasmBinary();
      SQL = await initSqlJs({ wasmBinary });
    } catch (e1) {
      console.warn('WASM binary load fallback to locateFile...', e1);
      try {
        SQL = await initSqlJs({
          locateFile: () => sqlWasmUrl
        });
      } catch (e2) {
        SQL = await initSqlJs({
          locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
        });
      }
    }

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
      try {
        dbInstance.run(sql);
      } catch (err) {
        console.warn('Migration run warning:', err);
      }
    }

    // Safe column additions for updates
    try {
      dbInstance.run("ALTER TABLE jobs ADD COLUMN reference_token TEXT;");
    } catch (_) {}
    try {
      dbInstance.run("ALTER TABLE customers ADD COLUMN party_type TEXT DEFAULT 'customer';");
    } catch (_) {}

    // Clean any legacy demo seed data if previously present
    cleanDemoSeededData(dbInstance);

    saveDbToStorage();
    return dbInstance;
  })();

  return dbInitPromise;
}

export async function resetDatabaseToProduction(): Promise<void> {
  const db = await getDb();
  
  // Drop all existing tables
  db.run(`
    DROP TABLE IF EXISTS financial_transactions;
    DROP TABLE IF EXISTS inventory_transactions;
    DROP TABLE IF EXISTS inventory_items;
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

  // Explicitly mark as seeded so no sample records are populated
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
    saveToLocalStorageBase64(data);
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

export async function executeRaw(sql: string): Promise<void> {
  const db = await getDb();
  db.run(sql);
  saveDbToStorage();
}

/**
 * Robust token generator that inspects database jobs to always find the next PTS-xxx token.
 * Formats: PTS-001, PTS-002, PTS-003, PTS-010, PTS-100, etc.
 */
export async function getNextPTSToken(): Promise<string> {
  try {
    const rows = await query<{ token_number: string }>(
      "SELECT token_number FROM jobs WHERE token_number IS NOT NULL AND deleted_at IS NULL ORDER BY id DESC LIMIT 200"
    );
    let maxNum = 0;
    for (const r of rows) {
      if (!r.token_number) continue;
      const match = r.token_number.match(/^(?:PTS-|TK-)?(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          if (num < 1000) {
            maxNum = num;
          }
        }
      }
    }
    const nextNum = maxNum + 1;
    return `PTS-${nextNum.toString().padStart(3, '0')}`;
  } catch (err) {
    console.error('Failed calculating next PTS token:', err);
    return 'PTS-001';
  }
}

export async function exportDatabaseBinary(): Promise<Uint8Array> {
  const db = await getDb();
  return db.export();
}

export async function restoreDatabaseBinary(uint8Array: Uint8Array): Promise<void> {
  let SQL;
  try {
    const wasmBinary = await loadWasmBinary();
    SQL = await initSqlJs({ wasmBinary });
  } catch (e) {
    SQL = await initSqlJs({
      locateFile: () => sqlWasmUrl
    });
  }
  dbInstance = new SQL.Database(uint8Array);
  saveDbToStorage();
}

function cleanDemoSeededData(db: Database) {
  try {
    // Purge any legacy sample jobs or sample inventory that may exist from initial dev iterations
    db.run(`
      DELETE FROM job_notifications WHERE job_id IN (SELECT id FROM jobs WHERE token_number IN ('TK-1001', 'TK-1002', 'TK-1003', 'TK-1004', 'TK-1005'));
      DELETE FROM jobs WHERE token_number IN ('TK-1001', 'TK-1002', 'TK-1003', 'TK-1004', 'TK-1005');
      DELETE FROM customers WHERE name IN ('Ahmad Hassan', 'Bilal Tariq', 'Usman Khalid', 'Zainab Raza', 'Kamran Ali');
      DELETE FROM inventory_items WHERE part_number IN ('RAM-DDR4-8GB', 'RAM-DDR4-16GB', 'SSD-NVME-256GB', 'SSD-NVME-512GB', 'LCD-156-FHD', 'BAT-DELL-5580', 'CHG-65W-TYPEC', 'PASTE-MX4-4G');
      INSERT OR REPLACE INTO settings (key, value) VALUES ('has_seeded', '1');
    `);
  } catch (e) {
    // Ignore error if cleanup fails
  }
}
