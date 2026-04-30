import { useState } from 'react'
import { Collapsible } from '../common/Collapsible'
import { CopyButton } from '../common/CopyButton'
import { HighlightedCode } from './HighlightedCode'
import type { ToolUseBlock } from '../../types/message'

const TRUNCATE_THRESHOLD = 15000 // characters

/** Truncate large content with a "Show all" button */
function useTruncated(content: string) {
  const [expanded, setExpanded] = useState(false)
  const needsTruncation = content.length > TRUNCATE_THRESHOLD
  const displayContent = needsTruncation && !expanded ? content.slice(0, TRUNCATE_THRESHOLD) : content
  const truncated = needsTruncation && !expanded

  const TruncateBar = truncated ? () => (
    <div className="text-center py-1.5 border-t border-[#30363d]/50 bg-[#161b22]">
      <button type="button" onClick={() => setExpanded(true)}
        className="text-xs text-[#58a6ff] hover:text-[#79c0ff]">
        Show all ({(content.length / 1000).toFixed(0)}K chars, truncated at {(TRUNCATE_THRESHOLD / 1000).toFixed(0)}K)
      </button>
    </div>
  ) : () => null

  return { displayContent, TruncateBar }
}

interface Props {
  block: ToolUseBlock
  onViewSubagent?: (description: string) => void
}

const TOOL_COLORS: Record<string, string> = {
  Bash: 'csv-tool-bash',
  Read: 'csv-tool-read',
  Write: 'csv-tool-write',
  Edit: 'csv-tool-edit',
  Glob: 'csv-tool-glob',
  Grep: 'csv-tool-grep',
  WebFetch: 'csv-tool-web',
  WebSearch: 'csv-tool-web',
  Agent: 'csv-tool-agent',
  AskUserQuestion: 'csv-tool-ask',
  TodoWrite: 'csv-tool-todo',
  TaskCreate: 'csv-tool-todo',
  TaskUpdate: 'csv-tool-todo',
  TaskList: 'csv-tool-todo',
  TaskGet: 'csv-tool-todo',
  LSP: 'csv-tool-lsp',
  Skill: 'csv-tool-skill',
  NotebookEdit: 'csv-tool-notebook'
}

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java',
  cs: 'csharp', cpp: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
  css: 'css', scss: 'scss', less: 'less', html: 'html', vue: 'vue',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'xml',
  md: 'markdown', sql: 'sql', sh: 'bash', bash: 'bash', zsh: 'bash',
  lua: 'lua', dart: 'dart', swift: 'swift', kt: 'kotlin',
  dockerfile: 'dockerfile', makefile: 'makefile', gradle: 'gradle',
  proto: 'protobuf', graphql: 'graphql', svelte: 'svelte',
}

function getLangFromPath(filePath: string): string {
  const name = filePath.split(/[/\\]/).pop() || ''
  // Special filenames
  const lower = name.toLowerCase()
  if (lower === 'dockerfile') return 'dockerfile'
  if (lower === 'makefile') return 'makefile'
  if (lower.endsWith('.d.ts')) return 'typescript'

  const ext = name.split('.').pop()?.toLowerCase() || ''
  return EXT_TO_LANG[ext] || ext || 'text'
}

function getToolSummary(block: ToolUseBlock): string {
  const input = block.input || {}
  if (block.name === 'Bash' && input.command) {
    return String(input.command)
  }
  if (block.name === 'Read' && input.file_path) return String(input.file_path)
  if ((block.name === 'Write' || block.name === 'Edit') && input.file_path)
    return String(input.file_path)
  if (block.name === 'Glob' && input.pattern) return String(input.pattern)
  if (block.name === 'Grep' && input.pattern) {
    const path = input.path ? ` in ${input.path}` : ''
    return `/${input.pattern}/${path}`
  }
  if (block.name === 'WebFetch' && input.url) return String(input.url)
  if (block.name === 'WebSearch' && input.query) return String(input.query)
  if (block.name === 'Agent' && input.description) return String(input.description)
  if (block.name === 'LSP' && input.operation) return `${input.operation} @ ${input.filePath || ''}`
  if (block.name === 'TodoWrite' && input.todos) {
    const todos = input.todos as Array<{ status?: string }>
    const counts = { completed: 0, in_progress: 0, pending: 0 }
    for (const t of todos) { if (t.status && t.status in counts) (counts as any)[t.status]++ }
    return `${todos.length} items (${counts.completed} done, ${counts.in_progress} active, ${counts.pending} pending)`
  }
  if (block.name === 'TaskCreate' && input.subject) return String(input.subject)
  if (block.name === 'TaskUpdate') return `#${input.taskId || ''} → ${input.status || ''}`
  return ''
}

function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath
}

export function ToolCallBlock({ block, onViewSubagent }: Props) {
  const colorClass = TOOL_COLORS[block.name] || 'bg-gray-600'
  const summary = getToolSummary(block)
  const hasError = block.result?.is_error

  return (
    <Collapsible
      className="my-2 border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--surface)] transition-shadow hover:shadow-[var(--shadow-1)]"
      defaultOpen={false}
      header={
        <span className="inline-flex items-start gap-2 px-3 py-2 text-sm w-full">
          <span className={`csv-tool-chip ${colorClass} text-xs font-semibold px-2 py-0.5 rounded-md flex-shrink-0 mt-0.5`}>
            {block.name}
          </span>
          <span className="text-[var(--text2)] text-xs break-all leading-relaxed">{summary}</span>
          {block.name === 'Agent' && onViewSubagent && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onViewSubagent(String((block as any).input?.description || '')) }}
              className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors flex-shrink-0 ml-auto"
            >
              View Sub-Agent
            </button>
          )}
          {hasError && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--error-soft)] text-[var(--error)] font-medium flex-shrink-0 ml-auto">Error</span>
          )}
        </span>
      }
    >
      <div className="border-t border-[var(--border)]">
        {renderToolContent(block)}
      </div>
    </Collapsible>
  )
}

function renderToolContent(block: ToolUseBlock) {
  switch (block.name) {
    case 'Edit': return <EditToolContent block={block} />
    case 'Read': return <ReadToolContent block={block} />
    case 'Write': return <WriteToolContent block={block} />
    case 'Bash': return <BashToolContent block={block} />
    case 'Grep': return <GrepToolContent block={block} />
    case 'Glob': return <GlobToolContent block={block} />
    case 'WebFetch':
    case 'WebSearch': return <WebToolContent block={block} />
    case 'AskUserQuestion': return <AskUserContent block={block} />
    case 'TodoWrite': return <TodoWriteContent block={block} />
    case 'TaskCreate':
    case 'TaskUpdate':
    case 'TaskList':
    case 'TaskGet': return <TaskContent block={block} />
    default: return <GenericToolContent block={block} />
  }
}

/** Edit tool: show file path, old_string vs new_string diff */
function EditToolContent({ block }: { block: ToolUseBlock }) {
  const input = block.input || {}
  const filePath = String(input.file_path || '')
  const oldStr = String(input.old_string || '')
  const newStr = String(input.new_string || '')
  const lang = getLangFromPath(filePath)
  const replaceAll = input.replace_all ? ' (replace all)' : ''

  return (
    <div className="px-3 py-2 space-y-2">
      {/* File path */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">File:</span>
        <span className="text-xs text-[#58a6ff] font-mono">{filePath}</span>
        {replaceAll && <span className="text-xs text-yellow-500">{replaceAll}</span>}
      </div>

      {/* Diff view */}
      <div className="rounded-lg overflow-hidden border border-[#30363d] bg-[#0d1117]">
        {/* Old string - deletions */}
        <div className="border-b border-[#30363d]">
          <div className="flex items-center justify-between px-3 py-1 bg-red-900/20 border-b border-[#30363d]">
            <span className="text-xs font-medium text-red-400">- old_string</span>
            <CopyButton text={oldStr} />
          </div>
          <div className="bg-red-900/5 relative">
            <HighlightedCode code={oldStr} language={lang} maxHeight="300px" />
            {/* Red overlay tint */}
            <div className="absolute inset-0 bg-red-900/10 pointer-events-none" />
          </div>
        </div>

        {/* New string - additions */}
        <div>
          <div className="flex items-center justify-between px-3 py-1 bg-green-900/20 border-b border-[#30363d]">
            <span className="text-xs font-medium text-green-400">+ new_string</span>
            <CopyButton text={newStr} />
          </div>
          <div className="bg-green-900/5 relative">
            <HighlightedCode code={newStr} language={lang} maxHeight="300px" />
            {/* Green overlay tint */}
            <div className="absolute inset-0 bg-green-900/10 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Result */}
      {block.result && <ToolResultDisplay result={block.result} />}
    </div>
  )
}

/** Strip line number prefixes from Read tool output (e.g. "1\tcode" -> "code") */
function stripLineNumbers(content: string): { code: string; startLine: number } {
  const lines = content.split('\n')
  let startLine = 1
  const stripped = lines.map((line, i) => {
    // Match "123\t..." pattern (cat -n format)
    const match = line.match(/^(\d+)\t(.*)$/)
    if (match) {
      if (i === 0) startLine = parseInt(match[1], 10)
      return match[2]
    }
    return line
  })
  return { code: stripped.join('\n'), startLine }
}

/** Read tool: show file content with language highlighting hint */
function ReadToolContent({ block }: { block: ToolUseBlock }) {
  const input = block.input || {}
  const filePath = String(input.file_path || '')
  const lang = getLangFromPath(filePath)
  const fileName = getFileName(filePath)
  const rawResult = block.result?.stdout || block.result?.content || ''
  const hasError = block.result?.is_error
  const { displayContent: resultContent, TruncateBar } = useTruncated(rawResult)
  const { code: strippedCode } = stripLineNumbers(resultContent)

  // Parse line range if present
  const offset = input.offset ? `from line ${input.offset}` : ''
  const limit = input.limit ? `${input.limit} lines` : ''
  const rangeInfo = [offset, limit].filter(Boolean).join(', ')

  return (
    <div className="px-3 py-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">File:</span>
        <span className="text-xs text-[#58a6ff] font-mono">{filePath}</span>
        {rangeInfo && <span className="text-xs text-gray-500">({rangeInfo})</span>}
      </div>

      {block.result && (
        <div className="rounded-lg overflow-hidden border border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center justify-between px-3 py-1 bg-[#161b22] border-b border-[#30363d]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{fileName}</span>
              <span className="text-[10px] text-gray-600">{lang}</span>
            </div>
            <CopyButton text={resultContent} />
          </div>
          {hasError ? (
            <pre className="p-2 text-xs overflow-x-auto max-h-96 overflow-y-auto text-red-400">
              <code>{resultContent}</code>
            </pre>
          ) : (
            <HighlightedCode code={strippedCode} language={lang} maxHeight="500px" />
          )}
          <TruncateBar />
        </div>
      )}
    </div>
  )
}

/** Write tool: show written content */
function WriteToolContent({ block }: { block: ToolUseBlock }) {
  const input = block.input || {}
  const filePath = String(input.file_path || '')
  const content = String(input.content || '')
  const lang = getLangFromPath(filePath)
  const fileName = getFileName(filePath)

  return (
    <div className="px-3 py-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">File:</span>
        <span className="text-xs text-[#58a6ff] font-mono">{filePath}</span>
      </div>

      <div className="rounded-lg overflow-hidden border border-[#30363d] bg-[#0d1117]">
        <div className="flex items-center justify-between px-3 py-1 bg-[#161b22] border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-400">CREATE</span>
            <span className="text-xs text-gray-400">{fileName}</span>
            <span className="text-[10px] text-gray-600">{lang}</span>
          </div>
          <CopyButton text={content} />
        </div>
        <HighlightedCode code={content} language={lang} maxHeight="500px" />
      </div>

      {block.result && <ToolResultDisplay result={block.result} />}
    </div>
  )
}

/** Bash tool: show command prominently + stdout/stderr */
function BashToolContent({ block }: { block: ToolUseBlock }) {
  const input = block.input || {}
  const command = String(input.command || '')
  const description = input.description ? String(input.description) : ''
  const rawResult = block.result?.stdout || block.result?.content || ''
  const hasError = block.result?.is_error
  const { displayContent: resultContent, TruncateBar } = useTruncated(rawResult)

  return (
    <div className="px-3 py-2 space-y-2">
      {description && (
        <div className="text-xs text-gray-400 italic">{description}</div>
      )}

      {/* Command */}
      <div className="rounded-lg overflow-hidden border border-[#30363d] bg-[#0d1117]">
        <div className="flex items-center justify-between px-3 py-1 bg-[#161b22] border-b border-[#30363d]">
          <span className="text-xs text-green-400 font-mono">$</span>
          <CopyButton text={command} />
        </div>
        <pre className="p-2 text-xs overflow-x-auto text-green-300 font-mono">
          <code>{command}</code>
        </pre>
      </div>

      {/* Output */}
      {block.result && (
        <div className="rounded-lg overflow-hidden border border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center justify-between px-3 py-1 bg-[#161b22] border-b border-[#30363d]">
            <span className={`text-xs ${hasError ? 'text-red-400' : 'text-gray-500'}`}>
              {hasError ? 'Error Output' : 'Output'}
            </span>
            <CopyButton text={rawResult} />
          </div>
          <pre className={`p-2 text-xs overflow-x-auto max-h-80 overflow-y-auto ${hasError ? 'text-red-400' : 'text-[#e6edf3]'}`}>
            <code>{resultContent || '(no output)'}</code>
          </pre>
          <TruncateBar />
          {block.result.stderr && (
            <div className="border-t border-[#30363d]">
              <div className="px-3 py-1 bg-red-900/10">
                <span className="text-xs text-red-400">stderr</span>
              </div>
              <pre className="p-2 text-xs overflow-x-auto max-h-40 overflow-y-auto text-red-400">
                <code>{block.result.stderr}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Grep tool: show pattern, path and results */
function GrepToolContent({ block }: { block: ToolUseBlock }) {
  const input = block.input || {}
  const pattern = String(input.pattern || '')
  const path = input.path ? String(input.path) : ''
  const glob = input.glob ? String(input.glob) : ''
  const outputMode = input.output_mode ? String(input.output_mode) : 'files_with_matches'
  const resultContent = block.result?.stdout || block.result?.content || ''

  return (
    <div className="px-3 py-2 space-y-2">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <span className="text-gray-500">Pattern:</span>
        <code className="text-yellow-300 bg-yellow-900/20 px-1.5 py-0.5 rounded font-mono">{pattern}</code>
        {path && <><span className="text-gray-500">in</span><span className="text-[#58a6ff] font-mono">{path}</span></>}
        {glob && <><span className="text-gray-500">glob:</span><span className="text-gray-300 font-mono">{glob}</span></>}
        <span className="text-gray-600">mode: {outputMode}</span>
      </div>

      {block.result && (
        <div className="rounded-lg overflow-hidden border border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center justify-between px-3 py-1 bg-[#161b22] border-b border-[#30363d]">
            <span className="text-xs text-gray-500">Results</span>
            <CopyButton text={resultContent} />
          </div>
          <pre className="p-2 text-xs overflow-x-auto max-h-80 overflow-y-auto text-[#e6edf3]">
            <code>{resultContent || '(no matches)'}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

/** Glob tool: show pattern and matched files */
function GlobToolContent({ block }: { block: ToolUseBlock }) {
  const input = block.input || {}
  const pattern = String(input.pattern || '')
  const path = input.path ? String(input.path) : ''
  const resultContent = block.result?.stdout || block.result?.content || ''

  const fileList = resultContent.split('\n').filter(Boolean)

  return (
    <div className="px-3 py-2 space-y-2">
      <div className="flex items-center gap-3 text-xs">
        <span className="text-gray-500">Pattern:</span>
        <code className="text-cyan-300 bg-cyan-900/20 px-1.5 py-0.5 rounded font-mono">{pattern}</code>
        {path && <><span className="text-gray-500">in</span><span className="text-[#58a6ff] font-mono">{path}</span></>}
      </div>

      {block.result && (
        <div className="rounded-lg overflow-hidden border border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center justify-between px-3 py-1 bg-[#161b22] border-b border-[#30363d]">
            <span className="text-xs text-gray-500">{fileList.length} files matched</span>
            <CopyButton text={resultContent} />
          </div>
          <div className="p-2 text-xs max-h-60 overflow-y-auto">
            {fileList.map((f, i) => (
              <div key={i} className="text-[#58a6ff] font-mono py-0.5 hover:bg-[#161b22]">{f}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** WebFetch / WebSearch */
function WebToolContent({ block }: { block: ToolUseBlock }) {
  const input = block.input || {}
  const url = input.url ? String(input.url) : ''
  const query = input.query ? String(input.query) : ''
  const prompt = input.prompt ? String(input.prompt) : ''
  const resultContent = block.result?.stdout || block.result?.content || ''

  return (
    <div className="px-3 py-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {url && <><span className="text-gray-500">URL:</span><span className="text-[#58a6ff]">{url}</span></>}
        {query && <><span className="text-gray-500">Query:</span><span className="text-yellow-300">{query}</span></>}
      </div>
      {prompt && (
        <div className="text-xs text-gray-400 italic">Prompt: {prompt}</div>
      )}

      {block.result && (
        <div className="rounded-lg overflow-hidden border border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center justify-between px-3 py-1 bg-[#161b22] border-b border-[#30363d]">
            <span className="text-xs text-gray-500">Response</span>
            <CopyButton text={resultContent} />
          </div>
          <pre className="p-2 text-xs overflow-x-auto max-h-80 overflow-y-auto text-[#e6edf3]">
            <code>{resultContent}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

/** AskUserQuestion: show questions and answers nicely */
function AskUserContent({ block }: { block: ToolUseBlock }) {
  const input = block.input || {}
  const questions = (input.questions as Array<{ question: string; header?: string; options?: Array<{ label: string; description?: string }> }>) || []
  const resultContent = block.result?.content || ''

  // Parse answers from result: "question"="answer", "question2"="answer2"
  const answers = new Map<string, string>()
  const answerRegex = /"([^"]+)"="([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = answerRegex.exec(resultContent)) !== null) {
    answers.set(match[1], match[2])
  }

  return (
    <div className="px-3 py-2 space-y-2">
      {questions.map((q, i) => {
        const answer = answers.get(q.question)
        return (
          <div key={i} className="bg-[#0d1117] rounded-lg p-3 border border-[#30363d]">
            <div className="text-xs text-yellow-300 font-medium mb-1.5">{q.question}</div>
            {q.options && (
              <div className="space-y-1">
                {q.options.map((opt, j) => {
                  const isSelected = answer === opt.label
                  return (
                    <div key={j} className={`flex items-start gap-2 px-2 py-1 rounded text-xs transition-colors ${
                      isSelected
                        ? 'bg-green-900/20 border border-green-700/40'
                        : 'border border-transparent'
                    }`}>
                      <span className={`flex-shrink-0 mt-0.5 ${isSelected ? 'text-green-400' : 'text-gray-600'}`}>
                        {isSelected ? '\u2705' : '\u25CB'}
                      </span>
                      <div>
                        <span className={isSelected ? 'text-green-300 font-medium' : 'text-gray-400'}>
                          {opt.label}
                        </span>
                        {opt.description && (
                          <span className="text-gray-600 ml-1">{opt.description}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {answer && !q.options?.some((o) => o.label === answer) && (
              <div className="mt-1.5 px-2 py-1 bg-green-900/20 border border-green-700/40 rounded text-xs text-green-300">
                {'\u2705'} {answer}
              </div>
            )}
          </div>
        )
      })}

      {resultContent && answers.size === 0 && (
        <div className="text-xs text-green-400 bg-green-900/10 rounded-lg p-2 border border-green-900/20">
          {resultContent}
        </div>
      )}
    </div>
  )
}

const STATUS_STYLES: Record<string, { icon: string; color: string }> = {
  completed: { icon: '\u2705', color: 'text-green-400' },
  in_progress: { icon: '\u23f3', color: 'text-blue-400' },
  pending: { icon: '\u2B55', color: 'text-gray-400' },
  deleted: { icon: '\u274C', color: 'text-red-400' }
}

/** TodoWrite: show as a task checklist */
function TodoWriteContent({ block }: { block: ToolUseBlock }) {
  const input = block.input || {}
  const todos = (input.todos as Array<{ content?: string; status?: string; activeForm?: string }>) || []

  return (
    <div className="px-3 py-2">
      {todos.length === 0 ? (
        <div className="text-xs text-gray-500">No items</div>
      ) : (
        <div className="space-y-1">
          {todos.map((todo, i) => {
            const st = STATUS_STYLES[todo.status || 'pending'] || STATUS_STYLES.pending
            return (
              <div key={i} className="flex items-start gap-2 py-1">
                <span className="text-sm flex-shrink-0">{st.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs ${st.color}`}>
                    {todo.content || todo.activeForm || 'Untitled'}
                  </div>
                  {todo.activeForm && todo.content && todo.activeForm !== todo.content && (
                    <div className="text-[10px] text-gray-600">{todo.activeForm}</div>
                  )}
                </div>
                <span className={`text-[10px] flex-shrink-0 ${st.color}`}>{todo.status}</span>
              </div>
            )
          })}
        </div>
      )}
      {block.result && <ToolResultDisplay result={block.result} />}
    </div>
  )
}

/** TaskCreate / TaskUpdate / TaskList / TaskGet */
function TaskContent({ block }: { block: ToolUseBlock }) {
  const input = block.input || {}

  if (block.name === 'TaskCreate') {
    const st = STATUS_STYLES.pending
    return (
      <div className="px-3 py-2">
        <div className="flex items-start gap-2 bg-[#0d1117] rounded-lg p-2.5 border border-[#30363d]">
          <span className="text-sm flex-shrink-0">{st.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-[var(--text)] font-medium">{String(input.subject || '')}</div>
            {input.description && <div className="text-[10px] text-gray-500 mt-0.5">{String(input.description)}</div>}
            {input.activeForm && <div className="text-[10px] text-gray-600 mt-0.5 italic">{String(input.activeForm)}</div>}
          </div>
        </div>
        {block.result && <ToolResultDisplay result={block.result} />}
      </div>
    )
  }

  if (block.name === 'TaskUpdate') {
    const newStatus = String(input.status || '')
    const st = STATUS_STYLES[newStatus] || STATUS_STYLES.pending
    return (
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Task</span>
          <span className="text-xs text-[var(--accent)] font-mono">#{String(input.taskId || '')}</span>
          <span className="text-xs text-gray-500">&rarr;</span>
          <span className={`text-xs ${st.color} font-medium`}>{st.icon} {newStatus}</span>
        </div>
        {input.subject && <div className="text-xs text-[var(--text)] mt-1">{String(input.subject)}</div>}
        {input.description && <div className="text-[10px] text-gray-500 mt-0.5">{String(input.description)}</div>}
        {block.result && <div className="mt-2"><ToolResultDisplay result={block.result} /></div>}
      </div>
    )
  }

  // TaskList / TaskGet — show result nicely
  return (
    <div className="px-3 py-2">
      {block.result && <ToolResultDisplay result={block.result} />}
    </div>
  )
}

/** Generic fallback for unknown tools */
function GenericToolContent({ block }: { block: ToolUseBlock }) {
  const inputStr = JSON.stringify(block.input, null, 2)
  const resultContent = block.result?.stdout || block.result?.content || ''

  return (
    <div className="px-3 py-2 space-y-2">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-500">Input</span>
          <CopyButton text={inputStr} />
        </div>
        <pre className="bg-[#0d1117] rounded p-2 text-xs overflow-x-auto max-h-60 overflow-y-auto">
          <code className="text-[#e6edf3]">{inputStr}</code>
        </pre>
      </div>

      {block.result && <ToolResultDisplay result={block.result} />}
    </div>
  )
}

/** Shared result display component */
function ToolResultDisplay({ result }: { result: NonNullable<ToolUseBlock['result']> }) {
  const rawContent = result.stdout || result.content || ''
  const hasError = result.is_error
  const { displayContent: content, TruncateBar } = useTruncated(rawContent)

  if (!rawContent && !result.stderr) return null

  return (
    <div className="rounded-lg overflow-hidden border border-[#30363d] bg-[#0d1117]">
      {rawContent && (
        <>
          <div className="flex items-center justify-between px-3 py-1 bg-[#161b22] border-b border-[#30363d]">
            <span className={`text-xs ${hasError ? 'text-red-400' : 'text-gray-500'}`}>
              {hasError ? 'Error' : 'Result'}
            </span>
            <CopyButton text={rawContent} />
          </div>
          <pre className={`p-2 text-xs overflow-x-auto max-h-60 overflow-y-auto ${hasError ? 'text-red-400' : 'text-[#e6edf3]'}`}>
            <code>{content}</code>
          </pre>
          <TruncateBar />
        </>
      )}
      {result.stderr && (
        <div className={content ? 'border-t border-[#30363d]' : ''}>
          <div className="px-3 py-1 bg-red-900/10">
            <span className="text-xs text-red-400">stderr</span>
          </div>
          <pre className="p-2 text-xs overflow-x-auto max-h-40 overflow-y-auto text-red-400">
            <code>{result.stderr}</code>
          </pre>
        </div>
      )}
    </div>
  )
}
