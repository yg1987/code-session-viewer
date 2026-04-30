# Contributing

> **English** · [简体中文](./CONTRIBUTING.zh-CN.md)

Thanks for your interest in Claude Session Viewer! Issues, PRs, and discussions are all welcome.

## Development environment

- Node.js >= 18
- npm >= 9
- Windows / macOS / Linux all work (the packaging script targets Windows by default — contributions for the other platforms are very welcome)

## Local setup

```bash
git clone https://github.com/Lition13/claude-session-viewer.git
cd claude-session-viewer
npm install
npm run dev
```

The app reads real sessions from `~/.claude/projects/` on your machine — there's no fixture data.

## Filing issues

When reporting a bug, please include:
- OS + Node version
- Reproduction steps (which session, what action)
- Error logs (DevTools console / terminal)
- Screenshots or recordings (especially helpful for UI issues)

**Do not paste raw session contents into issues** — they may contain sensitive information.

## Pull requests

1. For non-trivial changes, open an issue first to discuss the approach
2. Branch off `master`; suggested naming: `feat/...`, `fix/...`, `docs/...`
3. Keep each PR focused on a single concern — easier to review, easier to revert
4. Use clear imperative commit messages, e.g. `Add token trend chart`, `Fix subagent rendering on Windows`
5. In the PR description, explain: what problem it solves, how it's solved, and how to verify manually

## Code style

- TypeScript strict mode — avoid `any`
- Component layout: `layout/`, `conversation/`, `common/`
- IPC channel names live in `src/shared/constants.ts`
- All filesystem access lives in `src/main/` — never call `fs` from the renderer

## Data safety

The data this app handles is the user's AI conversation history. Please uphold these principles in every change:

- No user data leaves the machine
- No third-party analytics or telemetry
- Session deletion must cover all 6 cleanup points (see README)
