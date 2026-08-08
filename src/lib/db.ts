import type { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { validateBackupBytes, validateBackupSchema, backupErrorMessage } from './backup-validate';
import { applyMigrations, type MigrationExecutor } from './migrations';
import {
  electronQuery,
  electronExecute,
  electronExecuteRaw,
  electronExportDatabaseBinary,
  electronRestoreDatabaseBinary,
  electronResetDatabaseToProduction
} from './db-electron';

import m001 from '../db/migrations/001_initial_schema.sql?raw';
import m002 from '../db/migrations/002_seed_settings.sql?raw';
import m003 from '../db/migrations/003_indexes.sql?raw';
import m004 from '../db/migrations/004_purge_sample_data.sql?raw';

const MIGRATIONS = [m001, m002, m003, m004];

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

/** Debounced persistence: mutations are batched, flushed shortly after. */
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    saveDbToStorage();
  }, 400);
}
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      saveDbToStorage();
    }
  });
}

let sqlJsModule: Promise<{ default: typeof import('sql.js') }> | null = null;

/**
 * Lazily loads sql.js. Only the browser adapter needs it — the Electron app
 * talks to better-sqlite3 in the main process, so the WASM and its wrapper
 * stay out of the Electron renderer's critical path.
 */
async function initSql(): Promise<ReturnType<typeof import('sql.js')['default']>> {
  if (!sqlJsModule) {
    // Local WASM only. No CDN fallbacks: this app must work fully offline and
    // must not load third-party code at runtime (supply-chain risk).
    sqlJsModule = import('sql.js').then((mod) => ({
      default: mod.default as typeof import('sql.js')
    }));
  }
  const { default: initSqlJs } = await sqlJsModule;
  return initSqlJs({
    locateFile: () => sqlWasmUrl
  });
}

function makeExecutor(db: Database): MigrationExecutor {
  return {
    run: (sql) => db.run(sql),
    query: (sql) => {
      const stmt = db.prepare(sql);
      const rows: unknown[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
    transaction: (fn) => {
      db.run('BEGIN');
      try {
        fn();
        db.run('COMMIT');
      } catch (e) {
        db.run('ROLLBACK');
        throw e;
      }
    }
  };
}

async function webGetDb(): Promise<Database> {
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

    applyMigrations(makeExecutor(dbInstance), MIGRATIONS);
    saveDbToStorage();
    return dbInstance;
  })();

  return dbInitPromise;
}

export async function getDb(): Promise<Database> {
  return webGetDb();
}

async function webResetDatabaseToProduction(): Promise<void> {
  const db = await webGetDb();

  db.run(`
    DROP TABLE IF EXISTS schema_version;
    DROP TABLE IF EXISTS job_notifications;
    DROP TABLE IF EXISTS jobs;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS backup_log;
    DROP TABLE IF EXISTS settings;
  `);

  applyMigrations(makeExecutor(db), MIGRATIONS);

  await clearIndexedDB();
  if (typeof window !== 'undefined') {
    localStorage.removeItem(DB_STORAGE_KEY);
    localStorage.removeItem('app_theme');
  }

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

async function webQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await webGetDb();
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);

  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

async function webExecute(sql: string, params: any[] = []): Promise<void> {
  const db = await webGetDb();
  db.run(sql, params);
  schedulePersist();
}

/**
 * Internal only: raw SQL execution used by migrations. App code should use
 * the parameterized `execute` / `query` helpers instead.
 */
async function webExecuteRaw(sql: string): Promise<void> {
  const db = await webGetDb();
  db.run(sql);
  schedulePersist();
}

async function webExportDatabaseBinary(): Promise<Uint8Array> {
  const db = await webGetDb();
  return db.export();
}

/**
 * Validated restore: only real, intact SQLite databases with the required
 * schema are accepted. A crafted .db file must not be able to crash the app
 * or smuggle in triggers/views that run on the next query.
 */
async function webRestoreDatabaseBinary(uint8Array: Uint8Array): Promise<void> {
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
  applyMigrations(makeExecutor(dbInstance), MIGRATIONS);
  saveDbToStorage();
}

/**
 * Facade: in the Electron desktop app the database lives in the main process
 * (better-sqlite3); in the browser it is sql.js + IndexedDB. Every caller
 * imports from here, so the rest of the app is engine-agnostic.
 */
const IS_ELECTRON =
  typeof window !== 'undefined' && Boolean((window as any).prodata?.db);

export const query = IS_ELECTRON ? electronQuery : webQuery;
export const execute = IS_ELECTRON ? electronExecute : webExecute;
export const executeRaw = IS_ELECTRON ? electronExecuteRaw : webExecuteRaw;
export const exportDatabaseBinary = IS_ELECTRON
  ? electronExportDatabaseBinary
  : webExportDatabaseBinary;
export const restoreDatabaseBinary = IS_ELECTRON
  ? electronRestoreDatabaseBinary
  : webRestoreDatabaseBinary;
export const resetDatabaseToProduction = IS_ELECTRON
  ? electronResetDatabaseToProduction
  : webResetDatabaseToProduction;
