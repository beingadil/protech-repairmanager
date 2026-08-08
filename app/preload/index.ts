import { contextBridge, ipcRenderer } from 'electron';

const api = {
  db: {
    query: (sql: string, params: unknown[] = []) => ipcRenderer.invoke('db:query', { sql, params }),
    execute: (sql: string, params: unknown[] = []) =>
      ipcRenderer.invoke('db:execute', { sql, params }),
    executeRaw: (sql: string) => ipcRenderer.invoke('db:executeRaw', { sql }),
    export: () => ipcRenderer.invoke('db:export'),
    restore: (bytes: number[]) => ipcRenderer.invoke('db:restore', bytes),
    reset: () => ipcRenderer.invoke('db:reset'),
    getInfo: () => ipcRenderer.invoke('db:getInfo')
  },
  backup: {
    save: () => ipcRenderer.invoke('backup:save'),
    restore: () => ipcRenderer.invoke('backup:restore')
  },
  drive: {
    syncToFolder: (bytes: number[], folder: string) =>
      ipcRenderer.invoke('drive:sync', { bytes, folder }),
    chooseFolder: () => ipcRenderer.invoke('drive:choose-folder')
  },
  app: {
    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath')
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
