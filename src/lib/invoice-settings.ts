/**
 * Invoice / receipt customization settings.
 *
 * Users can toggle which sections appear on printed/PDF documents, with
 * independent defaults per paper size (58mm / 80mm / A4). The configuration is
 * stored as a single JSON string in the `settings` table under `invoice_settings`,
 * and is applied at render time (src/features/print/InvoiceDocument.tsx) without
 * changing any business/financial data.
 */

export type PaperKey = 'a4' | '80' | '58';

export interface InvoiceSectionToggles {
  // Business info
  logo: boolean;
  name: boolean;
  tagline: boolean;
  address: boolean;
  phone: boolean;
  // Invoice details
  token: boolean;
  date: boolean;
  // Customer
  customerName: boolean;
  customerPhone: boolean;
  customerAddress: boolean;
  // Repair details
  device: boolean;
  model: boolean;
  serial: boolean;
  specs: boolean; // RAM / storage / processor
  receiveDate: boolean;
  returnDate: boolean;
  symptoms: boolean;
  charger: boolean;
  estimatedCharges: boolean; // repair-ticket banner
  // Payment summary
  chargesLine: boolean;
  discount: boolean;
  netAmount: boolean;
  paid: boolean;
  balance: boolean;
  paymentMethod: boolean;
  paymentDate: boolean;
  // Footer
  terms: boolean;
  thankYou: boolean;
  qr: boolean;
}

export interface InvoicePreset {
  id: string;
  label: string;
  description: string;
  base: InvoiceSectionToggles;
  overrides: Record<PaperKey, Partial<InvoiceSectionToggles>>;
}

export interface InvoiceSettings {
  version: number;
  /** Global base toggles. */
  base: InvoiceSectionToggles;
  /** Per-paper overrides merged over `base`. */
  sizeOverrides: Record<PaperKey, Partial<InvoiceSectionToggles>>;
}

export const DEFAULT_SECTIONS: InvoiceSectionToggles = {
  logo: true,
  name: true,
  tagline: true,
  address: true,
  phone: true,
  token: true,
  date: true,
  customerName: true,
  customerPhone: true,
  customerAddress: true,
  device: true,
  model: true,
  serial: true,
  specs: true,
  receiveDate: true,
  returnDate: true,
  symptoms: true,
  charger: true,
  estimatedCharges: true,
  chargesLine: true,
  discount: true,
  netAmount: true,
  paid: true,
  balance: true,
  paymentMethod: true,
  paymentDate: true,
  terms: true,
  thankYou: true,
  qr: true
};

/** 58mm conveys only essentials so it fits the narrow media. */
const THERMAL_58_MINIMAL: Partial<InvoiceSectionToggles> = {
  logo: false,
  tagline: false,
  address: false,
  customerAddress: false,
  specs: false,
  receiveDate: false,
  returnDate: false,
  symptoms: false,
  charger: false,
  estimatedCharges: false,
  paymentDate: false,
  terms: false,
  qr: false
};

/** 80mm shows standard info, dropping only the least-used optional rows too. */
const THERMAL_80_DEFAULT: Partial<InvoiceSectionToggles> = {
  logo: true,
  tagline: false,
  address: true,
  customerAddress: false,
  specs: true,
  receiveDate: false,
  returnDate: false,
  symptoms: true,
  charger: false,
  estimatedCharges: true,
  qr: false
};

export const DEFAULT_SIZE_OVERRIDES: Record<PaperKey, Partial<InvoiceSectionToggles>> = {
  '58': { ...THERMAL_58_MINIMAL },
  '80': { ...THERMAL_80_DEFAULT },
  a4: {}
};

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  version: 1,
  base: { ...DEFAULT_SECTIONS },
  sizeOverrides: {
    '58': { ...DEFAULT_SIZE_OVERRIDES['58'] },
    '80': { ...DEFAULT_SIZE_OVERRIDES['80'] },
    a4: {}
  }
};

export const PRESETS: InvoicePreset[] = [
  {
    id: 'full',
    label: 'Full Invoice',
    description: 'Every section enabled on all sizes (best for A4 and 80mm).',
    base: { ...DEFAULT_SECTIONS },
    overrides: { a4: {}, '80': {}, '58': { ...THERMAL_58_MINIMAL } }
  },
  {
    id: 'quick',
    label: 'Quick Receipt',
    description: 'Minimal essentials for fast thermal printing.',
    base: {
      logo: false,
      name: true,
      tagline: false,
      address: false,
      phone: true,
      token: true,
      date: true,
      customerName: true,
      customerPhone: true,
      customerAddress: false,
      device: true,
      model: true,
      serial: false,
      specs: false,
      receiveDate: false,
      returnDate: false,
      symptoms: false,
      charger: false,
      estimatedCharges: false,
      chargesLine: true,
      discount: true,
      netAmount: true,
      paid: true,
      balance: true,
      paymentMethod: true,
      paymentDate: false,
      terms: false,
      thankYou: true,
      qr: false
    },
    overrides: { a4: {}, '80': {}, '58': {} }
  }
];

/** Merge `base` + the paper override into a single effective section set. */
export function getEffectiveSections(
  settings: InvoiceSettings,
  paper: PaperKey
): InvoiceSectionToggles {
  return { ...settings.base, ...settings.sizeOverrides[paper] };
}

const STORAGE_KEY = 'invoice_settings';

export function parseInvoiceSettings(raw: string | undefined | null): InvoiceSettings {
  if (!raw) return { ...clone(DEFAULT_INVOICE_SETTINGS) };
  try {
    const parsed = JSON.parse(raw) as Partial<InvoiceSettings>;
    return normalizeInvoiceSettings(parsed);
  } catch {
    return { ...clone(DEFAULT_INVOICE_SETTINGS) };
  }
}

function normalizeInvoiceSettings(p: Partial<InvoiceSettings>): InvoiceSettings {
  const base = { ...DEFAULT_SECTIONS, ...(p.base || {}) };
  const sizeOverrides: Record<PaperKey, Partial<InvoiceSectionToggles>> = {
    '58': { ...(p.sizeOverrides?.['58'] || {}) },
    '80': { ...(p.sizeOverrides?.['80'] || {}) },
    a4: { ...(p.sizeOverrides?.a4 || {}) }
  };
  return { version: p.version || 1, base, sizeOverrides };
}

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export function serializeInvoiceSettings(settings: InvoiceSettings): string {
  return JSON.stringify(settings);
}

/** Deep-copy helper for local editing drafts. */
export function cloneInvoiceSettings(settings: InvoiceSettings): InvoiceSettings {
  return JSON.parse(JSON.stringify(settings)) as InvoiceSettings;
}
