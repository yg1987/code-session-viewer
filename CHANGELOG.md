# Changelog

> **English** · [简体中文](./CHANGELOG.zh-CN.md)

All notable changes to this project will be recorded here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project follows [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-04-30

Initial public release.

### Highlights
- A complete, local-only viewer for Claude Code sessions
- Per-tool rendering, full token + cost analytics, HTML / Markdown export
- Three themes (dark / light / sepia) with a custom frameless titlebar
- Custom app icon

### Added

#### Browsing & rendering
- Session browser: scans every Claude Code session under `~/.claude/projects/`, grouped by project and date
- Full conversation rendering: user messages, assistant replies, collapsible thinking blocks, tool calls and results
- Tool-specific renderers: Edit (diff), Read, Write, Bash, Grep, Glob, TodoWrite, AskUserQuestion, TaskCreate/Update, Agent, WebFetch, WebSearch, and others
- Slash command rendering: detects `<command-name>` triples and pairs them with `local_command` output, with ANSI colors preserved
- Sub-agent conversation viewer
- Replay mode: step-through playback with pause / speed (0.5x–5x) / seek and full keyboard support
- Shiki syntax highlighting (30+ languages, no WASM dependency)

#### Analytics
- Per-session stats: token usage (input / output / cache read / cache write), tool ranking, cost estimate, output-tokens-per-turn chart
- Global dashboard: cross-session totals, daily trend, cumulative cost, model breakdown
- Insights: health score and inefficiency detection (repeated calls, fix loops, empty results, excessive reads, large-write-then-edit)
- Aggregation across main session + sub-agents with last-write-wins per `message.id`

#### Export
- HTML export: self-contained offline file matching the in-app rendering, including ANSI-colored slash commands and per-tool views
- Markdown export
- Raw JSON view

#### Search & management
- Cross-session search: click a hit to jump straight to the matching message
- In-session search (Ctrl+F)
- Session deletion: cleans up all 6 related locations (jsonl, sub-agents, file-history, telemetry, tasks, index)
- Bulk deletion
- "Open in Claude Code": one-click `claude --resume`; on Windows prefers Windows Terminal
- File watcher: auto-refresh on new sessions

#### UI & personalization
- Three themes: Dark, Light, and Sepia (paper) for long-form reading
- Custom frameless titlebar with built-in window controls (minimize / maximize / close); native menu bar removed in favor of in-app shortcuts
- Linear / Notion-inspired visual design: refined design tokens (4-step elevation, accent ramp, soft borders), 2px role rails on message bubbles, soft tinted tool chips, slim auto-fading scrollbars, fade-in modal overlays with backdrop blur
- Custom font (6 options) and font size
- Model pricing config: built-in Claude Opus / Sonnet / Haiku, plus user-defined models (GPT-4o, DeepSeek, etc.)
- App icon (window + Windows taskbar + packaged installer)

[1.0.0]: https://github.com/Lition13/claude-session-viewer/releases/tag/v1.0.0
