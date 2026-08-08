# ProTech Services Repair Manager — Production & Electron Plan

Status: DRAFT — awaiting user approval of Phase 0 decisions
Version: 1.0 | Date: 2026-08-08

## Goal

Turn the Antigravity/AI-Studio-generated web app into a **production-ready, fully offline desktop application** with a **persistent SQLite database**, security-hardened, tested, and packaged as an Electron installer.

## Current State (Audited 2026-08-08)

- React 19 + TypeScript + Vite 6 + Tailwind v4, 40 source files, `bun.lock` present but **no Bun installed** (Node 26 + npm available).
- SQLite via **sql.js** (WASM) with persistence to **IndexedDB + localStorage(base64)** — both written on every mutation.
- **Cloud/leftover deps not used in src**: `@google/genai`, `express`, `@types/express`, `dotenv`.
- **Network dependencies that break offline**:
  1. `src/lib/db.ts` — CDN fallbacks for sql.js WASM (`cdnjs.cloudflare.com`, `unpkg.com`).
  2. `index.html` — Google Fonts (Outfit, Plus Jakarta Sans) loaded from CDN.
  3. `restoreDatabaseBinary` also has a CDN fallback path.
- WhatsApp notifications = `wa.me` deeplinks (user-initiated, acceptable).
- Twilio settings (`twilio_sid/token/from`) stored but **never used** — dead feature + secrets at rest.
- SQL access is cleanly parameterized (`?` placeholders everywhere, no interpolation found).
- No test suite, no git repo, no CSP, no ErrorBoundary.
- Backup/restore accepts **any file** with zero validation (arbitrary SQLite file could carry malicious triggers/views executed by the app).

## Architecture Decisions (need user sign-off)

### D1 — Electron data layer: better-sqlite3 in main process (RECOMMENDED)
Replace sql.js-in-renderer with **better-sqlite3 in the Electron main process**, exposed to the renderer via a typed `contextBridge` IPC API.
- Real `.db` file in `app.getPath('userData')`, WAL mode, `PRAGMA foreign_keys=ON`, `integrity_check` on open.
- No WASM, no CDN, no IndexedDB/localStorage limits, native performance, true transactions.
- **Keep the existing `query`/`execute` surface** (`src/lib/db.ts`) as the seam: a `web` adapter (sql.js, for browser dev only) and an `electron` adapter (IPC). All 40 files keep working unchanged.
- Alternative (rejected): keep sql.js + write bytes to disk — still WASM, slower, weaker transactions.

### D2 — Electron tooling: electron-vite + electron-builder
`electron-vite` reuses the existing Vite config/Router setup with minimal churn; `electron-builder` produces NSIS installer + portable exe.
- Alternative (rejected): electron-forge — more boilerplate migration.

### D3 — Offline fonts: self-host the two Google Fonts
Download woff2 files into `assets/fonts/`, serve via `@font-face` with `font-display: swap`. Keeps brand look, zero network. (Fallback: system font stack if licensing/download is a problem — ask user.)

### D4 — Encryption at rest: DEFER (decision point)
SQLCipher or app-level AES adds build complexity for a single-admin local shop app. Recommendation: skip for v1, document in README, revisit if backups travel. **Ask user.**

### D5 — Packaging targets: Windows first
User runs Windows (path evidence). Ship NSIS installer + portable. Code signing needs a purchased cert — note as a user-owned step.

## Phases

### Phase 0 — Baseline (do first, ~15 min)
- [ ] `git init`, sane `.gitignore` (node_modules, dist, out, *.db, .env*, .freebuff/)
- [ ] `npm install` (convert from bun.lock; keep package.json as source of truth, delete bun.lock)
- [ ] Verify baseline: `npm run build` + `npm run lint` pass with zero errors → record in progress.md
- [ ] Inventory `.freebuff/` — **do not touch** (Freebuff client's own data)

### Phase 1 — Security audit & fixes (security-review skill)
Audit methodology: trace data flow, confirm attacker-controlled input, HIGH confidence only.
Expected findings → fixes:
- [ ] **F1 Restore = arbitrary file → validated restore**: reject non-SQLite files (magic bytes `SQLite format 3\0`), size cap (e.g. 500 MB), schema-version match check, `PRAGMA integrity_check` before swap, restore inside a transaction. Write failing test first (TDD).
- [ ] **F2 CDN WASM fallbacks → remove** (supply-chain + offline). Bundle `sql-wasm.wasm` locally only. Test: offline load works.
- [ ] **F3 Google Fonts CDN → self-host** (D3).
- [ ] **F4 Unused cloud deps → remove** (`@google/genai`, `express`, `dotenv`, `@types/express`). Verify zero references.
- [ ] **F5 Twilio dead feature → remove fields from UI/types/schema** (dead code + secrets-at-rest).
- [ ] **F6 localStorage base64 DB copy → remove** (5 MB quota, double PII at rest, perf). IndexedDB only for web dev; real file in Electron.
- [ ] **F7 CSP for production** — strict `default-src 'self'`; no `unsafe-inline` for scripts; fonts/images self; allow `blob:`/`data:` only where print/QR need it. Applied via Electron session headers + Vite build.
- [ ] **F8 `executeRaw`/broad API → restrict** — only internal migrations may use raw SQL.
- [ ] **F9 Secrets hygiene** — confirm no committed keys/tokens; `.env.example` cleaned; document GEMINI removal.
- [ ] **F10 Google Drive sync path handling** — move write logic into Electron main (validate + user-chosen folder via dialog); remove `window.require` hacks.
- [ ] Re-run audit; write findings + evidence to `findings.md`.

### Phase 2 — Offline-first hardening
- [ ] Verify zero network requests in built app: grep bundle for `https://` external loads; devtools network audit on a served build (offline mode).
- [ ] Remove AI Studio branding: README, metadata.json, MEMORY.md header, `index.html` title/tags.
- [ ] Print flow offline check (QR codes, jsPDF, html2canvas all local — verify).
- [ ] Confirm WhatsApp deeplinks degrade gracefully offline (button still visible; wa.me opens when online — acceptable, document).

### Phase 3 — Electron shell (electron-vite)
- [ ] Add `electron`, `electron-vite`, `electron-builder`, `better-sqlite3` + rebuild tooling (`electron-rebuild`/`@electron/rebuild`).
- [ ] Main process: single-instance lock, BrowserWindow (contextIsolation: true, sandbox: true, nodeIntegration: false), app menu, graceful quit (DB close + WAL checkpoint).
- [ ] Preload: `contextBridge.exposeInMainWorld('prodata', ...)` typed API — `db.query`, `db.execute`, `db.export`, `db.restore`, `backup.exportFile`, `backup.restoreFile`, `drive.syncToFolder`, `settings.getUserDataPath`.
- [ ] Renderer adapter `src/lib/db-electron.ts` implementing the same surface as `db.ts`; runtime switch on `window.prodata` presence.
- [ ] CSP via `session.defaultSession.webRequest.onHeadersReceived` + meta tag fallback.
- [ ] Dev flow preserved: `electron-vite dev` runs renderer HMR; browser `vite dev` still works with sql.js adapter.

### Phase 4 — Data-layer hardening (TDD)
- [ ] **Migration system**: `schema_version` table, ordered migrations loaded from `src/db/migrations/*.sql`, run in transaction, idempotent. Migrate existing inline `MIGRATIONS` array.
- [ ] **Transactions**: add `withTransaction(fn)` to the adapter API; wrap job-create, restore, batch settings.
- [ ] **WAL + durability**: `journal_mode=WAL`, `synchronous=NORMAL`, checkpoint on app quit; auto-backup on launch (copy to `userData/backups/` with retention).
- [ ] **Backup/restore hardening** (move from Phase 1 fixes into adapter): validated import/export through main-process dialog (save/`showOpenDialog`), atomic replace (write temp + rename).
- [ ] Tests (vitest): token counter increments atomically (concurrent), restore rejects invalid header/schema mismatch, migrations apply once & in order, WAL checkpoint runs, every public adapter function covered.
- [ ] Debounced persistence for web adapter (currently exports DB on every `execute` — jank + quota risk).

### Phase 5 — Packaging & distribution
- [ ] `electron-builder.yml`: appId, productName "ProTech Services", NSIS + portable targets, icon set (256px+), `asar: true`, files whitelist (dist, out, resources), artifactName.
- [ ] Build scripts: `build:web`, `build:electron`, `dist:win`, `dist:win:portable`.
- [ ] Verify packaged exe: fresh install, DB file created in `userData`, data survives restart, restore/backup work, print works, offline (airplane mode) full pass.
- [ ] Optional (ask user): code-signing cert, auto-update via electron-updater (offline app may skip).

### Phase 6 — QA & hardening
- [ ] vitest + @testing-library/react; unit tests: `sanitizePhoneNumber`, `generateWhatsAppMessage`, token generation, CSV export, `formatCurrency/Date`, restore validation, migration runner.
- [ ] Component tests for JobList filters, AddJob form validation (zod), Settings persistence.
- [ ] Error handling: React ErrorBoundary, unhandled-rejection handler, file-based app log in `userData/logs/`.
- [ ] Performance: verify job list renders fine at 10k rows (virtualize if needed), debounce DB writes, lazy-load routes.
- [ ] Final gate: `npm run lint` (tsc --noEmit), `npm test` all green, `electron-vite build` clean, packaged app smoke test → evidence in progress.md.

### Phase 7 — Docs & handoff
- [ ] README: production build steps, packaging, data location, backup guidance, offline behavior notes.
- [ ] MEMORY.md: update with production architecture decisions.
- [ ] Handoff notes for code signing + optional SQLCipher.

## Out of Scope (v1)
- Multi-user / auth (single admin per MEMORY.md) — note: no auth needed, but **local app lock screen is a possible future add**.
- Cloud sync (Google Drive is local-folder sync only, keep).
- Twilio SMS (dead feature removed).
- Mobile/tablet targets.

## Risks / Blockers
- `better-sqlite3` native build on Windows requires VS Build Tools or prebuilt binaries — mitigate with `@electron/rebuild` + prebuilds; fallback D1-alternative if blocked.
- Font licensing for self-hosting Google Fonts — both are OFL, fine to self-host; confirm with user.
- No git history — first commit after Phase 0 baseline passes.
- sql.js ↔ better-sqlite3 type drift — adapter interface is the contract; tests run against both.

## Verification Gate (before any success claim)
Per phase: run the specified command, read full output, record exit code + evidence in progress.md. No phase is "complete" without its verification evidence.
