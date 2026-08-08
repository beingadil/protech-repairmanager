import { app, type BrowserWindow } from 'electron';
import { createRequire } from 'node:module';
import type { UpdateInfo } from 'electron-updater';
import { log } from './log';

// electron-updater is CommonJS whose exports the ESM named-import lexer cannot
// detect; createRequire is the reliable way to load it from an ESM main bundle.
const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater') as typeof import('electron-updater');

let getWindow: () => BrowserWindow | null = () => null;
let initialized = false;
let lastCheckWasManual = false;
const listeners: Array<(e: UpdateEvent) => void> = [];

export type UpdateEventType =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'progress'
  | 'downloaded'
  | 'error';

export interface UpdateEvent {
  type: UpdateEventType;
  manual: boolean;
  info?: UpdateInfo;
  percent?: number;
  error?: string;
}

function send(event: UpdateEvent) {
  for (const cb of listeners) {
    try {
      cb(event);
    } catch {
      /* listener errors must not break the update flow */
    }
  }
  const win = getWindow();
  // The webContents can be disposed (e.g. during app teardown) while the
  // BrowserWindow itself is not destroyed yet — sending then throws.
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
    try {
      win.webContents.send('update:event', event);
    } catch {
      /* window tearing down mid-event; ignore */
    }
  }
}

/** Subscribes to update events (used by smoke tests and diagnostics). */
export function onUpdateEvent(cb: (e: UpdateEvent) => void): () => void {
  listeners.push(cb);
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };
}

/**
 * Wires electron-updater. The feed comes from app-update.yml (written by
 * electron-builder from the `publish` config); UPDATE_FEED_URL overrides it
 * at runtime so a self-hosted feed can be swapped without rebuilding.
 */
export function initUpdater(getWindowFn: () => BrowserWindow | null): void {
  if (initialized) return;
  initialized = true;
  getWindow = getWindowFn;

  if (!app.isPackaged) {
    // In dev there is no app-update.yml; allow a manual feed for testing.
    autoUpdater.forceDevUpdateConfig = true;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // We distribute the full NSIS installer, not a web installer.
  autoUpdater.disableWebInstaller = true;
  // The first update ever has no cached previous installer, and the
  // differential fallback path can reject out of our control. Always do a
  // reliable full download instead (updates are infrequent).
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.logger = {
    info: (m) => log.info(`[updater] ${m}`),
    warn: (m) => log.warn(`[updater] ${m}`),
    error: (m) => log.error(`[updater] ${m}`),
    debug: (m) => log.debug(`[updater] ${m}`)
  };

  const feedUrl = process.env.UPDATE_FEED_URL;
  if (feedUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl });
    log.info(`[updater] feed overridden to ${feedUrl}`);
  }

  autoUpdater.on('checking-for-update', () => {
    log.info('[updater] checking for update');
    send({ type: 'checking', manual: lastCheckWasManual });
  });

  autoUpdater.on('update-available', (info) => {
    log.info(`[updater] update available: ${info.version}`);
    send({ type: 'available', manual: lastCheckWasManual, info });
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('[updater] already up to date');
    send({ type: 'not-available', manual: lastCheckWasManual, info });
  });

  autoUpdater.on('download-progress', (p) => {
    send({ type: 'progress', manual: lastCheckWasManual, percent: Math.round(p.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`[updater] downloaded ${info.version}, ready to install`);
    send({ type: 'downloaded', manual: lastCheckWasManual, info });
  });

  autoUpdater.on('error', (err) => {
    // Offline and network failures are normal for this offline-first app —
    // only surface to the user when they explicitly asked to check.
    log.error(`[updater] ${err?.message || err}`);
    send({ type: 'error', manual: lastCheckWasManual, error: err?.message || String(err) });
  });
}

/** Returns true when a check is meaningful (packaged app or explicit feed). */
export function canCheckForUpdates(): boolean {
  return app.isPackaged || Boolean(process.env.UPDATE_FEED_URL);
}

export async function checkForUpdates(manual = false): Promise<{ ok: boolean; error?: string }> {
  if (!canCheckForUpdates()) {
    return { ok: false, error: 'Auto-update is only available in the packaged app.' };
  }
  lastCheckWasManual = manual;
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    log.error(`[updater] check failed: ${err instanceof Error ? err.message : err}`);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function quitAndInstall(): void {
  if (app.isPackaged) {
    autoUpdater.quitAndInstall();
  }
}
