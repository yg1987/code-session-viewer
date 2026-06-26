import { useState, useEffect } from 'react'
import { useLocale } from '../../hooks/useLocale'

interface SessionInsights {
  healthScore: number
  healthLabel: 'excellent' | 'good' | 'warning' | 'poor'
  totalToolCalls: number
  errorCount: number
  errorRate: number
  errorTools: { name: string; count: number }[]
  inefficiencies: Inefficiency[]
  avgOutputPerTurn: number
  maxOutputTurn: { turn: number; tokens: number }
  thinkingRatio: number
  toolDensity: number
  conversationDepth: number
}

interface Inefficiency {
  type: string
  severity: 'info' | 'warning' | 'error'
  message: string
  details: string
  turnRange?: [number, number]
}

const HEALTH_COLORS = {
  excellent: { bg: 'bg-green-500', text: 'text-green-400', ring: 'ring-green-500' },
  good: { bg: 'bg-blue-500', text: 'text-blue-400', ring: 'ring-blue-500' },
  warning: { bg: 'bg-yellow-500', text: 'text-yellow-400', ring: 'ring-yellow-500' },
  poor: { bg: 'bg-red-500', text: 'text-red-400', ring: 'ring-red-500' }
}

const SEVERITY_STYLES = {
  info: 'border-l-blue-500/50 bg-blue-900/10',
  warning: 'border-l-yellow-500/50 bg-yellow-900/10',
  error: 'border-l-red-500/50 bg-red-900/10'
}

interface Props {
  filePath: string
  messages?: import('../../types/message').ParsedMessage[]
}

export function InsightsPanel({ filePath, messages }: Props) {
  const [insights, setInsights] = useState<SessionInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const { t } = useLocale()

  useEffect(() => {
    setLoading(true)
    const promise = messages
      ? window.api.getSessionInsightsFromData(messages)
      : window.api.getSessionInsights(filePath)
    promise.then((data: SessionInsights) => {
      setInsights(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [filePath, messages])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-5 h-5 border-2 border-[#58a6ff] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!insights) return null

  const hc = HEALTH_COLORS[insights.healthLabel]

  return (
    <div className="space-y-4">
      {/* Health score */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">{t('insights.sessionHealth')}</h3>
        <div className="flex items-center gap-4">
          {/* Score circle */}
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ring-4 ${hc.ring}/30`}>
            <span className={`text-2xl font-bold ${hc.text}`}>{insights.healthScore}</span>
          </div>
          <div className="flex-1">
            <div className={`text-sm font-semibold ${hc.text} capitalize`}>{insights.healthLabel}</div>
            <div className="text-xs text-gray-500 mt-1">
              {insights.errorCount === 0
                ? t('insights.noToolErrors')
                : `${insights.errorCount}${t('insights.errorsIn')}${insights.totalToolCalls}${t('insights.toolCalls')} (${(insights.errorRate * 100).toFixed(1)}%)`}
            </div>
            {insights.inefficiencies.length > 0 && (
              <div className="text-xs text-gray-500">
                {insights.inefficiencies.length}{t('insights.potentialInefficiencies', { suffix: insights.inefficiencies.length === 1 ? t('insights.inefficiencySingular') : t('insights.inefficiencyPlural') })}
              </div>
            )}
          </div>
        </div>

        {/* Error breakdown */}
        {insights.errorTools.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#30363d]/50">
            <div className="text-[10px] text-gray-500 uppercase mb-1">{t('insights.errorsByTool')}</div>
            <div className="flex flex-wrap gap-1">
              {insights.errorTools.map((et) => (
                <span key={et.name} className="text-[10px] px-2 py-0.5 rounded bg-red-900/20 text-red-400 border border-red-900/30">
                  {et.name}: {et.count}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Complexity metrics */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">{t('insights.complexityMetrics')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <MetricItem label={t('insights.conversationDepth')} value={`${insights.conversationDepth}${t('insights.rounds')}`} />
          <MetricItem label={t('insights.avgOutputTurn')} value={`${insights.avgOutputPerTurn} tokens`} />
          <MetricItem label={t('insights.thinkingUsage')} value={`${insights.thinkingRatio}%`} />
          <MetricItem label={t('insights.toolDensity')} value={`${insights.toolDensity}${t('insights.callsPerTurn')}`} />
          <MetricItem label={t('insights.peakOutput')} value={`${t('insights.peakTurn')} ${insights.maxOutputTurn.turn} (${insights.maxOutputTurn.tokens} tokens)`} />
          <MetricItem label={t('insights.errorRate')} value={`${(insights.errorRate * 100).toFixed(1)}%`}
            color={insights.errorRate > 0.1 ? 'text-red-400' : insights.errorRate > 0.05 ? 'text-yellow-400' : 'text-green-400'} />
        </div>
      </div>

      {/* Inefficiencies */}
      {insights.inefficiencies.length > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">
            {t('insights.detectedInefficiencies')}
            <span className="font-normal text-gray-600 ml-1">({insights.inefficiencies.length})</span>
          </h3>
          <div className="space-y-2">
            {insights.inefficiencies.map((ineff, i) => (
              <div key={i} className={`border-l-2 rounded-r-lg p-2.5 ${SEVERITY_STYLES[ineff.severity]}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-semibold uppercase ${
                    ineff.severity === 'error' ? 'text-red-400' : ineff.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'
                  }`}>
                    {ineff.severity}
                  </span>
                  <span className="text-[10px] text-gray-600 font-mono">{ineff.type}</span>
                  {ineff.turnRange && (
                    <span className="text-[10px] text-gray-600 ml-auto">{t('insights.turnRange', { start: ineff.turnRange[0], end: ineff.turnRange[1] })}</span>
                  )}
                </div>
                <div className="text-xs text-[var(--text)]">{ineff.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.inefficiencies.length === 0 && (
        <div className="bg-green-900/10 border border-green-900/20 rounded-lg p-3 text-center">
          <span className="text-xs text-green-400">{t('insights.noInefficiencies')}</span>
        </div>
      )}
    </div>
  )
}

function MetricItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#0d1117] rounded-lg p-2.5 border border-[#30363d]/50">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className={`text-sm font-medium ${color || 'text-[var(--text)]'}`}>{value}</div>
    </div>
  )
}
