# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Validation**: Zod (`zod/v4`)
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── vps-manager/        # React + Vite file manager frontend (at /)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM (currently unused)
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## File Manager App

A **local file manager** — a browser-based UI to manage files on the server it's deployed on.
No SSH, no remote connections. Reads/writes the local filesystem via Node.js `fs`.

### Features
- **Browse**: Navigate the full filesystem including root (`/`)
- **View**: Read text files with syntax-aware icons; binary files show a "cannot display" notice
- **Edit**: In-browser text editor with save
- **Create**: New files (created empty, then opened for editing) and new directories
- **Delete**: With confirmation dialog; recursive delete for directories
- **Rename**: Rename a file/folder within its parent directory
- **Move**: Move a file or folder to any absolute destination path
- **Terminal**: Run shell commands on the server, with current directory as cwd

### API Endpoints
All endpoints are under `/api`:
- `GET /files/list?path=` — list directory contents (sorted dirs-first)
- `GET /files/read?path=` — read file content (detects binary; max 5MB text)
- `POST /files/write` — write/create file `{ path, content }`
- `DELETE /files/delete?path=&recursive=` — delete file or directory
- `POST /files/mkdir` — create directory (recursive) `{ path }`
- `POST /files/rename` — rename or move `{ oldPath, newPath }`
- `POST /terminal/exec` — execute a shell command `{ command, cwd? }`

### Frontend
Single page React app (`src/pages/file-manager.tsx`). No sidebar or routing beyond `/?path=…`.

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck
- **Project references** — cross-package dependencies are declared in `tsconfig.json`

## Root Scripts

- `pnpm run build` — runs `typecheck` then `build` recursively
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes: `files.ts`, `terminal.ts`, `health.ts`.
Uses `@workspace/api-zod` for validation, Node.js `fs` for filesystem ops.

### `artifacts/vps-manager` (`@workspace/vps-manager`)

React + Vite frontend. Single page file manager with dark theme.
Uses `@workspace/api-client-react` for React Query hooks.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec (`openapi.yaml`) + Orval config.
Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec. Used by `api-server` for validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.
