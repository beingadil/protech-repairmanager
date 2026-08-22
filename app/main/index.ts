import { app, BrowserWindow, dialog, session } from 'electron';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { registerIpcHandlers } from './ipc';
import { initUpdater, checkForUpdates, canCheckForUpdates, onUpdateEvent } from './updater';
import { log } from './log';
import { PRODUCTION_CSP } from '../../vite/csp';

let mainWindow: BrowserWindow | null = null;

// A stray unhandled rejection/exception in the main process must never take
// the shop's app down silently — log it and keep running (Node 22+ defaults
// --unhandled-rejections=throw, which would crash the whole app).
process.on('unhandledRejection', (reason) => {
  log.error(`unhandledRejection: ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`);
});
process.on('uncaughtException', (err) => {
  log.error(`uncaughtException: ${err.stack || err.message}`);
});

// SMOKE_TEST state (module scope so both createWindow and whenReady can use it).
const smokeLines: string[] = [];
const smokeOutFile = process.env.SMOKE_TEST_OUT || 'smoke-result.log';
function smokeFlush() {
  try {
    writeFileSync(smokeOutFile, smokeLines.join('\n'), 'utf8');
  } catch {
    /* ignore */
  }
}

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

  // SMOKE_TEST mode: capture renderer console + auto-quit, write results to a
  // file (stdout is buffered and lost on app.exit).
  if (process.env.SMOKE_TEST) {
    smokeLines.push(`smoke-start ${new Date().toISOString()}`);
    smokeFlush();
    mainWindow.webContents.on('console-message', (event, level, message) => {
      const msg = typeof message === 'string' && message ? message : event.message ?? String(message ?? level);
      smokeLines.push(`[renderer] ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    });
    mainWindow.webContents.on('did-finish-load', () => {
      smokeLines.push('did-finish-load');
      // Exercise the native SQLite bridge end-to-end: renderer preload ->
      // IPC -> main-process better-sqlite3 -> real query result, then a
      // write+read benchmark at repair-shop data scale.
      mainWindow?.webContents
        .executeJavaScript(
          `(async () => {
            try {
              const t0 = performance.now();
              const r = await window.prodata.db.query('SELECT 42 AS v');
              const pingMs = +(performance.now() - t0).toFixed(2);
              await window.prodata.db.execute('CREATE TABLE IF NOT EXISTS __bench (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT, charges REAL, status TEXT)');
              const t1 = performance.now();
              for (let i = 0; i < 500; i++) {
                await window.prodata.db.execute('INSERT INTO __bench (token, charges, status) VALUES (?, ?, ?)', ['PTS-' + i, 1000 + i, i % 2 ? 'paid' : 'due']);
              }
              const insertMs = +(performance.now() - t1).toFixed(1);
              const t2 = performance.now();
              const agg = await window.prodata.db.query("SELECT status, COUNT(*) AS n, SUM(charges) AS total FROM __bench GROUP BY status");
              const aggMs = +(performance.now() - t2).toFixed(1);
              const joinMsT = performance.now();
              await window.prodata.db.query('SELECT b.status, COUNT(*) AS n FROM __bench b LEFT JOIN __bench c ON c.id = b.id GROUP BY b.status');
              const joinMs = +(performance.now() - joinMsT).toFixed(1);
              await window.prodata.db.execute('DROP TABLE __bench');
              return JSON.stringify({ dbOk: true, v: r && r[0] ? r[0].v : null, pingMs, insert500Ms: insertMs, perInsertMs: +(insertMs / 500).toFixed(3), aggMs, selfJoinMs: joinMs, aggRows: agg.length });
            } catch (e) {
              return JSON.stringify({ dbOk: false, err: String(e) });
            }
          })()`
        )
        .then((res) => smokeLines.push(`db-bench: ${res}`))
        .catch((e) => smokeLines.push(`db-check-error: ${String(e)}`));
    });
    mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
      smokeLines.push(`did-fail-load code=${code} desc=${desc}`);
    });
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      smokeLines.push(`renderer-gone: ${JSON.stringify(details)}`);
    });
    const smokeDuration = Number(process.env.SMOKE_DURATION_MS || 15000);
    setTimeout(() => {
      smokeLines.push('SMOKE_TEST_COMPLETE');
      smokeFlush();
      app.exit(0);
    }, smokeDuration);
  }

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// Shop PCs often have old/flaky GPU drivers; the UI is simple React/Tailwind
// and runs perfectly on the CPU. Disabling hardware acceleration prevents
// random GPU-process crashes from taking the app down.
app.disableHardwareAcceleration();

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

    registerIpcHandlers();
    createWindow();

    initUpdater(() => mainWindow);
    if (process.env.SMOKE_TEST) {
      onUpdateEvent((e) => {
        smokeLines.push(`update-event: ${JSON.stringify(e)}`);
      });
      // Exercise the update check pipeline against the configured feed.
      checkForUpdates(false).then(
        (r) => {
          smokeLines.push(`update-check: ${JSON.stringify(r)}`);
          smokeFlush();
        },
        (e) => {
          smokeLines.push(`update-check-rejected: ${String(e)}`);
          smokeFlush();
        }
      );
    }

    // Silent background update check shortly after launch — fetches the latest
    // release feed from GitHub and downloads it in the background if found.
    if (!process.env.SMOKE_TEST && canCheckForUpdates()) {
      setTimeout(() => {
        checkForUpdates(false).catch((err) => {
          log.warn(`[updater] background check failed: ${err}`);
        });
      }, 4_000);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}