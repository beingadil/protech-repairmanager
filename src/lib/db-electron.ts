/**
 * Electron database adapter.
 *
 * In the packaged desktop app the SQLite database lives in the main process
 * (better-sqlite3, real file in userData). The renderer talks to it through
 * the typed preload bridge — it never touches sql.js or IndexedDB.
 * This adapter implements the exact same surface as the web adapter in db.ts.
 */

interface ElectronDbBridge {
  query(sql: string, params: unknown[]): Promise<unknown[]>;
  execute(sql: string, params: unknown[]): Promise<void>;
  executeRaw(sql: string): Promise<void>;
  export(): Promise<number[]>;
  restore(bytes: number[]): Promise<void>;
  reset(): Promise<void>;
  getInfo(): Promise<{ path: string; sizeBytes: number }>;
}

function bridge(): ElectronDbBridge {
  const b = (window as any).prodata?.db as ElectronDbBridge | undefined;
  if (!b) throw new Error('Electron database bridge is not available.');
  return b;
}

export const electronQuery = async <T = any>(sql: string, params: unknown[] = []): Promise<T[]> =>
  (await bridge().query(sql, params)) as T[];

export const electronExecute = async (sql: string, params: unknown[] = []): Promise<void> => {
  await bridge().execute(sql, params);
};

export const electronExecuteRaw = async (sql: string): Promise<void> => {
  await bridge().executeRaw(sql);
};

export const electronExportDatabaseBinary = async (): Promise<Uint8Array> =>
  Uint8Array.from(await bridge().export());

export const electronRestoreDatabaseBinary = async (bytes: Uint8Array): Promise<void> => {
  await bridge().restore(Array.from(bytes));
};

export const electronResetDatabaseToProduction = async (): Promise<void> => {
  await bridge().reset();
};

export const electronGetDbInfo = async (): Promise<{ path: string; sizeBytes: number }> =>
  bridge().getInfo();
