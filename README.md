# Code Session Viewer

> **English** · [简体中文](./README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

> **Forked from** [Lition13/claude-session-viewer](https://github.com/Lition13/claude-session-viewer) — with extended support for **OpenCode** sessions alongside the original Claude Code pipeline.

本项目使用 Claude + DeepSeek + MiMo（为了看截图）实现，目的是熟悉 AI 编程工具的使用，同时也根据自己需要，在原作者的基础上做些修改和扩展。

在 thought process 文件夹里有 1、2、3、4 四个 md 文件，是用本工具导出的对话过程。不知道是连接问题还是什么，每个会话到一定程度就会自动停掉，所以最后开了 4 个会话。第四个会话检查问题耗时很久，起码 40 分钟，比做功能都更耗时。

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

- [PLAN.md](./PLAN.md) — architecture design and implementation notes
- [Architecture](./docs/architecture.md) — process model, JSONL parsing, IPC channels
- [Development](./docs/development.md) — local setup, conventions, debugging
- [Features](./docs/features.md) — detailed feature guide
- [thought process](./thought process/) — exported conversation logs of building this project

## Contributing

Issues and PRs are welcome. This project is a fork of [Lition13/claude-session-viewer](https://github.com/Lition13/claude-session-viewer); original contributions go back upstream.

## License

MIT — see [LICENSE](./LICENSE)
