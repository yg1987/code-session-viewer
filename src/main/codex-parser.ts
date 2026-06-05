/**
 * Codex session parser (v3).
 * Parses Codex Desktop/CLI rollout JSONL files into ParsedMessage[].
 *
 * REVERSE-ENGINEERED ACTUAL FORMAT:
 *
 * Each line: {"timestamp":"...","type":"...","payload":{...}}
 *
 * Real sequence per turn (from actual rollout files):
 *   1. response_item {type:"message", role:"user", content:[{type:"input_text",text:"<environment_context>..."}]}  ← SKIP (system context)
 *   2. response_item {type:"message", role:"user", content:[{type:"input_text",text:"实际用户输入"}]}  ← REAL USER INPUT
 *   3. event_msg {type:"user_message", message:"实际用户输入"}  ← DUPLICATE, skip
 *   4. response_item {type:"message", role:"assistant", content:[{type:"output_text",text:"回复"}]}  ← ASSISTANT TEXT
 *   5. response_item {type:"reasoning", summary:[{type:"summary_text",text:"思考"}]}  ← THINKING
 *   6. response_item {type:"custom_tool_call", ...}  ← TOOL CALL
 *   7. response_item {type:"custom_tool_call_output", ...}  ← TOOL RESULT
 *   8. event_msg {type:"token_count", ...}  ← TOKEN USAGE
 *   9. event_msg {type:"task_complete"}  ← TURN END
 *
 * KEY INSIGHT: No "agent_message" event type exists in this format.
 * Assistant text is ONLY in response_item message role:assistant.
 */

import * as fs from 'fs'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import type { ParsedMessage, ContentBlock, ToolResult } from '../renderer/types/message'

interface PendingFuncCall {
  callId: string
  name: string
  arguments: Record<string, unknown>
  timestamp: string
}

/**
 * Parse a Codex rollout JSONL file into an ordered array of ParsedMessage.
 */
export async function parseCodexSession(filePath: string): Promise<ParsedMessage[]> {
  const lines = await readAllLines(filePath)
  if (lines.length === 0) return []

  const messages: ParsedMessage[] = []
  let sessionMeta: any = null
  let pendingFuncCall: PendingFuncCall | null = null

  // Current assistant accumulator
  let assistantBlocks: ContentBlock[] = []
  let assistantTimestamp = ''
  let assistantTokenUsage: ParsedMessage['tokenUsage'] = undefined

  // Dedup tracking: track last real user message to avoid duplicate from event_msg
  let lastUserText = ''
  // Track if we've seen a response_item user message in this turn
  let seenResponseItemUser = false

  const sessionModel = () => sessionMeta?.payload?.model_provider || ''
  const sessionAgent = () => sessionMeta?.payload?.originator || ''

  function flushAssistant() {
    if (assistantBlocks.length > 0) {
      messages.push({
        id: `assistant-${messages.length}`,
        role: 'assistant',
        timestamp: assistantTimestamp,
        content: assistantBlocks,
        model: sessionModel() || undefined,
        agent: sessionAgent() || undefined,
        tokenUsage: assistantTokenUsage
      })
    }
    assistantBlocks = []
    assistantTimestamp = ''
    assistantTokenUsage = undefined
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    let parsed: any
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }

    const timestamp = parsed.timestamp || ''
    const type = parsed.type
    const payload = parsed.payload

    // ── session_meta (line 1) ──
    if (type === 'session_meta') {
      sessionMeta = parsed
      continue
    }

    // ── response_item ──
    if (type === 'response_item' && payload) {
      // ── User message ──
      if (payload.type === 'message' && payload.role === 'user' && payload.content) {
        for (const block of payload.content) {
          if (block.type === 'input_text' && block.text) {
            const text = block.text

            // Skip system context messages (XML tags)
            if (text.startsWith('<') && (text.includes('<environment_context>') || text.includes('<permissions') || text.includes('<app-context') || text.includes('<collaboration_mode') || text.includes('<skills_instructions') || text.includes('<plugins_instructions'))) {
              continue
            }

            // This is the real user message
            // Flush any pending assistant blocks from previous turn
            flushAssistant()

            seenResponseItemUser = true
            lastUserText = text

            messages.push({
              id: `user-${messages.length}`,
              role: 'user',
              timestamp,
              content: [{ type: 'text', text }],
              model: sessionModel() || undefined,
              agent: sessionAgent() || undefined
            })
            break
          }
        }
        continue
      }

      // ── Assistant message (text response) ──
      if (payload.type === 'message' && payload.role === 'assistant' && payload.content) {
        assistantTimestamp = timestamp

        for (const block of payload.content) {
          if (block.type === 'output_text' && block.text) {
            assistantBlocks.push({ type: 'text', text: block.text })
          } else if (block.type === 'reasoning' && block.text) {
            assistantBlocks.push({ type: 'thinking', thinking: block.text })
          }
        }
        // Don't flush here — thinking blocks may follow, flush at task_complete or next user message
        continue
      }

      // ── Reasoning (thinking block) ──
      if (payload.type === 'reasoning' && payload.summary) {
        if (!assistantTimestamp) assistantTimestamp = timestamp

        for (const s of (payload.summary || [])) {
          if (s.type === 'summary_text' && s.text) {
            // Dedup: don't add if we already have a thinking block with the same text
            const text = s.text
            const isDuplicate = assistantBlocks.some(b =>
              b.type === 'thinking' && b.thinking.substring(0, 100) === text.substring(0, 100)
            )
            if (!isDuplicate) {
              assistantBlocks.push({ type: 'thinking', thinking: text })
            }
          }
        }
        continue
      }

      // ── Function call (tool use) ──
      if (payload.type === 'function_call' || payload.type === 'custom_tool_call') {
        if (!assistantTimestamp) assistantTimestamp = timestamp

        const callId = payload.call_id || `call-${assistantBlocks.length}`
        // Codex uses "input" field (string), not "arguments"
        const rawInput = payload.input || payload.arguments || ''
        pendingFuncCall = {
          callId,
          name: payload.name || payload.namespace || 'tool',
          arguments: typeof rawInput === 'string'
            ? tryParseJSON(rawInput)
            : (rawInput || {}),
          timestamp
        }
        continue
      }

      // ── Function call output (tool result) ──
      if (payload.type === 'function_call_output' || payload.type === 'custom_tool_call_output') {
        if (!assistantTimestamp) assistantTimestamp = timestamp

        const callId = payload.call_id || ''
        const output = payload.output !== undefined
          ? String(payload.output)
          : payload.content !== undefined
            ? String(payload.content)
            : ''
        const isError = payload.is_error === true || payload.status === 'error'

        // Pair with pending function_call if callId matches
        const fc = (pendingFuncCall && pendingFuncCall.callId === callId) ? pendingFuncCall : null

        assistantBlocks.push({
          type: 'tool_use',
          id: callId || `output-${assistantBlocks.length}`,
          name: fc?.name || payload.name || 'tool',
          input: fc?.arguments || {},
          result: { content: output, is_error: isError }
        })

        if (fc) pendingFuncCall = null
        continue
      }

      // ── Developer message (system prompt) — skip ──
      if (payload.type === 'message' && payload.role === 'developer') {
        continue
      }
    }

    // ── event_msg ──
    if (type === 'event_msg' && payload) {
      const payloadType = payload.type

      // User message — duplicate of response_item user, skip if already seen
      if (payloadType === 'user_message' && payload.message) {
        // If we already processed the response_item user message, skip this duplicate
        if (seenResponseItemUser) {
          seenResponseItemUser = false
          continue
        }
        // Fallback: if no response_item user message was seen, use this
        flushAssistant()
        messages.push({
          id: `user-${messages.length}`,
          role: 'user',
          timestamp,
          content: [{ type: 'text', text: payload.message }],
          model: sessionModel() || undefined,
          agent: sessionAgent() || undefined
        })
        continue
      }

      // Agent reasoning — duplicate of response_item reasoning, skip
      if (payloadType === 'agent_reasoning') {
        continue
      }

      // Agent message — some older rollout files may have this
      if (payloadType === 'agent_message' && payload.message) {
        // Dedup: skip if we already have assistant blocks from response_item
        if (assistantBlocks.length > 0) {
          continue
        }
        assistantTimestamp = timestamp
        assistantBlocks.push({ type: 'text', text: payload.message })
        continue
      }

      // Token count
      if (payloadType === 'token_count' && payload.info?.total_token_usage) {
        const tu = payload.info.total_token_usage
        assistantTokenUsage = {
          inputTokens: tu.input_tokens,
          outputTokens: tu.output_tokens,
          cacheRead: tu.cached_input_tokens,
          cacheCreation: undefined
        }
        continue
      }

      // Task complete — flush the assistant turn
      if (payloadType === 'task_complete') {
        flushAssistant()
        seenResponseItemUser = false
        continue
      }

      // task_started, other events — skip
      continue
    }

    // ── turn_context — skip ──
  }

  // Flush any remaining assistant blocks
  flushAssistant()

  return messages
}

function readAllLines(filePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const lines: string[] = []
    const stream = createReadStream(filePath, { encoding: 'utf-8' })
    const rl = createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', (line) => lines.push(line))
    rl.on('error', (err) => reject(err))
    rl.on('close', () => resolve(lines))
  })
}

function tryParseJSON(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str)
  } catch {
    return {}
  }
}
