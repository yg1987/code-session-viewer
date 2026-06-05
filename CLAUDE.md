# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

用中文回答所有问题和交流。

## Project

**Code Session Viewer** — An Electron desktop app for browsing, analyzing, and sharing AI coding sessions. Forked from [Lition13/claude-session-viewer](https://github.com/Lition13/claude-session-viewer) with added support for **OpenCode** sessions alongside the original Claude Code sessions.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start in development mode (electron-vite dev)
npm run build        # Type-check and build (electron-vite build)
npm run package      # Build + package as Windows directory (electron-vite build + electron-builder --win --dir)
npm run package:installer  # Build + create Windows installer
```

There are no test scripts — CI only runs `npm run build` (type-check + build).

## Architecture

Electron three-process architecture built with `electron-vite`:

- **Main process** (`src/main/`) — All filesystem I/O and data processing. Two parallel pipelines:
  - **Claude Code pipeline** (original): reads JSONL files from `~/.claude/projects/`
  - **OpenCode pipeline** (new): reads SQLite database from `~/.local/share/opencode/opencode.db`
  - Both pipelines produce identical output types (`ProjectGroup[]`, `SessionEntry[]`, `ParsedMessage[]`), so the UI is fully shared

- **Preload** (`src/preload/index.ts`) — Exposes IPC API to renderer via `contextBridge`. All APIs async (`ipcRenderer.invoke`). Typed as `ElectronAPI` and available as `window.api.*`.

- **Renderer** (`src/renderer/`) — React 19 + TypeScript + Tailwind CSS 4. Never touches filesystem directly — all data via `window.api.*`.

### Key Shared Types

- `src/shared/constants.ts` — All IPC channel names (`IPC_CHANNELS`) and `SessionSource` type (`'claude' | 'opencode'`)
- `src/renderer/types/session.ts` — `SessionEntry`, `ProjectGroup` (shared by both pipelines)
- `src/renderer/types/message.ts` — `ParsedMessage`, `ContentBlock` union (`TextBlock | ThinkingBlock | ToolUseBlock | ImageBlock`)

### Data Flow

Renderer calls `window.api.*` → Preload forwards via IPC → Main process handler → Pipeline module (discovery/parser/etc.) → Returns unified types

### Hooks and State

- `useSessionList` / `useOpenCodeSessionList` — Fetch session lists from respective pipelines
- `useSessionMessages` — Load and parse individual session messages
- `useSettings` — App settings via React Context + localStorage persistence (`AppSettings`)
- `useLocale` — i18n via `useLocale()` hook providing `{ locale, t }`. Translation files: `src/renderer/i18n/en.json` and `zh.json`. Use `t('key')` for translations, `t('key', { param: value })` for templates.

### i18n

All user-visible text should use `useLocale()` hook. The `t()` function looks up keys in the locale JSON, falls back to English, then to the raw key. Watch out for variable name shadowing — loop variable `t` will shadow the translation function.

## Code Conventions

- TypeScript strict mode — avoid `any`
- IPC channel constants only in `src/shared/constants.ts`
- All filesystem access in `src/main/` only — never call `fs` from the renderer
- Component directories: `layout/` (structural), `conversation/` (message rendering), `common/` (reusable)
- Vite alias: `@` maps to `src/renderer/`
- Settings panel stores OpenCode DB path config (persisted via `src/main/settings-store.ts` to `~/.config/opencode-session-viewer/settings.json`)

## Adding IPC Channels

1. Add channel constant to `IPC_CHANNELS` in `src/shared/constants.ts`
2. Add handler in `src/main/index.ts`
3. Add method to preload API in `src/preload/index.ts`
4. Update `ElectronAPI` type (auto-inferred from typeof api)
