import type { InvoiceData } from './invoice';
import { buildStandaloneHtml, paperToFormat, PAPER_SPECS } from './print-document';

/**
 * Central renderer-side print service.
 *
 * All print/PDF actions funnel through here:
 *   page → buildInvoiceData → buildStandaloneHtml → IPC → main-process native
 *   webContents.print / printToPDF → Windows printer / saved PDF file.
 *
 * Guarantees:
 *  - SIDE-EFFECT FREE for accounting (reads only; no DB writes anywhere).
 *  - Remembered printer per format in localStorage (app's existing local store).
 *  - Real errors surfaced; never silent failures or stuck "Printing..." UI.
 *  - Browser/dev fallback keeps the old window.print/export path usable.
 */

const PRINTER_KEY = 'print_device_';
const isNative = (): boolean =>
  typeof window !== 'undefined' && Boolean((window as unknown as { prodata?: { print?: unknown } }).prodata?.print);

export function getSavedPrinter(format: 'a4' | 'thermal'): string | undefined {
  try {
    return localStorage.getItem(PRINTER_KEY + format) || undefined;
  } catch {
    return undefined;
  }
}

export function savePrinterPreference(format: 'a4' | 'thermal', name: string): void {
  try {
    localStorage.setItem(PRINTER_KEY + format, name);
  } catch {
    /* storage unavailable — preference simply won't persist */
  }
}

export async function listPrinters(): Promise<
  Array<{ name: string; displayName: string; isDefault: boolean }>
> {
  if (!isNative()) return [];
  try {
    const printers = await window.prodata!.print.getPrinters();
    // Preserve Windows order but push the default to the top.
    return [...printers].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  } catch {
    return [];
  }
}

/** Native print. Throws with a human-readable reason on failure. */
export async function printDocument(data: InvoiceData): Promise<void> {
  const html = buildStandaloneHtml(data);
  const format = paperToFormat(data.paper);
  if (!isNative()) {
    triggerFallbackPrint();
    return;
  }
  await window.prodata!.print.printDocument({
    html,
    format,
    deviceName: getSavedPrinter(data.paper === 'a4' ? 'a4' : 'thermal')
  });
}

/** Native PDF save. Returns saved path, null when the user cancelled. */
export async function saveDocumentPdf(
  data: InvoiceData,
  fileName: string
): Promise<string | null> {
  const html = buildStandaloneHtml(data);
  const format = paperToFormat(data.paper);
  if (!isNative()) {
    const { exportElementToPDF } = await import('./print-utils');
    await exportElementToPDF('printable-content', fileName);
    return null;
  }
  const res = await window.prodata!.print.savePdf({ html, format, fileName });
  if (res.canceled) return null;
  if (!res.ok || !res.filePath) throw new Error(res.error || 'PDF generation failed.');
  return res.filePath;
}

function triggerFallbackPrint(): void {
  window.print();
}

export { PAPER_SPECS };
