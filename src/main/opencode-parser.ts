/**
 * OpenCode session parser.
 *
 * REVERSE-ENGINEERED ACTUAL SCHEMA (not plan.md's guess):
 *
 * === message table ===
 *   id, session_id, time_created (int ms), time_updated (int ms), data (JSON)
 *
 *   message.data shape:
 *     user:
 *       { role: 'user', time, agent, model: {providerID, modelID}, summary }
 *       Note: no parentID — these are root messages
 *
 *     assistant:
 *       { parentID, role: 'assistant', mode, agent, path, cost, tokens,
 *         modelID, providerID, time, finish }
 *       cost = { total, input_cost, output_cost, cache_read_cost, cache_write_cost }
 *       tokens = { input, output, reasoning, cache_read, cache_write }
 *
 * === part table ===
 *   id, message_id, session_id, time_created (int ms), time_updated (int ms), data (JSON)
 *
 *   part.data is an object whose type field determines the shape:
 *     type: 'text'     → { type, text }
 *     type: 'reasoning'→ { type, text, time }
 *     type: 'tool'     → { type, tool, callID, state: {status, input, output, ...} }
 *     type: 'step-start' → { type, snapshot }
 *     type: 'step-finish'→ { type, reason, snapshot, tokens, cost }
 *     type: 'patch'    → ?
 *     type: 'file'     → ?
 *     type: 'compaction' → ?
 */

import { getOpenCodeDb } from './opencode-db'
import type { ParsedMessage, ContentBlock, ToolResult } from '../renderer/types/message'

export async function parseOpenCodeSession(dbPath: string, sessionId: string): Promise<ParsedMessage[]> {
  const db = await getOpenCodeDb(dbPath)

  // Query messages
  const msgRes = db.exec(
    `SELECT id, session_id, time_created, data FROM message
     WHERE session_id = ?
     ORDER BY time_created ASC`,
    [sessionId]
  )

  if (!msgRes.length || !msgRes[0].values.length) return []

  const cols = msgRes[0].columns
  const ci = (name: string) => cols.indexOf(name)

  const messages: { id: string; time_created: number; data: any }[] = []
  for (const row of msgRes[0].values) {
    const raw = row[ci('data')] as string
    messages.push({
      id: row[ci('id')] as string,
      time_created: row[ci('time_created')] as number,
      data: JSON.parse(raw)
    })
  }

  // Query parts
  const messageIds = messages.map(m => m.id)
  const partsByMsg = new Map<string, any[]>()
  for (const mid of messageIds) partsByMsg.set(mid, [])

  const partRes = db.exec(
    `SELECT id, message_id, session_id, time_created, data FROM part
     WHERE message_id IN (${messageIds.map(() => '?').join(',')})
     ORDER BY time_created ASC`,
    messageIds
  )

  if (partRes.length > 0 && partRes[0].values) {
    const pCols = partRes[0].columns
    const pc = (name: string) => pCols.indexOf(name)
    for (const row of partRes[0].values) {
      const mid = row[pc('message_id')] as string
      if (!partsByMsg.has(mid)) partsByMsg.set(mid, [])
      partsByMsg.get(mid)!.push({
        id: row[pc('id')] as string,
        time_created: row[pc('time_created')] as number,
        data: JSON.parse(row[pc('data')] as string)
      })
    }
  }

  // Build tree: messages without parentID are roots (user),
  // messages WITH parentID are children (assistant)
  const rootMsgs: typeof messages = []
  const childMap = new Map<string, typeof messages>()

  for (const msg of messages) {
    if (msg.data.parentID) {
      const pid = msg.data.parentID as string
      if (!childMap.has(pid)) childMap.set(pid, [])
      childMap.get(pid)!.push(msg)
    } else {
      rootMsgs.push(msg)
    }
  }

  const result: ParsedMessage[] = []

  for (const root of rootMsgs) {
    const role = mapRole(root.data.role)
    // User message text comes from parts, NOT from data.summary (which is a diff object)
    const rootParts = partsByMsg.get(root.id) || []
    const rootContent = parseParts(rootParts)

    result.push({
      id: root.id,
      role,
      timestamp: msToISO(root.time_created),
      content: rootContent.length > 0 ? rootContent : [{ type: 'text', text: '' }],
      model: typeof root.data.model === 'object' ? root.data.model?.modelID : root.data.model,
      agent: root.data.agent as string | undefined,
      tokenUsage: undefined
    })

    // Children (assistant responses)
    const children = childMap.get(root.id) || []
    children.sort((a, b) => a.time_created - b.time_created)

    for (const child of children) {
      const parts = partsByMsg.get(child.id) || []
      const content = parseParts(parts)
      const tokenUsage = extractTokens(child.data, parts)

      result.push({
        id: child.id,
        role: 'assistant',
        timestamp: msToISO(child.time_created),
        content,
        model: child.data.modelID || child.data.model || undefined,
        agent: child.data.agent as string | undefined,
        tokenUsage
      })
    }
  }

  return result
}

function msToISO(ms: number): string {
  return new Date(ms).toISOString()
}

function mapRole(role: string): 'user' | 'assistant' {
  return role === 'user' ? 'user' : 'assistant'
}

/**
 * Parse part rows into ContentBlock[].
 * part.data.type determines the shape — we extract fields from the JSON blob.
 */
function parseParts(partRows: any[]): ContentBlock[] {
  const blocks: ContentBlock[] = []

  for (const row of partRows) {
    const d = row.data
    const t = d.type as string

    switch (t) {
      case 'text':
        if (d.text) blocks.push({ type: 'text', text: d.text })
        break

      case 'reasoning':
        if (d.text) blocks.push({ type: 'thinking', thinking: d.text })
        break

      case 'tool': {
        const tb = parseToolData(d)
        if (tb) blocks.push(tb)
        break
      }

      case 'step-start':
        break

      case 'step-finish':
        // Token info is extracted at message level, but emit a compact marker if present
        // Skip noisy step-finish — it's just metadata
        break

      case 'patch':
        if (d.text) {
          const txt = d.text as string
          const trimmed = txt.length > 5000 ? txt.slice(0, 5000) + '...' : txt
          blocks.push({ type: 'text', text: '📝 File change (diff):\n```diff\n' + trimmed + '\n```' })
        }
        break

      case 'file':
        if (d.filename) {
          const si = d.summary ? ' (' + d.summary + ')' : ''
          blocks.push({ type: 'text', text: '📎 File: `' + d.filename + '`' + si })
        }
        break

      case 'compaction':
        blocks.push({
          type: 'text',
          text: '🔄 Context compaction:\n' + (d.text || d.summary || 'Context was compacted.')
        })
        break

      default:
        if (d.text) {
          blocks.push({ type: 'text', text: '[' + t + ']: ' + d.text })
        }
        break
    }
  }

  return blocks
}

function parseToolData(d: any): ContentBlock | null {
  if (!d.tool && !d.callID) return null
  let input: Record<string, unknown> = {}
  let result: ToolResult | undefined

  if (d.state) {
    const st = d.state
    if (st.input) {
      input = typeof st.input === 'string' ? { _raw: st.input } : st.input
    }
    if (st.output !== undefined) {
      result = {
        content: typeof st.output === 'string' ? st.output : JSON.stringify(st.output, null, 2),
        is_error: st.status === 'error'
      }
    }
    if (!result && (st.status === 'pending' || st.status === 'running')) {
      result = { content: '[Tool ' + st.status + ']' }
    }
  }

  return {
    type: 'tool_use',
    id: (d.callID || d.id || '') as string,
    name: (d.tool || 'unknown') as string,
    input,
    result
  }
}

function extractTokens(msgData: any, parts: any[]): ParsedMessage['tokenUsage'] | undefined {
  let inputTokens: number | undefined
  let outputTokens: number | undefined
  let cacheRead: number | undefined
  let cacheCreation: number | undefined

  // From message.data.tokens
  if (msgData.tokens) {
    const t = msgData.tokens
    if (typeof t.input === 'number') inputTokens = t.input
    if (typeof t.output === 'number') outputTokens = t.output
    if (typeof t.cache_read === 'number') cacheRead = t.cache_read
    if (typeof t.cache_write === 'number') cacheCreation = t.cache_write
  }

  // Also check step-finish parts for token data
  for (const row of parts) {
    const d = row.data
    if (d.type !== 'step-finish') continue
    if (d.tokens) {
      const t = d.tokens
      if (typeof t.input === 'number') inputTokens = (inputTokens || 0) + t.input
      if (typeof t.output === 'number') outputTokens = (outputTokens || 0) + t.output
      if (typeof t.cache_read === 'number') cacheRead = (cacheRead || 0) + t.cache_read
      if (typeof t.cache_write === 'number') cacheCreation = (cacheCreation || 0) + t.cache_write
    }
  }

  if (inputTokens || outputTokens || cacheRead || cacheCreation) {
    return { inputTokens, outputTokens, cacheRead, cacheCreation }
  }
  return undefined
}

/**
 * OpenCode Todo types
 */
export interface OpenCodeTodo {
  id: string
  sessionId: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  created: string
  updated: string
}

/**
 * Fetch todos for a given OpenCode session.
 * Uses PRAGMA to detect actual column names since schema varies.
 */
export async function getOpenCodeTodos(dbPath: string, sessionId: string): Promise<OpenCodeTodo[]> {
  const db = await getOpenCodeDb(dbPath)

  // Detect actual column names via PRAGMA
  let idCol = 'rowid'
  let descCol = 'description'
  let statusCol = 'status'
  let createdCol = 'time_created'
  let updatedCol = 'time_updated'
  let sessionCol = 'session_id'

  try {
    const pragmaRes = db.exec('PRAGMA table_info(todo)')
    if (pragmaRes.length > 0 && pragmaRes[0].values) {
      const cols = pragmaRes[0].columns
      const ci = (name: string) => cols.indexOf(name)
      const colNames = new Set(pragmaRes[0].values.map((r) => r[ci('name')] as string))
      // Map known column names
      if (!colNames.has('id')) {
        for (const c of colNames) {
          if (c === 'todo_id') idCol = c
          if (c === 'content') descCol = c
          if (c === 'kind') statusCol = c
          if (c === 'time_created' || c === 'created_at') createdCol = c
          if (c === 'time_updated' || c === 'updated_at') updatedCol = c
          if (c === 'session_id' || c === 'sessionId') sessionCol = c
        }
      }
    }
  } catch {
    // fall through with defaults
  }

  const res = db.exec(
    `SELECT ${idCol}, ${sessionCol}, ${descCol}, ${statusCol}, ${createdCol}, ${updatedCol}
     FROM todo
     WHERE ${sessionCol} = ?
     ORDER BY ${createdCol} ASC`,
    [sessionId]
  )

  if (!res.length || !res[0].values) return []

  const cols = res[0].columns
  const ci = (name: string) => cols.indexOf(name)

  const todos: OpenCodeTodo[] = []
  for (const row of res[0].values) {
    const rawStatus = (row[ci(statusCol)] as string) || 'pending'
    const status = rawStatus === 'in_progress' || rawStatus === 'completed' ? rawStatus : 'pending'
    todos.push({
      id: row[ci(idCol)] as string,
      sessionId: row[ci(sessionCol)] as string,
      description: (row[ci(descCol)] as string) || '',
      status,
      created: msToISO(row[ci(createdCol)] as number),
      updated: msToISO(row[ci(updatedCol)] as number)
    })
  }

  return todos
}
