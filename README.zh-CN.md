# Code Session Viewer

> [English](./README.md) · **简体中文**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

> **Fork 自** [Lition13/claude-session-viewer](https://github.com/Lition13/claude-session-viewer) —— 在原有 Claude Code 管线基础上增加了 **OpenCode** 会话支持。

本项目使用 Claude + DeepSeek + MiMo（为了看截图）实现，目的是熟悉 AI 编程工具的使用，同时也根据自己需要，在原作者的基础上做些修改和扩展。

在 thought process 文件夹里有 1、2、3、4 四个 md 文件，是用本工具导出的对话过程。不知道是连接问题还是什么，每个会话到一定程度就会自动停掉，所以最后开了 4 个会话。第四个会话检查问题耗时很久，起码 40 分钟，比做功能都更耗时。

一个用于浏览、分析和分享 AI 编程会话的 Electron 桌面应用，**同时支持 Claude Code（JSONL）和 OpenCode（SQLite）两种数据源**。

> 🔒 **隐私优先** — 本工具完全在本地运行，只读取 `~/.claude/` 和 `~/.local/share/opencode/` 下的本地文件，不上传任何数据，不接入任何分析/埋点服务。源码开放，可自行审计。

![demo.gif](demo.gif)

## 相对于原版的改动

- **OpenCode 支持** — 读取 OpenCode SQLite 会话，与 Claude Code JSONL 并行
- **国际化 (i18n)** — 完整的 English / 中文 UI 本地化，支持应用内语言切换
- **Todo 列表与 Agent 时间线** — OpenCode 专属面板，用于任务追踪和 agent/模型切换查看
- **自定义模型定价** — 支持添加非 Claude 模型的定价（GPT-4o、DeepSeek 等）

> 📖 完整的功能列表、快捷键、技术栈和项目结构，请参阅[原版 README](https://github.com/Lition13/claude-session-viewer/blob/main/README.md)。

## 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9

### 从源码构建

```bash
git clone https://github.com/yg1987/code-session-viewer.git
cd code-session-viewer

npm install
npm run dev
```

### 生产构建与打包

```bash
npm run build
npm run package
```

## 文档

- [PLAN.md](./PLAN.md) — 架构设计与实现笔记
- [Architecture](./docs/architecture.md) — 进程模型、JSONL 解析、IPC 通道
- [Development](./docs/development.md) — 本地开发环境配置
- [Features](./docs/features.md) — 详细功能说明
- [thought process](./thought process/) — 用本工具导出的构建过程对话记录

## 贡献

欢迎 issue 和 PR！本仓库 fork 自 [Lition13/claude-session-viewer](https://github.com/Lition13/claude-session-viewer)，原作者贡献会向上游回馈。

## License

MIT — 见 [LICENSE](./LICENSE)
