# Code Session Viewer

> [English](./README.md) · **简体中文**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

> **Fork 自** [Lition13/claude-session-viewer](https://github.com/Lition13/claude-session-viewer) —— 在原有 Claude Code 管线基础上增加了 **OpenCode** 会话支持。

一个用于浏览、分析和分享 AI 编程会话的 Electron 桌面应用，**同时支持 Claude Code（JSONL）和 OpenCode（SQLite）两种数据源**。

Claude Code 的 `/export` 只能导出纯文本，无法直观查看对话过程（思考链、工具调用、代码变更等）。本工具直接读取 JSONL 或 SQLite 会话文件，以美观、可交互的界面展示完整对话内容。

> 🔒 **隐私优先** — 本工具完全在本地运行，只读取 `~/.claude/` 和 `~/.local/share/opencode/` 下的本地文件，不上传任何数据，不接入任何分析/埋点服务。源码开放，可自行审计。

![demo.gif](demo.gif)

## 功能特性

### 双数据源
- **Claude Code 管线** — 读取 `~/.claude/projects/` 下的 JSONL 会话
- **OpenCode 管线** — 读取 `opencode.db` SQLite 数据库（自动检测位置）
- **一键切换** — 侧边栏顶部切换数据源，并显示各自会话数量

### 核心功能
- **会话浏览** — 自动扫描所有会话，按项目分组、日期分组显示
- **对话渲染** — 完整展示用户消息、助手回复、思考过程（可折叠）、工具调用及结果
- **语法高亮** — 基于 Shiki 的代码高亮，支持 30+ 种语言，自动根据文件扩展名识别
- **工具专用渲染** — Edit（diff 对比）、Read（代码高亮）、Write（创建文件）、Bash（命令+输出）、Grep/Glob（搜索结果）等
- **子 Agent 查看** — 展示 subagent 会话完整内容
- **会话回放** — 像播放幻灯片一样逐条回放对话，支持暂停/加速/跳转

### OpenCode 专属功能
- **Todo 列表** — 查看会话的待办事项（pending / in_progress / completed），显示对应状态徽章
- **Agent / Model 时间线** — 垂直时间线展示会话中 agent 和模型的切换事件
- **会话元数据** — 在头部展示费用、Token 用量、agent 和模型等信息

### 数据分析
- **会话统计** — Token 用量（Input/Output/Cache Read/Cache Write）、工具使用排行、费用估算
- **全局仪表盘** — 跨所有会话的汇总统计、每日趋势图、总费用（两种数据源都支持）
- **智能洞察** — 会话健康度评分、低效模式检测（重复调用/循环修复/空结果/过度读取）
- **Token 趋势图** — 按时间轴展示每轮对话的 token 消耗

### 导出与分享
- **HTML 导出** — 生成自包含的独立 HTML 文件，可在任何浏览器中离线查看
- **Markdown 导出** — 生成 Markdown 文件，方便在 GitHub 等平台分享
- **Raw JSON 视图** — 查看源 JSONL 文件格式化后的 JSON 数据

### 管理功能
- **删除会话** — Claude 会话完整清理所有关联文件；OpenCode 会话通过 SQLite 级联删除
- **在 Claude Code 中打开** — 一键在终端恢复 Claude 会话（`claude --resume`）
- **批量删除** — 勾选多个会话一键删除
- **跨会话搜索** — 在所有会话中搜索关键词（两种数据源皆可）
- **文件监听** — 自动检测新会话并刷新列表

### 个性化
- **三种主题** — 深色、浅色、Sepia（纸质），针对长时间阅读优化
- **自定义标题栏** — 无边框窗口，内置控制按钮
- **自定义字体** — 支持 6 种字体和字号调整
- **模型定价配置** — 内置 Claude Opus/Sonnet/Haiku 定价，支持添加自定义模型（GPT-4o、DeepSeek 等）

### 国际化 (i18n)
- **English / 中文** — 完整 UI 本地化，支持应用内语言切换
- **语言感知格式化** — 相对时间戳（如"3 小时前"）跟随所选语言

## 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9

### 通过 npm 运行（无需克隆）

```bash
npx claude-session-browser
```

首次运行会下载 Electron（约 100 MB）并缓存，之后启动即开即用。

### 从源码构建

```bash
# 克隆项目
git clone https://github.com/yg1987/code-session-viewer.git
cd code-session-viewer

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 生产构建
npm run build

# 打包为可分发的安装程序
npm run package
```

## 快捷键

| 快捷键                  | 功能                          |
| ----------------------- | ----------------------------- |
| `Ctrl+F`                | 当前会话内搜索                |
| `Ctrl+Shift+F`          | 跨会话全局搜索                |
| `Ctrl+D`                | 全局统计仪表盘                |
| `Ctrl+E`                | 导出 HTML                     |
| `Ctrl+O`                | 在 Claude Code 中打开当前会话 |
| `Alt+↑/↓`               | 切换上/下一个会话             |
| `Enter` / `Shift+Enter` | 搜索时跳转下/上一个匹配       |

### 回放模式快捷键

| 快捷键        | 功能                 |
| ------------- | -------------------- |
| `Space` / `K` | 播放/暂停            |
| `→` / `L`     | 下一条消息           |
| `←` / `J`     | 上一条消息           |
| `Shift+→`     | 跳到下一条 User 消息 |
| `Shift+←`     | 跳到上一条 User 消息 |
| `Esc`         | 退出回放             |

## 技术栈

- **Electron** + **electron-vite** — 跨平台桌面应用
- **React 19** + **TypeScript** — 前端 UI
- **Tailwind CSS v4** — 样式
- **sql.js** — SQLite WASM 引擎，用于 OpenCode 集成
- **Shiki** — 语法高亮（JavaScript 引擎，无 WASM 依赖）
- **react-markdown** + **remark-gfm** — Markdown 渲染
- **marked** — HTML 导出时的 Markdown 转换
- **date-fns** — 日期格式化

## 项目结构

```
src/
├── main/                          # Electron 主进程
│   ├── index.ts                   # 窗口创建、IPC 注册
│   ├── session-discovery.ts       # Claude 会话发现
│   ├── session-parser.ts          # JSONL 解析
│   ├── session-delete.ts          # Claude 会话删除
│   ├── cross-search.ts            # Claude 跨会话搜索
│   ├── global-stats.ts            # Claude 全局统计
│   ├── session-insights.ts        # 智能分析
│   ├── html-exporter.ts           # HTML 导出
│   ├── md-exporter.ts             # Markdown 导出
│   ├── opencode-db.ts             # SQLite 连接管理（OpenCode）
│   ├── opencode-discovery.ts      # OpenCode 会话发现
│   ├── opencode-parser.ts         # OpenCode 消息解析 + Todos
│   ├── opencode-delete.ts         # OpenCode 会话删除
│   ├── opencode-cross-search.ts   # OpenCode 跨会话搜索
│   ├── opencode-global-stats.ts   # OpenCode 全局统计
│   └── settings-store.ts          # 持久化设置
├── preload/
│   └── index.ts                   # contextBridge API
├── renderer/
│   ├── App.tsx                    # 主布局、双数据源路由
│   ├── hooks/                     # 自定义 hooks
│   └── components/                # UI 组件
└── shared/
    └── constants.ts               # IPC 通道常量 + SessionSource 类型
```

## 数据说明

本工具只读取 `~/.claude/` 和 `opencode.db` 下的本地文件，不会上传任何数据。

### Claude Code 会话
| 位置                         | 说明                    |
| ---------------------------- | ----------------------- |
| `projects/<proj>/<id>.jsonl` | 主会话文件              |
| `projects/<proj>/<id>/`      | 子 Agent + tool-results |
| `file-history/<id>/`         | 文件版本快照            |
| `telemetry/*.<id>.*.json`    | 遥测事件                |
| `tasks/<id>/`                | 任务文件                |
| `sessions-index.json`        | 移除该条目              |

### OpenCode 会话
| 位置                            | 适用系统         |
| ------------------------------- | ---------------- |
| `~/.local/share/opencode/`      | Linux / Git-Bash |
| `~/AppData/Local/opencode/`     | Windows          |
| `~/Library/Application Support/`| macOS            |

## 贡献

欢迎 issue 和 PR！本仓库 fork 自 [Lition13/claude-session-viewer](https://github.com/Lition13/claude-session-viewer)，原作者贡献会向上游回馈。

## License

MIT — 见 [LICENSE](./LICENSE)
