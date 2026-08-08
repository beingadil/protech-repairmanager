# Findings — ProTech Production/Electron Audit

## Codebase Facts (verified 2026-08-08)
- 40 TS/TSX files under `src/`; 5 lib, 3 store, 3 hooks/services, 14 features/pages, 13 components.
- `src/lib/db.ts` is the single DB seam: `getDb`, `query`, `execute`, `executeRaw`, `exportDatabaseBinary`, `restoreDatabaseBinary`, `saveDbToStorage`, `resetDatabaseToProduction`.
- Persistence: IndexedDB (primary) + localStorage base64 (mirror) — both written on EVERY `execute()`.
- Migrations live as an inline `MIGRATIONS` string array in `db.ts`; `src/db/migrations/*.sql` files exist but are NOT loaded by code (dead files).
- All user SQL is `?`-parameterized; no string interpolation found (checked all `query`/`execute` call sites).
- `@google/genai`, `express`, `dotenv` unused in src. `bun.lock` present; Bun not installed; Node v26.3.0 + npm available.
- `.freebuff/` contains the Freebuff client's own `desktop-v2.db` + settings — NOT project data, must not be touched.

## Security Findings (HIGH confidence)
1. **Restore accepts arbitrary files** (`BackupPage.handleRestoreFile` → `restoreDatabaseBinary`): no magic-byte check, no size cap, no integrity check. A crafted SQLite file can carry triggers/views executed on next query; malformed file can crash or corrupt. → Fix F1.
2. **CDN fallbacks for WASM** (`cdnjs.cloudflare.com`, `unpkg.com`): supply-chain (third-party code injected at runtime) + breaks offline. → Fix F2.
3. **Google Fonts from CDN** (`index.html`): offline break + third-party request. → Fix F3.
4. **Twilio credentials stored in plaintext** in `settings` table, feature never implemented (no Twilio code exists). Dead secret surface. → Fix F5.
5. **Full DB mirrored to localStorage as base64**: PII (names, mobiles, serials, financials) at rest in two stores; 5 MB quota will corrupt-save for large DBs. → Fix F6.
6. **`window.require` in `dbSyncService.ts`**: Electron preload-bypass pattern; `nodeIntegration`-style access if ever enabled; also throws in browser. → Fix F10.
7. **No CSP anywhere**; default Electron would run with dev-insecure headers if shipped as-is. → Fix F7.

## Non-findings (checked, OK)
- No `dangerouslySetInnerHTML`, no `eval`, no `innerHTML` with user data.
- WhatsApp deeplink uses `noopener,noreferrer`. ✓
- `.env.example` only placeholders, no real keys committed. ✓
- CSV export escapes `"` (double-quote) in fields. ✓ (check other fields later)
- All DB writes parameterized. ✓

## Architecture Notes
- The `query`/`execute` API in `db.ts` is already a clean adapter seam — keep it; add `electron` implementation + runtime switch.
- JobListPage builds dynamic SQL with placeholders (`sql, params`) — fine, keep pattern.
- `resetDatabaseToProduction` (factory wipe) exists — port to Electron adapter.
