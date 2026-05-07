# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment

Node.js is installed via `nvm`. Before running any `npm` commands, source nvm if it's not already active:

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"
```

## Commands

```bash
npm run dev       # Start dev server with HMR
npm run build     # Type-check (tsc -b) then bundle for production
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint across all TS/TSX files
```

No test framework is configured yet.

## Backend (Vulnerability Scanner)

Python FastAPI backend in `backend/`. Start it separately:

```bash
cd backend && bash start.sh        # installs deps and starts on :8000
# or directly:
cd backend && python3 -m uvicorn main:app --reload --port 8000
```

Requires `nmap` on the system: `sudo dnf install -y nmap`

The Vite dev server proxies `/api/*` to `http://localhost:8000` (configured in `vite.config.ts`). The backend stores all scan data in `backend/scanner.db` (SQLite, auto-created on first run).

**Key backend files:**
- `backend/main.py` — FastAPI app, all endpoints, nmap wrapper, NVD CVE lookup, background scan worker
- `backend/requirements.txt` — `fastapi`, `uvicorn`, `aiohttp`

**API surface:** `GET /api/health`, `GET /api/profiles`, `GET|POST /api/scans`, `GET|DELETE /api/scans/{id}`

NVD API rate limit: 5 req/30s without a key, 50 req/30s with one (free at nvd.nist.gov/developers). The backend caches CVE results in SQLite for 24h.

## Architecture

Standard Vite + React 19 + TypeScript single-page app:

- `index.html` — entry point; Vite resolves `src/main.tsx` from here
- `src/main.tsx` — mounts `<App>` into `#root` inside `StrictMode`
- `src/App.tsx` — root component; view routing via `View` state (`dashboard | assets | scanner`)
- `src/index.css` — CSS variables and global reset; `src/App.css` — all component styles
- `src/types/index.ts` — all TypeScript types (CMDB types + scanner types)
- `src/data/mockData.ts` — 25 mock CMDB configuration items (no backend needed for CMDB)
- `src/api/scanner.ts` — typed fetch wrappers for the scanner API
- `src/components/ScannerView.tsx` — full scanner UI (scan list, new scan form, results with expandable host rows and CVE cards)

TypeScript uses project references: `tsconfig.app.json` covers `src/` (targets ES2023, bundler module resolution), `tsconfig.node.json` covers `vite.config.ts`. `noUnusedLocals` and `noUnusedParameters` are enforced — unused variables cause build errors.

ESLint is configured with `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`. The `dist/` directory is ignored.
