# Changelog

> [English](./CHANGELOG.md) · **简体中文**

本项目所有重要变更都会记录在此文件中。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-04-30

首个公开发布版本。

### 亮点
- 完整、纯本地的 Claude Code 会话查看器
- 工具专属渲染、完整的 Token + 费用分析、HTML / Markdown 导出
- 三种主题（深色 / 浅色 / Sepia 纸质）+ 自绘无边框标题栏
- 自定义应用图标

### 新增

#### 浏览与渲染
- 会话浏览：自动扫描 `~/.claude/projects/` 下所有 Claude Code 会话，按项目和日期分组
- 完整对话渲染：用户消息、助手回复、思考链（可折叠）、工具调用与结果
- 工具专属渲染：Edit（diff）、Read、Write、Bash、Grep、Glob、TodoWrite、AskUserQuestion、TaskCreate/Update、Agent、WebFetch、WebSearch 等
- 斜杠命令渲染：识别 `<command-name>` 三元组并配对 `local_command` 输出，保留 ANSI 颜色
- 子 Agent 会话查看
- 回放模式：逐条播放，支持暂停 / 倍速（0.5x–5x）/ 跳转 + 完整快捷键
- Shiki 语法高亮（30+ 语言，无 WASM 依赖）

#### 数据分析
- 会话统计：Token 用量（Input / Output / Cache Read / Cache Write）、工具使用排行、费用估算、每轮输出柱状图
- 全局仪表盘：跨会话汇总、每日趋势、累计费用、按模型拆分
- 智能洞察：健康度评分 + 低效模式检测（重复调用 / 循环修复 / 空结果 / 过度读取 / 写后立刻编辑）
- 主会话 + subagent 聚合，按 `message.id` last-write-wins 去重

#### 导出
- HTML 导出：自包含离线文件，与界面渲染一致，含 ANSI 着色的斜杠命令和工具专属视图
- Markdown 导出
- Raw JSON 视图

#### 搜索与管理
- 跨会话搜索：点击匹配项直接跳转到对应消息
- 会话内搜索（Ctrl+F）
- 删除会话：完整清理 6 处相关文件（jsonl、subagents、file-history、telemetry、tasks、index）
- 批量删除
- "在 Claude Code 中打开"：一键 `claude --resume`，Windows 优先使用 Windows Terminal
- 文件监听：新会话自动刷新

#### UI 与个性化
- 三种主题：Dark、Light、Sepia（纸质阅读优化）
- 自绘无边框标题栏 + 内置窗口控制（最小化 / 最大化 / 关闭）；移除原生菜单栏，改由应用内快捷键和按钮承担
- Linear / Notion 风格视觉：4 级深度 token、accent 渐变、柔和边框，2px 角色色条标识 user/assistant 气泡，工具 chip 软调着色，细线自动隐藏滚动条，模态层背景 blur 淡入
- 自定义字体（6 种）和字号
- 模型定价配置：内置 Claude Opus / Sonnet / Haiku，支持自定义模型（GPT-4o、DeepSeek 等）
- 应用图标（窗口 + Windows 任务栏 + 安装包）

[1.0.0]: https://github.com/Lition13/claude-session-viewer/releases/tag/v1.0.0
