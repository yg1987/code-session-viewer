import { memo } from 'react'
import type { ParsedMessage, ToolUseBlock } from '../../types/message'
import { MarkdownRenderer } from './MarkdownRenderer'
import { ThinkingBlock } from './ThinkingBlock'
import { ToolCallBlock } from './ToolCallBlock'

interface Props {
  message: ParsedMessage
  onViewSubagent?: (description: string) => void
}

export const AssistantMessage = memo(function AssistantMessage({ message, onViewSubagent }: Props) {
  const time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''

  return (
    <div className="flex justify-start mb-4 csv-msg-in">
      <div className="csv-msg-assistant max-w-[90%] rounded-2xl rounded-tl-sm pl-4 pr-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: 'var(--assistant-rail)' }}>Assistant</span>
          {message.model && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--surface2)] text-[var(--text2)] font-mono">{message.model}</span>
          )}
          <span className="text-xs text-[var(--text3)] ml-auto tabular-nums">{time}</span>
        </div>

        <div className="space-y-1">
          {message.content.map((block, i) => {
            if (block.type === 'thinking' && block.thinking) {
              return <ThinkingBlock key={i} thinking={block.thinking} />
            }
            if (block.type === 'text' && block.text) {
              return (
                <div key={i} className="text-sm text-[var(--text)]">
                  <MarkdownRenderer content={block.text} />
                </div>
              )
            }
            if (block.type === 'tool_use') {
              return (
                <ToolCallBlock
                  key={i}
                  block={block as ToolUseBlock}
                  onViewSubagent={block.name === 'Agent' ? onViewSubagent : undefined}
                />
              )
            }
            return null
          })}
        </div>

        {/* Token usage */}
        {message.tokenUsage && (
          <div className="flex gap-3 mt-2 pt-2 border-t border-[var(--border-soft)]">
            {message.tokenUsage.inputTokens ? (
              <span className="text-[10px] text-[var(--text3)] tabular-nums">
                in {message.tokenUsage.inputTokens.toLocaleString()}
              </span>
            ) : null}
            {message.tokenUsage.outputTokens ? (
              <span className="text-[10px] text-[var(--text3)] tabular-nums">
                out {message.tokenUsage.outputTokens.toLocaleString()}
              </span>
            ) : null}
            {message.tokenUsage.cacheRead ? (
              <span className="text-[10px] text-[var(--text3)] tabular-nums">
                cache {message.tokenUsage.cacheRead.toLocaleString()}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
})
