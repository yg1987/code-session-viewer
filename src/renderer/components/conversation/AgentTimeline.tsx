/**
 * AgentTimeline — renders agent/model switch events as a vertical timeline.
 *
 * Scans through ParsedMessage[] and detects transitions in the `agent` or `model`
 * fields across consecutive messages, rendering each switch as a timeline event.
 */

import { useMemo } from 'react'
import type { ParsedMessage } from '../../types/message'
import { useLocale } from '../../hooks/useLocale'

interface Props {
  messages: ParsedMessage[]
}

interface TimelineEvent {
  type: 'agent' | 'model' | 'both'
  timestamp: string
  messageId: string
  agent?: string
  model?: string
  prevAgent?: string
  prevModel?: string
}

export function AgentTimeline({ messages }: Props) {
  const { t } = useLocale()
  const events = useMemo(() => {
    const result: TimelineEvent[] = []
    let lastAgent: string | undefined
    let lastModel: string | undefined

    for (const msg of messages) {
      const agent = msg.agent
      const model = msg.model
      const agentChanged = agent !== undefined && agent !== lastAgent && lastAgent !== undefined
      const modelChanged = model !== undefined && model !== lastModel && lastModel !== undefined

      if (agentChanged || modelChanged) {
        const type: TimelineEvent['type'] =
          agentChanged && modelChanged ? 'both' : agentChanged ? 'agent' : 'model'
        result.push({
          type,
          timestamp: msg.timestamp,
          messageId: msg.id,
          agent: agentChanged ? agent : undefined,
          model: modelChanged ? model : undefined,
          prevAgent: agentChanged ? lastAgent : undefined,
          prevModel: modelChanged ? lastModel : undefined
        })
      }

      if (agent !== undefined) lastAgent = agent
      if (model !== undefined) lastModel = model
    }

    return result
  }, [messages])

  // Also detect initial agent/model from the first message
  const firstMsg = messages.find((m) => m.agent || m.model)
  const hasFirstEvent = firstMsg && (firstMsg.agent || firstMsg.model)

  if (events.length === 0 && !hasFirstEvent) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8 text-center">
          <svg className="w-8 h-8 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-sm text-gray-500">{t('timeline.noChanges')}</p>
          <p className="text-xs text-gray-600 mt-1">{t('timeline.noChangesHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#30363d] flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-sm font-medium text-gray-300">
            {t('timeline.title')}
            <span className="text-gray-500 font-normal ml-1">({events.length}{t('timeline.switches')})</span>
          </span>
        </div>

        {/* Timeline */}
        <div className="px-4 py-4">
          {/* Initial state */}
          {firstMsg && (
            <div className="flex items-start gap-3 pb-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full border-2 border-blue-500 bg-blue-900/40 flex-shrink-0" />
                <div className="w-0.5 flex-1 bg-[#30363d] mt-1" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="text-xs font-medium text-blue-400">{t('timeline.sessionStarted')}</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {firstMsg.agent && (
                    <span className="text-[11px] bg-blue-900/20 text-blue-300 px-2 py-0.5 rounded border border-blue-800/30">
                      {t('timeline.agentPrefix')}{firstMsg.agent}
                    </span>
                  )}
                  {firstMsg.model && (
                    <span className="text-[11px] bg-purple-900/20 text-purple-300 px-2 py-0.5 rounded border border-purple-800/30 font-mono">
                      {t('timeline.modelPrefix')}{firstMsg.model}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {events.length === 0 && hasFirstEvent && (
            <div className="text-center py-6 text-xs text-gray-500">
              {t('timeline.noSwitches')}
            </div>
          )}

          {events.map((evt, i) => {
            const timeStr = evt.timestamp ? new Date(evt.timestamp).toLocaleString() : ''
            const isLast = i === events.length - 1

            return (
              <div key={evt.messageId} className="flex items-start gap-3 pb-4 last:pb-0">
                {/* Timeline dot + line */}
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 border-2 ${
                    evt.type === 'agent'
                      ? 'border-blue-500 bg-blue-900/40'
                      : evt.type === 'model'
                        ? 'border-purple-500 bg-purple-900/40'
                        : 'border-green-500 bg-green-900/40'
                  }`} />
                  {!isLast && <div className="w-0.5 flex-1 bg-[#30363d] mt-1" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                      evt.type === 'agent'
                        ? 'text-blue-400'
                        : evt.type === 'model'
                          ? 'text-purple-400'
                          : 'text-green-400'
                    }`}>
                      {evt.type === 'agent' ? t('timeline.agentSwitch') : evt.type === 'model' ? t('timeline.modelSwitch') : t('timeline.bothSwitch')}
                    </span>
                    {timeStr && <span className="text-[10px] text-gray-600">{timeStr}</span>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* Agent change */}
                    {(evt.type === 'agent' || evt.type === 'both') && evt.agent && (
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-gray-500 line-through decoration-gray-600">
                          {evt.prevAgent}
                        </span>
                        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <span className="text-blue-300 font-medium">{evt.agent}</span>
                      </div>
                    )}

                    {/* Model change */}
                    {(evt.type === 'model' || evt.type === 'both') && evt.model && (
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-gray-500 line-through decoration-gray-600">
                          {evt.prevModel}
                        </span>
                        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <span className="text-purple-300 font-mono font-medium">{evt.model}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
