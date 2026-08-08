import { app, BrowserWindow, dialog, session } from 'electron';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { openDatabase, closeDatabase } from './db';
import { registerIpcHandlers } from './ipc';
import { PRODUCTION_CSP } from '../../vite/csp';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    title: 'ProTech Services | Repair Management System',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // SMOKE_TEST mode: capture renderer console + auto-quit, write results to a file
  // (stdout is buffered and lost on app.exit).
  if (process.env.SMOKE_TEST) {
    const lines: string[] = [];
    const outFile = process.env.SMOKE_TEST_OUT || 'smoke-result.log';
    const flush = () => {
      try {
        writeFileSync(outFile, lines.join('\n'), 'utf8');
      } catch {
        /* ignore */
      }
    };
    lines.push(`smoke-start ${new Date().toISOString()}`);
    flush();
    mainWindow.webContents.on('console-message', (event) => {
      const msg = event.message ?? event;
      lines.push(`[renderer] ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    });
    mainWindow.webContents.on('did-finish-load', () => {
      lines.push('did-finish-load');
      flush();
      // Exercise the full IPC + better-sqlite3 path.
      mainWindow?.webContents
        .executeJavaScript(
          `window.prodata.db.query('SELECT COUNT(*) as c FROM settings').then(r => JSON.stringify({settingsRows: r.length, ok: true})).catch(e => JSON.stringify({ok: false, err: String(e)}))`
        )
        .then((res) => lines.push(`db-ipc-check: ${res}`))
        .catch((e) => lines.push(`db-ipc-check-error: ${String(e)}`));
    });
    mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
      lines.push(`did-fail-load code=${code} desc=${desc}`);
    });
    setTimeout(() => {
      lines.push('SMOKE_TEST_COMPLETE');
      flush();
      app.exit(0);
    }, 12000);
  }

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// SMOKE_TEST bypasses the single-instance lock so repeated test launches work.
const gotLock = process.env.SMOKE_TEST ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Defense in depth: enforce the same CSP via headers for any http(s) load.
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [PRODUCTION_CSP]
        }
      });
    });

    try {
      openDatabase();
    } catch (err) {
      dialog.showErrorBox(
        'Database Error',
        err instanceof Error ? err.message : 'The local database could not be opened.'
      );
      app.quit();
      return;
    }

    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    closeDatabase();
  });
}
