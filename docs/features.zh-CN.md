# 功能详细说明

> [English](./features.md) · **简体中文**

## 1. 会话浏览

### 侧边栏
- 自动扫描 `~/.claude/projects/` 下所有项目和会话
- 按项目分组，项目内按日期分组（Today / Yesterday / This Week / Earlier）
- 显示会话标题（优先级：customTitle > summary > firstPrompt）、文件大小、Git 分支、相对时间
- 搜索过滤：支持搜索标题、prompt、sessionId
- 右键菜单：在 Claude Code 中打开、在文件管理器中打开、删除会话
- 侧边栏可折叠、可拖拽调整宽度

### 对话视图
- 用户消息：蓝色气泡，右对齐，支持图片显示（base64/URL，点击放大，加载失败显示占位图）
- 助手消息：灰色卡片，左对齐，显示模型名和时间
- 思考块：黄色左边框，默认折叠，显示字符数
- Token 用量：每条助手消息底部显示 input/output/cache 数量
- 会话重命名：右键菜单 → Rename，直接编辑标题（写入 JSONL custom-title 条目）

### 搜索（Ctrl+F）
搜索功能根据当前视图智能切换：
- **Chat 视图**：搜索用户消息、助手回复、思考内容、工具名称和输入/输出
- **Raw JSON 视图**：搜索原始 JSON 数据内容，匹配的条目高亮并自动展开
- 两种视图都支持：Enter 跳转下一个、Shift+Enter 跳转上一个、显示匹配计数和↑↓导航按钮

## 2. 工具渲染

每种工具有专门的渲染器：

| 工具 | 渲染方式 |
|------|----------|
| **Edit** | 红绿 diff 对比视图，old_string 红色底 / new_string 绿色底，带语法高亮 |
| **Read** | 文件名 + 语言标签 + 语法高亮内容（自动剥离行号前缀） |
| **Write** | CREATE 标签 + 语法高亮的完整文件内容 |
| **Bash** | `$` 提示符 + 绿色命令 + stdout/stderr 分离显示 |
| **Grep** | 黄色高亮 pattern + 路径 + output_mode + 结果 |
| **Glob** | 青色 pattern + 匹配文件列表 |
| **WebFetch/WebSearch** | URL/Query 高亮 + 响应内容 |
| **AskUserQuestion** | 问题卡片 + 选项列表（用户选择的选项 ✅ 绿色高亮） |
| **TodoWrite** | 任务清单视图，带状态图标（⭕ pending / ⏳ active / ✅ done） |
| **TaskCreate/Update** | 任务卡片 + 状态变更箭头 |
| **Agent** | 通用渲染 + "View Sub-Agent" 按钮 |

### 斜杠命令渲染

识别 JSONL 中的 Claude Code 斜杠命令三元组（`<command-name>` + `<command-message>` + `<command-args>`），配对其后同一父级下的 `type:"system", subtype:"local_command"` 输出记录，按 CLI 风格展示：

- 命令头：`> /cost`（name 加粗，args 灰色）
- 命令输出：等宽代码块，通过 `ansi-to-html` 将 ANSI 转义（颜色、dim、真彩色）转换为 HTML 颜色样式，保留 `/context` 的表格、`/cost` 的 dim 样式
- `<local-command-caveat>`（提示模型忽略的系统注释）自动隐藏

## 3. 语法高亮

基于 Shiki（JavaScript RegExp 引擎，无 WASM 依赖）：
- 支持 30+ 种语言：TypeScript, JavaScript, Python, Go, Java, C#, C++, C, Rust, Ruby, Lua, Bash, JSON, YAML, HTML, CSS, SQL, Markdown, XML 等
- 使用 `github-dark` 主题
- 按需加载语言语法文件
- 根据文件扩展名自动识别语言

## 4. 会话统计 (Stats)

- **概览卡片**：消息数、持续时间、工具调用数、思考次数
- **Token 用量**：Input / Output / Cache Read / Cache Write 四项，带换算（K/M/B）和精确数字
  - 数据来自主会话 JSONL **+ 该会话的所有 subagent JSONL**（聚合显示）
  - 同一 `message.id` 在 JSONL 多行落盘时取最后一条（累积总数）
  - 标题显示"+N subagents"指示子任务数量
  - 与 `/cost` 不完全一致：`/cost` 还包含 advisor / classifier 等不写盘的辅助调用
- **比例条**：可视化各项 token 占比
- **费用估算**：按模型自动匹配定价计算，多模型会话分别显示
- **工具使用排行**：横向柱状图
- **Output Tokens Per Turn**：每轮输出 token 柱状图，支持水平滚动和 hover 详情
- **使用模型列表**
- **Token Per Turn 消息跳转**：点击柱子自动切换到 Chat 视图并滚动到对应消息

## 5. 智能洞察 (Insights)

### 健康度评分 (0-100)
- 90-100: Excellent（绿色）
- 75-89: Good（蓝色）
- 60-74: Warning（黄色）
- 0-59: Poor（红色）

### 低效模式检测
| 类型 | 说明 |
|------|------|
| `repeated_tool` | 相同工具+相似输入在 5 轮内重复 3+ 次 |
| `fix_loop` | 同一文件在短时间内被 Edit 4+ 次 |
| `empty_result` | Grep/Glob 返回空结果 5+ 次 |
| `excessive_reads` | 同一文件被 Read 5+ 次 |
| `large_write_then_edit` | Write 后立即 Edit 同一文件 |

### 复杂度指标
- 对话深度、平均 output/轮、思考使用率、工具密度、峰值输出、错误率

## 6. 全局仪表盘

- 汇总所有会话：总会话数、总 token、总费用
- 每日 Output Token 趋势图（最近 30 天）
- 工具使用全局排行
- 模型使用统计
- 按模型分类的费用明细

## 7. 会话回放

像幻灯片一样逐条展示对话：
- 播放/暂停、上/下一条、上/下一条 User 消息
- 5 种速度：0.5x / 1x / 2x / 3x / 5x
- 进度条可点击跳转
- 当前消息绿色高亮，自动滚动
- 完整快捷键支持

## 8. 跨会话搜索增强

### 搜索结果交互
- **子项直接跳转**：点击每条匹配项（而非只能点击 Session 标题）可直接打开该会话并自动滚动到对应消息位置
- **展开更多**：每个 Session 默认显示前 5 条匹配，点击 `+N more matches` 可展开显示全部匹配项
- 匹配项按类型着色：`user`（蓝色）、`assistant`（紫色）、`tool`（绿色）
- 每条匹配项显示时间戳，点击后会话视图自动滚动至该消息

## 9. 导出

### HTML 导出
- 自包含单文件，内联 CSS + JS（可离线查看）
- 暗色主题与界面一致（GitHub Dark 调色板）
- **逐工具专属渲染**，与界面渲染保持一致：
  - `Edit`：old/new 红绿 diff 双卡片
  - `Read`：文件名 + 语言、剥离 `cat -n` 行号、范围信息
  - `Write`：CREATE 标识 + 文件名 + 内容
  - `Bash`：命令绿色 `$` 卡片 + stdout/stderr
  - `Grep` / `Glob`：pattern 高亮、路径、glob、结果列表
  - `WebFetch` / `WebSearch`：URL/Query/Prompt + 响应
  - `AskUserQuestion`：问题卡片 + 选项 ✅/○ 选中态 + 自由作答
  - `TodoWrite`：状态图标列表
  - `TaskCreate` / `TaskUpdate`：主题/状态徽章
  - 其他工具：通用 JSON 输入 + 结果
- Slash 命令（`<command-name>` / `<command-message>` / `<local-command-stdout/stderr>`）按界面 `>` 提示符 + ANSI 着色输出框渲染
- caveat-only 系统消息自动隐藏
- 用户图片支持（base64/url）+ 点击放大灯箱
- thinking 块（黄色边、长度 + 预览、`<details>` 折叠）
- token usage 行（in / out / cache）
- 工具按名称着色 badge（Bash 绿、Read 蓝、Edit 橙等）
- 15K 字符截断条
- 顶部元信息（标题、项目路径、时间范围、模型、消息数、git 分支、session ID）

### Markdown 导出
- 完整对话内容
- 思考块用 `<details>` 折叠
- 工具调用用引用块 + 代码块
- 超过 50 行的工具结果自动截断

## 10. 模型定价配置

### 内置定价
| 模型 | Input $/1M | Output $/1M | Cache Read $/1M | Cache Write $/1M |
|------|-----------|------------|----------------|-----------------|
| Claude Opus | $15 | $75 | $1.50 | $3.75 |
| Claude Sonnet | $3 | $15 | $0.30 | $0.75 |
| Claude Haiku | $0.80 | $4 | $0.08 | $0.20 |

### 自定义模型
- 设置面板中添加任意模型
- 设定 pattern（前缀匹配）和 4 项价格
- 匹配逻辑：精确匹配 > 最长前缀匹配 > 默认 fallback

## 11. 子 Agent 查看

- 在 Agent 工具调用块上显示 "View Sub-Agent" 按钮
- 点击后直接打开该 Agent 的对话（通过 description 匹配，无需手动选择）
- 右侧滑出面板，显示 Agent 类型标签、描述、完整对话内容
- 支持 Explore、Plan、general-purpose 等所有 Agent 类型

## 12. 在 Claude Code 中打开会话

直接从界面恢复 Claude Code 会话，无需手动输入命令：

- **入口**：顶栏 "Resume" 蓝色按钮、侧边栏右键菜单 "Open in Claude"、快捷键 `Ctrl+O`
- **执行命令**：`claude --resume <session-id>`
- **工作目录**：自动 cd 到会话的项目路径
- **终端选择**：
  - Windows：优先 Windows Terminal（`wt.exe`），不可用时回退到 CMD
  - macOS：通过 AppleScript 打开 Terminal.app
  - Linux：尝试 gnome-terminal / konsole / xterm

> Windows 实现注意：`wt.exe` 是 WindowsApps 执行别名，必须 `spawn(..., { shell: true })` 才能解析；
> 工作目录通过 `wt -d` / `start /D` 传入，**不要**拼 `cd /d "..." && claude ...`，
> 那样 `&&` 会被外层 cmd 抢去，导致 Claude 在父 shell 中再启动一次（出现两个窗口）。
