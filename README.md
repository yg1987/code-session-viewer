# Code Session Viewer

> **English** · [简体中文](./README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

> **Forked from** [Lition13/claude-session-viewer](https://github.com/Lition13/claude-session-viewer) — with extended support for **OpenCode** sessions alongside the original Claude Code pipeline.

This project was built using Claude + DeepSeek + MiMo (for viewing screenshots), with the goal of learning AI coding tools while making modifications and extensions based on personal needs on top of the original author's work.

In the [thought process](./thought process/) directory, there are 4 exported conversation logs (md files). Due to what appears to be connection issues, each session would automatically stop after a certain point, so 4 separate sessions were needed. The fourth session's debugging alone took at least 40 minutes — longer than building the actual features.

An Electron desktop app for browsing, analyzing, and sharing AI coding sessions — supporting **both Claude Code (JSONL)** and **OpenCode (SQLite)** data sources.

> 🔒 **Privacy first** — Everything runs locally. The app only reads files under `~/.claude/` and `~/.local/share/opencode/`. No telemetry, no analytics, no network calls to third parties. The source is open — audit it yourself.

![demo.gif](demo.gif)

## What's different from the original

- **OpenCode support** — reads OpenCode SQLite sessions alongside Claude Code JSONL
- **i18n** — full English / 中文 UI localization with in-app language switch
- **Todo list & Agent Timeline** — OpenCode-specific panels for task tracking and agent/model switching
- **Custom model pricing** — add pricing for non-Claude models (GPT-4o, DeepSeek, etc.)

> 📖 For the full feature list, keyboard shortcuts, tech stack, and project layout, see the [original README](https://github.com/Lition13/claude-session-viewer/blob/main/README.md).

## Quick start

### Requirements
- Node.js >= 18
- npm >= 9

### Build from source

```bash
git clone https://github.com/yg1987/code-session-viewer.git
cd code-session-viewer

npm install
npm run dev
```

### Production build & package

```bash
npm run build
npm run package
```

## Documentation

- [PLAN.md](./PLAN.md) — architecture design and implementation notes (Chinese)
- [thought process](./thought process/) — exported conversation logs of building this project (4 sessions)
- [docs/](./docs/) — original project docs (architecture, development, features) — not yet updated for OpenCode/i18n changes

## Contributing

Issues and PRs are welcome. This project is a fork of [Lition13/claude-session-viewer](https://github.com/Lition13/claude-session-viewer); original contributions go back upstream.

## License

MIT — see [LICENSE](./LICENSE)
