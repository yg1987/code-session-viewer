/**
 * OpenCode cross-session search.
 * Searches part.data JSON text fields using LIKE matching.
 */

import { getOpenCodeDb } from './opencode-db'

export interface OpenCodeSearchResult {
  sessionId: string
  sessionTitle: string
  projectPath: string
  messageId: string
  timestamp: string
  snippet: string
  matchField: 'text' | 'reasoning' | 'tool'
}

export async function openCodeCrossSearch(
  dbPath: string,
  query: string
): Promise<OpenCodeSearchResult[]> {
  const db = await getOpenCodeDb(dbPath)
  const likeQ = `%${query}%`

  // Search part.data JSON text
  const partRes = db.exec(
    `SELECT
      pt.id, pt.message_id, pt.session_id, pt.time_created, pt.data
     FROM part pt
     WHERE pt.data LIKE ?
     ORDER BY pt.time_created DESC
     LIMIT 200`,
    [likeQ]
  )

  const results: OpenCodeSearchResult[] = []
  const seenSessions = new Set<string>()

  if (partRes.length > 0 && partRes[0].values) {
    const cols = partRes[0].columns
    const c = (name: string) => cols.indexOf(name)

    for (const row of partRes[0].values) {
      const sid = row[c('session_id')] as string
      const mid = row[c('message_id')] as string
      const ts = row[c('time_created')] as number

      // Deduplicate: one hit per message
      const dedupKey = sid + '/' + mid
      if (seenSessions.has(dedupKey)) continue
      seenSessions.add(dedupKey)

      const data = JSON.parse(row[c('data')] as string)
      let snippet = ''
      let matchField: OpenCodeSearchResult['matchField'] = 'text'

      if (data.type === 'reasoning' && data.text) {
        snippet = excerpt(data.text, query, 200)
        matchField = 'reasoning'
      } else if (data.type === 'tool') {
        snippet = '[Tool: ' + (data.tool || 'unknown') + ' — matched in input/output]'
        matchField = 'tool'
      } else if (data.text) {
        snippet = excerpt(data.text, query, 200)
        matchField = 'text'
      } else {
        snippet = '[Matched in: ' + (data.type || 'unknown') + ']'
      }

      results.push({
        sessionId: sid,
        sessionTitle: sid.slice(0, 12),
        projectPath: '',
        messageId: mid,
        timestamp: msToISO(ts),
        snippet,
        matchField
      })
    }
  }

  // Enrich with session titles
  if (results.length > 0) {
    const sessionIds = [...new Set(results.map(r => r.sessionId))]
    const sessRes = db.exec(
      `SELECT id, title, project_id FROM session WHERE id IN (${sessionIds.map(() => '?').join(',')})`,
      sessionIds
    )
    if (sessRes.length > 0 && sessRes[0].values) {
      const sc = sessRes[0].columns
      const si = (name: string) => sc.indexOf(name)
      const titleMap = new Map<string, string>()
      const projMap = new Map<string, string>()
      for (const srow of sessRes[0].values) {
        titleMap.set(srow[si('id')] as string, (srow[si('title')] as string) || '')
        projMap.set(srow[si('project_id')] as string, '')
      }

      // Get project paths
      const projIds = [...new Set(projMap.keys())]
      if (projIds.length > 0) {
        const projRes = db.exec(
          `SELECT id, worktree FROM project WHERE id IN (${projIds.map(() => '?').join(',')})`,
          projIds
        )
        if (projRes.length > 0 && projRes[0].values) {
          const pc = projRes[0].columns
          for (const prow of projRes[0].values) {
            projMap.set(prow[pc('id')] as string, (prow[pc('worktree')] as string) || '')
          }
        }
      }

      for (const r of results) {
        r.sessionTitle = titleMap.get(r.sessionId) || r.sessionId.slice(0, 12)
        // Look up project path from session → project map
        // (We need session → project_id; re-query from the already-fetched data)
      }
    }
  }

  return results
}

function msToISO(ms: number): string {
  return new Date(ms).toISOString()
}

function excerpt(text: string, query: string, maxLen: number): string {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const idx = lowerText.indexOf(lowerQuery)

  if (idx < 0) return text.slice(0, maxLen) + (text.length > maxLen ? '...' : '')

  const start = Math.max(0, idx - 60)
  const end = Math.min(text.length, idx + query.length + 120)
  let snippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')

  if (snippet.length > maxLen + 50) {
    snippet = snippet.slice(0, maxLen) + '...'
  }

  return snippet
}
