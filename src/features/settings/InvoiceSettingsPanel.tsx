import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RotateCcw, Save, Sparkles } from 'lucide-react';
import { useSettingsStore } from '../../store/settings';
import {
  InvoiceSectionToggles,
  InvoiceSettings,
  PaperKey,
  PRESETS,
  DEFAULT_INVOICE_SETTINGS,
  getEffectiveSections,
  cloneInvoiceSettings
} from '../../lib/invoice-settings';
import { Button } from '../../components/ui/Button';
import { Toggle } from '../../components/ui/Toggle';

const SIZE_TABS: { id: PaperKey; label: string; hint: string }[] = [
  { id: '58', label: '58mm', hint: 'Narrow thermal - essentials only' },
  { id: '80', label: '80mm', hint: 'Standard thermal receipt' },
  { id: 'a4', label: 'A4', hint: 'Full document' }
];

const GROUPS: {
  title: string;
  fields: { key: keyof InvoiceSectionToggles; label: string }[];
}[] = [
  { title: 'Business Information', fields: [
    { key: 'logo', label: 'Business Logo' },
    { key: 'name', label: 'Business Name' },
    { key: 'tagline', label: 'Tagline / Slogan' },
    { key: 'address', label: 'Business Address' },
    { key: 'phone', label: 'Phone / WhatsApp' }
  ]},
  { title: 'Invoice Details', fields: [
    { key: 'token', label: 'Token / Receipt Number' },
    { key: 'date', label: 'Issue Date' }
  ]},
  { title: 'Customer Information', fields: [
    { key: 'customerName', label: 'Customer Name' },
    { key: 'customerPhone', label: 'Customer Phone' },
    { key: 'customerAddress', label: 'Customer Address' }
  ]},
  { title: 'Repair Job Details', fields: [
    { key: 'device', label: 'Device Type' },
    { key: 'model', label: 'Model' },
    { key: 'serial', label: 'Serial Number' },
    { key: 'specs', label: 'Specs (RAM / Storage / CPU)' },
    { key: 'receiveDate', label: 'Receive Date' },
    { key: 'returnDate', label: 'Expected Return Date' },
    { key: 'symptoms', label: 'Reported Symptoms' },
    { key: 'charger', label: 'Charger Included' },
    { key: 'estimatedCharges', label: 'Estimated Charges Banner' }
  ]},
  { title: 'Payment Summary', fields: [
    { key: 'chargesLine', label: 'Repair Charges' },
    { key: 'discount', label: 'Discount' },
    { key: 'netAmount', label: 'Net Amount' },
    { key: 'paid', label: 'Amount Paid' },
    { key: 'balance', label: 'Balance Due' },
    { key: 'paymentMethod', label: 'Payment Method' },
    { key: 'paymentDate', label: 'Payment Date' }
  ]},
  { title: 'Footer', fields: [
    { key: 'terms', label: 'Terms & Conditions' },
    { key: 'thankYou', label: 'Thank-you Message' },
    { key: 'qr', label: 'QR Code' }
  ]}
];

export const InvoiceSettingsPanel: React.FC = () => {
  const { getInvoiceSettings, updateInvoiceSettings } = useSettingsStore();
  const [paper, setPaper] = useState<PaperKey>('80');
  const [draft, setDraft] = useState<InvoiceSettings>(() => cloneInvoiceSettings(getInvoiceSettings()));
  const [saving, setSaving] = useState(false);

  const effective = useMemo(() => getEffectiveSections(draft, paper), [draft, paper]);
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(getInvoiceSettings()),
    [draft]
  );

  const setSizeOverride = (key: keyof InvoiceSectionToggles, value: boolean) => {
    setDraft((prev) => ({
      ...prev,
      sizeOverrides: { ...prev.sizeOverrides, [paper]: { ...prev.sizeOverrides[paper], [key]: value } }
    }));
  };

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDraft({
      version: draft.version,
      base: { ...preset.base },
      sizeOverrides: JSON.parse(JSON.stringify(preset.overrides))
    });
    toast.success(`Preset applied - press Save to persist.`);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateInvoiceSettings(draft);
      toast.success('Invoice print settings saved.');
    } catch {
      toast.error('Could not save invoice settings.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setDraft(cloneInvoiceSettings(DEFAULT_INVOICE_SETTINGS));
    toast.info('Reset to defaults - press Save to apply.');
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Choose what appears on printed receipts and PDFs. Each paper size has its own overrides.
      </p>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {SIZE_TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setPaper(t.id)}
            className={`flex flex-col shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${paper === t.id ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}>
            <span>{t.label}</span>
            <span className="text-[10px] font-medium normal-case opacity-70">{t.hint}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        {PRESETS.map((p) => (
          <Button key={p.id} variant="secondary" size="sm" onClick={() => applyPreset(p.id)}>{p.label}</Button>
        ))}
        <span className={`text-[11px] ${dirty ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {GROUPS.map((group) => (
          <div key={group.title} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2.5">{group.title}</h4>
            <div className="space-y-0.5">
              {group.fields.map((field) => (
                <Toggle key={String(field.key)} label={field.label} checked={effective[field.key]} onChange={(v) => setSizeOverride(field.key, v)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={save} disabled={saving || !dirty}><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Settings'}</Button>
        <Button variant="ghost" onClick={reset}><RotateCcw className="w-4 h-4" />Reset to Defaults</Button>
      </div>
    </div>
  );
};

export default InvoiceSettingsPanel;
