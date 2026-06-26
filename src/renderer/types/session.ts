import type { SessionSource } from '../../shared/constants'

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
  /** Data source — 'claude' (JSONL), 'opencode' (SQLite), or 'codex' (JSONL) */
  source?: SessionSource
  /** For OpenCode sessions: path to the opencode.db */
  dbPath?: string
  /** OpenCode: agent that handled this session */
  agent?: string
  /** OpenCode: model used */
  model?: string
  /** OpenCode: total cost in USD */
  cost?: number
  /** OpenCode: total input tokens */
  tokensInput?: number
  /** OpenCode: total output tokens */
  tokensOutput?: number
  /** OpenCode: total reasoning tokens */
  tokensReasoning?: number
}

export interface ProjectGroup {
  projectPath: string
  encodedName: string
  sessions: SessionEntry[]
}
