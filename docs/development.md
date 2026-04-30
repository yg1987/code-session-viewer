# Development guide

> **English** · [简体中文](./development.zh-CN.md)

## Setup

```bash
# Install dependencies
npm install

# If the Electron binary download fails, use a mirror
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

## Scripts

```bash
# Dev mode (HMR)
npm run dev

# Production build
npm run build

# Preview the production build
npm run preview

# Package as an installer
npm run package
```

## Conventions

### File naming
- React components: `PascalCase` (`UserMessage.tsx`)
- Hooks: `camelCase`, prefixed with `use` (`useSettings.ts`)
- Utility modules: `kebab-case` (`session-parser.ts`)

### IPC
1. Define the channel name in `src/shared/constants.ts`
2. Register the handler in `src/main/index.ts`
3. Expose the API in `src/preload/index.ts`
4. Add the type declaration in `src/renderer/types/electron.d.ts`

### Adding a new tool renderer
1. Add a case to `renderToolContent` in `src/renderer/components/conversation/ToolCallBlock.tsx`
2. Implement the renderer (use `BashToolContent`, `EditToolContent`, etc. as references)
3. Add a color entry in `TOOL_COLORS`

### Adding a new highlight language
1. Add the import to `LANG_IMPORTS` in `src/renderer/hooks/useHighlighter.ts`
2. Map the file extension in `EXT_TO_LANG` in `src/renderer/components/conversation/ToolCallBlock.tsx`

### Adding a new setting
1. Add the field to the `AppSettings` interface in `src/renderer/hooks/useSettings.ts`
2. Update `DEFAULT_SETTINGS`
3. Add the UI control in `src/renderer/components/SettingsPanel.tsx`

## Debugging

### Main process
electron-vite emits source maps for the main process in dev mode — set breakpoints in `src/main/` directly.

### Renderer
Use Electron's DevTools (`Ctrl+Shift+I`). Vite HMR works automatically in dev.

### FAQ

**Q: `require("electron")` throws `Cannot find module`**
A: The Electron binary didn't install correctly. Run `node node_modules/electron/install.js`.

**Q: Shiki highlighting isn't working**
A: Check that the `useHighlighter` hook is initialized. Shiki uses the JavaScript RegExp engine — no WASM required.

**Q: Some sessions don't show up in the list**
A: Check whether `sessions-index.json` exists. Without it the app falls back to scanning `.jsonl` files.
