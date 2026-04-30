export interface SessionEntry {
  sessionId: string
  fullPath: string
  customTitle: string
  firstPrompt: string
  summary: string
  messageCount: number
  fileSize: number  // bytes
  created: string
  modified: string
  gitBranch: string
  projectPath: string
  isSidechain: boolean
}

export interface ProjectGroup {
  projectPath: string
  encodedName: string
  sessions: SessionEntry[]
}
