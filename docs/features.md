# Features

> **English** · [简体中文](./features.zh-CN.md)

## 1. Session browser

### Sidebar
- Auto-scans every project and session under `~/.claude/projects/`
- Grouped by project, then by date inside each project (Today / Yesterday / This Week / Earlier)
- Shows session title (priority: customTitle > summary > firstPrompt), file size, Git branch, relative time
- Filter: search by title, prompt, or sessionId
- Right-click menu: open in Claude Code, reveal in file manager, delete
- Sidebar is collapsible and resizable

### Conversation view
- User messages: blue bubble, right-aligned, image support (base64/URL, click to enlarge, fallback placeholder on load failure)
- Assistant messages: gray card, left-aligned, with model name and timestamp
- Thinking blocks: yellow left border, collapsed by default, shows character count
- Token usage: input / output / cache shown at the bottom of each assistant message
- Rename a session: right-click → Rename — writes a `custom-title` entry into the JSONL

### Search (Ctrl+F)
Behavior switches based on the current view:
- **Chat view**: searches user messages, assistant replies, thinking content, tool names, inputs and outputs
- **Raw JSON view**: searches the raw JSON; matching entries are highlighted and auto-expanded
- Both: Enter for next match, Shift+Enter for previous, with match count and ↑/↓ navigation

## 2. Tool rendering

Each tool has a dedicated renderer:

| Tool | Renderer |
|------|----------|
| **Edit** | Red/green diff, old_string on red / new_string on green, syntax highlighted |
| **Read** | Filename + language badge + highlighted content (line-number prefixes stripped) |
| **Write** | CREATE badge + complete file content with highlighting |
| **Bash** | `$` prompt + green command + separated stdout/stderr |
| **Grep** | Highlighted pattern + path + output_mode + results |
| **Glob** | Cyan pattern + matched file list |
| **WebFetch / WebSearch** | URL/Query highlighted + response body |
| **AskUserQuestion** | Question card + option list (selected option ✅ in green) |
| **TodoWrite** | Task list with status icons (⭕ pending / ⏳ active / ✅ done) |
| **TaskCreate / Update** | Task card + status-change arrow |
| **Agent** | Generic renderer + a "View Sub-Agent" button |

### Slash command rendering

The parser detects the Claude Code slash-command triple in JSONL (`<command-name>` + `<command-message>` + `<command-args>`) and pairs it with the immediately following `type: "system", subtype: "local_command"` output under the same parent. Rendered in CLI style:

- Command header: `> /cost` (name bold, args dim)
- Output: monospace block. ANSI escapes (colors, dim, true-color) are converted to inline HTML styles via `ansi-to-html`, preserving `/context` tables and `/cost` dim styling
- `<local-command-caveat>` (system notes telling the model to ignore something) is hidden automatically

## 3. Syntax highlighting

Powered by Shiki (JavaScript RegExp engine — no WASM):
- 30+ languages: TypeScript, JavaScript, Python, Go, Java, C#, C++, C, Rust, Ruby, Lua, Bash, JSON, YAML, HTML, CSS, SQL, Markdown, XML, etc.
- `github-dark` theme
- Languages loaded on demand
- Auto-detected from file extension

## 4. Session stats

- **Overview cards**: message count, duration, tool-call count, thinking count
- **Token usage**: Input / Output / Cache Read / Cache Write, with K/M/B units and exact numbers
  - Sourced from the main session JSONL **plus all of its sub-agent JSONLs** (aggregated)
  - Last-write-wins per `message.id` when multiple lines are written to disk
  - Header shows "+N subagents" to indicate sub-task count
  - Will not match `/cost` exactly: `/cost` also includes advisor / classifier calls that are never written to disk
- **Ratio bar**: visual breakdown by category
- **Cost estimate**: matched against the configured pricing per model; multi-model sessions show a per-model split
- **Tool ranking**: horizontal bar chart
- **Output Tokens Per Turn**: bar chart with horizontal scroll and hover details
- **Models used**: listed
- **Click to jump**: clicking a bar in the per-turn chart switches to Chat view and scrolls to that message

## 5. Insights

### Health score (0–100)
- 90–100: Excellent (green)
- 75–89: Good (blue)
- 60–74: Warning (yellow)
- 0–59: Poor (red)

### Inefficiency detection
| Type | Description |
|------|-------------|
| `repeated_tool` | Same tool + similar input repeats 3+ times within 5 turns |
| `fix_loop` | The same file is Edit'd 4+ times in a short window |
| `empty_result` | Grep/Glob returns empty 5+ times |
| `excessive_reads` | The same file is Read 5+ times |
| `large_write_then_edit` | A Write is followed immediately by an Edit on the same file |

### Complexity metrics
Conversation depth, average output per turn, thinking-usage ratio, tool density, peak output, error rate.

## 6. Global dashboard

- All-session totals: session count, total tokens, total cost
- Daily Output Token trend (last 30 days)
- Global tool-usage ranking
- Model usage stats
- Cost breakdown by model

## 7. Session replay

Step through a conversation like a slideshow:
- Play / pause, next / previous message, next / previous user message
- 5 speeds: 0.5x / 1x / 2x / 3x / 5x
- Click the progress bar to seek
- Active message highlighted green, auto-scrolled into view
- Full keyboard support

## 8. Cross-session search

### Result interaction
- **Click to jump**: clicking a match (not just the session header) opens that session and scrolls to the message
- **Show more**: each session shows the first 5 matches by default; click `+N more matches` to expand
- Matches color-coded by source: `user` (blue), `assistant` (purple), `tool` (green)
- Each match shows a timestamp; clicking auto-scrolls in the conversation view

## 9. Export

### HTML export
- Self-contained single file with inlined CSS + JS (works offline)
- Dark theme matches the in-app palette (GitHub Dark)
- **Per-tool renderers**, matching the in-app rendering:
  - `Edit`: old/new red/green diff cards
  - `Read`: filename + language, line numbers stripped, range info preserved
  - `Write`: CREATE badge + filename + content
  - `Bash`: green `$` command card + stdout/stderr
  - `Grep` / `Glob`: highlighted pattern, path, glob, result list
  - `WebFetch` / `WebSearch`: URL/Query/Prompt + response
  - `AskUserQuestion`: question card + ✅/○ option states + free-form answer
  - `TodoWrite`: status-icon list
  - `TaskCreate` / `TaskUpdate`: subject / status badges
  - Other tools: generic JSON input + result
- Slash commands (`<command-name>` / `<command-message>` / `<local-command-stdout/stderr>`) render with the same `>` prompt and ANSI-colored output box as the app
- Caveat-only system messages are auto-hidden
- User images supported (base64/url) with click-to-enlarge lightbox
- Thinking blocks styled (yellow border, length + preview, `<details>` collapse)
- Token usage line (in / out / cache)
- Tool name color badges (Bash green, Read blue, Edit orange, etc.)
- 15K-character truncation marker
- Top-of-document metadata (title, project path, time range, model, message count, git branch, session ID)

### Markdown export
- Full conversation
- Thinking blocks wrapped in `<details>`
- Tool calls rendered as quote blocks + code blocks
- Tool results longer than 50 lines are truncated automatically

## 10. Model pricing

### Built-in pricing
| Model | Input $/1M | Output $/1M | Cache Read $/1M | Cache Write $/1M |
|-------|-----------|------------|-----------------|------------------|
| Claude Opus | $15 | $75 | $1.50 | $3.75 |
| Claude Sonnet | $3 | $15 | $0.30 | $0.75 |
| Claude Haiku | $0.80 | $4 | $0.08 | $0.20 |

### Custom models
- Add any model via the Settings panel
- Define a pattern (prefix match) and four prices
- Match priority: exact match > longest prefix match > default fallback

## 11. Sub-agent viewer

- An "View Sub-Agent" button appears on Agent tool calls
- Clicking opens that agent's full conversation (matched by `description`, no manual selection needed)
- Right-side slide-out panel with agent type badge, description, and the complete conversation
- Works for Explore, Plan, general-purpose, and any other agent type

## 12. Open in Claude Code

Restore a Claude Code session straight from the UI — no manual command typing:

- **Entry points**: blue "Resume" button in the top bar, "Open in Claude" in the sidebar context menu, `Ctrl+O`
- **Command**: `claude --resume <session-id>`
- **Working directory**: auto-`cd` into the session's project path
- **Terminal selection**:
  - Windows: prefers Windows Terminal (`wt.exe`), falls back to CMD
  - macOS: opens Terminal.app via AppleScript
  - Linux: tries `gnome-terminal` / `konsole` / `xterm`

> Windows note: `wt.exe` is a WindowsApps execution alias and must be launched with `spawn(..., { shell: true })` to resolve.
> Pass the working directory via `wt -d` / `start /D` — **do not** build `cd /d "..." && claude ...`,
> because the outer cmd will eat the `&&` and Claude will start a second time in the parent shell (you'll see two windows).
