import { useState, useEffect } from 'react'
import type { ParsedMessage } from '../../types/message'
import { Tooltip } from '../common/Tooltip'
import { useSettings, getModelPricing, calculateCost } from '../../hooks/useSettings'
import { useLocale } from '../../hooks/useLocale'

interface Props {
  messages: ParsedMessage[]
  sessionFilePath?: string
  onJumpToMessage?: (messageId: string) => void
}

interface ModelUsageEntry {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreateTokens: number
  messageCount: number
}

interface SessionUsageResult {
  perModel: Record<string, ModelUsageEntry>
  subagentFiles: string[]
}

function fmt(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remainHours = hours % 24
  if (days < 30) return remainHours > 0 ? `${days}d ${remainHours}h` : `${days}d`
  const months = Math.floor(days / 30)
  const remainDays = days % 30
  return remainDays > 0 ? `${months}mo ${remainDays}d` : `${months}mo`
}

export function SessionStats({ messages, sessionFilePath, onJumpToMessage }: Props) {
  const { settings } = useSettings()
  const { t } = useLocale()
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  const [expandedAllCalls, setExpandedAllCalls] = useState<Set<string>>(new Set())
  const [usageFromFile, setUsageFromFile] = useState<SessionUsageResult | null>(null)
  const userMsgs = messages.filter((m) => m.role === 'user')
  const assistantMsgs = messages.filter((m) => m.role === 'assistant')

  // Load per-model usage from the main JSONL + subagent JSONLs, aligning with /cost.
  // Fall back to message-derived stats if filePath is not provided or the call fails.
  useEffect(() => {
    if (!sessionFilePath) { setUsageFromFile(null); return }
    let cancelled = false
    window.api.getSessionModelUsage(sessionFilePath)
      .then((res: SessionUsageResult) => { if (!cancelled) setUsageFromFile(res) })
      .catch(() => { if (!cancelled) setUsageFromFile(null) })
    return () => { cancelled = true }
  }, [sessionFilePath])

  // Per-model tokens — prefer file-based aggregation (includes subagents) over
  // messages-based fallback (main session only).
  const perModelTokens: Record<string, { input: number; output: number; cacheRead: number; cacheCreate: number }> = {}
  if (usageFromFile) {
    for (const [model, u] of Object.entries(usageFromFile.perModel)) {
      perModelTokens[model] = {
        input: u.inputTokens,
        output: u.outputTokens,
        cacheRead: u.cacheReadTokens,
        cacheCreate: u.cacheCreateTokens
      }
    }
  } else {
    for (const msg of assistantMsgs) {
      if (msg.tokenUsage && msg.model) {
        const m = msg.model
        if (!perModelTokens[m]) perModelTokens[m] = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 }
        perModelTokens[m].input += msg.tokenUsage.inputTokens || 0
        perModelTokens[m].output += msg.tokenUsage.outputTokens || 0
        perModelTokens[m].cacheRead += msg.tokenUsage.cacheRead || 0
        perModelTokens[m].cacheCreate += msg.tokenUsage.cacheCreation || 0
      }
    }
  }

  // Aggregate totals (all models combined)
  let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheCreate = 0
  for (const t of Object.values(perModelTokens)) {
    totalInput += t.input
    totalOutput += t.output
    totalCacheRead += t.cacheRead
    totalCacheCreate += t.cacheCreate
  }
  const totalAllInput = totalInput + totalCacheRead + totalCacheCreate

  // Tool usage stats — indexed per individual call, sorted by result size (token proxy)
  interface ToolCallRecord {
    key: string         // display label
    resultChars: number // result content length → input token proxy
    msgId: string       // parent assistant message id (for jump)
    timestamp: string
  }
  const toolCallRecords: Record<string, ToolCallRecord[]> = {}

  for (const msg of assistantMsgs) {
    for (const block of msg.content) {
      if (block.type !== 'tool_use' || !block.name) continue
      const name = block.name
      const key = getToolSubKey(name, block.input as Record<string, unknown>)
      const resultChars = block.result?.content?.length ?? 0
      if (!toolCallRecords[name]) toolCallRecords[name] = []
      toolCallRecords[name].push({ key, resultChars, msgId: msg.id, timestamp: msg.timestamp })
    }
  }

  // Aggregate per tool
  const toolStats = Object.entries(toolCallRecords).map(([name, calls]) => ({
    name,
    calls,
    totalChars: calls.reduce((s, c) => s + c.resultChars, 0),
    count: calls.length,
  })).sort((a, b) => b.totalChars - a.totalChars)

  const totalToolCalls = toolStats.reduce((s, t) => s + t.count, 0)
  const grandTotalChars = toolStats.reduce((s, t) => s + t.totalChars, 0)

  const models = Object.keys(perModelTokens)

  const firstTime = messages[0]?.timestamp ? new Date(messages[0].timestamp) : null
  const lastTime = messages[messages.length - 1]?.timestamp ? new Date(messages[messages.length - 1].timestamp) : null
  const durationMs = firstTime && lastTime ? lastTime.getTime() - firstTime.getTime() : 0
  const durationMin = Math.round(durationMs / 60000)

  let thinkingCount = 0, thinkingChars = 0, errorCount = 0
  for (const msg of assistantMsgs) {
    for (const block of msg.content) {
      if (block.type === 'thinking' && block.thinking) { thinkingCount++; thinkingChars += block.thinking.length }
      if (block.type === 'tool_use' && block.result?.is_error) errorCount++
    }
  }

  // Cost per model
  const modelCosts = Object.entries(perModelTokens).map(([model, tokens]) => {
    const pricing = getModelPricing(model, settings)
    const cost = calculateCost(pricing, tokens)
    return { model, pricing, tokens, cost }
  })
  const totalCost = modelCosts.reduce((sum, mc) => sum + mc.cost.total, 0)

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label={t('stats.messages')} value={messages.length} sub={`${userMsgs.length}${t('stats.userMsgs')} / ${assistantMsgs.length}${t('stats.assistantMsgs')}`} />
        <StatCard label={t('stats.duration')} value={fmtDuration(durationMin)} sub={firstTime ? `${firstTime.toLocaleTimeString()} ~ ${lastTime?.toLocaleTimeString()}` : ''} />
        <StatCard label={t('stats.toolCalls')} value={totalToolCalls} sub={errorCount > 0 ? `${errorCount}${t('stats.errors')}` : t('stats.noErrors')} color={errorCount > 0 ? 'text-red-400' : undefined} />
        <StatCard label={t('stats.thinking')} value={thinkingCount} sub={thinkingChars > 0 ? `${fmt(thinkingChars)}${t('stats.chars')}` : ''} />
      </div>

      {/* Token usage */}
      {(totalAllInput > 0 || totalOutput > 0) && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">
            {t('stats.tokenUsage')}
            <span className="font-normal text-gray-600 ml-1">
              (from JSONL{usageFromFile && usageFromFile.subagentFiles.length > 0 ? ` + ${usageFromFile.subagentFiles.length} subagent${usageFromFile.subagentFiles.length > 1 ? 's' : ''}` : ''}, may differ from /cost)
            </span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
            <div>
              <div className="text-lg font-semibold text-blue-400">{fmt(totalInput)}</div>
              <div className="text-[10px] text-gray-500">{t('stats.input')} <span className="text-gray-600">({totalInput.toLocaleString()})</span></div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-400">{fmt(totalOutput)}</div>
              <div className="text-[10px] text-gray-500">{t('stats.output')} <span className="text-gray-600">({totalOutput.toLocaleString()})</span></div>
            </div>
            <div>
              <div className="text-lg font-semibold text-yellow-400">{fmt(totalCacheRead)}</div>
              <div className="text-[10px] text-gray-500">{t('stats.cacheRead')} <span className="text-gray-600">({totalCacheRead.toLocaleString()})</span></div>
            </div>
            <div>
              <div className="text-lg font-semibold text-orange-400">{fmt(totalCacheCreate)}</div>
              <div className="text-[10px] text-gray-500">{t('stats.cacheWrite')} <span className="text-gray-600">({totalCacheCreate.toLocaleString()})</span></div>
            </div>
          </div>

          {/* Visual bar */}
          <div className="flex h-3 rounded-full overflow-hidden bg-[#0d1117]">
            <div className="bg-blue-500" style={{ flex: totalInput }} title={`${t('stats.inputColon')} ${fmt(totalInput)}`} />
            <div className="bg-orange-500" style={{ flex: totalCacheCreate }} title={`${t('stats.cacheWriteColon')} ${fmt(totalCacheCreate)}`} />
            <div className="bg-yellow-500" style={{ flex: totalCacheRead }} title={`${t('stats.cacheReadColon')} ${fmt(totalCacheRead)}`} />
            <div className="bg-green-500" style={{ flex: totalOutput }} title={`${t('stats.outputColon')} ${fmt(totalOutput)}`} />
          </div>
          <div className="flex gap-4 mt-1.5">
            <span className="text-[10px] text-blue-400">{t('stats.input')}</span>
            <span className="text-[10px] text-orange-400">{t('stats.cacheWrite')}</span>
            <span className="text-[10px] text-yellow-400">{t('stats.cacheRead')}</span>
            <span className="text-[10px] text-green-400">{t('stats.output')}</span>
          </div>

          {/* Cost */}
          {totalCost > 0 && (
            <div className="mt-3 pt-3 border-t border-[#30363d]/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">{t('stats.estimatedCost')} <span className="text-gray-600">{t('stats.estimatedCostSub')}</span></span>
                <span className="text-sm font-semibold text-green-400">${totalCost.toFixed(4)}</span>
              </div>
              {modelCosts.length > 1 && (
                <div className="space-y-1">
                  {modelCosts.map((mc) => (
                    <div key={mc.model} className="flex items-center justify-between text-[10px]">
                      <span className="text-[var(--accent)] font-mono">{mc.pricing.displayName}</span>
                      <span className="text-gray-500">
                        ${mc.cost.total.toFixed(4)}
                        <span className="text-gray-600 ml-1">(in:{mc.cost.inputCost.toFixed(3)} out:{mc.cost.outputCost.toFixed(3)} cr:{mc.cost.cacheReadCost.toFixed(3)} cw:{mc.cost.cacheWriteCost.toFixed(3)})</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {modelCosts.length === 1 && (
                <div className="flex gap-3 text-[10px] text-gray-600">
                  <span>{t('stats.inputColon')} ${modelCosts[0].cost.inputCost.toFixed(4)}</span>
                  <span>{t('stats.cacheReadColon')} ${modelCosts[0].cost.cacheReadCost.toFixed(4)}</span>
                  <span>{t('stats.cacheWriteColon')} ${modelCosts[0].cost.cacheWriteCost.toFixed(4)}</span>
                  <span>{t('stats.outputColon')} ${modelCosts[0].cost.outputCost.toFixed(4)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tool breakdown — ranked by result size (token proxy) */}
      {toolStats.length > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-1">{t('stats.toolUsage')}</h3>
          <p className="text-[10px] text-gray-600 mb-3">{t('stats.toolUsageSub')}</p>
          <div className="space-y-1.5">
            {toolStats.map(({ name, calls, totalChars, count }) => {
              const pct = grandTotalChars > 0 ? Math.round((totalChars / grandTotalChars) * 100) : 0
              const isExpanded = expandedTools.has(name)
              // Sort individual calls by resultChars desc
              const sortedCalls = [...calls].sort((a, b) => b.resultChars - a.resultChars)
              return (
                <div key={name}>
                  {/* Tool row */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedTools((prev) => {
                        const next = new Set(prev)
                        next.has(name) ? next.delete(name) : next.add(name)
                        return next
                      })}
                      className="text-xs text-gray-300 w-28 truncate text-left hover:text-[#58a6ff] transition-colors flex items-center gap-1 flex-shrink-0"
                      title={name}
                    >
                      <svg className={`w-2.5 h-2.5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 6 10">
                        <path d="M1 1l4 4-4 4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="truncate">{name}</span>
                    </button>
                    <div className="flex-1 h-4 bg-[#0d1117] rounded overflow-hidden">
                      <div className="h-full bg-[#58a6ff]/30 rounded flex items-center px-1.5 gap-1"
                        style={{ width: `${Math.max(pct, 4)}%` }}>
                        <span className="text-[10px] text-[#58a6ff] whitespace-nowrap">{fmtChars(totalChars)}({count})</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-500 w-12 text-right whitespace-nowrap">{pct}%</span>
                  </div>

                  {/* Expanded: individual calls */}
                  {isExpanded && (
                    <div className="mt-1 ml-4 border-l border-[#30363d] pl-3 space-y-0.5">
                      {(expandedAllCalls.has(name) ? sortedCalls : sortedCalls.slice(0, 20)).map((call, i) => {
                        const callPct = totalChars > 0 ? Math.round((call.resultChars / totalChars) * 100) : 0
                        const timeStr = call.timestamp ? new Date(call.timestamp).toLocaleTimeString() : ''
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => onJumpToMessage?.(call.msgId)}
                            className={`w-full flex items-center gap-2 py-0.5 rounded text-left group ${onJumpToMessage ? 'hover:bg-[#1c2333] cursor-pointer' : ''}`}
                          >
                            <span className="text-[10px] text-gray-400 w-48 truncate font-mono flex-shrink-0 group-hover:text-[#58a6ff] transition-colors" title={call.key || '(no label)'}>
                              {call.key || <span className="italic text-gray-600">{t('stats.noLabel')}</span>}
                            </span>
                            <div className="flex-1 h-2.5 bg-[#0d1117] rounded overflow-hidden">
                              <div className="h-full bg-[#58a6ff]/20 rounded"
                                style={{ width: `${Math.max(callPct, 2)}%` }} />
                            </div>
                            <span className="text-[9px] text-gray-600 w-20 text-right whitespace-nowrap flex-shrink-0">
                              {fmtChars(call.resultChars)} · {callPct}%
                            </span>
                            {timeStr && <span className="text-[9px] text-gray-700 w-16 text-right flex-shrink-0">{timeStr}</span>}
                          </button>
                        )
                      })}
                      {sortedCalls.length > 20 && !expandedAllCalls.has(name) && (
                        <button
                          type="button"
                          onClick={() => setExpandedAllCalls((prev) => new Set([...prev, name]))}
                          className="text-[9px] text-[#58a6ff] hover:text-blue-300 py-0.5 transition-colors"
                        >
                          {t('stats.moreCallsButton', { count: sortedCalls.length - 20 })}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Token timeline per turn — output tokens as bar height, hover for full details */}
      {(() => {
        const turns = assistantMsgs
          .filter((m) => m.tokenUsage && m.tokenUsage.outputTokens && m.tokenUsage.outputTokens > 0)
          .map((m, i) => {
            const u = m.tokenUsage!
            return {
              turn: i + 1,
              msgId: m.id,
              time: m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : '',
              output: u.outputTokens || 0,
              input: u.inputTokens || 0,
              cacheRead: u.cacheRead || 0,
              cacheCreate: u.cacheCreation || 0
            }
          })

        if (turns.length < 2) return null
        const maxOutput = Math.max(...turns.map((t) => t.output), 1)

        return (
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">
              {t('stats.outputPerTurn')} <span className="font-normal text-gray-600">{t('stats.turnsMax', { turns: turns.length, max: fmt(maxOutput) })}</span>
            </h3>
            <div className="overflow-x-auto pb-2">
              <div className="flex items-end" style={{ height: 160, minWidth: Math.max(turns.length * 6, 300) }}>
                {turns.map((t) => {
                  const barH = Math.max(Math.round((t.output / maxOutput) * 150), 2)
                  return (
                    <Tooltip key={t.turn} className="flex-1" content={
                      <>
                        <div className="text-[#e6edf3] font-medium">{t('stats.turn', { n: t.turn })} {t.time}</div>
                        <div className="text-green-400">{t('stats.outputColon')} {fmt(t.output)}</div>
                        <div className="text-blue-400">{t('stats.inputColon')} {fmt(t.input)}</div>
                        <div className="text-yellow-400">{t('stats.cacheReadColon')} {fmt(t.cacheRead)}</div>
                        {t.cacheCreate > 0 && <div className="text-orange-400">{t('stats.cacheWriteColon')} {fmt(t.cacheCreate)}</div>}
                        {onJumpToMessage && <div className="text-gray-500 border-t border-gray-700 mt-1 pt-1">{t('stats.clickToJump')}</div>}
                      </>
                    }>
                      <div className={`w-full flex items-end ${onJumpToMessage ? 'cursor-pointer' : ''}`}
                        style={{ height: 150 }}
                        onClick={() => onJumpToMessage?.(t.msgId)}>
                        <div className="w-full bg-green-500/60 rounded-t hover:bg-green-400/70 transition-colors" style={{ height: barH }} />
                      </div>
                    </Tooltip>
                  )
                })}
              </div>
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-gray-600">
              <span>Turn 1</span>
              <span className="text-green-400">{t('stats.outputTokensLabel')}</span>
              <span>{t('stats.turn', { n: turns.length })}</span>
            </div>
          </div>
        )
      })()}

      {/* Models */}
      {models.length > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">{t('stats.models')}</h3>
          <div className="flex flex-wrap gap-2">
            {models.map((m) => (
              <span key={m} className="text-xs bg-[#0d1117] px-2 py-1 rounded text-[#58a6ff] border border-[#30363d]">{m}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function fmtChars(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color?: string }) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color || 'text-[#e6edf3]'}`}>{value}</div>
      <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>
    </div>
  )
}

function getToolSubKey(toolName: string, input: Record<string, unknown>): string {
  if (!input) return ''
  const name = toolName.toLowerCase()

  if (name === 'bash') {
    const cmd = (input.command as string) || ''
    // Extract first meaningful token(s): binary + first arg, max 40 chars
    const trimmed = cmd.replace(/\s+/g, ' ').trim()
    const tokens = trimmed.split(' ')
    // Use up to 3 tokens for context but cap total length
    const key = tokens.slice(0, 3).join(' ')
    return key.length > 48 ? key.slice(0, 48) + '…' : key
  }

  if (name === 'read') {
    const p = (input.file_path as string) || ''
    return shortenPath(p)
  }

  if (name === 'write') {
    const p = (input.file_path as string) || ''
    return shortenPath(p)
  }

  if (name === 'edit') {
    const p = (input.file_path as string) || ''
    return shortenPath(p)
  }

  if (name === 'glob') {
    const pat = (input.pattern as string) || ''
    return pat.length > 48 ? pat.slice(0, 48) + '…' : pat
  }

  if (name === 'grep') {
    const pat = (input.pattern as string) || ''
    return pat.length > 48 ? pat.slice(0, 48) + '…' : pat
  }

  if (name === 'webfetch' || name === 'web_fetch') {
    const url = (input.url as string) || ''
    try {
      const { hostname, pathname } = new URL(url)
      const key = hostname + pathname.slice(0, 24)
      return key.length > 48 ? key.slice(0, 48) + '…' : key
    } catch {
      return url.slice(0, 48)
    }
  }

  if (name === 'websearch' || name === 'web_search') {
    const q = (input.query as string) || ''
    return q.length > 48 ? q.slice(0, 48) + '…' : q
  }

  if (name === 'agent') {
    const sub = (input.subagent_type as string) || (input.description as string) || ''
    return sub.length > 48 ? sub.slice(0, 48) + '…' : sub
  }

  // Generic: use first string value found
  for (const v of Object.values(input)) {
    if (typeof v === 'string' && v.length > 0) {
      return v.length > 48 ? v.slice(0, 48) + '…' : v
    }
  }
  return ''
}

function shortenPath(p: string): string {
  if (!p) return ''
  // Normalize separators and take last 2-3 segments
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  const key = parts.length > 2 ? '…/' + parts.slice(-2).join('/') : parts.join('/')
  return key.length > 48 ? '…' + key.slice(-47) : key
}
