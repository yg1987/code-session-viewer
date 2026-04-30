import { dialog } from 'electron'
import * as fs from 'fs'
import type { ParsedMessage, ContentBlock } from './session-parser'

export async function exportSessionToMarkdown(
  messages: ParsedMessage[],
  sessionInfo: { title: string; projectPath: string; sessionId: string }
): Promise<string | null> {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: `claude-session-${sessionInfo.sessionId.slice(0, 8)}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })

  if (!filePath) return null

  const lines: string[] = []

  // Header
  lines.push(`# ${sessionInfo.title}`)
  lines.push('')
  lines.push(`- **Project**: ${sessionInfo.projectPath}`)
  lines.push(`- **Session ID**: ${sessionInfo.sessionId}`)
  const firstTime = messages[0]?.timestamp ? new Date(messages[0].timestamp).toLocaleString() : ''
  const lastTime = messages.length > 0 ? new Date(messages[messages.length - 1].timestamp).toLocaleString() : ''
  if (firstTime) lines.push(`- **Time**: ${firstTime} ~ ${lastTime}`)
  lines.push(`- **Messages**: ${messages.length}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const msg of messages) {
    const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''
    if (msg.role === 'user') {
      lines.push(`## 🧑 User  *(${time})*`)
    } else {
      const model = msg.model ? `  \`${msg.model}\`` : ''
      lines.push(`## 🤖 Assistant${model}  *(${time})*`)
    }
    lines.push('')

    for (const block of msg.content) {
      lines.push(renderBlock(block))
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8')
  return filePath
}

function renderBlock(block: ContentBlock): string {
  if (block.type === 'text' && block.text) {
    return block.text
  }

  if (block.type === 'thinking' && block.thinking) {
    return `<details>\n<summary>💭 Thinking (${block.thinking.length} chars)</summary>\n\n${block.thinking}\n</details>`
  }

  if (block.type === 'tool_use') {
    const lines: string[] = []
    lines.push(`> **🔧 ${block.name || 'Tool'}**`)

    if (block.input) {
      const inputStr = JSON.stringify(block.input, null, 2)
      lines.push('>')
      lines.push('> ```json')
      for (const line of inputStr.split('\n')) {
        lines.push(`> ${line}`)
      }
      lines.push('> ```')
    }

    if (block.result) {
      const content = block.result.stdout || block.result.content || ''
      const label = block.result.is_error ? '❌ Error' : '✅ Result'
      lines.push('>')
      lines.push(`> ${label}:`)
      lines.push('>')
      lines.push('> ```')
      for (const line of content.split('\n').slice(0, 50)) {
        lines.push(`> ${line}`)
      }
      if (content.split('\n').length > 50) {
        lines.push('> ...(truncated)')
      }
      lines.push('> ```')
    }

    return lines.join('\n')
  }

  return ''
}
