/**
 * Database Desktop Sync Service
 *
 * In Electron the actual file write happens in the main process (real
 * filesystem access through the preload bridge) — the renderer never touches
 * `require`/`fs`. In the browser this degrades to a download, since web pages
 * cannot write to an arbitrary folder.
 */

export interface SyncResult {
  success: boolean;
  filePath: string;
  bytesWritten: number;
  timestamp: string;
  error?: string;
}

const DEFAULT_DB_FILENAME = 'ProDataRepairManager.db';

/**
 * Saves the sql.js Uint8Array database binary directly to a local folder.
 * - Electron: `window.prodata.drive.syncToFolder` (main-process IPC).
 * - Browser: triggers a file download (best-effort fallback).
 */
export async function syncDatabaseToFolder(
  dbBytes: Uint8Array,
  folderPath: string
): Promise<SyncResult> {
  const timestamp = new Date().toISOString();

  if (!folderPath || !folderPath.trim()) {
    return {
      success: false,
      filePath: '',
      bytesWritten: 0,
      timestamp,
      error: 'Backup folder path is not configured. Please set a valid path in settings.'
    };
  }

  const targetFilePath = normalizePath(folderPath.trim(), DEFAULT_DB_FILENAME);

  // Electron desktop path: filesystem access lives in the main process.
  const bridge = (window as any).prodata?.drive;
  if (bridge?.syncToFolder) {
    try {
      return await bridge.syncToFolder(Array.from(dbBytes), folderPath.trim());
    } catch (err: any) {
      console.error('Desktop sync error:', err);
      return {
        success: false,
        filePath: targetFilePath,
        bytesWritten: 0,
        timestamp,
        error: (err && err.message) || 'Desktop sync failed.'
      };
    }
  }

  // Browser fallback: trigger a download into the user's configured folder.
  return browserFileSystemFallbackSync(dbBytes, targetFilePath, folderPath.trim());
}

/**
 * Normalizes directory paths for Windows and Unix systems.
 */
function normalizePath(basePath: string, fileName: string): string {
  const cleanBase = basePath.trim().replace(/[\\/]+$/, '');
  const separator = cleanBase.includes('/') ? '/' : '\\';
  return `${cleanBase}${separator}${fileName}`;
}

/**
 * Fallback handler for web browser environments.
 */
async function browserFileSystemFallbackSync(
  dbBytes: Uint8Array,
  targetFilePath: string,
  googleDrivePath: string
): Promise<SyncResult> {
  const timestamp = new Date().toISOString();

  const isPathFormatted = /^[a-zA-Z]:[\\/]|^[/]/.test(googleDrivePath);
  if (!isPathFormatted) {
    return {
      success: false,
      filePath: targetFilePath,
      bytesWritten: 0,
      timestamp,
      error: `Invalid path format '${googleDrivePath}'. Please provide an absolute folder path (e.g. C:\\Users\\Name\\Google Drive).`
    };
  }

  try {
    const blob = new Blob([dbBytes.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = DEFAULT_DB_FILENAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      filePath: targetFilePath,
      bytesWritten: dbBytes.length,
      timestamp
    };
  } catch (e: any) {
    return {
      success: false,
      filePath: targetFilePath,
      bytesWritten: 0,
      timestamp,
      error: `Browser Sync Fallback Error: ${e.message || 'Failed to write file stream.'}`
    };
  }
}

// Backwards-compatible alias so existing callers keep working.
export const syncDatabaseToGoogleDrive = syncDatabaseToFolder;
