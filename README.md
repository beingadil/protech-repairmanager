# ProTech Services — Repair Management System

Offline-first desktop application for PC, laptop, and industrial equipment repair
shops. Single-admin, local SQLite database, no cloud services, no API keys.

- **Desktop (primary):** Electron + `better-sqlite3` — the database is a real
  `.db` file in the OS user-data directory, opened in WAL mode by the main
  process and accessed from the sandboxed renderer over a typed IPC bridge.
- **Browser (dev/preview):** same UI over `sql.js` + IndexedDB, so the app also
  runs as a plain web page.

## Requirements

- Node.js 20+ (tested on Node 26) and npm.
- Windows is the supported packaging target (NSIS installer + portable exe).

## Development

```bash
npm install
npm run dev            # web (Vite, browser, sql.js adapter)
npm run dev:electron   # desktop (electron-vite dev, HMR, better-sqlite3)
```

## Production build & packaging

```bash
npm run lint           # tsc --noEmit
npm test               # vitest unit/integration tests
npm run build          # web build -> dist/
npm run build:electron # desktop build -> out/ (main, preload, renderer)
npm run dist:win       # NSIS installer + portable exe -> release/
npm run dist:win:portable  # portable exe only
```

Artifacts land in `release/`:

- `ProTech Services Repair Manager Setup 1.0.0.exe` — installable (NSIS, allows
  choosing the install directory, desktop shortcut).
- `ProTech Services Repair Manager-portable-1.0.0.exe` — portable, no install.

The packaged app can be smoke-tested headlessly:

```bash
SMOKE_TEST=1 SMOKE_TEST_OUT=smoke-result.log "release/win-unpacked/ProTech Services Repair Manager.exe"
# then check smoke-result.log for did-finish-load + db-ipc-check ok
```

## Where the data lives

| Mode | Storage |
|------|---------|
| Electron | `%APPDATA%\protech-repair-manager\prodata.db` (WAL mode) |
| Electron backups | `%APPDATA%\protech-repair-manager\backups\` — one automatic copy per day, newest 10 kept |
| Browser | IndexedDB (`prodata_repair_db_store`) |

Export/restore from the **Backup & Restore** page uses a validated restore: the
file must be a real SQLite database, pass `PRAGMA integrity_check`, and contain
the required tables before it replaces the live database. Restores are atomic
(temp file + rename).

## Offline behavior

- Zero runtime network requests in the production build (fonts, WASM, and all
  assets are self-hosted; CSP is `default-src 'self'`).
- WhatsApp notifications are `wa.me` deep links — user-initiated; they open the
  browser/WhatsApp only when the user clicks and only when online.
- Print (thermal 58/80mm, A4 invoice, QR codes, PDF export) is fully local.

## Security notes

- Renderer is sandboxed (`contextIsolation`, `sandbox`, `nodeIntegration: off`).
- The database lives in the main process; the renderer only reaches it through
  the preload bridge with typed IPC handlers that validate payloads.
- Strict CSP is applied to production builds.
- Restore validation (above) blocks crafted/corrupt `.db` files.
- No secrets are stored: the unused Twilio settings were removed; there are no
  API keys anywhere.

### Before distributing (user-owned steps)

1. **Code signing** — purchase a code-signing certificate (e.g. Sectigo/Comodo
   EV or OV) and configure it in electron-builder (`win.certificateFile` /
   `WIN_CSC_LINK`) so Windows SmartScreen stops warning users. Add
   `"postinstall": "electron-builder install-app-deps"` to `package.json` on the
   build machine.
2. **Branded icon** — drop a 512×512 `build/icon.ico` and uncomment `icon:` in
   `electron-builder.yml`.
3. **Auto-update (optional)** — the app is offline-first by design; if you later
   want updates, add `electron-updater` + a release server (or use the portable
   exe as the distribution mechanism).
4. **Encryption at rest (optional)** — currently the `.db` file is plaintext on
   disk, matching the single-admin local use case. If backups will travel or
   laptops can be lost, move to SQLCipher or OS disk encryption (BitLocker).

## Project layout

```
app/main/      Electron main: window, IPC handlers, better-sqlite3 wrapper
app/preload/   Sandboxed contextBridge (typed, minimal surface)
src/lib/       db facade (web/electron switch), migrations runner, validation,
               utils, whatsapp, export
src/db/migrations/  versioned .sql migrations (schema_version tracked)
src/features/  Dashboard, Jobs, Customers, Print, Backup, Settings, ...
scripts/       fetch-fonts.mjs (self-host Google Fonts)
```

## Tests

```bash
npm test
```

Covers backup validation, the migration runner (against real better-sqlite3),
token formatting, WhatsApp message generation, and date/currency utilities.
