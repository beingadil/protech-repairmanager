import { app, dialog, ipcMain } from 'electron';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { checkForUpdates, quitAndInstall, canCheckForUpdates } from './updater';
import { query as dbQuery, execute as dbExecute, exportBinary, importBinary, resetToProduction, getDbPath } from './database';

export function registerIpcHandlers(): void {
  // Native SQLite bridge — renderer never touches the file directly.
  ipcMain.handle('db:query', (_e, sql: unknown, params?: unknown) => {
    if (typeof sql !== 'string' || !sql.trim()) throw new Error('Invalid SQL.');
    const args = Array.isArray(params) ? params : [];
    return dbQuery(sql, args);
  });

  ipcMain.handle('db:execute', (_e, sql: unknown, params?: unknown) => {
    if (typeof sql !== 'string' || !sql.trim()) throw new Error('Invalid SQL.');
    const args = Array.isArray(params) ? params : [];
    dbExecute(sql, args);
    return { ok: true };
  });

  ipcMain.handle('db:export-binary', () => exportBinary());

  ipcMain.handle('db:import-binary', (_e, bytes: unknown) => {
    const buf = toBuffer(bytes);
    if (!buf || buf.length === 0) throw new Error('Invalid database payload.');
    importBinary(buf);
    return { ok: true };
  });

  ipcMain.handle('db:reset-production', () => {
    resetToProduction();
    return { ok: true };
  });

  ipcMain.handle('db:get-path', () => getDbPath());

  ipcMain.handle('drive:choose-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Select Google Drive Backup Folder',
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

  ipcMain.handle('app:getUserDataPath', () => app.getPath('userData'));  ipcMain.handle('update:check', async (_e, manual: unknown) => {
    if (!canCheckForUpdates()) {
      return { ok: false, error: 'Auto-update is only available in the packaged app.' };
    }
    return checkForUpdates(manual === true);
  });

  ipcMain.handle('update:install', () => {
    quitAndInstall();
  });

  ipcMain.handle('update:canCheck', () => canCheckForUpdates());
}

// Accepts number[] (legacy JSON transport) or Uint8Array (structured clone).
function toBuffer(bytes: unknown): Buffer | null {
  if (bytes instanceof Uint8Array) return Buffer.from(bytes);
  if (Array.isArray(bytes)) {
    if (!bytes.every((b) => typeof b === 'number' && b >= 0 && b <= 255)) return null;
    return Buffer.from(bytes as number[]);
  }
  return null;
}