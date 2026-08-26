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
 * Authoritative token generator backed by the `settings.token_counter` key.
 *
 * WHY a persisted counter instead of scanning MAX(token_number):
 * After a backup restore the on-disk jobs table and the parsed numeric maximum
 * can disagree with the `id` auto-increment sequence (sqlite_sequence), which is
 * the root cause of the "UNIQUE constraint failed: jobs.token_number" error
 * that clients hit when creating the first new job after restoring a backup.
 * A persisted counter survives the restore, is written back before each
 * return, and keeps the sequence consistent and collision-free.
 *
 * Seeding: on first use (or after a restore that removed the row) the counter
 * is backfilled from the live MAX(numeric token) in the jobs table.
 */
export async function getNextPTSToken(): Promise<string> {
  try {
    // 1. Ensure a token_counter setting row exists (idempotent).
    await execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('token_counter', '0')");

    // 2. Reconcile against restored data: if the persisted counter is stale /
    //    zero / smaller than the real maximum numeric token, resync it so the
    //    next generated token never collides with restored jobs.
    await execute(`
      UPDATE settings
      SET value = CAST(
        (SELECT COALESCE(MAX(CAST(SUBSTR(token_number, INSTR(token_number, '-') + 1) AS INTEGER)), 0)
         FROM jobs WHERE token_number LIKE 'PTS-%')
        AS TEXT)
      WHERE key = 'token_counter'
        AND (CAST(value AS INTEGER) = 0
             OR CAST(value AS INTEGER) <
               (SELECT COALESCE(MAX(CAST(SUBSTR(token_number, INSTR(token_number, '-') + 1) AS INTEGER)), 0)
                FROM jobs WHERE token_number LIKE 'PTS-%'))
    `);

    // 3. Atomically read + increment. All db IPC calls run on the main-process
    //    native SQLite connection which serialises writes, so concurrent callers
    //    never observe the same nextNum.
    const rows = await query<{ value: string }>("SELECT value FROM settings WHERE key = ?", ['token_counter']);
    const current = rows.length > 0 ? parseInt(rows[0].value, 10) : 0;
    const nextNum = (isNaN(current) ? 0 : current) + 1;
    await execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['token_counter', String(nextNum)]);

    return `PTS-${nextNum.toString().padStart(3, '0')}`;
  } catch (err) {
    console.error('Failed calculating next PTS token:', err);
    // Last-resort fallback: scan the jobs table so we never return a token that
    // already exists even if the settings table is unavailable.
    try {
      const rows = await query<{ token_number: string }>("SELECT token_number FROM jobs WHERE token_number IS NOT NULL AND deleted_at IS NULL AND token_number LIKE 'PTS-%'");
      let maxNum = 0;
      for (const r of rows) {
        const match = r.token_number.match(/^PTS-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
      return `PTS-${(maxNum + 1).toString().padStart(3, '0')}`;
    } catch {
      return 'PTS-001';
    }
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
