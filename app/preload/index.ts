import { contextBridge, ipcRenderer } from 'electron';

const api = {
  db: {
    query: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:query', sql, params ?? []),
    execute: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:execute', sql, params ?? []),
    batch: (ops: Array<{ sql: string; params?: unknown[] }>) => ipcRenderer.invoke('db:batch', ops),
    exportBinary: () => ipcRenderer.invoke('db:export-binary'),
    importBinary: (bytes: Uint8Array | number[]) => ipcRenderer.invoke('db:import-binary', Array.from(bytes)),
    resetProduction: () => ipcRenderer.invoke('db:reset-production'),
    getPath: () => ipcRenderer.invoke('db:get-path')
  },
  app: {
    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath')
  },
  drive: {
    syncToFolder: (bytes: number[], folder: string) =>
      ipcRenderer.invoke('drive:sync', { bytes, folder }),
    chooseFolder: () => ipcRenderer.invoke('drive:choose-folder')
  },
  print: {
    getPrinters: () => ipcRenderer.invoke('print:get-printers'),
    /** Native print to a Windows printer (deviceName optional = OS dialog). */
    printDocument: (payload: { html: string; format: string; deviceName?: string }) =>
      ipcRenderer.invoke('print:document', payload),
    /** Native save dialog + vector PDF. Returns { ok, canceled?, filePath? }. */
    savePdf: (payload: { html: string; format: string; fileName?: string }) =>
      ipcRenderer.invoke('print:save-pdf', payload)
  },
  updater: {
    check: (manual = false) => ipcRenderer.invoke('update:check', manual),
    install: () => ipcRenderer.invoke('update:install'),
    canCheck: () => ipcRenderer.invoke('update:canCheck'),
    onEvent: (cb: (e: unknown) => void) => {
      const listener = (_e: unknown, payload: unknown) => cb(payload);
      ipcRenderer.on('update:event', listener);
      return () => ipcRenderer.removeListener('update:event', listener);
    }
  }
};

contextBridge.exposeInMainWorld('prodata', api);