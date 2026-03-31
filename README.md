# XCASPER MANAGER

[![License: MIT](https://img.shields.io/badge/License-MIT-6e5cff.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5-lightgrey.svg)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)

**A self-hosted, browser-based VPS file manager and control panel** — part of the [xcasper.space](https://xcasper.space) brand family by [TRABY CASPER](https://github.com/Casper-Tech-ke).

No SaaS. No subscriptions. No telemetry. Deploy it on your own server, secure it with your own API key, and manage your filesystem from anywhere.

---

## Screenshot

![XCASPER MANAGER — System Dashboard](docs/screenshot-dashboard.png)

> Screenshot placeholder — replace with an actual capture once deployed.

---

## Features

| Category | Capability |
|---|---|
| **File Management** | Browse, create, edit, rename, move, delete files and directories (including `/root`) |
| **File Viewer** | Images, video, audio, syntax-highlighted code, plain text — auto-detected by extension |
| **Terminal** | In-browser shell with persistent working directory (`cd` across commands) |
| **System Dashboard** | Real-time CPU (with model), memory (used/free/total), disk, network stats and uptime |
| **Search** | Search filename filter from the home page or directly via `?search=` URL param |
| **Clear Cache** | `sync` + drop Linux page cache (root) or sync-only (non-root) with accurate feedback |
| **Authentication** | API-key login; Bearer token auto-injected into all requests via `sessionStorage` |
| **Welcome Modal** | First-login Terms & Conditions + Buy-a-Coffee prompt |
| **Dev Page** | Developer bio, live GitHub repo card (stars/forks), fork walkthrough, support links |
| **Theming** | Dark xcasper.space theme — purple `#6e5cff`, cyan `#0ff4c6`, bg `#08090d` |

---

## Quick Start

### Requirements

- Node.js 20+ (tested on 24)
- pnpm 9+

### 1. Clone the repository

```bash
git clone https://github.com/Casper-Tech-ke/vps-manager.git
cd vps-manager
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set your API key

```bash
export API_KEY=your-secret-key-here
```

This is the key you will enter on the login screen. Keep it secret.

### 4. Start development servers

```bash
# API server (port 8080 by default)
pnpm --filter @workspace/api-server run dev &

# Frontend (port 5173 by default, or $PORT)
pnpm --filter @workspace/vps-manager run dev
```

Open your browser at `http://localhost:5173` and sign in with your API key.

### 5. Production build

```bash
pnpm run build
NODE_ENV=production API_KEY="your-key" node artifacts/api-server/dist/index.mjs
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, TanStack Query, Wouter, Tailwind CSS, shadcn/ui |
| **Backend** | Express 5, TypeScript, esbuild (CJS bundle) |
| **Validation** | Zod v4 (generated from OpenAPI spec via Orval) |
| **Monorepo** | pnpm workspaces |
| **Fonts** | Inter (UI), Fira Code (mono) |

---

## Project Structure

```
vps-manager/
├── artifacts/
│   ├── api-server/      # Express 5 REST API
│   └── vps-manager/     # React + Vite frontend (XCASPER MANAGER UI)
├── lib/
│   ├── api-spec/        # OpenAPI 3.1 spec + Orval codegen config
│   ├── api-client-react/# Generated React Query hooks
│   └── api-zod/         # Generated Zod schemas
├── scripts/             # Utility scripts (favicon generation, etc.)
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
└── SECURITY.md
```

---

## API Reference

All endpoints are prefixed with `/api` and require a `Bearer <API_KEY>` header (except `/api/auth/verify` and `/api/healthz`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/verify` | Validate API key |
| `POST` | `/auth/logout` | Clear session |
| `GET` | `/system/info` | CPU, memory, disk, network, uptime |
| `POST` | `/system/clear-cache` | sync + drop page cache |
| `GET` | `/files/list?path=` | List directory contents |
| `GET` | `/files/read?path=` | Read file content (JSON, max 5 MB text) |
| `GET` | `/files/raw?path=` | Stream raw file bytes (for media) |
| `POST` | `/files/write` | Write or create a file |
| `DELETE` | `/files/delete?path=&recursive=` | Delete file or directory |
| `POST` | `/files/mkdir` | Create directory (recursive) |
| `POST` | `/files/rename` | Rename or move |
| `POST` | `/terminal/exec` | Execute a shell command |

---

## Links

- **Dev page**: `/dev` in the app (developer bio, fork guide, support)
- **Support**: [support.xcasper.space](https://support.xcasper.space)
- **Buy Me a Coffee**: [payments.xcasper.space](https://payments.xcasper.space)
- **GitHub**: [github.com/Casper-Tech-ke](https://github.com/Casper-Tech-ke)
- **Telegram**: [t.me/casper_tech_ke](https://t.me/casper_tech_ke)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the fork workflow, branch naming conventions, and PR checklist.

## Security

See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

## License

[MIT](LICENSE) — Copyright 2025 TRABY CASPER / Casper-Tech-ke
