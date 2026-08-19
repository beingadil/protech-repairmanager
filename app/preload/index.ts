import { contextBridge, ipcRenderer } from 'electron';

const api = {
  sqlWasm: {
    get: () => ipcRenderer.invoke('bridge:get-sql-wasm')
  },
  app: {
    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath')
  },
  drive: {
    syncToFolder: (bytes: number[], folder: string) =>
      ipcRenderer.invoke('drive:sync', { bytes, folder }),
    chooseFolder: () => ipcRenderer.invoke('drive:choose-folder')
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