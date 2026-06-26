import type { ParsedMessage, ContentBlock } from './session-parser'

export interface SessionInsights {
  // Health score 0-100
  healthScore: number
  healthLabel: 'excellent' | 'good' | 'warning' | 'poor'

  // Error analysis
  totalToolCalls: number
  errorCount: number
  errorRate: number // 0-1
  errorTools: { name: string; count: number }[]

  // Inefficiency detection
  inefficiencies: Inefficiency[]

  // Complexity metrics
  avgOutputPerTurn: number
  maxOutputTurn: { turn: number; tokens: number }
  thinkingRatio: number  // % of turns that used thinking
  toolDensity: number    // avg tools per assistant message
  conversationDepth: number // total user turns
}

export interface Inefficiency {
  type: 'repeated_tool' | 'fix_loop' | 'empty_result' | 'excessive_reads' | 'large_write_then_edit'
  severity: 'info' | 'warning' | 'error'
  message: string
  details: string
  turnRange?: [number, number]
}

export function analyzeSession(messages: ParsedMessage[]): SessionInsights {
  const assistantMsgs = messages.filter((m) => m.role === 'assistant')
  const userMsgs = messages.filter((m) => m.role === 'user')

  // Collect all tool calls
  const toolCalls: { turn: number; name: string; input: Record<string, unknown>; hasError: boolean; resultPreview: string }[] = []
  let turnIdx = 0

  for (const msg of assistantMsgs) {
    turnIdx++
    for (const block of msg.content) {
      if (block.type === 'tool_use') {
        toolCalls.push({
          turn: turnIdx,
          name: block.name || '',
          input: block.input || {},
          hasError: !!block.result?.is_error,
          resultPreview: (block.result?.content || '').slice(0, 200)
        })
      }
    }
  }

  const totalToolCalls = toolCalls.length
  const errorCount = toolCalls.filter((t) => t.hasError).length
  const errorRate = totalToolCalls > 0 ? errorCount / totalToolCalls : 0

  // Error by tool
  const errorByTool: Record<string, number> = {}
  for (const tc of toolCalls) {
    if (tc.hasError) {
      errorByTool[tc.name] = (errorByTool[tc.name] || 0) + 1
    }
  }
  const errorTools = Object.entries(errorByTool)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // Inefficiency detection
  const inefficiencies: Inefficiency[] = []

  // 1. Repeated identical tool calls (same tool + same key input within 5 turns)
  detectRepeatedCalls(toolCalls, inefficiencies)

  // 2. Fix loops: Edit on same file appearing 3+ times
  detectFixLoops(toolCalls, inefficiencies)

  // 3. Empty results: Read/Grep returning empty
  detectEmptyResults(toolCalls, inefficiencies)

  // 4. Excessive reads: same file read 5+ times
  detectExcessiveReads(toolCalls, inefficiencies)

  // 5. Large Write then immediate Edit on same file
  detectWriteThenEdit(toolCalls, inefficiencies)

  // Complexity metrics
  let totalOutput = 0
  let maxOutput = 0
  let maxOutputTurn = 0
  let thinkingTurns = 0
  let toolTurns = 0

  turnIdx = 0
  for (const msg of assistantMsgs) {
    turnIdx++
    const output = msg.tokenUsage?.outputTokens || 0
    totalOutput += output
    if (output > maxOutput) { maxOutput = output; maxOutputTurn = turnIdx }

    let hasThinking = false
    let hasTools = false
    for (const block of msg.content) {
      if (block.type === 'thinking') hasThinking = true
      if (block.type === 'tool_use') hasTools = true
    }
    if (hasThinking) thinkingTurns++
    if (hasTools) toolTurns++
  }

  const avgOutput = assistantMsgs.length > 0 ? totalOutput / assistantMsgs.length : 0
  const thinkingRatio = assistantMsgs.length > 0 ? thinkingTurns / assistantMsgs.length : 0
  const toolDensity = assistantMsgs.length > 0 ? totalToolCalls / assistantMsgs.length : 0

  // Health score
  let healthScore = 100
  // Deduct for errors
  healthScore -= Math.min(errorRate * 100, 40)
  // Deduct for inefficiencies
  const warningCount = inefficiencies.filter((i) => i.severity === 'warning').length
  const errorIneffCount = inefficiencies.filter((i) => i.severity === 'error').length
  healthScore -= warningCount * 5
  healthScore -= errorIneffCount * 10
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))

  let healthLabel: SessionInsights['healthLabel'] = 'excellent'
  if (healthScore < 60) healthLabel = 'poor'
  else if (healthScore < 75) healthLabel = 'warning'
  else if (healthScore < 90) healthLabel = 'good'

  return {
    healthScore,
    healthLabel,
    totalToolCalls,
    errorCount,
    errorRate,
    errorTools,
    inefficiencies,
    avgOutputPerTurn: Math.round(avgOutput),
    maxOutputTurn: { turn: maxOutputTurn, tokens: maxOutput },
    thinkingRatio: Math.round(thinkingRatio * 100),
    toolDensity: Math.round(toolDensity * 10) / 10,
    conversationDepth: userMsgs.length
  }
}

function detectRepeatedCalls(toolCalls: typeof Array.prototype, inefficiencies: Inefficiency[]) {
  const calls = toolCalls as { turn: number; name: string; input: Record<string, unknown> }[]
  const window = 5
  const seen = new Map<string, number[]>() // key -> turn numbers

  for (const tc of calls) {
    // Build a signature: tool name + key input params
    let sig = tc.name
    if (tc.name === 'Bash' && tc.input.command) sig += ':' + String(tc.input.command).slice(0, 80)
    else if (tc.name === 'Read' && tc.input.file_path) sig += ':' + tc.input.file_path
    else if (tc.name === 'Grep' && tc.input.pattern) sig += ':' + tc.input.pattern

    const prev = seen.get(sig) || []
    const recentRepeats = prev.filter((t) => tc.turn - t <= window)
    if (recentRepeats.length >= 2) {
      // Only add once per pattern
      if (!inefficiencies.some((i) => i.type === 'repeated_tool' && i.details === sig)) {
        inefficiencies.push({
          type: 'repeated_tool',
          severity: 'warning',
          message: `"${tc.name}" called ${recentRepeats.length + 1}x with similar input within ${window} turns`,
          details: sig,
          turnRange: [recentRepeats[0], tc.turn]
        })
      }
    }
    seen.set(sig, [...prev, tc.turn])
  }
}

function detectFixLoops(toolCalls: any[], inefficiencies: Inefficiency[]) {
  const editsByFile: Record<string, number[]> = {}
  for (const tc of toolCalls) {
    if (tc.name === 'Edit' && tc.input.file_path) {
      const f = String(tc.input.file_path)
      if (!editsByFile[f]) editsByFile[f] = []
      editsByFile[f].push(tc.turn)
    }
  }

  for (const [file, turns] of Object.entries(editsByFile)) {
    if (turns.length >= 4) {
      // Check if edits are clustered (within a span of 2x the count)
      const span = turns[turns.length - 1] - turns[0]
      if (span <= turns.length * 3) {
        const shortFile = file.split(/[/\\]/).pop() || file
        inefficiencies.push({
          type: 'fix_loop',
          severity: 'warning',
          message: `"${shortFile}" edited ${turns.length}x in ${span} turns — possible fix loop`,
          details: file,
          turnRange: [turns[0], turns[turns.length - 1]]
        })
      }
    }
  }
}

function detectEmptyResults(toolCalls: any[], inefficiencies: Inefficiency[]) {
  let emptyCount = 0
  for (const tc of toolCalls) {
    if ((tc.name === 'Grep' || tc.name === 'Glob') && !tc.hasError) {
      if (!tc.resultPreview || tc.resultPreview.trim() === '' || tc.resultPreview.includes('No matches')) {
        emptyCount++
      }
    }
  }
  if (emptyCount >= 5) {
    inefficiencies.push({
      type: 'empty_result',
      severity: 'info',
      message: `${emptyCount} search/glob calls returned empty — may indicate wrong search patterns`,
      details: `${emptyCount} empty results`
    })
  }
}

function detectExcessiveReads(toolCalls: any[], inefficiencies: Inefficiency[]) {
  const readsByFile: Record<string, number> = {}
  for (const tc of toolCalls) {
    if (tc.name === 'Read' && tc.input.file_path) {
      const f = String(tc.input.file_path)
      readsByFile[f] = (readsByFile[f] || 0) + 1
    }
  }

  for (const [file, count] of Object.entries(readsByFile)) {
    if (count >= 5) {
      const shortFile = file.split(/[/\\]/).pop() || file
      inefficiencies.push({
        type: 'excessive_reads',
        severity: 'info',
        message: `"${shortFile}" read ${count}x — content may have been forgotten between turns`,
        details: file
      })
    }
  }
}

function detectWriteThenEdit(toolCalls: any[], inefficiencies: Inefficiency[]) {
  for (let i = 0; i < toolCalls.length - 1; i++) {
    const curr = toolCalls[i]
    const next = toolCalls[i + 1]
    if (curr.name === 'Write' && next.name === 'Edit' &&
        curr.input.file_path && curr.input.file_path === next.input.file_path &&
        next.turn - curr.turn <= 2) {
      const shortFile = String(curr.input.file_path).split(/[/\\]/).pop() || ''
      if (!inefficiencies.some((x) => x.type === 'large_write_then_edit' && x.details === curr.input.file_path)) {
        inefficiencies.push({
          type: 'large_write_then_edit',
          severity: 'info',
          message: `"${shortFile}" written then immediately edited — could have been written correctly in one pass`,
          details: String(curr.input.file_path),
          turnRange: [curr.turn, next.turn]
        })
      }
    }
  }
}
