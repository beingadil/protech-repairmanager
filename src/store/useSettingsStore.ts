import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SyncSettingsState {
  googleDrivePath: string;
  autoBackupOnClose: boolean;
  lastSyncTime: string | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  syncError: string | null;
  
  // Actions
  setGoogleDrivePath: (path: string) => void;
  setAutoBackupOnClose: (enabled: boolean) => void;
  setSyncStatus: (status: 'idle' | 'syncing' | 'success' | 'error', error?: string | null) => void;
  setLastSyncTime: (time: string) => void;
  resetSyncStatus: () => void;
}

export const useSyncSettingsStore = create<SyncSettingsState>()(
  persist(
    (set) => ({
      googleDrivePath: 'C:\\Users\\Admin\\Google Drive\\ProDataBackups',
      autoBackupOnClose: true,
      lastSyncTime: null,
      syncStatus: 'idle',
      syncError: null,

      setGoogleDrivePath: (path: string) =>
        set({ googleDrivePath: path.trim(), syncError: null }),

      setAutoBackupOnClose: (enabled: boolean) =>
        set({ autoBackupOnClose: enabled }),

      setSyncStatus: (status, error = null) =>
        set({ syncStatus: status, syncError: error }),

      setLastSyncTime: (time: string) =>
        set({ lastSyncTime: time, syncStatus: 'success', syncError: null }),

      resetSyncStatus: () =>
        set({ syncStatus: 'idle', syncError: null })
    }),
    {
      name: 'protech_google_drive_sync_settings',
    }
  )
);

// Backward-compatible alias
export const useSettingsStore = useSyncSettingsStore;
