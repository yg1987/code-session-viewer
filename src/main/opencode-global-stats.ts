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

  // Base counts
  const sessionCnt = db.exec('SELECT COUNT(*) as cnt FROM session')
  const messageCnt = db.exec('SELECT COUNT(*) as cnt FROM message')
  const totalSessions = (sessionCnt[0]?.values?.[0]?.[0] as number) || 0
  const totalMessages = (messageCnt[0]?.values?.[0]?.[0] as number) || 0

  // Token aggregates
  const tokenRow = db.exec(
    `SELECT
      COALESCE(SUM(total_tokens_input), 0) as total_in,
      COALESCE(SUM(total_tokens_output), 0) as total_out,
      COALESCE(SUM(total_tokens_reasoning), 0) as total_reasoning,
      COALESCE(SUM(total_cost), 0) as total_cost
     FROM session`
  )
  const tv = tokenRow[0]?.values?.[0] || [0, 0, 0, 0]
  const totalTokensInput = (tv[0] as number) || 0
  const totalTokensOutput = (tv[1] as number) || 0
  const totalTokensReasoning = (tv[2] as number) || 0
  const totalCost = (tv[3] as number) || 0

  // Top models
  const modelRows = db.exec(
    `SELECT model, COUNT(*) as sessions, COALESCE(SUM(total_cost), 0) as total_cost
     FROM session WHERE model IS NOT NULL
     GROUP BY model ORDER BY sessions DESC LIMIT 10`
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
    `SELECT agent, COUNT(*) as sessions
     FROM session WHERE agent IS NOT NULL
     GROUP BY agent ORDER BY sessions DESC LIMIT 10`
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
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM session
     WHERE created_at IS NOT NULL
       AND created_at >= DATE('now', '-30 days')
     GROUP BY DATE(created_at)
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
