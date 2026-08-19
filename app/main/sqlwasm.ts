import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function resolveRendererDir(): string | null {
  // electron-vite emits the renderer to out/renderer in dev and package alike.
  const candidates = [join(__dirname, '../renderer')];
  for (const dir of candidates) {
    try {
      readdirSync(dir);
      return dir;
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Bridges the bundled sql.js WASM binary to the renderer. The renderer page is
 * loaded over file:// where fetch() of a relative .wasm asset is blocked by
 * Chromium, so we read the bytes in the main process and hand them over IPC.
 */
export function getSqlWasmBytes(): Uint8Array | null {
  const rendererDir = resolveRendererDir();
  if (!rendererDir) return null;
  try {
    const assetsDir = join(rendererDir, 'assets');
    const wasmFile = readdirSync(assetsDir).find((f) => f.endsWith('.wasm'));
    if (!wasmFile) return null;
    return readFileSync(join(assetsDir, wasmFile));
  } catch {
    return null;
  }
}