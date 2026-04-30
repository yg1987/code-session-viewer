import { useState, useEffect } from 'react'
import { useSettings, getModelPricing, calculateCost } from '../hooks/useSettings'

interface ModelTokens { input: number; output: number; cacheRead: number; cacheCreate: number }

interface DailyStat {
  date: string
  sessions: number
  inputTokens: number
  outputTokens: number
  cacheTokens: number
  toolCalls: number
}

interface GlobalStats {
  totalSessions: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheCreateTokens: number
  totalToolCalls: number
  estimatedCost: number
  toolBreakdown: Record<string, number>
  modelBreakdown: Record<string, number>
  perModelTokens: Record<string, ModelTokens>
  dailyStats: DailyStat[]
}

interface Props {
  onClose: () => void
}

export function GlobalDashboard({ onClose }: Props) {
  const { settings } = useSettings()
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.getGlobalStats().then((data: GlobalStats) => {
      setStats(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-[var(--text2)] text-sm">Computing global statistics...</p>
          <p className="text-gray-600 text-xs mt-1">This may take a moment for large histories</p>
        </div>
      </div>
    )
  }

  if (!stats) return null

  // Calculate cost using settings pricing
  const modelCosts = Object.entries(stats.perModelTokens || {}).map(([model, tokens]) => {
    const pricing = getModelPricing(model, settings)
    const cost = calculateCost(pricing, tokens)
    return { model, pricing, tokens, cost }
  })
  const totalEstCost = modelCosts.reduce((sum, mc) => sum + mc.cost.total, 0)

  const sortedTools = Object.entries(stats.toolBreakdown).sort((a, b) => b[1] - a[1])
  const sortedModels = Object.entries(stats.modelBreakdown).sort((a, b) => b[1] - a[1])
  const maxToolCount = sortedTools[0]?.[1] || 1

  // Chart: last 30 days — use output tokens for bar height (most meaningful metric)
  const last30 = stats.dailyStats.slice(-30)
  const maxDailyOutput = Math.max(...last30.map((d) => d.outputTokens), 1)

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg)] overflow-y-auto app-shell">
      {/* Header */}
      <div className="sticky top-0 bg-[#0d1117] border-b border-[#30363d] px-6 py-3 flex items-center justify-between z-10">
        <h1 className="text-lg font-semibold text-[#e6edf3]">Global Dashboard</h1>
        <button type="button" onClick={onClose}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-[#161b22] transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Card label="Sessions" value={stats.totalSessions.toLocaleString()} />
          <Card label="Input Tokens" value={formatTokens(stats.totalInputTokens)} sub={stats.totalInputTokens.toLocaleString()} />
          <Card label="Output Tokens" value={formatTokens(stats.totalOutputTokens)} sub={stats.totalOutputTokens.toLocaleString()} />
          <Card label="Cache (R+W)" value={formatTokens(stats.totalCacheReadTokens + stats.totalCacheCreateTokens)}
            sub={`R: ${formatTokens(stats.totalCacheReadTokens)} / W: ${formatTokens(stats.totalCacheCreateTokens)}`} />
          <Card label="Est. Cost" value={`$${totalEstCost.toFixed(2)}`} color="text-green-400" />
        </div>

        {/* Daily usage chart */}
        {last30.length > 1 && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase mb-4">Daily Output Tokens (Last 30 Days)</h2>
            <div className="flex items-end gap-1" style={{ height: 160 }}>
              {last30.map((day) => {
                const barH = Math.max(Math.round((day.outputTokens / maxDailyOutput) * 150), 3)
                return (
                  <div key={day.date} className="flex-1 group relative" style={{ alignSelf: 'flex-end' }}>
                    <div className="w-full bg-green-500/60 rounded-t" style={{ height: barH }} />
                    <div className="hidden group-hover:block absolute bottom-full mb-2 bg-[#0d1117] border border-[#30363d] rounded p-2 text-[10px] whitespace-nowrap z-10 shadow-lg">
                      <div className="text-[#e6edf3] font-medium">{day.date}</div>
                      <div className="text-green-400">Output: {formatTokens(day.outputTokens)}</div>
                      <div className="text-blue-400">Input: {formatTokens(day.inputTokens)}</div>
                      <div className="text-yellow-400">Cache R: {formatTokens(day.cacheReadTokens || 0)}</div>
                      <div className="text-gray-400">Sessions: {day.sessions} | Tools: {day.toolCalls}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-gray-600">
              <span>{last30[0]?.date}</span>
              <span className="text-green-400">Output Tokens</span>
              <span>{last30[last30.length - 1]?.date}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tool ranking */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase mb-3">Tool Usage Ranking</h2>
            <div className="space-y-1.5">
              {sortedTools.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-600 w-4 text-right">{i + 1}</span>
                  <span className="text-xs text-gray-300 w-28 truncate">{name}</span>
                  <div className="flex-1 h-4 bg-[#0d1117] rounded overflow-hidden">
                    <div className="h-full bg-[#58a6ff]/30 rounded transition-all"
                      style={{ width: `${(count / maxToolCount) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Model usage */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase mb-3">Model Usage</h2>
            <div className="space-y-2">
              {sortedModels.map(([model, count]) => (
                <div key={model} className="flex items-center justify-between bg-[#0d1117] rounded-lg p-3 border border-[#30363d]">
                  <span className="text-xs text-[#58a6ff] font-mono">{model}</span>
                  <span className="text-sm font-semibold text-[#e6edf3]">{count.toLocaleString()} calls</span>
                </div>
              ))}
            </div>

            {/* Cost breakdown */}
            <div className="mt-4 pt-4 border-t border-[#30363d]">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Cost Breakdown by Model</h3>
              <div className="space-y-1 text-xs">
                {modelCosts.sort((a, b) => b.cost.total - a.cost.total).map((mc) => (
                  <div key={mc.model} className="flex justify-between">
                    <span className="text-gray-500">{mc.pricing.displayName} <span className="text-gray-600 font-mono text-[10px]">({mc.model})</span></span>
                    <span className="text-[#e6edf3]">${mc.cost.total.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1 border-t border-[#30363d] font-semibold">
                  <span className="text-gray-400">Total</span>
                  <span className="text-green-400">${totalEstCost.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3">
      <div className="text-[10px] text-gray-500 uppercase">{label}</div>
      <div className={`text-xl font-bold ${color || 'text-[#e6edf3]'}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}
