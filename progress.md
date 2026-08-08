# Progress — ProTech Production/Electron

## Session 2 — 2026-08-08 (Execution)
- Phase 0 done: git init, npm install (converted from bun.lock), baseline build+lint pass, committed.
- Phase 1 done (committed): validated restore (7 TDD tests), CDN WASM removed, localStorage mirror removed,
  Twilio removed, CSP plugin, sync service rewritten to preload bridge, unused cloud deps removed.
- Phase 2 done (same commit): fonts self-hosted (10 woff2 via scripts/fetch-fonts.mjs), AI Studio branding
  removed, bundle audit: zero runtime network fetches.
- Phase 3 done (committed): electron-vite shell, better-sqlite3 in main (WAL, FK, integrity check on open,
  daily auto-backup), sandboxed preload bridge, db.ts facade, hash router (file:// fix), SMOKE_TEST mode.
  Debugged: electron/ dir name collided with electron-vite external regex (/^electron\/.+/); preload must be
  CJS (.cjs) for sandbox; stdout buffering lost on app.exit (write smoke results to file instead).
  SMOKE TEST: did-finish-load + db-ipc-check {"settingsRows":1,"ok":true} — passed for dev build AND packaged exe.
- Found + fixed: @types/react was never installed — React imports were `any`, lint was a no-op for components.
  Installed @types/react+react-dom, fixed 2 real errors (bad CSS props in PrintPreviewPage).
- Phase 4 folded into 3: migration runner (schema_version), canonical .sql migrations, WAL, auto-backup,
  validated restore, debounced web persistence.
- Phase 5 done: electron-builder NSIS installer + portable exe built (release/), packaged exe smoke test passed.
- Phase 6: vitest 32 tests (backup-validate, migrations vs better-sqlite3, whatsapp, utils, token). Fixed 3
  test bugs of my own (currency format is 'Rs 2,500' not 'Rs.'; INSERT OR IGNORE preserves legacy values;
  DROP TABLE IF EXISTS).
- Perf: sql.js lazy-loaded — split into browser-only chunk (76 KB), out of Electron renderer critical path.
- Phase 7: README rewritten (build, packaging, data location, security, signing steps); MEMORY.md updated.

## Verification evidence (final gate)
- npm run lint: exit 0 (tsc --noEmit, now with real React types)
- npx vitest run: 32 passed / 32
- npm run build: exit 0
- npx electron-vite build: exit 0 (main 16 KB, preload index.cjs, renderer)
- Packaged exe smoke: SMOKE_TEST_COMPLETE, did-finish-load, db-ipc-check ok
- Installers: release/ProTech Services Repair Manager Setup 1.0.0.exe (125.6 MB), portable (125.4 MB)

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| bun: command not found | 1 | Use npm (package.json is source of truth) |
| Entry module cannot be external | 2 | electron/ dir name matched /^electron\/.+/ external regex; renamed to app/ |
| Preload built as .mjs | 1 | Force output.format cjs + [name].cjs (sandbox needs CJS) |
| BrowserRouter 404 on file:// | 2 | createHashRouter |
| React Router error hidden ([object Object]) | 3 | onCaughtError + errorElement instrumentation -> found file:// route mismatch |
| Smoke logs lost (stdout buffering on app.exit) | 2 | Write smoke results to a file, flush() at each stage |
| @types/react missing -> components unchecked | 1 | npm i -D @types/react @types/react-dom; fixed 2 surfaced errors |
| Test bugs: 'Rs.' vs 'Rs '; INSERT OR IGNORE preserves legacy; DROP TABLE missing | 3 | Fixed assertions to match actual behavior |
