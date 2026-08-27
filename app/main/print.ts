import { BrowserWindow, dialog, ipcMain } from "electron";
import { writeFile } from "node:fs/promises";

export type NativePaperFormat = "a4" | "thermal80" | "thermal58";

export interface PrintDocumentPayload {
  html: unknown;
  format: unknown;
  deviceName?: unknown;
}

const FORMATS: NativePaperFormat[] = ["a4", "thermal80", "thermal58"];

const PRINTABLE_WIDTH_MM: Record<"thermal80" | "thermal58", number> = {
  thermal80: 72,
  thermal58: 54
};

function validatePayload(payload: unknown): { html: string; format: NativePaperFormat; deviceName?: string } {
  const p = (payload ?? {}) as PrintDocumentPayload;
  if (typeof p.html !== "string" || p.html.length < 20 || p.html.length > 2_000_000) {
    throw new Error("Invalid document payload.");
  }
  if (typeof p.format !== "string" || !FORMATS.includes(p.format as NativePaperFormat)) {
    throw new Error("Unknown paper format.");
  }
  const deviceName = typeof p.deviceName === "string" && p.deviceName.trim() ? p.deviceName.trim() : undefined;
  return { html: p.html, format: p.format as NativePaperFormat, deviceName };
}

function mmToPx(mm: number): number {
  return Math.round((mm / 25.4) * 96);
}
function pxToMicrons(px: number): number {
  return Math.round((px / 96) * 25_400);
}

async function loadDocument(html: string, widthMm?: number): Promise<BrowserWindow> {
  const widthPx = widthMm ? mmToPx(widthMm) : 1000;
  const win = new BrowserWindow({
    show: false,
    width: Math.max(320, widthPx + 40),
    height: 900,
    useContentSize: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  return win;
}

async function waitForRendered(win: BrowserWindow): Promise<void> {
  try {
    await win.webContents.executeJavaScript(
      `new Promise((resolve) => {
         if (document.readyState === "complete") {
           requestAnimationFrame(() => resolve(true));
         } else {
           window.addEventListener("load", () => requestAnimationFrame(() => resolve(true)), { once: true });
         }
       })`,
      true
    );
    await new Promise((r) => setTimeout(r, 80));
  } catch {}
}

async function measureThermalHeight(win: BrowserWindow): Promise<number | null> {
  try {
    const height = await win.webContents.executeJavaScript(
      `Math.ceil(document.querySelector(".doc-root")?.scrollHeight ?? 0)`,
      false
    );
    if (typeof height === "number" && height > 40) return pxToMicrons(height + 10);
    return null;
  } catch {
    return null;
  }
}

async function thermalPageSize(
  win: BrowserWindow,
  format: "thermal80" | "thermal58"
): Promise<{ width: number; height: number }> {
  const widthMicrons = format === "thermal80" ? 80_000 : 58_000;
  const measured = await measureThermalHeight(win);
  const height = Math.max(measured ?? 220_000, 25_000);
  return { width: widthMicrons, height };
}

export function registerPrintHandlers(): void {
  ipcMain.handle("print:get-printers", async () => {
    const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ?? null;
    if (!win) throw new Error("No application window available.");
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((p) => {
      const info = p as unknown as Record<string, unknown>;
      return {
        name: p.name,
        displayName: (info.displayName as string) || p.name,
        isDefault: info.isDefault === true,
        status: typeof info.status === "number" ? info.status : 0
      };
    });
  });

  ipcMain.handle("print:document", async (_e, payload: unknown) => {
    const { html, format, deviceName } = validatePayload(payload);
    let win: BrowserWindow | null = null;
    try {
      const widthMm = format === "a4" ? undefined : PRINTABLE_WIDTH_MM[format];
      win = await loadDocument(html, widthMm);
      await waitForRendered(win);
      let pageSize: "A4" | { width: number; height: number } = "A4";
      if (format !== "a4") {
        pageSize = await thermalPageSize(win, format);
      }
      await new Promise<void>((resolve, reject) => {
        win!.webContents.print(
          {
            silent: Boolean(deviceName),
            deviceName,
            printBackground: true,
            margins: { marginType: "none" },
            pageSize
          },
          (success, failureReason) => {
            if (success) resolve();
            else reject(new Error(failureReason || "Print job failed."));
          }
        );
      });
      return { ok: true };
    } finally {
      win?.destroy();
    }
  });

  ipcMain.handle("print:save-pdf", async (_e, payload: unknown) => {
    const { html, format } = validatePayload(payload);
    const suggested = typeof (payload as { fileName?: unknown })?.fileName === "string"
      ? (payload as { fileName: string }).fileName
      : "ProTech-Document.pdf";
    let win: BrowserWindow | null = null;
    try {
      const parent = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ?? undefined;
      const { canceled, filePath } = await dialog.showSaveDialog(parent!, {
        title: "Save Document as PDF",
        defaultPath: suggested.endsWith(".pdf") ? suggested : `${suggested}.pdf`,
        filters: [{ name: "PDF Document", extensions: ["pdf"] }]
      });
      if (canceled || !filePath) return { ok: false, canceled: true };

      const widthMm = format === "a4" ? undefined : PRINTABLE_WIDTH_MM[format];
      win = await loadDocument(html, widthMm);
      await waitForRendered(win);

      let bytes: Buffer;
      try {
        if (format === "a4") {
          bytes = await win.webContents.printToPDF({
            printBackground: true,
            margins: { marginType: "none" },
            pageSize: "A4"
          });
        } else {
          bytes = await win.webContents.printToPDF({
            printBackground: true,
            margins: { marginType: "none" },
            preferCSSPageSize: true
          });
        }
      } catch (firstErr) {
        try {
          const pageSize = format === "a4" ? "A4" : await thermalPageSize(win, format);
          bytes = await win.webContents.printToPDF({
            printBackground: true,
            margins: { marginType: "none" },
            pageSize
          });
        } catch {
          bytes = await win.webContents.printToPDF({
            printBackground: true,
            margins: { marginType: "none" },
            pageSize: "A4"
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
