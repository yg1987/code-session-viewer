# 架构设计

> [English](./architecture.md) · **简体中文**

## 概述

Claude Session Viewer 采用 Electron 三进程架构（Main + Preload + Renderer），使用 electron-vite 构建。

## 进程职责

### Main Process（Node.js）
负责所有文件 I/O 和数据处理：
- **会话发现**：扫描 `~/.claude/projects/` 目录，读取 `sessions-index.json` 和 JSONL 文件元数据
- **JSONL 解析**：流式读取、消息合并、工具配对、对话排序
- **数据分析**：全局统计、会话健康度评估、低效模式检测
- **文件操作**：导出 HTML/Markdown、删除会话、跨会话搜索

### Preload（Bridge）
通过 `contextBridge` 暴露安全的 IPC API 给渲染进程。所有 API 都是异步的（`ipcRenderer.invoke`）。

### Renderer Process（React）
纯 UI 渲染，不直接访问文件系统：
- 通过 `window.api.*` 调用主进程功能
- 使用 React Context 管理全局状态（Settings、CollapseControl）
- 使用 React.memo 优化消息组件重渲染
- 渐进式渲染（先 20 条，滚动加载更多）

## JSONL 解析核心算法

### 消息合并
Claude Code 将一个 API 响应拆成多行 JSONL，每行有相同的 `message.id` 但不同的 `uuid`：
1. 按 `message.id` 分组
2. 通过 `parentUuid` 链确定每组内的顺序
3. 合并所有 `content[]` 数组为一个完整消息
4. 从任意条目取 `usage`（同一 message.id 的所有条目 usage 相同）

### 工具配对
`tool_use` 块（在 assistant 消息中）通过 `tool_use_id` 与 `tool_result`（在后续 user 消息中）配对。

### 对话排序
所有消息通过 `parentUuid` 形成链表，从根节点（`parentUuid === null`）遍历构建有序数组。

### 斜杠命令输出
Claude Code 的斜杠命令（如 `/cost`、`/context`）在 JSONL 中由两类记录组成：

1. `type:"user"`、`message.content` 含 `<command-name>/xxx</command-name>` 三元组（命令本身）
2. `type:"system", subtype:"local_command"`、顶层 `content` 字段为 `<local-command-stdout>...</local-command-stdout>`（命令输出，`parentUuid` 指向上面的 user 消息）

解析器把 `local_command` 记录按 `parentUuid` 挂回对应的 user 消息上，渲染层据此合并显示。

## IPC 通道

| 通道 | 方向 | 说明 |
|------|------|------|
| `sessions:list` | R→M | 获取所有会话列表 |
| `session:load` | R→M | 解析会话 JSONL |
| `session:load-raw` | R→M | 获取原始 JSON 数据 |
| `session:export` | R→M | 导出 HTML |
| `session:export-md` | R→M | 导出 Markdown |
| `session:delete` | R→M | 删除会话 |
| `session:insights` | R→M | 智能分析 |
| `stats:global` | R→M | 全局统计 |
| `search:cross-session` | R→M | 跨会话搜索 |
| `subagents:list` | R→M | 列出子 Agent |
| `subagent:load` | R→M | 加载子 Agent 会话 |
| `session:model-usage` | R→M | 按模型聚合 token 用量（主会话 + subagents） |
| `sessions:changed` | M→R | 文件变更通知 |

## 性能优化

1. **渐进式渲染** — 初始只渲染 20 条消息，滚动到底部自动加载更多
2. **React.memo** — UserMessage 和 AssistantMessage 防止不必要重渲染
3. **Shiki 按需加载** — 语言语法文件在首次使用时才加载
4. **流式 JSONL 读取** — 使用 `readline` 逐行读取，不一次性加载整个文件到内存
5. **文件监听防抖** — 2 秒防抖避免频繁刷新
6. **message.id 去重** — 全局统计中按 message.id 取最后一条（last-write-wins），避免重复计算或漏计 token

## Token 统计说明

Session Viewer 的 token 统计基于 JSONL 文件中记录的 `message.usage` 字段。聚合规则：

1. **last-write-wins per message.id** — 同一个 `message.id` 在 JSONL 里可能写多行（assistant 同时输出 text 和 tool_use 时，每个 content block 单独落盘），每行的 usage 是该消息**到当前块为止的累积值**，最后一行才是完整总数。**取最后一条**才是正确做法。
2. **聚合主会话 + subagents** — 单会话视图的统计读 `{sessionId}.jsonl` 加上 `{sessionId}/subagents/*.jsonl`，全局 dashboard 也包含 subagent 数据（不重复计入会话数）。
3. **按 model 分组** — 不同模型独立累加，UI 显示每个模型的费用拆分。

**与 `/cost` 命令的差异**：Session Viewer 与 Claude Code 的 `/cost` 通常**主模型对话部分能精确对上**（input、output、cache read/write），但仍可能出现差异，原因：

- `/cost` 累加的是**进程运行时内存里的所有 API 调用**（`addToTotalSessionCost`），包含 advisor 调用（如 auto-mode classifier、压缩摘要、自动命名等走 haiku 的辅助计算）。这些请求**不会写进会话 JSONL**，因此 Session Viewer 看不到。
- 这就是为什么有时 `/cost` 会列出 `claude-haiku-4-5` 一行而 Session Viewer 不显示，或者 opus output 有少量差额（advisor 也可能借用主模型）。
- `/cost` 是 per-process 的：`--resume` 会话时 `/cost` 只看本进程的新增调用，JSONL 累计了所有历史。
- 取消/重试的请求两边可能不一致。

界面上已标注 "may differ from /cost"。两个数都基于真实数据，**JSONL 是会话内容的权威记录，/cost 是当前进程的运行时账单**，互为补充。
