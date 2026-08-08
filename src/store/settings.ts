import { create } from 'zustand';
import { AppSettings } from '../types/settings';
import { query, execute } from '../lib/db';

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  loadSettings: () => Promise<AppSettings>;
  updateSetting: (key: keyof AppSettings, value: string) => Promise<void>;
  updateSettingsBatch: (newSettings: Partial<AppSettings>) => Promise<void>;
  setTheme: (theme: 'dark' | 'light') => Promise<void>;
  getNextTokenNumber: () => Promise<string>;
}

const DEFAULT_SETTINGS: AppSettings = {
  shop_name: 'ProTech Services',
  shop_address: 'Jamil Ahmad Computer Market, Munir Chowk, Gujranwala / Flat 1, Sadiq Plaza, Lahore',
  shop_mobile: '0300-0404004',
  logo_path: '',
  theme: 'dark',
  thermal_size: '80',
  default_charges: '1500',
  auto_backup: '1',
  token_counter: '1000'
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: true,

  loadSettings: async () => {
    try {
      const rows = await query<{ key: string; value: string }>('SELECT key, value FROM settings');
      const loaded = { ...DEFAULT_SETTINGS };

      for (const row of rows) {
        if (row.key in loaded) {
          (loaded as any)[row.key] = row.value;
        }
      }

      set({ settings: loaded, isLoading: false });

      // Apply theme class to document html element
      const isDark = loaded.theme === 'dark';
      document.documentElement.classList.toggle('dark', isDark);

      return loaded;
    } catch (err) {
      console.error('Failed to load settings from DB:', err);
      set({ isLoading: false });
      return DEFAULT_SETTINGS;
    }
  },

  updateSetting: async (key, value) => {
    // Optimistic state and DOM update
    if (key === 'theme') {
      document.documentElement.classList.toggle('dark', value === 'dark');
    }
    set((state) => ({
      settings: { ...state.settings, [key]: value }
    }));

    try {
      await execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    } catch (err) {
      console.error(`Failed to update setting ${key}:`, err);
    }
  },

  updateSettingsBatch: async (newSettings) => {
    try {
      for (const [key, value] of Object.entries(newSettings)) {
        if (value !== undefined) {
          await execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
        }
      }
      const state = get();
      const updated = { ...state.settings, ...newSettings };
      if (newSettings.theme) {
        document.documentElement.classList.toggle('dark', newSettings.theme === 'dark');
      }
      set({ settings: updated });
    } catch (err) {
      console.error('Failed to update settings batch:', err);
    }
  },

  setTheme: async (theme) => {
    await get().updateSetting('theme', theme);
  },

  getNextTokenNumber: async () => {
    const state = get();
    const currentCounter = parseInt(state.settings.token_counter || '1000', 10);
    const tokenStr = `TK-${currentCounter.toString().padStart(4, '0')}`;
    
    // Increment counter for next job
    const nextCounter = (currentCounter + 1).toString();
    await get().updateSetting('token_counter', nextCounter);

    return tokenStr;
  }
}));
