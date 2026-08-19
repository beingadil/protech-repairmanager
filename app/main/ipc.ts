import { app, dialog, ipcMain } from 'electron';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { checkForUpdates, quitAndInstall, canCheckForUpdates } from './updater';
import { getSqlWasmBytes } from './sqlwasm';

export function registerIpcHandlers(): void {
  // sql.js WASM binary lives inside the packaged renderer bundle; fetch() is
  // blocked on file:// so we ship the bytes over IPC instead.
  ipcMain.handle('bridge:get-sql-wasm', () => {
    const bytes = getSqlWasmBytes();
    return bytes ? Array.from(bytes) : null;
  });

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

  ipcMain.handle('app:getUserDataPath', () => app.getPath('userData'));

  ipcMain.handle('update:check', async (_e, manual: unknown) => {
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