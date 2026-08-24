// Native SQLite data layer. All storage lives in a real on-disk database
// (prodata.db) owned by the Electron main process; this module is a thin
// typed bridge over IPC with a one-time legacy-data migration from the old
// sql.js-in-IndexedDB snapshot format.

const MIGRATION_FLAG = 'prodata_native_db_migrated';

interface DbBridge {
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  execute: (sql: string, params?: unknown[]) => Promise<{ ok: true }>;
  batch: (ops: Array<{ sql: string; params?: unknown[] }>) => Promise<unknown[]>;
  exportBinary: () => Promise<Uint8Array>;
  importBinary: (bytes: Uint8Array | number[]) => Promise<{ ok: true }>;
  resetProduction: () => Promise<{ ok: true }>;
  getPath: () => Promise<string>;
}

function bridge(): DbBridge {
  const b = (window as unknown as { prodata?: { db?: DbBridge } }).prodata?.db;
  if (!b) {
    throw new Error('Native database bridge is unavailable. Is the app running inside Electron?');
  }
  return b;
}

// ---------------------------------------------------------------------------
// One-time legacy migration: the pre-native build stored its whole database as
// a sql.js snapshot in IndexedDB. On first launch of the native build we copy
// that snapshot into prodata.db and flag completion. The legacy IndexedDB data
// is intentionally LEFT IN PLACE for rollback safety.
// ---------------------------------------------------------------------------

const IDB_NAME = 'prodata_repair_db_store';
const IDB_STORE = 'files';
const IDB_KEY = 'sqlite_db';

function openLegacyIDB(): Promise<IDBDatabase> {
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

async function loadLegacySnapshot(): Promise<Uint8Array | null> {
  try {
    const idb = await openLegacyIDB();
    return await new Promise<Uint8Array | null>((resolve) => {
      let tx: IDBTransaction;
      try {
        tx = idb.transaction(IDB_STORE, 'readonly');
      } catch {
        resolve(null);
        return;
      }
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => {
        resolve(req.result ? new Uint8Array(req.result) : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

let readyPromise: Promise<void> | null = null;

export function ensureDbReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const b = bridge();
      if (localStorage.getItem(MIGRATION_FLAG) === '1') return;

      const legacy = await loadLegacySnapshot();
      if (legacy && legacy.length > 0) {
        try {
          await b.importBinary(legacy);
          console.info('[db] Legacy snapshot imported into native SQLite.');
        } catch (err) {
          // Never brick the app on a bad snapshot: continue with whatever the
          // native file contains; legacy bytes stay in IndexedDB for recovery.
          console.error('[db] Legacy snapshot import FAILED:', err);
        }
      }
      localStorage.setItem(MIGRATION_FLAG, '1');
    })();
  }
  return readyPromise;
}

// ---------------------------------------------------------------------------

export async function query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ensureDbReady();
  return bridge().query(sql, params) as Promise<T[]>;
}

export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  await ensureDbReady();
  await bridge().execute(sql, params);
}

/**
 * Execute multiple operations in a single IPC round-trip inside a transaction.
 * Returns an array of results — one per operation (queries return row arrays,
 * mutations return { changes, lastInsertRowid }).
 */
export async function batch(
  operations: Array<{ sql: string; params?: unknown[] }>
): Promise<unknown[]> {
  await ensureDbReady();
  return bridge().batch(operations);
}

/**
 * Robust token generator that inspects database jobs to always find the next PTS token.
 * Formats: PTS-001, PTS-002, PTS-003, PTS-010, PTS-100, etc.
 */
export async function getNextPTSToken(): Promise<string> {
  try {
    // Scan ALL active jobs (not just last 200) and parse every token format
    const rows = await query<{ token_number: string }>(
      "SELECT token_number FROM jobs WHERE token_number IS NOT NULL AND deleted_at IS NULL"
    );
    let maxNum = 0;
    for (const r of rows) {
      if (!r.token_number) continue;
      const match = r.token_number.match(/^(?:PTS-|TK-)?(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
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

/**
 * Attempt to insert a job, retrying with fresh token on UNIQUE constraint failure.
 * This handles race conditions where two concurrent creates grab the same token.
 */
export async function insertJobWithRetry(
  jobValues: unknown[],
  maxRetries: number = 3
): Promise<string> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await execute(
        `INSERT INTO jobs (
          token_number, customer_id, job_type, serial_no, model, ram, hard, processor,
          symptoms, receive_date, return_date, charges, has_charger, payment_status, deliver_status, notes, reference_token, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        jobValues
      );
      return jobValues[0] as string; // return the token that was actually inserted
    } catch (e: any) {
      const isUnique = e?.message?.includes('UNIQUE constraint failed');
      if (!isUnique || attempt >= maxRetries) throw e;
      // Token collided — grab the next one and rebuild the values array
      const freshToken = await getNextPTSToken();
      jobValues[0] = freshToken;
    }
  }
  throw new Error('Failed to generate unique token after multiple attempts');
}

export async function exportDatabaseBinary(): Promise<Uint8Array> {
  await ensureDbReady();
  return bridge().exportBinary();
}

export async function restoreDatabaseBinary(uint8Array: Uint8Array): Promise<void> {
  await ensureDbReady();
  await bridge().importBinary(uint8Array);
}

export async function resetDatabaseToProduction(): Promise<void> {
  await ensureDbReady();
  await bridge().resetProduction();
}
