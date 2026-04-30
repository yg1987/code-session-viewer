import { useState, useEffect } from 'react'
import type { ParsedMessage } from '../../types/message'
import { UserMessage } from './UserMessage'
import { AssistantMessage } from './AssistantMessage'

interface SubagentInfo {
  agentId: string
  filePath: string
  agentType: string
  description: string
}

interface Props {
  sessionFilePath: string
  agentDescription: string
  onClose: () => void
}

export function SubagentPanel({ sessionFilePath, agentDescription, onClose }: Props) {
  const [agent, setAgent] = useState<SubagentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<ParsedMessage[]>([])
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    window.api.listSubagents(sessionFilePath).then((agents: SubagentInfo[]) => {
      // Match by description
      const match = agents.find((a) => a.description === agentDescription)
        || agents.find((a) => a.description.includes(agentDescription) || agentDescription.includes(a.description))
      if (match) {
        setAgent(match)
        window.api.loadSubagent(match.filePath).then((msgs: ParsedMessage[]) => {
          setMessages(msgs)
          setLoading(false)
        })
      } else {
        setNotFound(true)
        setLoading(false)
      }
    })
  }, [sessionFilePath, agentDescription])

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 csv-overlay" onClick={onClose} />

      <div className="relative ml-auto w-full max-w-3xl h-full bg-[var(--bg)] border-l border-[var(--border)] flex flex-col shadow-[var(--shadow-4)] csv-pop">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d] flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#e6edf3]">Sub-Agent</h3>
              {agent && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-pink-900/40 text-pink-300">
                  {agent.agentType}
                </span>
              )}
            </div>
            {agent && (
              <div className="text-xs text-gray-400 mt-0.5 truncate">{agent.description}</div>
            )}
          </div>
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-[#161b22] transition-colors flex-shrink-0 ml-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin w-6 h-6 border-2 border-[#58a6ff] border-t-transparent rounded-full" />
            </div>
          )}

          {notFound && (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Sub-agent not found for: "{agentDescription}"
            </div>
          )}

          {!loading && !notFound && (
            <div className="px-4 py-4">
              {/* Agent info */}
              {agent && (
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-pink-900/40 text-pink-300">
                      {agent.agentType}
                    </span>
                    <span className="text-xs text-gray-500">{messages.length} messages</span>
                  </div>
                  <div className="text-xs text-gray-400">{agent.description}</div>
                </div>
              )}

              {messages.map((msg) =>
                msg.role === 'user' ? (
                  <UserMessage key={msg.id} message={msg} />
                ) : (
                  <AssistantMessage key={msg.id} message={msg} />
                )
              )}

              {messages.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500 text-sm">No messages</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
