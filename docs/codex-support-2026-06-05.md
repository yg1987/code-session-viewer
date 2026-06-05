# 方案：在 Code Session Viewer 基础上增加 Codex CLI 支持

**日期：** 2026-06-05

## 背景

当前应用已支持 **Claude Code**（JSONL 文件系统）和 **OpenCode**（SQLite）两种会话来源。用户要求在此基础上增加 **Codex CLI**（OpenAI 的 CLI 工具）的会话浏览支持。Codex CLI 使用 JSONL 格式的 rollout 文件存储会话于 `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`。

## 核心原则

- **不破坏原有功能**：所有现有的 Claude Code 和 OpenCode 代码完全不动
- **平行三管线**：Claude Code 走原有 JSONL 管线，OpenCode 走 SQLite 管线，Codex 走新建的 JSONL 事件流管线
- **统一输出类型**：三条管线产出相同的 `SessionEntry[]`、`ProjectGroup[]`、`ParsedMessage[]` 类型，UI 层完全复用
- **自动检测路径**：Codex 主目录默认 `~/.codex/`，支持 `$CODEX_HOME` 环境变量覆盖，也可在设置中手动指定

## 架构图

```
                    ┌──────────────────────────────────────────┐
                    │          Renderer (React UI)              │
                    │  Sidebar / ConversationView 等组件        │
                    │  三标签切换: Claude | OpenCode | Codex    │
                    └────────────┬─────────────────────────────┘
                                 │ IPC
                    ┌────────────┴─────────────────────────────┐
                    │       Preload (API 桥接层)                │
                    └────────────┬─────────────────────────────┘
                                 │
      ┌────────────────┬────────┴────────┬──────────────────────────┐
      │                │                 │                          │
┌─────┴──────┐  ┌──────┴───────┐  ┌─────┴──────────┐
│ Claude 管线 │  │ OpenCode 管线 │  │ Codex 管线(NEW)│
│ (不修改)    │  │ (不修改)      │  │                │
│            │  │              │  │ codex-db.ts    │
│            │  │              │  │ codex-discovery │
│            │  │              │  │ codex-parser   │
│            │  │              │  │ codex-delete   │
└─────┬──────┘  └──────┬───────┘  └───────┬─────────┘
      │                │                  │
      └────────────────┴──────────────────┘
                       │
           统一产出: ProjectGroup[] / SessionEntry[] / ParsedMessage[]
                       │
                ┌──────┴────────┐
                │  IPC Router   │
                │ (main/index)  │
                └───────────────┘
```

## Codex JSONL 格式说明

Codex 的 rollout 文件是事件流 JSONL，与 Claude Code 的 JSONL 格式不同：

**第一行（session_meta）：**
```json
{"type":"session_meta","id":"<uuid>","cwd":"/path","model_provider":"gpt-5-codex","cli_version":"0.x.y","timestamp":"2025-04-10T12:00:00Z"}
```

**后续行（事件流）：**
```
格式A: {"timestamp":"...","item":{ event }}
格式B: {"type":"event_msg", ...}
```

**事件类型 → ContentBlock 映射：**

| Codex 事件 | ContentBlock / ParsedMessage |
|---|---|
| `event_msg.user_message.text` | `{ role: 'user', text }` → ParsedMessage |
| `event_msg.agent_message.text` | `{ role: 'assistant', text }` → ParsedMessage |
| `response_item.message.content[].type:'text'` | `{ type: 'text', text }` |
| `response_item.function_call` | `{ type: 'tool_use', id, name, input }` |
| `response_item.function_call_output` | 匹配到前一个 function_call，附上 result |
| `compacted` | `{ type: 'text', text: '[上下文压缩...]' }` |
| `event_msg.token_count` | 提取 token 用量，关联到最近消息 |
| `turn_context` | 跳过（元数据） |

## 实现步骤

### Step 1: 扩展类型定义

**文件：** `src/shared/constants.ts` — 修改
- `SessionSource` 从 `'claude' | 'opencode'` 改为 `'claude' | 'opencode' | 'codex'`
- 新增 Codex IPC 通道常量：
  - `CODEX_DETECT_HOME: 'codex:detect-home'`
  - `CODEX_SESSIONS_LIST: 'codex:sessions-list'`
  - `CODEX_SESSION_LOAD: 'codex:session-load'`
  - `CODEX_SESSION_DELETE: 'codex:session-delete'`

### Step 2: 新建 Codex 数据访问层

**文件：** `src/main/codex-db.ts`（新建）— 主目录检测
- 检查 `CODEX_HOME` 环境变量（优先）
- 回退到 `path.join(os.homedir(), '.codex')`
- 返回路径（即使目录不存在）

**文件：** `src/main/codex-discovery.ts`（新建）— 会话发现
- 遍历 `<codexHome>/sessions/YYYY/MM/DD/` 目录树
- 读取每个 `rollout-*.jsonl` 的第一行（`session_meta`）
- 按 `cwd` 字段分组（Codex 没有项目概念）
- 映射到 `SessionEntry`，`source` 设为 `'codex'`
- 高效读取：每文件仅读第一行 + fs.stat

**文件：** `src/main/codex-parser.ts`（新建）— 消息解析
- 按时间顺序处理事件流
- `function_call` + `function_call_output` 配对成 ToolUseBlock
- `agent_message` / `user_message` → ParsedMessage
- 从 `token_count` 事件提取 token 用量
- 映射到 `ParsedMessage[]`

**文件：** `src/main/codex-delete.ts`（新建）— 删除会话
- 简单的文件删除（无关联文件）

### Step 3: 注册 IPC 处理器

**文件：** `src/main/index.ts`（修改 — 只新增）

```ts
import { detectCodexHome } from './codex-db'
import { discoverCodexSessions } from './codex-discovery'
import { parseCodexSession } from './codex-parser'
import { deleteCodexSession } from './codex-delete'

// ─── Codex IPC Handlers (NEW) ──
ipcMain.handle(IPC_CHANNELS.CODEX_DETECT_HOME, () => detectCodexHome())
ipcMain.handle(IPC_CHANNELS.CODEX_SESSIONS_LIST, (_e, codexHome) => discoverCodexSessions(codexHome))
ipcMain.handle(IPC_CHANNELS.CODEX_SESSION_LOAD, (_e, filePath) => parseCodexSession(filePath))
ipcMain.handle(IPC_CHANNELS.CODEX_SESSION_DELETE, (_e, filePath) => deleteCodexSession(filePath))
```

可选：增加文件监听 `~/.codex/sessions/`（类似现有 Claude 的 `fs.watch`）。

### Step 4: 更新 Preload API

**文件：** `src/preload/index.ts`（修改 — 只新增）

```ts
// ─── Codex API (NEW) ──
detectCodexHome: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.CODEX_DETECT_HOME),
getCodexSessions: (codexHome: string) => ipcRenderer.invoke(IPC_CHANNELS.CODEX_SESSIONS_LIST, codexHome),
loadCodexSession: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.CODEX_SESSION_LOAD, filePath),
deleteCodexSession: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.CODEX_SESSION_DELETE, filePath),
```

### Step 5: 新建 React Hook

**文件：** `src/renderer/hooks/useCodexSessionList.ts`（新建）

严格遵循 `useOpenCodeSessionList.ts` 模式：
- mount 时自动 `detectCodexHome()` → `getCodexSessions(home)` → `setGroups(result)`
- `refresh()` 支持 overridePath 重载
- 返回 `{ groups, loading, error, codexHome, homeNotFound, refresh }`

### Step 6: 主应用集成

**文件：** `src/renderer/App.tsx`（修改）

1. 导入 `useCodexSessionList`
2. 增加 Codex 管道和消息状态
3. `groups` / `displayMessages` / `displayLoading` / `displayError` 三路切换
4. `handleSelectSession2` 增加 `'codex'` 分支
5. `handleSourceChange` 增加清除 codex 消息
6. `handleDeleteSession` / `handleBatchDelete` 增加 Codex 分支
7. Sidebar props 增加 `codexCount`
8. SettingsPanel props 增加 `codexHomePath` / `codexHomeNotFound`

### Step 7: 侧边栏增加 Codex 标签

**文件：** `src/renderer/components/layout/Sidebar.tsx`（修改）

侧边栏顶部从 2 个 Tab 变为 3 个 Tab：

```tsx
┌──────────┬──────────┬──────────┐
│  Claude  │ OpenCode │  Codex   │
│  (23)    │  (29)    │  (15)    │
├──────────┴──────────┴──────────┤
│  搜索框                         │
│  会话列表...                     │
```

- Props 增加 `codexCount?: number`
- 标题 / 空状态消息增加 `'codex'` 分支
- SessionItem 模型展示条件增加 `session.source === 'codex'`
- 右键菜单：Codex 行为与 OpenCode 相同

### Step 8: ConversationView 适配

**文件：** `src/renderer/components/conversation/ConversationView.tsx`（修改）

- agent/model/cost/tokens 展示条件增加 `session.source === 'codex'`
- 现有的 `!session.source || session.source === 'claude'` 条件已自动排除 Codex 的"在 Claude 中打开"

### Step 9: 设置面板增加 Codex 配置

**文件：** `src/renderer/components/SettingsPanel.tsx`（修改）

选项卡从 3 个变为 4 个：appearance / pricing / opencode / **codex**

```tsx
┌──────────┬──────────┬──────────┬──────────┐
│ 外观     │ 模型定价 │ OpenCode │  Codex   │
├──────────┴──────────┴──────────┴──────────┤
│  Codex Home Directory                      │
│  [自动检测路径] ● ~/.codex/ ✔ 有效         │
│  [自定义路径]   _________________ [保存]     │
│  帮助: ~/.codex/ 位置、$CODEX_HOME 环境变量  │
└─────────────────────────────────────────────┘
```

- 显示自动检测到的 Codex 主目录路径（含状态指示）
- 自定义路径输入 + 保存
- 帮助文本说明默认位置和环境变量

### Step 10: 国际化补充

**文件：** `src/renderer/i18n/en.json` + `zh.json`（修改）

新增键值：
- `sidebar.title.codex` / `sidebar.noCodexSessions` / `sidebar.tab.codex`
- `settings.tab.codex` / `settings.codex.*` 系列
- `app.failedLoadCodex`

## 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `src/shared/constants.ts` | `SessionSource` + Codex IPC 通道 |
| 新建 | `src/main/codex-db.ts` | Codex 主目录检测 |
| 新建 | `src/main/codex-discovery.ts` | 目录遍历 + session_meta 读取 |
| 新建 | `src/main/codex-parser.ts` | JSONL 事件流 → ParsedMessage[] |
| 新建 | `src/main/codex-delete.ts` | 文件删除 |
| 修改 | `src/main/index.ts` | 注册 Codex IPC handler |
| 修改 | `src/preload/index.ts` | 新增 Codex API 方法 |
| 新建 | `src/renderer/hooks/useCodexSessionList.ts` | React hook |
| 修改 | `src/renderer/App.tsx` | 第三条管道集成 |
| 修改 | `src/renderer/components/layout/Sidebar.tsx` | 第三个来源标签页 |
| 修改 | `src/renderer/components/conversation/ConversationView.tsx` | Codex 元数据显示 |
| 修改 | `src/renderer/components/SettingsPanel.tsx` | Codex 配置选项卡 |
| 修改 | `src/renderer/i18n/en.json` | 英文翻译 |
| 修改 | `src/renderer/i18n/zh.json` | 中文翻译 |

## 不修改的文件清单（确保原有功能完整保留）

- `src/main/session-discovery.ts`（Claude JSONL 发现）
- `src/main/session-parser.ts`（Claude JSONL 解析）
- `src/main/session-delete.ts`（Claude 删除）
- `src/main/cross-search.ts`（Claude 跨会话搜索）
- `src/main/global-stats.ts`（Claude 全局统计）
- `src/main/session-insights.ts`（Claude 会话洞察）
- `src/main/html-exporter.ts` / `md-exporter.ts`（导出器）
- `src/main/opencode-*.ts`（OpenCode 全套管线）
- `src/main/settings-store.ts`（设置持久化）
- 所有 renderer 对话渲染组件（AssistantMessage、UserMessage、ToolCallBlock、MarkdownRenderer、ThinkingBlock 等）
- `src/renderer/hooks/useOpenCodeSessionList.ts`
- `src/renderer/hooks/useSessionList.ts`
- `src/renderer/hooks/useSessionMessages.ts`

## 关键设计决策

1. **仅使用 JSONL 文件，不依赖 SQLite**：Codex 的 `state.sqlite` 是可选的元数据索引。为简化实施，直接从 rollout JSONL 文件读取 session_meta。

2. **Parser 结构与另两者不同**：不同于 Claude JSONL（多行 uuid 链）和 OpenCode SQLite（join 查询）。Codex 是扁平的事件流，按时间顺序处理即可。

3. **分组按 `cwd`**：Codex 没有项目的概念，使用 `session_meta.cwd` 分组（路径用 `encodeProjectPath` 编码为 `encodedName`）。

4. **最小功能集**：第一版支持浏览、查看和删除。跨搜索和全局统计为可选扩展。

## 验证方法

1. `npm run build` — 确保类型检查和构建通过
2. 手动测试：
   - 侧边栏默认显示 "Claude" 标签，原有会话正常浏览（回归验证）
   - 切换到 "Codex" 标签 — 自动检测 `~/.codex/`，显示 rollout 会话列表
   - 点击 Codex 会话 — 消息正常渲染（文本、工具调用、thinking 块）
   - 右键菜单 — Codex 会话不显示"在 Claude 中打开"
   - 设置面板中 Codex 选项卡可配置和检测
   - 切换到 "OpenCode" 标签，确认原有功能不受影响
