/**
 * OpenCode global statistics.
 * Aggregates token usage, costs, and session counts via sql.js.
 */

import { getOpenCodeDb } from './opencode-db'

export interface OpenCodeGlobalStats {
  totalSessions: number
  totalMessages: number
  totalTokensInput: number
  totalTokensOutput: number
  totalTokensReasoning: number
  totalCost: number
  topModels: { model: string; sessions: number; totalCost: number }[]
  topAgents: { agent: string; sessions: number }[]
  sessionsByDay: { date: string; count: number }[]
}

export async function openCodeGlobalStats(dbPath: string): Promise<OpenCodeGlobalStats> {
  const db = await getOpenCodeDb(dbPath)

  // Detect actual column names since OpenCode schema varies across versions
  let colInput = 'total_tokens_input'
  let colOutput = 'total_tokens_output'
  let colReasoning = 'total_tokens_reasoning'
  let colCost = 'total_cost'
  let colModel = 'model'
  let colAgent = 'agent'
  let colCreated = 'created_at'

  try {
    const pragma = db.exec('PRAGMA table_info(session)')
    if (pragma.length > 0 && pragma[0].values) {
      const cols = pragma[0].columns
      const ci = (name: string) => cols.indexOf(name)
      const names = new Set(pragma[0].values.map((r) => r[ci('name')] as string))
      if (!names.has('total_tokens_input') && names.has('tokens_input')) colInput = 'tokens_input'
      if (!names.has('total_tokens_output') && names.has('tokens_output')) colOutput = 'tokens_output'
      if (!names.has('total_tokens_reasoning') && names.has('tokens_reasoning')) colReasoning = 'tokens_reasoning'
      if (!names.has('total_cost') && names.has('cost')) colCost = 'cost'
      if (!names.has('created_at') && names.has('time_created')) colCreated = 'time_created'
      if (!names.has('model')) colModel = 'NULL as model'
      if (!names.has('agent')) colAgent = 'NULL as agent'
    }
  } catch { /* use defaults */ }

  // Base counts
  const sessionCnt = db.exec('SELECT COUNT(*) as cnt FROM session')
  const messageCnt = db.exec('SELECT COUNT(*) as cnt FROM message')
  const totalSessions = (sessionCnt[0]?.values?.[0]?.[0] as number) || 0
  const totalMessages = (messageCnt[0]?.values?.[0]?.[0] as number) || 0

  // Token aggregates
  const tokenRow = db.exec(
    `SELECT
      COALESCE(SUM(${colInput}), 0) as total_in,
      COALESCE(SUM(${colOutput}), 0) as total_out,
      COALESCE(SUM(${colReasoning}), 0) as total_reasoning,
      COALESCE(SUM(${colCost}), 0) as total_cost
     FROM session`
  )
  const tv = tokenRow[0]?.values?.[0] || [0, 0, 0, 0]
  const totalTokensInput = (tv[0] as number) || 0
  const totalTokensOutput = (tv[1] as number) || 0
  const totalTokensReasoning = (tv[2] as number) || 0
  const totalCost = (tv[3] as number) || 0

  // Top models
  const modelRows = db.exec(
    `SELECT ${colModel}, COUNT(*) as sessions, COALESCE(SUM(${colCost}), 0) as total_cost
     FROM session WHERE ${colModel} IS NOT NULL AND ${colModel} != 'NULL'
     GROUP BY ${colModel} ORDER BY sessions DESC LIMIT 10`
  )
  const topModels: { model: string; sessions: number; totalCost: number }[] = []
  if (modelRows[0]?.values) {
    for (const row of modelRows[0].values) {
      topModels.push({
        model: (row[0] as string) || 'unknown',
        sessions: row[1] as number,
        totalCost: (row[2] as number) || 0
      })
    }
  }

  // Top agents
  const agentRows = db.exec(
    `SELECT ${colAgent}, COUNT(*) as sessions
     FROM session WHERE ${colAgent} IS NOT NULL AND ${colAgent} != 'NULL'
     GROUP BY ${colAgent} ORDER BY sessions DESC LIMIT 10`
  )
  const topAgents: { agent: string; sessions: number }[] = []
  if (agentRows[0]?.values) {
    for (const row of agentRows[0].values) {
      topAgents.push({
        agent: (row[0] as string) || 'unknown',
        sessions: row[1] as number
      })
    }
  }

  // Sessions by day (last 30)
  const dayRows = db.exec(
    `SELECT DATE(${colCreated}) as date, COUNT(*) as count
     FROM session
     WHERE ${colCreated} IS NOT NULL
       AND ${colCreated} >= DATE('now', '-30 days')
     GROUP BY DATE(${colCreated})
     ORDER BY date ASC`
  )
  const sessionsByDay: { date: string; count: number }[] = []
  if (dayRows[0]?.values) {
    for (const row of dayRows[0].values) {
      sessionsByDay.push({
        date: row[0] as string,
        count: row[1] as number
      })
    }
  }

  return {
    totalSessions,
    totalMessages,
    totalTokensInput,
    totalTokensOutput,
    totalTokensReasoning,
    totalCost,
    topModels,
    topAgents,
    sessionsByDay
  }
}
