import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface DailyStat {
  date: string
  sessions: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreateTokens: number
  toolCalls: number
}

export interface ModelTokens {
  input: number
  output: number
  cacheRead: number
  cacheCreate: number
}

export interface GlobalStats {
  totalSessions: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheCreateTokens: number
  totalToolCalls: number
  estimatedCost: number  // legacy, will be recalculated by frontend
  toolBreakdown: Record<string, number>
  modelBreakdown: Record<string, number>
  perModelTokens: Record<string, ModelTokens>
  dailyStats: DailyStat[]
}

export async function computeGlobalStats(): Promise<GlobalStats> {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects')
  if (!fs.existsSync(projectsDir)) return emptyStats()

  const stats: GlobalStats = emptyStats()
  const dailyMap = new Map<string, DailyStat>()

  const dirs = fs.readdirSync(projectsDir, { withFileTypes: true })
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue
    const projectDir = path.join(projectsDir, dir.name)
    const files = fs.readdirSync(projectDir).filter(
      (f) => f.endsWith('.jsonl') && !f.startsWith('agent-')
    )
    for (const file of files) {
      try {
        processSessionFile(path.join(projectDir, file), stats, dailyMap)
      } catch { /* skip */ }

      // Also include subagent JSONLs for this session (don't count as a new session)
      const sessionId = file.replace('.jsonl', '')
      const subDir = path.join(projectDir, sessionId, 'subagents')
      if (!fs.existsSync(subDir)) continue
      try {
        const subFiles = fs.readdirSync(subDir).filter((f) => f.endsWith('.jsonl'))
        for (const sf of subFiles) {
          try {
            processSessionFile(path.join(subDir, sf), stats, dailyMap, { isSubagent: true })
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
  }

  stats.dailyStats = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date))
  stats.estimatedCost =
    (stats.totalInputTokens / 1_000_000) * 15 +
    (stats.totalCacheReadTokens / 1_000_000) * 1.5 +
    (stats.totalCacheCreateTokens / 1_000_000) * 3.75 +
    (stats.totalOutputTokens / 1_000_000) * 75

  return stats
}

function emptyStats(): GlobalStats {
  return {
    totalSessions: 0, totalInputTokens: 0, totalOutputTokens: 0,
    totalCacheReadTokens: 0, totalCacheCreateTokens: 0, totalToolCalls: 0,
    estimatedCost: 0, toolBreakdown: {}, modelBreakdown: {}, perModelTokens: {}, dailyStats: []
  }
}

function getOrCreateDay(dailyMap: Map<string, DailyStat>, day: string): DailyStat {
  if (!dailyMap.has(day)) {
    dailyMap.set(day, { date: day, sessions: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreateTokens: 0, toolCalls: 0 })
  }
  return dailyMap.get(day)!
}

function processSessionFile(
  filePath: string,
  stats: GlobalStats,
  dailyMap: Map<string, DailyStat>,
  opts?: { isSubagent?: boolean }
): void {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  if (!opts?.isSubagent) {
    stats.totalSessions++
  }

  // A single message.id can appear on multiple lines (text block then tool_use).
  // Each subsequent line's usage is cumulative, so the LAST line carries the full
  // totals. Collect per-msgId latest usage first, then fold into stats at the end.
  const latestUsageByMsg = new Map<string, { model: string | undefined; timestamp: string; usage: Record<string, number> }>()
  let sessionDate = ''

  for (const line of lines) {
    if (!line.trim()) continue

    let obj: any
    try { obj = JSON.parse(line) } catch { continue }

    // Only process assistant entries
    if (obj.type !== 'assistant' || !obj.message) continue

    const msgId = obj.message.id
    if (!sessionDate && obj.timestamp) {
      sessionDate = obj.timestamp.slice(0, 10)
    }

    const usage = obj.message.usage
    const model = obj.message.model
    if (msgId && usage) {
      latestUsageByMsg.set(msgId, { model, timestamp: obj.timestamp, usage })
    }

    // Tool calls — count from every line (each line has one content block)
    const contentArr = obj.message.content
    if (Array.isArray(contentArr)) {
      for (const block of contentArr) {
        if (block.type === 'tool_use' && block.name) {
          stats.totalToolCalls++
          stats.toolBreakdown[block.name] = (stats.toolBreakdown[block.name] || 0) + 1

          if (obj.timestamp) {
            const day = obj.timestamp.slice(0, 10)
            getOrCreateDay(dailyMap, day).toolCalls++
          }
        }
      }
    }
  }

  // Fold per-msg usage into totals / per-model / daily
  for (const { model, timestamp, usage } of latestUsageByMsg.values()) {
    const isRealModel = model && !model.startsWith('<')
    if (isRealModel) {
      stats.modelBreakdown[model] = (stats.modelBreakdown[model] || 0) + 1
    }

    const input = (usage.input_tokens || 0) as number
    const output = (usage.output_tokens || 0) as number
    const cacheRead = (usage.cache_read_input_tokens || 0) as number
    const cacheCreate = (usage.cache_creation_input_tokens || 0) as number

    stats.totalInputTokens += input
    stats.totalOutputTokens += output
    stats.totalCacheReadTokens += cacheRead
    stats.totalCacheCreateTokens += cacheCreate

    if (timestamp) {
      const day = timestamp.slice(0, 10)
      const d = getOrCreateDay(dailyMap, day)
      d.inputTokens += input
      d.outputTokens += output
      d.cacheReadTokens += cacheRead
      d.cacheCreateTokens += cacheCreate
    }

    if (isRealModel) {
      if (!stats.perModelTokens[model]) {
        stats.perModelTokens[model] = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 }
      }
      const mt = stats.perModelTokens[model]
      mt.input += input
      mt.output += output
      mt.cacheRead += cacheRead
      mt.cacheCreate += cacheCreate
    }
  }

  if (sessionDate && !opts?.isSubagent) {
    getOrCreateDay(dailyMap, sessionDate).sessions++
  }
}
