/**
 * Codex session discovery.
 * Scans the Codex sessions directory tree (sessions/YYYY/MM/DD/)
 * for rollout-*.jsonl files and extracts session metadata from
 * the first line (session_meta record).
 *
 * Actual Codex rollout format (reverse-engineered from real data):
 *   Line 1: {"timestamp":"...","type":"session_meta","payload":{"id":"...","cwd":"...","model_provider":"...",...}}
 *   Lines 2+: {"timestamp":"...","type":"response_item|event_msg|turn_context","payload":{...}}
 *
 * Sessions are grouped by payload.cwd, analogous to OpenCode's project.worktree.
 */

import * as fs from 'fs'
import * as path from 'path'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'

import { encodeProjectPath } from './path-utils'
import type { ProjectGroup, SessionEntry } from '../renderer/types/session'

/**
 * Discover all Codex sessions from the given codex home directory.
 */
export async function discoverCodexSessions(codexHome: string): Promise<ProjectGroup[]> {
  const sessionsDir = path.join(codexHome, 'sessions')
  if (!fs.existsSync(sessionsDir)) {
    return []
  }

  const entries: SessionEntry[] = []

  // Walk the YYYY/MM/DD directory tree
  await walkDateDirs(sessionsDir, entries)

  // Sort by modified time descending
  entries.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())

  // Group by cwd (projectPath)
  const groupMap = new Map<string, SessionEntry[]>()
  const projectEncodedNames = new Map<string, string>()

  for (const entry of entries) {
    const projectPath = entry.projectPath || 'Unknown project'
    const encodedName = encodeProjectPath(projectPath)

    if (!projectEncodedNames.has(encodedName)) {
      projectEncodedNames.set(encodedName, projectPath)
    }

    if (!groupMap.has(encodedName)) {
      groupMap.set(encodedName, [])
    }
    groupMap.get(encodedName)!.push(entry)
  }

  const groups: ProjectGroup[] = []
  for (const [encodedName, sessions] of groupMap) {
    groups.push({
      projectPath: projectEncodedNames.get(encodedName) || 'Unknown project',
      encodedName,
      sessions
    })
  }

  // Sort groups by most recent session
  groups.sort((a, b) => {
    const aTime = a.sessions[0] ? new Date(a.sessions[0].modified).getTime() : 0
    const bTime = b.sessions[0] ? new Date(b.sessions[0].modified).getTime() : 0
    return bTime - aTime
  })

  return groups
}

async function walkDateDirs(dir: string, entries: SessionEntry[]): Promise<void> {
  try {
    for (const year of fs.readdirSync(dir)) {
      if (!/^\d{4}$/.test(year)) continue
      const yearPath = path.join(dir, year)
      if (!fs.statSync(yearPath).isDirectory()) continue

      for (const month of fs.readdirSync(yearPath)) {
        if (!/^\d{2}$/.test(month)) continue
        const monthPath = path.join(yearPath, month)
        if (!fs.statSync(monthPath).isDirectory()) continue

        for (const day of fs.readdirSync(monthPath)) {
          if (!/^\d{2}$/.test(day)) continue
          const dayPath = path.join(monthPath, day)
          if (!fs.statSync(dayPath).isDirectory()) continue

          for (const file of fs.readdirSync(dayPath)) {
            if (!file.startsWith('rollout-') || !file.endsWith('.jsonl')) continue
            const filePath = path.join(dayPath, file)

            const entry = await parseSessionMeta(filePath)
            if (entry) entries.push(entry)
          }
        }
      }
    }
  } catch (e) {
    console.debug('codex-discovery: walkDateDirs failed for', dir, e)
  }
}

/**
 * Parse the session_meta line from a Codex rollout file.
 * Real format: {"timestamp":"...","type":"session_meta","payload":{ id, cwd, model_provider, ... }}
 */
async function parseSessionMeta(filePath: string): Promise<SessionEntry | null> {
  try {
    const stat = fs.statSync(filePath)
    if (stat.size === 0) return null

    const metaLine = await readFirstLine(filePath)
    if (!metaLine) return null

    let parsed: { type?: string; payload?: Record<string, string> }
    try {
      parsed = JSON.parse(metaLine)
    } catch (e) {
      console.debug('codex-discovery: failed to parse session meta JSON for', filePath, e)
      return null
    }

    // Real format: {"type":"session_meta","payload":{...}}
    if (parsed.type !== 'session_meta' || !parsed.payload) return null

    const p = parsed.payload
    const sessionId = p.id || path.basename(filePath, '.jsonl')
    const cwd = p.cwd || ''
    const modelProvider = p.model_provider || ''
    const cliVersion = p.cli_version || ''
    const originator = p.originator || ''
    const timestamp = p.timestamp || ''

    // Scan a few lines for the first user_message to extract firstPrompt
    const firstPrompt = await extractFirstPrompt(filePath)

    const entry: SessionEntry = {
      sessionId,
      fullPath: filePath,
      customTitle: '',
      firstPrompt,
      summary: modelProvider ? `${modelProvider} (${originator})` : originator,
      messageCount: 0,
      fileSize: stat.size,
      created: timestamp,
      modified: stat.mtime.toISOString(),
      gitBranch: '',
      projectPath: cwd,
      isSidechain: false,
      source: 'codex',
      model: modelProvider || undefined,
      agent: originator || (cliVersion ? `codex-${cliVersion}` : 'codex')
    }

    // Count lines (approximate message count)
    entry.messageCount = await countEventLines(filePath)

    return entry
  } catch (e) {
    console.debug('codex-discovery: parseSessionMeta failed for', filePath, e)
    return null
  }
}

/**
 * Extract the first user message text from a rollout file.
 * Looks for {"type":"event_msg","payload":{"type":"user_message","message":"..."}}
 */
async function extractFirstPrompt(filePath: string): Promise<string> {
  try {
    const lines = await readFirstNLines(filePath, 20)
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        // Real Codex format: type="event_msg", payload.type="user_message"
        if (parsed.type === 'event_msg' && parsed.payload?.type === 'user_message' && parsed.payload.message) {
          return parsed.payload.message.slice(0, 200)
        }
      } catch {
        // skip unparseable lines
      }
    }
  } catch (e) {
    console.debug('codex-discovery: extractFirstPrompt failed for', filePath, e)
  }
  return ''
}

/**
 * Count the event lines (all lines minus the session_meta line).
 */
async function countEventLines(filePath: string): Promise<number> {
  let count = 0
  try {
    const stream = createReadStream(filePath, { encoding: 'utf-8' })
    const rl = createInterface({ input: stream, crlfDelay: Infinity })
    for await (const _line of rl) {
      count++
      if (count > 10000) break // cap for very large files
    }
  } catch (e) {
    console.debug('codex-discovery: countEventLines failed for', filePath, e)
  }
  return Math.max(0, count - 1) // minus session_meta line
}

function readFirstLine(filePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const stream = createReadStream(filePath, { encoding: 'utf-8' })
    const rl = createInterface({ input: stream, crlfDelay: Infinity })
    let resolved = false

    rl.on('line', (line) => {
      if (!resolved) {
        resolved = true
        rl.close()
        stream.close()
        resolve(line)
      }
    })

    rl.on('error', () => { if (!resolved) resolve(null) })
    rl.on('close', () => { if (!resolved) resolve(null) })
  })
}

function readFirstNLines(filePath: string, n: number): Promise<string[]> {
  return new Promise((resolve) => {
    const lines: string[] = []
    const stream = createReadStream(filePath, { encoding: 'utf-8' })
    const rl = createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', (line) => {
      lines.push(line)
      if (lines.length >= n) { rl.close(); stream.close() }
    })
    rl.on('error', () => resolve(lines))
    rl.on('close', () => resolve(lines))
  })
}
