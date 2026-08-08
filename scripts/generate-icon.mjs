/**
 * Renders build/icon.svg into build/icon.png (512x512).
 * Runs under Electron so we get a real rasterizer:
 *   npx electron scripts/generate-icon.mjs
 */
import { app, BrowserWindow } from 'electron';
import { writeFileSync, mkdirSync } from 'node:fs';

// Force 1:1 device pixels so a 512 DIP window captures as exactly 512x512.
app.commandLine.appendSwitch('force-device-scale-factor', '1');
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'build');
mkdirSync(buildDir, { recursive: true });

const svgUrl = 'file://' + path.join(buildDir, 'icon.svg').replace(/\\/g, '/');

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function render(size, visible) {
  const win = new BrowserWindow({
    width: size,
    height: size,
    show: visible,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    x: visible ? -10000 : undefined,
    y: visible ? -10000 : undefined,
    webPreferences: { offscreen: false }
  });
  try {
    await win.loadURL(svgUrl);
    await delay(800);
    return await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
  } finally {
    win.destroy();
  }
}

app.whenReady().then(async () => {
  try {
    let image = await render(512, false);

    // Hidden-window captures can come back empty on some platforms; retry
    // with an off-screen visible window if so.
    if (image.isEmpty()) {
      console.log('hidden capture empty, retrying with off-screen window');
      image = await render(512, true);
    }
    if (image.isEmpty()) throw new Error('capturePage returned an empty image.');

    const png = image.toPNG();
    writeFileSync(path.join(buildDir, 'icon.png'), png);

    // electron-builder converts this PNG into a multi-size .ico at package
    // time (win.icon accepts a >=256px PNG).
    console.log(
      `Wrote build/icon.png (${png.length} bytes, ${image.getSize().width}x${image.getSize().height})`
    );
    app.exit(0);
  } catch (err) {
    console.error('Icon generation failed:', err);
    app.exit(1);
  }
});
