import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { CopyButton } from '../common/CopyButton'
import { useLocale } from '../../hooks/useLocale'

import type { ParsedMessage } from '../../types/message'

interface Props {
  filePath: string
  searchActive?: boolean
  /** Pre-loaded messages for sessions without raw JSONL files (OpenCode/Codex) */
  messages?: ParsedMessage[]
}

const TYPE_COLORS: Record<string, string> = {
  user: 'border-l-blue-500',
  assistant: 'border-l-purple-500',
  attachment: 'border-l-yellow-600',
  system: 'border-l-gray-500',
  'file-history-snapshot': 'border-l-gray-700',
  progress: 'border-l-gray-700',
  'queue-operation': 'border-l-gray-700',
  'last-prompt': 'border-l-gray-700',
  'permission-mode': 'border-l-green-700'
}

export function RawJsonView({ filePath, searchActive, messages }: Props) {
  const [entries, setEntries] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const { t } = useLocale()

  const TYPE_LABELS: Record<string, string> = useMemo(() => ({
    user: t('rawJson.user'),
    assistant: t('rawJson.assistant'),
    attachment: t('rawJson.attach'),
    system: t('rawJson.system'),
    'file-history-snapshot': t('rawJson.snapshot'),
    progress: t('rawJson.progress'),
    'queue-operation': t('rawJson.queue'),
    'last-prompt': t('rawJson.lastPrompt'),
    'permission-mode': t('rawJson.perm')
  }), [t])

  // Search state
  const [searchText, setSearchText] = useState('')
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (messages) {
      const mapped = messages.map((m) => ({
        type: m.role === 'user' ? 'user' : 'assistant',
        uuid: m.id,
        timestamp: m.timestamp,
        message: {
          id: m.id, role: m.role, model: m.model,
          content: m.content.map((b) => {
            if (b.type === 'text') return { type: 'text', text: b.text }
            if (b.type === 'thinking') return { type: 'thinking', thinking: b.thinking }
            if (b.type === 'tool_use') return { type: 'tool_use', id: b.id, name: b.name, input: b.input }
            if (b.type === 'image') return { type: 'image', source: b.source }
            return b
          }),
          usage: m.tokenUsage ? {
            input_tokens: m.tokenUsage.inputTokens,
            output_tokens: m.tokenUsage.outputTokens,
            cache_read_input_tokens: m.tokenUsage.cacheRead,
            cache_creation_input_tokens: m.tokenUsage.cacheCreation
          } : undefined
        }
      }))
      setEntries(mapped)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setExpandedSet(new Set())
    setSearchText('')
    window.api.loadSessionRaw(filePath).then((data: unknown[]) => {
      if (!cancelled) { setEntries(data); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [filePath, messages])

  useEffect(() => { scrollRef.current?.scrollTo(0, 0) }, [filePath])

  // Focus search input when activated
  useEffect(() => {
    if (searchActive) searchInputRef.current?.focus()
    else setSearchText('')
  }, [searchActive])

  const allTypes = [...new Set(entries.map((e: any) => e.type || 'unknown'))]

  const filtered = filter === 'all' ? entries : entries.filter((e: any) => e.type === filter)

  // Search: find indices of matching entries in filtered list
  const matchedIndices = useMemo(() => {
    if (!searchText.trim()) return [] as number[]
    const q = searchText.toLowerCase()
    const matches: number[] = []
    for (let i = 0; i < filtered.length; i++) {
      const jsonStr = JSON.stringify(filtered[i]).toLowerCase()
      if (jsonStr.includes(q)) matches.push(i)
    }
    return matches
  }, [filtered, searchText])

  const matchedSet = useMemo(() => new Set(matchedIndices), [matchedIndices])
  const currentMatchEntryIdx = matchedIndices[currentMatchIdx] ?? -1

  useEffect(() => { setCurrentMatchIdx(0) }, [searchText])

  const jumpToMatch = useCallback((idx: number) => {
    if (matchedIndices.length === 0) return
    const wrapped = ((idx % matchedIndices.length) + matchedIndices.length) % matchedIndices.length
    setCurrentMatchIdx(wrapped)
    const entryIdx = matchedIndices[wrapped]
    // Auto-expand the matched entry
    setExpandedSet((prev) => { const next = new Set(prev); next.add(entryIdx); return next })
    // Scroll to it
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-raw-idx="${entryIdx}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [matchedIndices])

  // Auto-jump on first search
  useEffect(() => {
    if (matchedIndices.length > 0) {
      const timer = setTimeout(() => jumpToMatch(0), 100)
      return () => clearTimeout(timer)
    }
  }, [matchedIndices])

  // Keyboard: Enter/Shift+Enter to jump
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && matchedIndices.length > 0) {
      e.preventDefault()
      jumpToMatch(e.shiftKey ? currentMatchIdx - 1 : currentMatchIdx + 1)
    }
  }

  const toggle = (idx: number) => {
    setExpandedSet((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  const expandAll = () => setExpandedSet(new Set(filtered.map((_, i) => i)))
  const collapseAll = () => setExpandedSet(new Set())

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#58a6ff] border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-500 text-sm">{t('rawJson.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[#30363d] bg-[#161b22]">
        <span className="text-xs text-gray-500">{entries.length}{t('rawJson.entries')}</span>
        <span className="text-xs text-gray-600">|</span>

        <select value={filter}
          onChange={(e) => { setFilter(e.target.value); setExpandedSet(new Set()) }}
          className="text-xs bg-[#0d1117] border border-[#30363d] text-[#e6edf3] rounded px-2 py-1 focus:outline-none focus:border-[#58a6ff]">
          <option value="all">{t('rawJson.allTypes', { count: entries.length })}</option>
          {allTypes.map((t) => (
            <option key={t} value={t}>{t} ({entries.filter((e: any) => e.type === t).length})</option>
          ))}
        </select>

        <span className="text-xs text-gray-600">|</span>
        <button onClick={expandAll} className="text-xs text-gray-400 hover:text-gray-200">{t('rawJson.expandAll')}</button>
        <button onClick={collapseAll} className="text-xs text-gray-400 hover:text-gray-200">{t('rawJson.collapseAll')}</button>

        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length !== entries.length && t('rawJson.showing', { filtered: filtered.length, total: entries.length })}
        </span>
      </div>

      {/* Search bar */}
      {searchActive && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[#30363d] bg-[#0d1117]">
          <div className="relative flex-1">
            <input ref={searchInputRef} autoFocus type="text" value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('rawJson.searchPlaceholder')}
              className="w-full bg-[#161b22] border border-[#30363d] rounded-lg pl-8 pr-3 py-1.5 text-sm text-[#e6edf3] placeholder-gray-500 focus:outline-none focus:border-[#58a6ff]" />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchText && (
            <>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {matchedIndices.length > 0 ? t('rawJson.searchCount', { current: currentMatchIdx + 1, total: matchedIndices.length }) : t('rawJson.searchNoResults')}
              </span>
              <button type="button" onClick={() => jumpToMatch(currentMatchIdx - 1)} disabled={matchedIndices.length === 0}
                className="p-1 rounded hover:bg-[#30363d] text-gray-400 hover:text-gray-200 disabled:opacity-30">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
              </button>
              <button type="button" onClick={() => jumpToMatch(currentMatchIdx + 1)} disabled={matchedIndices.length === 0}
                className="p-1 rounded hover:bg-[#30363d] text-gray-400 hover:text-gray-200 disabled:opacity-30">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
            </>
          )}
        </div>
      )}

      {/* Entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 space-y-1">
          {filtered.map((entry: any, i) => {
            const type = entry.type || 'unknown'
            const borderColor = TYPE_COLORS[type] || 'border-l-gray-600'
            const label = TYPE_LABELS[type] || type.toUpperCase()
            const isExpanded = expandedSet.has(i)
            const jsonStr = JSON.stringify(entry, null, 2)
            const isMatch = searchText && matchedSet.has(i)
            const isCurrent = i === currentMatchEntryIdx

            let summary = ''
            if (type === 'user' && entry.message?.content) {
              const content = entry.message.content
              if (typeof content === 'string') summary = content.slice(0, 80)
              else if (Array.isArray(content)) {
                const textBlock = content.find((c: any) => c.type === 'text')
                const toolResult = content.find((c: any) => c.type === 'tool_result')
                if (textBlock?.text) summary = textBlock.text.slice(0, 80)
                else if (toolResult) summary = `tool_result [${toolResult.tool_use_id?.slice(-8) || ''}]`
              }
            } else if (type === 'assistant' && entry.message?.content) {
              const blocks = entry.message.content
              if (Array.isArray(blocks)) {
                const first = blocks[0]
                if (first?.type === 'text') summary = first.text?.slice(0, 80) || ''
                else if (first?.type === 'thinking') summary = `thinking (${first.thinking?.length || 0} chars)`
                else if (first?.type === 'tool_use') summary = `${first.name}()`
              }
            } else if (type === 'attachment') {
              summary = entry.attachment?.type || ''
            } else if (type === 'system') {
              summary = entry.subtype || ''
            }

            return (
              <div key={i} data-raw-idx={i}
                className={`border-l-2 ${borderColor} bg-[#161b22] rounded-r transition-all ${
                  isCurrent ? 'ring-2 ring-[#58a6ff] rounded' : isMatch ? 'ring-1 ring-[#58a6ff]/40 rounded' : ''
                }`}>
                <div className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[#1c2333] select-none"
                  onClick={() => toggle(i)}>
                  <span className="text-[10px] transition-transform inline-block"
                    style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
                  <span className="text-[10px] font-bold text-gray-400 w-6 text-right flex-shrink-0">{entries.indexOf(entry)}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    type === 'user' ? 'bg-blue-900/40 text-blue-300' :
                    type === 'assistant' ? 'bg-purple-900/40 text-purple-300' :
                    'bg-gray-800 text-gray-400'
                  }`}>{label}</span>
                  <span className="text-xs text-gray-500 truncate flex-1">{summary}</span>
                  {entry.uuid && (
                    <span className="text-[10px] text-gray-600 flex-shrink-0 font-mono">{entry.uuid.slice(0, 8)}</span>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-[#30363d]/50 relative">
                    <div className="absolute top-1 right-2"><CopyButton text={jsonStr} /></div>
                    <pre className="px-3 py-2 text-xs overflow-x-auto max-h-[500px] overflow-y-auto text-[#e6edf3] leading-relaxed font-mono">
                      {syntaxHighlight(jsonStr)}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function syntaxHighlight(json: string): React.ReactNode[] {
  const lines = json.split('\n')
  return lines.map((line, i) => {
    const colored = line
      .replace(/"([^"]+)":/g, '<k>"$1"</k>:')
      .replace(/: "([^"]*)"/g, ': <s>"$1"</s>')
      .replace(/: (\d+\.?\d*)/g, ': <n>$1</n>')
      .replace(/: (true|false|null)/g, ': <b>$1</b>')

    const reactParts: React.ReactNode[] = []
    const tagRegex = /<(k|s|n|b)>(.*?)<\/\1>/g
    let tagMatch: RegExpExecArray | null
    let tagLastIndex = 0
    let partKey = 0

    while ((tagMatch = tagRegex.exec(colored)) !== null) {
      if (tagMatch.index > tagLastIndex) reactParts.push(colored.slice(tagLastIndex, tagMatch.index))
      const tag = tagMatch[1]
      const text = tagMatch[2]
      const color = tag === 'k' ? '#79c0ff' : tag === 's' ? '#a5d6ff' : tag === 'n' ? '#f0883e' : '#ff7b72'
      reactParts.push(<span key={partKey++} style={{ color }}>{text}</span>)
      tagLastIndex = tagRegex.lastIndex
    }
    if (tagLastIndex < colored.length) reactParts.push(colored.slice(tagLastIndex))

    return <div key={i}>{reactParts}</div>
  })
}
