import { BrowserWindow, dialog, ipcMain } from 'electron';
import { writeFile } from 'node:fs/promises';

/**
 * Native Windows printing engine (main process).
 *
 * The RENDERER prepares a fully self-contained document HTML string
 * (src/lib/print-document.ts). This module is presentation-agnostic: it loads
 * the document into a hidden window, measures thermal height, then either
 * prints to the selected Windows printer or writes a vector PDF chosen via the
 * native save dialog.
 *
 * Printing is SIDE-EFFECT FREE with respect to accounting: no DB access here.
 */

export type NativePaperFormat = 'a4' | 'thermal80' | 'thermal58';

export interface PrintDocumentPayload {
  html: unknown;
  format: unknown;
  deviceName?: unknown;
}

const FORMATS: NativePaperFormat[] = ['a4', 'thermal80', 'thermal58'];

function validatePayload(payload: unknown): { html: string; format: NativePaperFormat; deviceName?: string } {
  const p = (payload ?? {}) as PrintDocumentPayload;
  if (typeof p.html !== 'string' || p.html.length < 20 || p.html.length > 2_000_000) {
    throw new Error('Invalid document payload.');
  }
  if (typeof p.format !== 'string' || !FORMATS.includes(p.format as NativePaperFormat)) {
    throw new Error('Unknown paper format.');
  }
  const deviceName =
    typeof p.deviceName === 'string' && p.deviceName.trim() ? p.deviceName.trim() : undefined;
  return { html: p.html, format: p.format as NativePaperFormat, deviceName };
}

async function loadDocument(html: string): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      // Offscreen document is plain content; keep the same hardened defaults.
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  await win.loadURL(
    'data:text/html;charset=utf-8,' + encodeURIComponent(html)
  );
  return win;
}

/** px -> microns at the standard 96 CSS px/inch. */
function pxToMicrons(px: number): number {
  return Math.round((px / 96) * 25_400);
}

/**
 * Force the offscreen document to fully commit and lay out before printing.
 *
 * WITHOUT this, printToPDF can be called while Chromium is still committing the
 * data: document, which reliably throws "Printing failed" — especially for A4
 * (thermal formats happen to force a render round-trip via height measurement,
 * A4 did not). We round-trip through the page and give it one frame + a small
 * settle so fonts/images/layout are ready.
 */
async function waitForRendered(win: BrowserWindow): Promise<void> {
  try {
    await win.webContents.executeJavaScript(
      `new Promise((resolve) => {
         if (document.readyState === 'complete') {
           requestAnimationFrame(() => resolve(true));
         } else {
           window.addEventListener('load', () => requestAnimationFrame(() => resolve(true)), { once: true });
         }
       })`,
      true
    );
    await new Promise((r) => setTimeout(r, 60)); // settle fonts/images
  } catch {
    /* best-effort — printing below may still succeed */
  }
}

async function measureThermalHeight(win: BrowserWindow): Promise<number | null> {
  try {
    const height = await win.webContents.executeJavaScript(
      `Math.ceil(document.querySelector('.doc-root')?.scrollHeight ?? 0)`,
      false
    );
    if (typeof height === 'number' && height > 40) return pxToMicrons(height + 8); // small cut buffer
    return null;
  } catch {
    return null;
  }
}

export function registerPrintHandlers(): void {
  // Enumerate installed Windows printers so the UI can offer real names only.
  ipcMain.handle('print:get-printers', async () => {
    const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ?? null;
    if (!win) throw new Error('No application window available.');
    const printers = await win.webContents.getPrintersAsync();
    // Electron's PrinterInfo typing omits some fields present at runtime.
    return printers.map((p) => {
      const info = p as unknown as Record<string, unknown>;
      return {
        name: p.name,
        displayName: (info.displayName as string) || p.name,
        isDefault: info.isDefault === true,
        status: typeof info.status === 'number' ? info.status : 0
      };
    });
  });

  ipcMain.handle('print:document', async (_e, payload: unknown) => {
    const { html, format, deviceName } = validatePayload(payload);
    let win: BrowserWindow | null = null;
    try {
      win = await loadDocument(html);
      await waitForRendered(win);

      let pageSize: 'A4' | { width: number; height: number } = 'A4';
      if (format !== 'a4') {
        const measured = await measureThermalHeight(win);
        const widthMicrons = format === 'thermal80' ? 80_000 : 58_000;
        pageSize = {
          width: widthMicrons,
          height: Math.max(measured ?? 60_000, 25_000)
        };
      }

      await new Promise<void>((resolve, reject) => {
        win!.webContents.print(
          {
            silent: Boolean(deviceName), // direct to printer when one is configured
            deviceName,
            printBackground: true,
            margins: { marginType: 'none' },
            pageSize
          },
          (success, failureReason) => {
            if (success) resolve();
            else reject(new Error(failureReason || 'Print job failed.'));
          }
        );
      });
      return { ok: true };
    } finally {
      win?.destroy();
    }
  });

  ipcMain.handle('print:save-pdf', async (_e, payload: unknown) => {
    const { html, format } = validatePayload(payload);
    const suggested = typeof (payload as { fileName?: unknown })?.fileName === 'string'
      ? (payload as { fileName: string }).fileName
      : 'ProTech-Document.pdf';
    let win: BrowserWindow | null = null;
    try {
      const parent = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ?? undefined;
      const { canceled, filePath } = await dialog.showSaveDialog(parent!, {
        title: 'Save Document as PDF',
        defaultPath: suggested.endsWith('.pdf') ? suggested : `${suggested}.pdf`,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
      });
      if (canceled || !filePath) return { ok: false, canceled: true };

      win = await loadDocument(html);
      await waitForRendered(win);

      let pageSize: 'A4' | { width: number; height: number } = 'A4';
      if (format !== 'a4') {
        const measured = await measureThermalHeight(win);
        const widthMicrons = format === 'thermal80' ? 80_000 : 58_000;
        pageSize = {
          width: widthMicrons,
          height: Math.max(measured ?? 60_000, 25_000)
        };
      }

      let bytes: Buffer;
      try {
        bytes = await win.webContents.printToPDF({
          printBackground: true,
          margins: { marginType: 'none' },
          pageSize
        });
      } catch (firstErr) {
        // Some Windows/Electron builds reject a custom {width,height} pageSize
        // or need the CSS @page to drive sizing. Retry with the document's own
        // @page rule, then fall back to a plain A4 page so we always produce a
        // usable PDF instead of failing with "Printing failed".
        try {
          bytes = await win.webContents.printToPDF({
            printBackground: true,
            preferCSSPageSize: true,
            margins: { marginType: 'none' }
          });
        } catch {
          bytes = await win.webContents.printToPDF({
            printBackground: true,
            margins: { marginType: 'none' },
            pageSize: 'A4'
          });
        }
      }
      await writeFile(filePath, bytes);
      return { ok: true, filePath };
    } finally {
      win?.destroy();
    }
  });
}
