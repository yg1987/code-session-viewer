import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { decodeProjectPath } from './path-utils'

export interface SessionEntry {
  sessionId: string
  fullPath: string
  customTitle: string
  firstPrompt: string
  summary: string
  messageCount: number
  fileSize: number
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

export function getClaudeProjectsDir(): string {
  return path.join(os.homedir(), '.claude', 'projects')
}

export function decodeProjectPath(dirName: string): string {
  // Encoding: C--Users-lizenglong becomes C:\Users\lizenglong
  // First "--" after a single letter is drive separator ":\", rest "-" are path separators "\"
  // But some paths have hyphens in folder names, e.g. "Test-skills"
  // The encoding actually uses double dashes for path separators
  // Single char + "--" = drive letter, then "--" = path separator

  // Actually from the data: "i--AutoComplete" = "i:\AutoComplete"
  // "C--Users-lizenglong--claude" = "C:\Users\lizenglong\.claude"
  // So: first letter + "--" = drive, then "--" = \, and single "-" = "-" in name?
  // Wait: "C--Users-lizenglong" must be "C:\Users\lizenglong"
  // That means single "-" IS a path separator too
  // But "Test-skills" has a hyphen...

  // The actual encoding from Claude Code source: replace non-alphanumeric with "-"
  // But then "--" could be ambiguous. Let's use a simpler heuristic:
  // First char + first "--" = "X:\"
  // Remaining: split on "--" for path segments that may contain single "-"
  // Actually the simplest correct approach: first two chars if "X-" → drive root

  const parts = dirName.split('--')
  if (parts.length >= 2 && parts[0].length === 1) {
    // Drive letter pattern: "C--Users-..." → "C:\" + rest
    const drive = parts[0].toUpperCase() + ':\\'
    const rest = parts.slice(1).join('\\')
    return drive + rest
  }

  // No drive letter, just replace -- with path sep
  return parts.join(path.sep)
}

export async function discoverSessions(): Promise<ProjectGroup[]> {
  const projectsDir = getClaudeProjectsDir()
  if (!fs.existsSync(projectsDir)) return []

  const groups: ProjectGroup[] = []
  const dirEntries = fs.readdirSync(projectsDir, { withFileTypes: true })

  for (const dirEntry of dirEntries) {
    if (!dirEntry.isDirectory()) continue

    const encodedName = dirEntry.name
    const projectDir = path.join(projectsDir, encodedName)

    // Try reading sessions-index.json first
    const indexPath = path.join(projectDir, 'sessions-index.json')
    let sessions: SessionEntry[] = []

    if (fs.existsSync(indexPath)) {
      sessions = readSessionIndex(indexPath, projectDir)
    }

    if (sessions.length === 0) {
      // Fallback: scan for .jsonl files
      sessions = scanJsonlFiles(projectDir)
    }

    if (sessions.length === 0) continue

    // Determine project path from index or decode dir name
    let projectPath = decodeProjectPath(encodedName)
    if (sessions[0]?.projectPath) {
      projectPath = sessions[0].projectPath
    }

    // Skip claude-mem observer-sessions and other non-user project directories
    if (projectPath.includes('.claude-mem') || projectPath.includes('\\claude-mem\\')) continue

    // Sort sessions by modified date, newest first
    sessions.sort(
      (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()
    )

    groups.push({ projectPath, encodedName, sessions })
  }

  // Sort groups by most recently modified session
  groups.sort((a, b) => {
    const aTime = a.sessions[0]
      ? new Date(a.sessions[0].modified).getTime()
      : 0
    const bTime = b.sessions[0]
      ? new Date(b.sessions[0].modified).getTime()
      : 0
    return bTime - aTime
  })

  return groups
}

function readSessionIndex(indexPath: string, projectDir: string): SessionEntry[] {
  try {
    const raw = fs.readFileSync(indexPath, 'utf-8')
    const index = JSON.parse(raw)
    const entries: SessionEntry[] = []
    const seenIds = new Set<string>()

    for (const entry of index.entries || []) {
      // Deduplicate by sessionId
      const sid = entry.sessionId || ''
      if (seenIds.has(sid)) continue
      seenIds.add(sid)

      // Verify the JSONL file exists
      let fullPath = entry.fullPath
      if (!fs.existsSync(fullPath)) {
        // Try relative to project dir
        fullPath = path.join(projectDir, `${entry.sessionId}.jsonl`)
        if (!fs.existsSync(fullPath)) continue
      }

      let fileSize = 0
      try { fileSize = fs.statSync(fullPath).size } catch (e) { console.debug('session-discovery: stat failed for', fullPath, e) }

      // Skip sessions whose firstPrompt is an error message (no real user content)
      let fp = entry.firstPrompt || ''
      if (fp.startsWith('API Error:') || /^HTTP error|^Error:|^\d{3}\s(error|unknown|upstream)/i.test(fp)) continue

      // If firstPrompt is a caveat, re-extract from the JSONL to find the real user message
      if (isNonUserContent(fp)) {
        const meta = extractMetadataFromJsonl(fullPath)
        if (meta?.firstPrompt) fp = meta.firstPrompt
      }

      entries.push({
        sessionId: entry.sessionId || '',
        fullPath,
        customTitle: extractCustomTitle(fullPath),
        firstPrompt: fp,
        summary: entry.summary || '',
        messageCount: entry.messageCount || 0,
        fileSize,
        created: entry.created || '',
        modified: entry.modified || entry.created || '',
        gitBranch: entry.gitBranch || '',
        projectPath: entry.projectPath || index.originalPath || '',
        isSidechain: entry.isSidechain || false
      })
    }

    return entries.filter((e) => !e.isSidechain)
  } catch (e) {
    console.debug('session-discovery: failed to read session index', indexPath, e)
    return []
  }
}

function scanJsonlFiles(projectDir: string): SessionEntry[] {
  const sessions: SessionEntry[] = []

  try {
    const files = fs.readdirSync(projectDir)
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue
      // Skip subagent files
      if (file.startsWith('agent-')) continue

      const fullPath = path.join(projectDir, file)
      const sessionId = file.replace('.jsonl', '')

      // Read first few lines to extract metadata
      const metadata = extractMetadataFromJsonl(fullPath)
      if (!metadata) continue

      const stat = fs.statSync(fullPath)

      sessions.push({
        sessionId,
        fullPath,
        customTitle: metadata.customTitle || '',
        firstPrompt: metadata.firstPrompt || 'No prompt',
        summary: '',
        messageCount: metadata.lineCount,
        fileSize: stat.size,
        created: metadata.firstTimestamp || stat.birthtime.toISOString(),
        modified: metadata.lastTimestamp || stat.mtime.toISOString(),
        gitBranch: metadata.gitBranch || '',
        projectPath: metadata.cwd || '',
        isSidechain: false
      })
    }
  } catch (e) {
    console.debug('session-discovery: directory read error for', projectDir, e)
  }

  return sessions
}

interface JsonlMetadata {
  firstPrompt?: string
  customTitle?: string
  firstTimestamp?: string
  lastTimestamp?: string
  gitBranch?: string
  cwd?: string
  lineCount: number
}

/** Check if a session file has no actual conversation (only metadata entries) */
function isEmptySession(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath)
    // Very small files can't have real conversation
    if (stat.size < 500) {
      // Double check: look for any user or assistant message
      const content = fs.readFileSync(filePath, 'utf-8')
      return !content.includes('"type":"user"') && !content.includes('"type":"assistant"')
    }
    return false
  } catch (e) {
    console.debug('session-discovery: isEmptySession failed for', filePath, e)
    return false
  }
}

/** Extract customTitle from a JSONL file by scanning for custom-title entries */
function extractCustomTitle(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    // Scan from the end since custom-title is often set/updated later
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim()
      if (!line) continue
      if (!line.includes('custom-title')) continue
      try {
        const obj = JSON.parse(line)
        if (obj.type === 'custom-title' && obj.customTitle) {
          return obj.customTitle
        }
      } catch {
        // skip
      }
    }
  } catch (e) {
    console.debug('session-discovery: extractCustomTitle failed for', filePath, e)
  }
  return ''
}

/** Check if user content is a system prompt, teammate forward, caveat, or error message */
function isNonUserContent(text: string): boolean {
  return /<(observed_from_primary_session|environment_context|permissions|app-context|collaboration_mode|skills_instructions|plugins_instructions)/.test(text)
    || /<teammate-/.test(text)
    || /\b(CRITICAL:|WHAT TO RECORD|WHEN TO SKIP|SPATIAL AWARENESS)/.test(text)
    || /^Caveat[:\s—–-]/i.test(text)
    || /^The messages below were/.test(text)
    || /^API Error:/.test(text)
    || /^\d{3}\s/.test(text)
}

function extractMetadataFromJsonl(filePath: string): JsonlMetadata | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').filter((l) => l.trim())
    if (lines.length === 0) return null

    let firstPrompt: string | undefined
    let customTitle: string | undefined
    let firstTimestamp: string | undefined
    let lastTimestamp: string | undefined
    let gitBranch: string | undefined
    let cwd: string | undefined

    // Scan for customTitle from end
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i].trim()
      if (!l || !l.includes('custom-title')) continue
      try {
        const obj = JSON.parse(l)
        if (obj.type === 'custom-title' && obj.customTitle) {
          customTitle = obj.customTitle
          break
        }
      } catch { /* skip */ }
    }

    // Read first 20 lines for metadata
    const scanLines = lines.slice(0, 20)
    for (const line of scanLines) {
      try {
        const obj = JSON.parse(line)
        if (!firstTimestamp && obj.timestamp) {
          firstTimestamp = obj.timestamp
        }
        if (obj.gitBranch && !gitBranch) {
          gitBranch = obj.gitBranch
        }
        if (obj.cwd && !cwd) {
          cwd = obj.cwd
        }
        if (
          !firstPrompt &&
          obj.type === 'user' &&
          obj.message?.role === 'user'
        ) {
          const content = obj.message.content
          let text = ''
          if (typeof content === 'string') {
            text = content
          } else if (Array.isArray(content)) {
            const textBlock = content.find(
              (c: { type: string }) => c.type === 'text'
            )
            if (textBlock?.text) text = textBlock.text
          }
          // Skip system prompts forwarded to teammate agents
          if (text && !isNonUserContent(text)) {
            firstPrompt = text.slice(0, 200)
          }
        }
      } catch {
        // skip malformed
      }
    }

    // Read last line for last timestamp
    const lastLine = lines[lines.length - 1]
    try {
      const obj = JSON.parse(lastLine)
      lastTimestamp = obj.timestamp
    } catch (e) {
      console.debug('session-discovery: failed to parse last line JSON for', filePath, e)
    }

    return {
      firstPrompt,
      customTitle,
      firstTimestamp,
      lastTimestamp,
      gitBranch,
      cwd,
      lineCount: lines.length
    }
  } catch (e) {
    console.debug('session-discovery: extractMetadataFromJsonl failed for', filePath, e)
    return null
  }
}
