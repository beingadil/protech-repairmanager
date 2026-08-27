import { create } from 'zustand';
import { AppSettings } from '../types/settings';
import { query, execute, getNextPTSToken } from '../lib/db';
import {
  InvoiceSettings,
  parseInvoiceSettings,
  serializeInvoiceSettings,
  DEFAULT_INVOICE_SETTINGS
} from '../lib/invoice-settings';

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  loadSettings: () => Promise<AppSettings>;
  updateSetting: (key: keyof AppSettings, value: string) => Promise<void>;
  updateSettingsBatch: (newSettings: Partial<AppSettings>) => Promise<void>;
  setTheme: (theme: 'dark' | 'light') => Promise<void>;
  getNextTokenNumber: () => Promise<string>;
  getInvoiceSettings: () => InvoiceSettings;
  updateInvoiceSettings: (config: InvoiceSettings) => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  shop_name: 'ProTech Services',
  shop_slogan: 'Professional Laptop & Desktop Hardware Repair Center',
  shop_address: 'Jamil Ahmad Computer Market, Munir Chowk, Gujranwala / Flat 1, Sadiq Plaza, Lahore',
  shop_mobile: '0300-0404004',
  shop_whatsapp: '0300-0404004',
  shop_email: 'support@protechservices.pk',
  logo_path: '',
  theme: 'dark',
  thermal_size: '80',
  default_charges: '1500',
  currency_symbol: 'PKR',
  receipt_header_msg: 'Thank you for choosing ProTech Services for your hardware repairs.',
  receipt_footer_msg: 'Warranty claims must be accompanied by this receipt. No returns after 30 days.',
  receipt_terms: '1. Repaired equipment must be collected within 30 days of completion.\n2. We are not responsible for any software or data loss during hardware repair.\n3. Warranty void if warranty seal or sticker is broken or tampered with.',
  show_qr_on_receipt: '1',
  show_logo_on_receipt: '1',
  invoice_settings: '',
  default_warranty_days: '30',
  default_turnaround_days: '2',
  token_prefix: 'PTS',
  twilio_sid: '',
  twilio_token: '',
  twilio_from: '',
  auto_backup: '1',
  token_counter: '1'
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
    return await getNextPTSToken();
  },

  getInvoiceSettings: () => {
    const raw = get().settings.invoice_settings;
    return raw ? parseInvoiceSettings(raw) : { ...JSON.parse(JSON.stringify(DEFAULT_INVOICE_SETTINGS)) };
  },

  updateInvoiceSettings: async (config) => {
    const serialized = serializeInvoiceSettings(config);
    set((state) => ({
      settings: { ...state.settings, invoice_settings: serialized }
    }));
    try {
      await execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
        'invoice_settings',
        serialized
      ]);
    } catch (err) {
      console.error('Failed to save invoice settings:', err);
    }
  }
}));
