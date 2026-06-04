import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/constants'

const api = {
  getSessions: () => ipcRenderer.invoke(IPC_CHANNELS.SESSIONS_LIST),
  loadSession: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_LOAD, filePath),
  loadSessionRaw: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_LOAD_RAW, filePath),
  exportSession: (data: {
    filePath: string
    title: string
    projectPath: string
    sessionId: string
  }) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_EXPORT, data),
  exportSessionMd: (data: {
    filePath: string
    title: string
    projectPath: string
    sessionId: string
  }) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_EXPORT_MD, data),
  listSubagents: (sessionFilePath: string) => ipcRenderer.invoke(IPC_CHANNELS.SUBAGENTS_LIST, sessionFilePath),
  loadSubagent: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.SUBAGENT_LOAD, filePath),
  getSessionInsights: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_INSIGHTS, filePath),
  getSessionModelUsage: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_MODEL_USAGE, filePath),
  renameSession: (data: { filePath: string; sessionId: string; newTitle: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_RENAME, data),
  deleteSession: (data: { filePath: string; sessionId: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_DELETE, data),
  getGlobalStats: () => ipcRenderer.invoke(IPC_CHANNELS.GLOBAL_STATS),
  crossSearch: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.CROSS_SEARCH, query),
  openInClaude: (data: { sessionId: string; projectPath: string }) =>
    ipcRenderer.send(IPC_CHANNELS.OPEN_IN_CLAUDE, data),
  openExternal: (url: string) => ipcRenderer.send(IPC_CHANNELS.OPEN_EXTERNAL, url),
  showInFolder: (filePath: string) => ipcRenderer.send(IPC_CHANNELS.SHOW_IN_FOLDER, filePath),
  openFolder: (folderPath: string) => ipcRenderer.send(IPC_CHANNELS.OPEN_FOLDER, folderPath),
  onSessionsChanged: (callback: () => void) => {
    ipcRenderer.on('sessions:changed', callback)
    return () => { ipcRenderer.removeListener('sessions:changed', callback) }
  },

  // Window controls (frameless titlebar)
  windowMinimize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
  windowMaximizeToggle: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE_TOGGLE),
  windowClose: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),
  windowIsMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
  onWindowStateChanged: (callback: (state: { isMaximized: boolean }) => void) => {
    const handler = (_event: unknown, state: { isMaximized: boolean }) => callback(state)
    ipcRenderer.on('window:state-changed', handler)
    return () => { ipcRenderer.removeListener('window:state-changed', handler) }
  },

  // ─── OpenCode API (NEW) ──────────────────────────────────────

  /** Detect the opencode.db path on disk */
  detectOpenCodeDb: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.OPENCODE_DETECT_DB),

  /** List all OpenCode sessions, grouped by project */
  getOpenCodeSessions: (dbPath: string) => ipcRenderer.invoke(IPC_CHANNELS.OPENCODE_SESSIONS_LIST, dbPath),

  /** Load messages for an OpenCode session */
  loadOpenCodeSession: (dbPath: string, sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OPENCODE_SESSION_LOAD, dbPath, sessionId),

  /** Delete an OpenCode session */
  deleteOpenCodeSession: (dbPath: string, sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OPENCODE_SESSION_DELETE, dbPath, sessionId),

  /** Cross-session search across OpenCode data */
  openCodeCrossSearch: (dbPath: string, query: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OPENCODE_CROSS_SEARCH, dbPath, query),

  /** Global stats for OpenCode sessions */
  openCodeGlobalStats: (dbPath: string) => ipcRenderer.invoke(IPC_CHANNELS.OPENCODE_GLOBAL_STATS, dbPath),

  /** Todos for an OpenCode session */
  getOpenCodeTodos: (dbPath: string, sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.OPENCODE_SESSION_TODOS, dbPath, sessionId),

  /** Load viewer settings */
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_LOAD),

  /** Save viewer settings */
  setSettings: (settings: any) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings)
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
