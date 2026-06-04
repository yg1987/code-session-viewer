# 方案：在 Claude Session Viewer 基础上增加 OpenCode 支持

## 背景

用户已安装 OpenCode，其会话数据存储在 SQLite 数据库 `opencode.db` 中（位于 `~/.local/share/opencode/` 或类似位置）。希望在 [claude-session-viewer](https://github.com/Lition13/claude-session-viewer) 项目中增加对 OpenCode 会话的可视化浏览功能，同时不能破坏原有的 Claude Code 会话浏览功能。

## 核心原则

- **不破坏原有功能**：所有现有的 Claude Code 相关代码文件完全不动
- **并行双管线**：Claude Code 数据走原有解析管线，OpenCode 走新建的 SQLite 解析管线
- **统一输出类型**：两边都产出相同的 `SessionEntry[]`、`ProjectGroup[]`、`ParsedMessage[]` 类型，UI 层完全复用，不用改
- **自动检测路径**：OpenCode 数据库位置不硬编码，按平台自动检测，也可在设置中手动指定

## 架构图

```
                    ┌──────────────────────────────────┐
                    │        Renderer (React UI)         │
                    │  Sidebar / ConversationView 等组件  │
                    └────────────┬─────────────────────┘
                                 │ IPC（复用现有通道 + 新增通道）
                    ┌────────────┴─────────────────────┐
                    │       Preload (API 桥接层)         │
                    └────────────┬─────────────────────┘
                                 │
            ┌────────────────────┼──────────────────────────┐
            │                                              │
   ┌────────┴────────┐                         ┌───────────┴───────────────┐
   │  Claude 管线     │                         │  OpenCode 管线 (NEW)      │
   │  (完全不修改)     │                         │                           │
   │                  │                         │ opencode-discovery.ts     │
   │ session-discovery│                         │ opencode-parser.ts        │
   │ session-parser   │                         │ opencode-db.ts            │
   │ session-delete   │                         │ opencode-delete.ts        │
   │ cross-search     │                         │ opencode-cross-search.ts  │
   │ global-stats     │                         │ opencode-global-stats.ts  │
   │ ...              │                         │                           │
   └────────┬─────────┘                         └─────────────┬─────────────┘
            │                                                  │
            │           统一产出:                                │
            │     ProjectGroup[] / SessionEntry[]               │
            │     ParsedMessage[]                               │
            └────────────────┬─────────────────────────────────┘
                             │
                      ┌──────┴────────┐
                      │  IPC Router   │
                      │ (main/index)  │
                      └───────────────┘
```

## 实现步骤

### 第一步：扩展类型定义

**文件：`src/shared/constants.ts`** — 新增源代码类型和新 IPC 通道
- 新增 `SessionSource = 'claude' | 'opencode'` 类型
- 新增 OpenCode 相关的 IPC 通道常量

**文件：`src/renderer/types/session.ts`** — 扩展已有接口
- `ProjectGroup` 和 `SessionEntry` 都加上 `source` 字段
- `SessionEntry` 增加可选字段：`dbPath`（opencode.db 路径）、`agent`、`model`、`cost`、`tokensInput`、`tokensOutput`、`tokensReasoning`

### 第二步：新建 OpenCode 数据访问层

**文件：`src/main/opencode-db.ts`**（新建）— 数据库访问
- 使用 `better-sqlite3`（唯一新增依赖）访问 SQLite
- 自动检测 `opencode.db` 路径函数 `detectOpenCodeDbPath()`，按顺序查找：
  1. `~/.local/share/opencode/opencode.db`（XDG 规范，Linux / Git-Bash on Windows）
  2. `~/AppData/Local/opencode/opencode.db`（原生 Windows）
  3. `~/Library/Application Support/opencode/opencode.db`（macOS）
- 支持单例连接、关闭连接

**文件：`src/main/opencode-discovery.ts`**（新建）— 会话列表
- `discoverOpenCodeSessions(dbPath: string): ProjectGroup[]`
- 从 `session` 表 JOIN `project` 表查出所有会话，按项目分组
- 映射到 `ProjectGroup` / `SessionEntry` 类型，`source` 设为 `'opencode'`
- `fullPath` 设为虚拟标识 `opencode://{dbPath}/{sessionId}`，后续用于区分来源
- `isSidechain` ← `session.parent_id IS NOT NULL`

**文件：`src/main/opencode-parser.ts`**（新建）— 消息解析
- `parseOpenCodeSession(dbPath: string, sessionId: string): ParsedMessage[]`
- 查询 `message` + `part` 表，按 `time_created` 排序
- OpenCode 的 8 种 part 类型 → 统一 `ContentBlock` 映射：

| OpenCode part 类型 | ContentBlock 映射 |
|---|---|
| `text` | `{ type: 'text', text }` |
| `reasoning` | `{ type: 'thinking', thinking }` |
| `tool` | `{ type: 'tool_use', id: callID, name: tool, input: state.input, result: {...} }` |
| `step-start` | 跳过（仅边界标记） |
| `step-finish` | 提取 tokens/cost 作为消息的 tokenUsage |
| `patch` | 转为文本块，记载 diff 摘要 |
| `file` | 转为文本块，注明文件附件 |
| `compaction` | 转为文本块，标注上下文压缩事件 |

- 按 `parentID` 树组装消息链（user message → 所有 assistant children 按时间排序）
- 从 `message.data.tokens` 和 `step-finish` parts 提取 token 用量

**文件：`src/main/opencode-delete.ts`**（新建）— 删除会话
- `deleteOpenCodeSession(dbPath, sessionId)`
- 通过 SQLite CASCADE 删除会话及关联的 messages, parts

**文件：`src/main/opencode-cross-search.ts`**（新建）— 跨会话搜索
- `openCodeCrossSearch(dbPath, query)`
- 在 message/part 文本内容中全文搜索

**文件：`src/main/opencode-global-stats.ts`**（新建）— 全局统计
- `openCodeGlobalStats(dbPath)`
- 直接从 `session` 表聚合 tokens/cost 等统计

### 第三步：新增 IPC 处理器（main/index.ts）

**文件：`src/main/index.ts`**（修改 — 只新增，不改原有代码）

新增以下 IPC handler：
```
OPENCODE_SESSIONS_LIST  → discoverOpenCodeSessions(dbPath)
OPENCODE_SESSION_LOAD   → parseOpenCodeSession(dbPath, sessionId)
OPENCODE_DETECT_DB      → detectOpenCodeDbPath()
OPENCODE_SESSION_DELETE → deleteOpenCodeSession(dbPath, sessionId)
OPENCODE_CROSS_SEARCH   → openCodeCrossSearch(dbPath, query)
OPENCODE_GLOBAL_STATS   → openCodeGlobalStats(dbPath)
```

原有的 Claude Code IPC handler 保持完全不变。

### 第四步：新增设置持久化（主进程）

**文件：`src/main/settings-store.ts`**（新建）
- 简单的 JSON 文件读写，存储位置 `~/.config/opencode-session-viewer/settings.json`
- 存储用户自定义的 OpenCode DB 路径（覆盖自动检测）
- 读写方法：`loadSettings()` / `saveSettings()`

### 第五步：更新 Preload 桥接层

**文件：`src/preload/index.ts`**（修改 — 只新增方法）
- 新增 API 方法暴露给渲染进程：
  - `getOpenCodeSessions(dbPath?)`
  - `loadOpenCodeSession(dbPath, sessionId)`
  - `detectOpenCodeDb()`
  - `deleteOpenCodeSession(dbPath, sessionId)`
  - `getSettings()` / `setSettings(settings)`
- 原有的 Claude API 方法全部保留

### 第六步：侧边栏增加数据源切换

**文件：`src/renderer/components/layout/Sidebar.tsx`**（修改）

在侧边栏顶部原 "Claude Sessions" 标题位置，改为两个 Tab 切换：
```tsx
// 示例效果
┌──────────┬──────────┐
│  Claude  │ OpenCode │
│  (23)    │  (29)    │
├──────────┴──────────┤
│  搜索框              │
│  会话列表...          │
```

- 新增 `source` state，默认为 `'claude'`（不破坏现有体验）
- `source === 'claude'` → 使用现有的 `useSessionList` hook（不变）
- `source === 'opencode'` → 使用新建的 `useOpenCodeSessionList` hook
- 两边产出相同的 `ProjectGroup[]`，用同一个列表组件渲染

**文件：`src/renderer/hooks/useOpenCodeSessionList.ts`**（新建）
- 结构与 `useSessionList` 一致
- 首次加载时调用 `window.api.detectOpenCodeDb()` 自动检测 DB
- 调用 `window.api.getOpenCodeSessions(dbPath)` 获取会话列表

### 第七步：App.tsx 路由到正确管线

**文件：`src/renderer/App.tsx`**（修改）

- 跟踪 `source` 状态和 `selectedSession`
- 根据 `source` 决定调用哪个加载方法：
  - `source === 'opencode'` → `window.api.loadOpenCodeSession(session.dbPath, session.sessionId)`
  - `source === 'claude'` → `window.api.loadSession(filePath)`（不变）
- 将 `source` 传递给 Sidebar 和 ConversationView

### 第八步：ConversationView 做来源适配

**文件：`src/renderer/components/conversation/ConversationView.tsx`**（修改）
- 接受 `source` prop
- 当 `source === 'opencode'` 时：
  - 隐藏 "Open in Claude Code" 按钮
  - Stats 标签页展示 OpenCode 特有的字段（cost、reasoning tokens）
  - 显示 agent/model 切换时间线

### 第九步：设置面板增加 OpenCode 配置

**文件：`src/renderer/components/SettingsPanel.tsx`**（修改）
- 新增 "OpenCode" 设置区域：
  - 显示自动检测到的 DB 路径（只读）
  - "自定义路径" 输入框，手动指定 `opencode.db` 位置
  - "重新检测" 按钮

### 第十步：OpenCode 专属 UI 组件（可选增强）

**文件：`src/renderer/components/conversation/TodoPanel.tsx`**（新建）
- 展示会话的 Todo 列表（来源 `todo` 表）
- 显示状态标签：pending / in_progress / completed

**文件：`src/renderer/components/conversation/AgentTimeline.tsx`**（新建）
- 渲染 agent/model 切换事件时间线
- 可选内联在消息之间显示或作为独立面板

### 第十一步：新增依赖

在 `package.json` 中新增：
```json
"better-sqlite3": "^11.0.0"
```

这是唯一新增的依赖。其他所有依赖（React、Tailwind、Shiki、Electron 等）保持不变。

## 不修改的文件清单（确保 Claude 功能完整保留）

以下文件**完全不动**：
- `src/main/session-discovery.ts`
- `src/main/session-parser.ts`
- `src/main/session-delete.ts`
- `src/main/cross-search.ts`
- `src/main/global-stats.ts`
- `src/main/session-insights.ts`
- `src/main/html-exporter.ts`
- `src/main/md-exporter.ts`
- 所有 renderer 对话组件（AssistantMessage、ThinkingBlock、ToolCallBlock、MarkdownRenderer 等）

## 验证方法

1. 启动应用 — 侧边栏默认显示 "Claude" 标签，原有会话正常浏览（回归验证）
2. 切换到 "OpenCode" 标签 — 自动检测 `~/.local/share/opencode/opencode.db`，显示会话列表
3. 点击 OpenCode 会话 — 消息正常渲染，包括文本、reasoning 块、工具调用
4. Stats 标签页显示 token/cost 数据
5. 导出功能对两种来源的会话都能正常工作
6. 如果 OpenCode DB 未找到，OpenCode 标签页显示 "未找到 OpenCode 数据库" 提示，并引导到设置页面
7. 在设置中可以手动指定 OpenCode DB 路径（适配不同安装位置）

---

## 后续：国际化 (i18n) 支持

### 概述

在双数据源功能完成后，增加了完整的 UI 国际化支持，支持 English 和中文两种语言，可在设置面板中实时切换。

### 架构

- **翻译文件**：`src/renderer/i18n/en.json` 和 `src/renderer/i18n/zh.json`
- **查找逻辑**：`src/renderer/i18n/translations.ts` — 按 key 查找，fallback 到英文，最终 fallback 到原始 key
- **React Hook**：`src/renderer/hooks/useLocale.ts` — 提供 `{ locale, t }` ，`t` 支持 `{{param}}` 模板替换
- **持久化**：语言设置存储在 `localStorage`（`AppSettings.locale` 字段），跟随其他设置一起保存

### 关键文件

| 文件 | 说明 |
|---|---|
| `src/renderer/i18n/en.json` | 英文翻译（~390 keys） |
| `src/renderer/i18n/zh.json` | 中文翻译 |
| `src/renderer/i18n/translations.ts` | 查找 + fallback 逻辑 |
| `src/renderer/hooks/useLocale.ts` | React hook |
| `src/renderer/hooks/useSettings.ts` | `AppSettings` 含 `locale` 字段 |

### 常见陷阱（踩过的坑）

1. **独立函数中直接调用 `t()`**：`groupSessionsByDate()`、`ToolResultDisplay` 等非组件函数无法访问闭包中的 `t`，需要通过参数传入或在函数内调用 `useLocale()`
2. **变量名遮蔽**：循环变量名 `t` 会遮蔽 `t()` 翻译函数，导致运行时找不到函数（如 `SettingsPanel.tsx` 中 `map((t) => ...)` 的 `t` 遮蔽了 `t()`）
3. **子组件缺少 `useLocale()` 调用**：`ImageDisplay`、`TaskRow`、`TeammateRow` 等子组件直接使用 `t()` 但未声明，需要在组件内部调用 `useLocale()`
