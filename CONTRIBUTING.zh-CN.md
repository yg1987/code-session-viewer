# Contributing

> [English](./CONTRIBUTING.md) · **简体中文**

感谢你对 Claude Session Viewer 的关注！欢迎 issue、PR 和讨论。

## 开发环境

- Node.js >= 18
- npm >= 9
- Windows / macOS / Linux 均可（打包脚本目前以 Windows 为主，欢迎补全其他平台）

## 本地启动

```bash
git clone https://github.com/Lition13/claude-session-viewer.git
cd claude-session-viewer
npm install
npm run dev
```

应用会读取你本机 `~/.claude/projects/` 下的真实会话作为数据源。

## 提交 Issue

提 bug 时请尽量提供：
- 操作系统 + Node 版本
- 复现步骤（哪些会话、做了什么操作）
- 报错日志（DevTools Console / 终端输出）
- 截图或录屏（UI 问题尤其有帮助）

请勿在 issue 中粘贴会话原文，里面可能包含敏感信息。

## Pull Request

1. 先开 issue 讨论较大改动，避免白做
2. 从 `master` 拉分支，命名建议 `feat/xxx`、`fix/xxx`、`docs/xxx`
3. 保持单 PR 单一目的，便于 review
4. 提交信息使用清晰的祈使句，如 `Add token trend chart`、`Fix subagent rendering on Windows`
5. PR 描述里说明：解决了什么问题、怎么改的、如何手动验证

## 代码风格

- TypeScript 严格模式，避免 `any`
- 组件分目录：`layout/` 布局、`conversation/` 对话渲染、`common/` 通用
- IPC 通道常量统一在 `src/shared/constants.ts`
- 主进程文件操作集中在 `src/main/`，渲染进程不要直接访问 fs

## 数据安全

本项目读取的是用户的 AI 对话历史，请在所有改动中坚持以下原则：
- 不上传任何用户数据到外部服务
- 不引入需要联网的第三方分析/埋点
- 删除会话时确保 6 处清理点都覆盖到（见 README）
