/**
 * OpenCode session discovery.
 * Queries the opencode.db SQLite database via sql.js.
 *
 * Actual schema:
 *   session: id, project_id, parent_id, title, time_created, time_updated,
 *            agent, model, cost, tokens_input, tokens_output, tokens_reasoning, ...
 *   project: id, worktree (path), name, ...
 *   message: id, session_id, time_created, data (JSON with role, parentID, etc.)
 */

import { getOpenCodeDb } from './opencode-db'
import { encodeProjectPath } from './path-utils'
import type { ProjectGroup, SessionEntry } from '../renderer/types/session'

export async function discoverOpenCodeSessions(dbPath: string): Promise<ProjectGroup[]> {
  const db = await getOpenCodeDb(dbPath)

  // Sessions with project info
  const sessionRes = db.exec(
    `SELECT
      s.id,
      s.title,
      s.parent_id,
      s.time_created,
      s.time_updated,
      s.project_id,
      s.agent,
      s.model,
      s.cost,
      s.tokens_input,
      s.tokens_output,
      s.tokens_reasoning,
      (SELECT COUNT(*) FROM message m WHERE m.session_id = s.id) as message_count
    FROM session s
    ORDER BY s.time_updated DESC`
  )

  // Projects: id -> path (worktree column)
  const projectRes = db.exec('SELECT id, worktree FROM project')

  const projectMap = new Map<string, string>()
  if (projectRes.length > 0 && projectRes[0].values) {
    for (const row of projectRes[0].values) {
      projectMap.set(row[0] as string, (row[1] as string) || 'Unknown project')
    }
  }

  const groupMap = new Map<string, SessionEntry[]>()
  const projectEncodedNames = new Map<string, string>()

  if (sessionRes.length > 0 && sessionRes[0].values) {
    const cols = sessionRes[0].columns
    const i = (name: string) => cols.indexOf(name)

    for (const row of sessionRes[0].values) {
      const projectId = row[i('project_id')] as string
      const projectPath = projectMap.get(projectId) || 'Unknown project'
      const encodedName = encodeProjectPath(projectPath)

      if (!projectEncodedNames.has(encodedName)) {
        projectEncodedNames.set(encodedName, projectPath)
      }

      const entry: SessionEntry = {
        sessionId: (row[i('id')] as string) || '',
        fullPath: `opencode://${dbPath}/${row[i('id')]}`,
        customTitle: (row[i('title')] as string) || '',
        firstPrompt: '',
        summary: (row[i('title')] as string) || '',
        messageCount: (row[i('message_count')] as number) || 0,
        fileSize: 0,
        created: tsToISO(row[i('time_created')] as number),
        modified: tsToISO(row[i('time_updated')] as number) || tsToISO(row[i('time_created')] as number),
        gitBranch: '',
        projectPath,
        isSidechain: !!row[i('parent_id')],
        source: 'opencode',
        dbPath,
        agent: (row[i('agent')] as string) || undefined,
        model: (row[i('model')] as string) || undefined,
        cost: row[i('cost')] != null ? (row[i('cost')] as number) : undefined,
        tokensInput: row[i('tokens_input')] != null ? (row[i('tokens_input')] as number) : undefined,
        tokensOutput: row[i('tokens_output')] != null ? (row[i('tokens_output')] as number) : undefined,
        tokensReasoning: row[i('tokens_reasoning')] != null ? (row[i('tokens_reasoning')] as number) : undefined
      }

      if (!groupMap.has(encodedName)) {
        groupMap.set(encodedName, [])
      }
      groupMap.get(encodedName)!.push(entry)
    }
  }

  const groups: ProjectGroup[] = []
  for (const [encodedName, sessions] of groupMap) {
    groups.push({
      projectPath: projectEncodedNames.get(encodedName) || 'Unknown project',
      encodedName,
      sessions
    })
  }

  groups.sort((a, b) => {
    const aTime = a.sessions[0] ? new Date(a.sessions[0].modified).getTime() : 0
    const bTime = b.sessions[0] ? new Date(b.sessions[0].modified).getTime() : 0
    return bTime - aTime
  })

  return groups
}

function tsToISO(ts: number | undefined | null): string {
  if (!ts) return ''
  // OpenCode timestamps are JS milliseconds
  return new Date(ts).toISOString()
}
