# Architecture

> **English** · [简体中文](./architecture.zh-CN.md)

## Overview

Claude Session Viewer uses Electron's three-process architecture (Main + Preload + Renderer), built with electron-vite.

## Process responsibilities

### Main process (Node.js)
Owns all filesystem I/O and data processing:
- **Session discovery** — scans `~/.claude/projects/`, reads `sessions-index.json` and JSONL metadata
- **JSONL parsing** — streaming read, message merging, tool pairing, conversation ordering
- **Analytics** — global stats, session health scoring, inefficiency detection
- **File ops** — HTML/Markdown export, session deletion, cross-session search

### Preload (bridge)
Exposes a safe IPC API to the renderer via `contextBridge`. All APIs are async (`ipcRenderer.invoke`).

### Renderer process (React)
Pure UI rendering, never touches the filesystem directly:
- Calls main-process functionality through `window.api.*`
- React Context for global state (Settings, CollapseControl)
- `React.memo` to avoid re-rendering message components
- Progressive rendering (start with 20 messages, load more on scroll)

## JSONL parsing

### Message merging
Claude Code splits one API response across several JSONL lines. Each line shares the same `message.id` but has a different `uuid`:
1. Group by `message.id`
2. Use the `parentUuid` chain to determine intra-group order
3. Concatenate every `content[]` array into a single complete message
4. Take `usage` from any one entry (all entries with the same `message.id` carry the same usage)

### Tool pairing
`tool_use` blocks (in assistant messages) are paired with `tool_result` blocks (in subsequent user messages) via `tool_use_id`.

### Conversation ordering
All messages form a linked list through `parentUuid`. Walking from the root (`parentUuid === null`) yields the ordered conversation.

### Slash command output
Claude Code slash commands (e.g. `/cost`, `/context`) appear as two record types in the JSONL:

1. `type: "user"` with `message.content` containing the `<command-name>/xxx</command-name>` triple (the command itself)
2. `type: "system", subtype: "local_command"` with a top-level `content` field of `<local-command-stdout>...</local-command-stdout>` (the command output, with `parentUuid` pointing back at the user message above)

The parser attaches each `local_command` record to its parent user message by `parentUuid`. The renderer merges them for display.

## IPC channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `sessions:list` | R→M | List all sessions |
| `session:load` | R→M | Parse one session JSONL |
| `session:load-raw` | R→M | Get the raw JSON |
| `session:export` | R→M | Export HTML |
| `session:export-md` | R→M | Export Markdown |
| `session:delete` | R→M | Delete a session |
| `session:insights` | R→M | Insights / health score |
| `stats:global` | R→M | Global stats |
| `search:cross-session` | R→M | Cross-session search |
| `subagents:list` | R→M | List sub-agents |
| `subagent:load` | R→M | Load a sub-agent session |
| `session:model-usage` | R→M | Aggregate token usage by model (main session + sub-agents) |
| `sessions:changed` | M→R | File-change notification |

## Performance

1. **Progressive rendering** — start with 20 messages, load more when scrolled near the bottom
2. **`React.memo`** — `UserMessage` and `AssistantMessage` skip unnecessary re-renders
3. **On-demand Shiki languages** — language grammars are loaded lazily on first use
4. **Streaming JSONL read** — uses `readline` line-by-line; the entire file never sits in memory
5. **Debounced file watcher** — 2-second debounce avoids storming the UI on bursty writes
6. **`message.id` deduplication** — global stats keep the **last** entry per `message.id` (last-write-wins) so tokens aren't double-counted or under-counted

## Token accounting

Token stats come from the `message.usage` field inside the JSONL. Aggregation rules:

1. **Last-write-wins per `message.id`** — when an assistant message has both text and `tool_use`, each content block is flushed to its own JSONL line, and each line's `usage` is the **running cumulative** up to that block. The **last line** is the complete total — that's the one to keep.
2. **Main session + sub-agents** — the per-session view sums `{sessionId}.jsonl` plus `{sessionId}/subagents/*.jsonl`. The global dashboard also includes sub-agent data (without inflating the session count).
3. **Per-model breakdown** — different models accumulate independently; the UI shows per-model cost.

**Why this can differ from `/cost`:** the in-app numbers usually match `/cost` exactly for the main conversation (input, output, cache read/write), but small deltas can appear because:

- `/cost` adds up **every API call in the running process's memory** (`addToTotalSessionCost`), including advisor calls (auto-mode classifier, compression summarizer, auto-naming on Haiku). Those requests are **not written to the session JSONL**, so the viewer can't see them.
- That's why `/cost` sometimes lists a `claude-haiku-4-5` line that the viewer doesn't, or shows a small delta on Opus output (advisors can also borrow the main model).
- `/cost` is per-process: after `--resume`, `/cost` only reflects new calls in the current process; the JSONL holds the full history.
- Cancelled/retried requests can land differently on each side.

The UI marks the relevant numbers "may differ from /cost". Both sets are real data — **JSONL is the authoritative session record; `/cost` is the running process's bill** — they complement each other.
