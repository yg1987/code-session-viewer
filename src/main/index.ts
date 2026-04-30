import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { spawn } from 'child_process'
import { IPC_CHANNELS } from '../shared/constants'
import { discoverSessions } from './session-discovery'
import { parseSessionFile, collectSessionUsage } from './session-parser'
import { exportSessionToHtml } from './html-exporter'
import { exportSessionToMarkdown } from './md-exporter'
import { deleteSession } from './session-delete'
import { computeGlobalStats } from './global-stats'
import { crossSessionSearch } from './cross-search'
import { analyzeSession } from './session-insights'

function getIconPath(): string {
  // Packaged: icons are copied to resources/ via extraResources.
  // Dev: read from build/ at the project root.
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  return app.isPackaged
    ? join(process.resourcesPath, iconFile)
    : join(__dirname, '../../build', iconFile)
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    backgroundColor: '#0b0d10',
    icon: getIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Notify renderer when maximize state changes (so the titlebar icon can flip)
  const sendMaxState = () => {
    mainWindow.webContents.send('window:state-changed', {
      isMaximized: mainWindow.isMaximized()
    })
  }
  mainWindow.on('maximize', sendMaxState)
  mainWindow.on('unmaximize', sendMaxState)
  mainWindow.on('enter-full-screen', sendMaxState)
  mainWindow.on('leave-full-screen', sendMaxState)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  // Hide native menu bar entirely (functions are covered by in-app shortcuts)
  Menu.setApplicationMenu(null)

  // IPC Handlers
  ipcMain.handle(IPC_CHANNELS.SESSIONS_LIST, async () => {
    return discoverSessions()
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_LOAD, async (_event, filePath: string) => {
    return parseSessionFile(filePath)
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_LOAD_RAW, async (_event, filePath: string) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').filter((l) => l.trim())
    return lines.map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return { _raw: line, _parseError: true }
      }
    })
  })

  ipcMain.handle(
    IPC_CHANNELS.SESSION_EXPORT,
    async (
      _event,
      data: {
        filePath: string
        title: string
        projectPath: string
        sessionId: string
      }
    ) => {
      const messages = await parseSessionFile(data.filePath)
      return exportSessionToHtml(messages, {
        title: data.title,
        projectPath: data.projectPath,
        sessionId: data.sessionId
      })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SESSION_EXPORT_MD,
    async (
      _event,
      data: { filePath: string; title: string; projectPath: string; sessionId: string }
    ) => {
      const messages = await parseSessionFile(data.filePath)
      return exportSessionToMarkdown(messages, data)
    }
  )

  // Rename session (write custom-title to JSONL)
  ipcMain.handle(IPC_CHANNELS.SESSION_RENAME, async (_event, data: { filePath: string; sessionId: string; newTitle: string }) => {
    const line = JSON.stringify({ type: 'custom-title', customTitle: data.newTitle, sessionId: data.sessionId })
    fs.appendFileSync(data.filePath, '\n' + line)
    return true
  })

  // Global stats
  ipcMain.handle(IPC_CHANNELS.GLOBAL_STATS, async () => {
    return computeGlobalStats()
  })

  // Cross-session search
  ipcMain.handle(IPC_CHANNELS.CROSS_SEARCH, async (_event, query: string) => {
    return crossSessionSearch(query)
  })

  // Session insights
  ipcMain.handle(IPC_CHANNELS.SESSION_INSIGHTS, async (_event, filePath: string) => {
    const messages = await parseSessionFile(filePath)
    return analyzeSession(messages)
  })

  // Per-model token usage (main JSONL + subagent JSONLs), mirroring /cost
  ipcMain.handle(IPC_CHANNELS.SESSION_MODEL_USAGE, async (_event, filePath: string) => {
    return collectSessionUsage(filePath)
  })

  // Delete session
  ipcMain.handle(
    IPC_CHANNELS.SESSION_DELETE,
    async (_event, data: { filePath: string; sessionId: string }) => {
      return deleteSession(data.filePath, data.sessionId)
    }
  )

  // Subagent handlers
  ipcMain.handle(IPC_CHANNELS.SUBAGENTS_LIST, async (_event, sessionFilePath: string) => {
    // sessionFilePath is like .../projects/X/abc-123.jsonl
    // subagents dir is .../projects/X/abc-123/subagents/
    const sessionId = require('path').basename(sessionFilePath, '.jsonl')
    const sessionDir = require('path').join(require('path').dirname(sessionFilePath), sessionId, 'subagents')
    if (!fs.existsSync(sessionDir)) return []

    const agents: { agentId: string; filePath: string; agentType: string; description: string }[] = []
    const files = fs.readdirSync(sessionDir)
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue
      const agentId = file.replace('.jsonl', '').replace('agent-', '')
      const metaPath = require('path').join(sessionDir, file.replace('.jsonl', '.meta.json'))
      let agentType = 'Agent'
      let description = ''
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          agentType = meta.agentType || 'Agent'
          description = meta.description || ''
        } catch { /* skip */ }
      }
      agents.push({
        agentId,
        filePath: require('path').join(sessionDir, file),
        agentType,
        description
      })
    }
    return agents
  })

  ipcMain.handle(IPC_CHANNELS.SUBAGENT_LOAD, async (_event, filePath: string) => {
    return parseSessionFile(filePath, { includeSidechain: true })
  })

  // Open session in Claude Code terminal
  ipcMain.on(IPC_CHANNELS.OPEN_IN_CLAUDE, (_event, data: { sessionId: string; projectPath: string }) => {
    const { sessionId, projectPath } = data
    const cwd = fs.existsSync(projectPath) ? projectPath : require('os').homedir()

    if (process.platform === 'win32') {
      // shell:true is required because wt.exe is a WindowsApps execution
      // alias (reparse point) that Node's spawn cannot resolve directly.
      // wt's -d / start's /D set the cwd — do NOT chain `cd && claude`, that
      // leaks `&&` to the outer shell and spawns a second stray window.
      const wtCmd = `wt.exe -d "${cwd}" -- cmd /k claude --resume ${sessionId}`
      spawn(wtCmd, { detached: true, stdio: 'ignore', shell: true })
        .on('error', () => {
          const fallback = `start "Claude Code" /D "${cwd}" cmd /k claude --resume ${sessionId}`
          spawn(fallback, { detached: true, stdio: 'ignore', shell: true })
        })
    } else if (process.platform === 'darwin') {
      spawn('osascript', ['-e', `tell app "Terminal" to do script "cd '${cwd}' && claude --resume ${sessionId}"`], {
        detached: true, stdio: 'ignore'
      })
    } else {
      // Linux: try common terminal emulators
      const terminals = ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xterm']
      for (const term of terminals) {
        try {
          spawn(term, ['-e', `bash -c 'cd "${cwd}" && claude --resume ${sessionId}; exec bash'`], {
            detached: true, stdio: 'ignore'
          })
          break
        } catch { continue }
      }
    }
  })

  ipcMain.on(IPC_CHANNELS.OPEN_EXTERNAL, (_event, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.on(IPC_CHANNELS.SHOW_IN_FOLDER, (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.on(IPC_CHANNELS.OPEN_FOLDER, (_event, folderPath: string) => {
    shell.openPath(folderPath)
  })

  // Window controls (frameless titlebar)
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE_TOGGLE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })

  const mainWindow = createWindow()

  // Watch ~/.claude/projects/ for new sessions and notify renderer
  const projectsDir = require('path').join(require('os').homedir(), '.claude', 'projects')
  try {
    fs.watch(projectsDir, { recursive: true }, (_event, filename) => {
      if (filename && (filename.endsWith('.jsonl') || filename.endsWith('sessions-index.json'))) {
        mainWindow.webContents.send('sessions:changed')
      }
    })
  } catch {
    // Watching not supported or dir doesn't exist
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
