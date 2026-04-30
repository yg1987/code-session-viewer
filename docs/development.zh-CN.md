# 开发指南

> [English](./development.md) · **简体中文**

## 环境搭建

```bash
# 安装依赖
npm install

# 如果 Electron 二进制下载失败，设置镜像
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

## 开发命令

```bash
# 开发模式（HMR）
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview

# 打包为安装程序
npm run package
```

## 项目约定

### 文件命名
- React 组件：PascalCase（`UserMessage.tsx`）
- Hooks：camelCase，`use` 前缀（`useSettings.ts`）
- 工具模块：kebab-case（`session-parser.ts`）

### IPC 通信
1. 在 `src/shared/constants.ts` 定义通道名
2. 在 `src/main/index.ts` 注册 handler
3. 在 `src/preload/index.ts` 暴露 API
4. 在 `src/renderer/types/electron.d.ts` 中有类型声明

### 添加新工具渲染器
1. 在 `src/renderer/components/conversation/ToolCallBlock.tsx` 的 `renderToolContent` 中添加 case
2. 创建对应的渲染函数（参考 `BashToolContent`、`EditToolContent` 等）
3. 在 `TOOL_COLORS` 中添加颜色

### 添加新语言高亮
1. 在 `src/renderer/hooks/useHighlighter.ts` 的 `LANG_IMPORTS` 中添加 import
2. 在 `src/renderer/components/conversation/ToolCallBlock.tsx` 的 `EXT_TO_LANG` 中添加扩展名映射

### 添加新设置项
1. 在 `src/renderer/hooks/useSettings.ts` 的 `AppSettings` 接口添加字段
2. 更新 `DEFAULT_SETTINGS`
3. 在 `src/renderer/components/SettingsPanel.tsx` 添加 UI 控件

## 调试

### 主进程调试
electron-vite 在开发模式下支持主进程的 source map。可以在 `src/main/` 中的代码设置断点。

### 渲染进程调试
使用 Electron 的 DevTools（`Ctrl+Shift+I`）。Vite HMR 在开发模式下自动生效。

### 常见问题

**Q: `require("electron")` 报错 `Cannot find module`**
A: 这通常是 Electron 二进制没有正确安装。运行 `node node_modules/electron/install.js`。

**Q: Shiki 高亮不生效**
A: 检查 `useHighlighter` hook 是否正确初始化。Shiki 使用 JavaScript RegExp 引擎，不依赖 WASM。

**Q: 会话列表不显示某些会话**
A: 检查 `sessions-index.json` 是否存在。没有 index 文件时会回退到扫描 `.jsonl` 文件。
