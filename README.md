# ProTech Services Repair Manager

Offline-first PC, Laptop, Industrial Equipment & Repair Shop Management application.
Runs as a desktop app (Electron + Vite + React) with local SQLite persistence
(sql.js) — no internet or server required for day-to-day work.

## Features

- **Job management** — intake, edit, detail, filterable master list, auto token generation (PTS-xxx)
- **Payments & accounts** — double-entry financial ledger, payment status tracking
- **Inventory** — parts & spare tracking with stock thresholds and transactions
- **Customers** — searchable directory with repair history and spend
- **Dashboard & analytics** — KPIs, revenue trends, repair status distribution
- **Printing & export** — thermal 58mm / 80mm job cards and A4 invoices with QR codes; PDF export
- **WhatsApp notifications** — ready-for-collection, repair update and payment reminder templates
- **Backup & restore** — one-click SQLite `.db` export/import plus optional Google Drive sync
- **Auto-update** — checks GitHub Releases and silently installs new versions
- **Dark/light themes**, command palette (`Ctrl/Cmd+K`), full offline support

## Tech stack

- Electron + electron-vite, React 19, TypeScript, Tailwind CSS v4
- SQLite via `sql.js` persisted to IndexedDB (local, offline)
- Zustand state, React Router, Recharts, sonner, jsPDF / html2canvas

## Getting started

```bash
npm install
npm run dev          # run in the browser (port 3000)
npm run dev:electron # run inside Electron with HMR
```

## Building

```bash
npm run lint              # TypeScript type check
npm run test              # vitest unit tests
npm run build             # web bundle -> dist/
npm run build:electron    # electron shell -> out/
npm run dist:win          # NSIS installer + portable exe -> release/
npm run dist:win:portable # portable exe only
```

## Auto-updates

The desktop app uses [electron-updater](https://www.electron.build/auto-update)
with the **GitHub Releases** provider (`owner: beingadil`, `repo: protech-repairmanager`).

- Each tagged release (`vX.Y.Z` push) is built and published by
  `.github/workflows/release.yml`, which uploads the installer, the portable exe
  and `latest.yml` to a GitHub Release.
- Installed clients check for updates a few seconds after launch, download in
  the background and offer **Restart to Update**. The update pill appears in the
  app top bar.
- For a self-hosted feed, override at runtime without rebuilding:
  `UPDATE_FEED_URL=https://your.server/path electron .`

## Project layout

```
app/            Electron main + preload (window, IPC, updater, sql.js WASM bridge)
src/            React renderer (features, components, stores, db layer)
scripts/        helpers (icon generation, font self-hosting)
build/          app icons used by electron-builder
public/fonts/   self-hosted fonts (no Google dependency at runtime)
.github/        CI + release workflows
```