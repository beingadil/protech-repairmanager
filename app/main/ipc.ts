import { app, dialog, ipcMain } from 'electron';
import { join, isAbsolute } from 'node:path';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import {
  query,
  execute,
  executeRaw,
  exportDatabaseBytes,
  restoreDatabase,
  resetDatabase,
  getDbInfo,
  MAX_BACKUP_BYTES
} from './db';

function assertSqlPayload(payload: unknown): { sql: string; params: unknown[] } {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid IPC payload.');
  const { sql, params } = payload as { sql?: unknown; params?: unknown };
  if (typeof sql !== 'string') throw new Error('SQL must be a string.');
  if (params !== undefined && !Array.isArray(params)) throw new Error('Params must be an array.');
  return { sql, params: (params as unknown[]) ?? [] };
}

export function registerIpcHandlers(): void {
  ipcMain.handle('db:query', (_e, payload) => {
    const { sql, params } = assertSqlPayload(payload);
    return query(sql, params);
  });

  ipcMain.handle('db:execute', (_e, payload) => {
    const { sql, params } = assertSqlPayload(payload);
    execute(sql, params);
  });

  ipcMain.handle('db:executeRaw', (_e, payload) => {
    const { sql } = assertSqlPayload(payload);
    executeRaw(sql);
  });

  ipcMain.handle('db:export', () => Array.from(exportDatabaseBytes()));

  ipcMain.handle('db:restore', (_e, bytes: unknown) => {
    if (!Array.isArray(bytes) || bytes.length === 0) throw new Error('Empty restore payload.');
    if (bytes.length > MAX_BACKUP_BYTES) throw new Error('Restore file is too large.');
    restoreDatabase(Uint8Array.from(bytes as number[]));
  });

  ipcMain.handle('db:reset', () => {
    resetDatabase();
  });

  ipcMain.handle('db:getInfo', () => getDbInfo());

  ipcMain.handle('backup:save', async (_e) => {
    const bytes = exportDatabaseBytes();
    const defaultName = `ProData_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Database Backup',
      defaultPath: defaultName,
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
    });
    if (canceled || !filePath) return { canceled: true };
    writeFileSync(filePath, bytes);
    return { canceled: false, filePath, sizeBytes: bytes.length };
  });

  ipcMain.handle('backup:restore', async (_e) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Restore Database Backup',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
    });
    if (canceled || filePaths.length === 0) return { canceled: true };
    const filePath = filePaths[0];
    const bytes = readFileSync(filePath);
    restoreDatabase(new Uint8Array(bytes));
    return { canceled: false, filePath };
  });

  ipcMain.handle('drive:choose-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Backup Folder',
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  ipcMain.handle('drive:sync', (_e, payload: unknown) => {
    const { bytes, folder } = (payload ?? {}) as { bytes?: unknown; folder?: unknown };
    if (!Array.isArray(bytes) || typeof folder !== 'string' || !folder.trim()) {
      throw new Error('Invalid sync payload.');
    }
    if (!isAbsolute(folder)) throw new Error('Backup folder must be an absolute path.');

    const dir = folder.trim();
    mkdirSync(dir, { recursive: true });
    const target = join(dir, 'ProDataRepairManager.db');
    writeFileSync(target, Buffer.from(bytes as number[]));
    return { success: true, filePath: target, bytesWritten: (bytes as number[]).length };
  });

  ipcMain.handle('app:getUserDataPath', () => app.getPath('userData'));
}
