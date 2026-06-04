import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { ParsedMessage } from '../../types/message'
import type { SessionEntry } from '../../types/session'
import { UserMessage } from './UserMessage'
import { AssistantMessage } from './AssistantMessage'
import { ErrorBoundary } from '../common/ErrorBoundary'
import { ShortcutsHelp } from '../ShortcutsHelp'
import { RawJsonView } from './RawJsonView'
import { SessionStats } from './SessionStats'
import { SubagentPanel } from './SubagentPanel'
import { InsightsPanel } from './InsightsPanel'
import { ReplayControls } from './ReplayControls'
import { useExport } from '../../hooks/useExport'
import { CollapseContext, useCollapseProvider } from '../../hooks/useCollapseControl'
import { TodoPanel } from './TodoPanel'
import { AgentTimeline } from './AgentTimeline'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function cleanPrompt(prompt: string): string {
  if (!prompt || prompt === 'No prompt') return ''
  let cleaned = prompt.replace(/<[^>]+>[^<]*<\/[^>]+>/g, '').trim()
  cleaned = cleaned.replace(/<[^>]+>/g, '').trim()
  return cleaned || ''
}

type ViewMode = 'chat' | 'raw' | 'stats' | 'insights' | 'todos' | 'timeline'

interface Props {
  messages: ParsedMessage[]
  loading: boolean
  error: string | null
  session: SessionEntry | null
  jumpToTimestamp?: string | null
  onJumpDone?: () => void
}

export function ConversationView({ messages, loading, error, session, jumpToTimestamp, onJumpDone }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { exporting, exportSession } = useExport()
  const [viewMode, setViewMode] = useState<ViewMode>('chat')
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [replayMode, setReplayMode] = useState(false)
  const [replayPos, setReplayPos] = useState(0)
  const [searchText, setSearchText] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportBtnRef = useRef<HTMLButtonElement>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSubagents, setShowSubagents] = useState(false)
  const [subagentDescription, setSubagentDescription] = useState('')
  const collapseControl = useCollapseProvider()
  const BATCH_SIZE = 20
  const [renderCount, setRenderCount] = useState(BATCH_SIZE)

  // Matched message IDs
  const matchedIds = useMemo(() => {
    if (!searchText.trim()) return [] as string[]
    const q = searchText.toLowerCase()
    return messages
      .filter((msg) =>
        msg.content.some((block) => {
          if (block.type === 'text' && block.text?.toLowerCase().includes(q)) return true
          if (block.type === 'thinking' && block.thinking?.toLowerCase().includes(q)) return true
          if (block.type === 'tool_use') {
            if (block.name?.toLowerCase().includes(q)) return true
            if (JSON.stringify(block.input).toLowerCase().includes(q)) return true
            if (block.result?.content?.toLowerCase().includes(q)) return true
          }
          return false
        })
      )
      .map((m) => m.id)
  }, [messages, searchText])

  const matchedIdSet = useMemo(() => new Set(matchedIds), [matchedIds])
  const currentMatchId = matchedIds[currentMatchIdx] || null

  useEffect(() => { scrollRef.current?.scrollTo(0, 0) }, [session?.sessionId])
  useEffect(() => { setViewMode('chat'); setSearchText(''); setShowSearch(false); setRenderCount(BATCH_SIZE); setReplayMode(false); setReplayPos(0) }, [session?.sessionId])
  useEffect(() => { setCurrentMatchIdx(0) }, [searchText])

  // Jump to match
  const jumpToMatch = useCallback((idx: number) => {
    if (matchedIds.length === 0) return
    const wrappedIdx = ((idx % matchedIds.length) + matchedIds.length) % matchedIds.length
    setCurrentMatchIdx(wrappedIdx)
    // Ensure the matched message is rendered
    const matchId = matchedIds[wrappedIdx]
    const msgIdx = messages.findIndex((m) => m.id === matchId)
    if (msgIdx >= 0) setRenderCount((prev) => Math.max(prev, msgIdx + 5))
    // Scroll after render
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-msg-id="${matchId}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [matchedIds, messages])

  useEffect(() => {
    if (matchedIds.length > 0) {
      const timer = setTimeout(() => jumpToMatch(0), 100)
      return () => clearTimeout(timer)
    }
  }, [matchedIds])

  // Jump to a specific timestamp from cross-search
  useEffect(() => {
    if (!jumpToTimestamp || loading || messages.length === 0) return
    const msgIdx = messages.findIndex((m) => m.timestamp === jumpToTimestamp)
    if (msgIdx < 0) return
    const msg = messages[msgIdx]
    setRenderCount((prev) => Math.max(prev, msgIdx + 5))
    const doScroll = () => {
      const el = document.querySelector(`[data-msg-id="${msg.id}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        onJumpDone?.()
      } else {
        requestAnimationFrame(doScroll)
      }
    }
    const timer = setTimeout(doScroll, 150)
    return () => clearTimeout(timer)
  }, [jumpToTimestamp, messages, loading])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    setShowScrollTop(scrollRef.current.scrollTop > 400)
    // Load more when scrolled near bottom
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    if (scrollHeight - scrollTop - clientHeight < 500) {
      setRenderCount((prev) => Math.min(prev + BATCH_SIZE, messages.length))
    }
  }, [messages.length])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault(); setShowShortcuts((p) => !p); return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowSearch((p) => !p) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') { e.preventDefault(); handleExportHtml() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o' && session && (!session.source || session.source === 'claude')) {
        e.preventDefault()
        window.api.openInClaude({ sessionId: session.sessionId, projectPath: session.projectPath })
      }
      if (e.key === 'Escape' && showSearch) { setShowSearch(false); setSearchText('') }
      if (e.key === 'Enter' && showSearch && matchedIds.length > 0) {
        e.preventDefault()
        jumpToMatch(e.shiftKey ? currentMatchIdx - 1 : currentMatchIdx + 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showSearch, matchedIds, currentMatchIdx, jumpToMatch])

  const getExportData = () => ({
    filePath: session!.fullPath,
    title: session!.customTitle || session!.summary || session!.firstPrompt || session!.sessionId,
    projectPath: session!.projectPath,
    sessionId: session!.sessionId
  })

  const handleExportHtml = async () => {
    if (!session) return
    setShowExportMenu(false)
    await exportSession(getExportData())
  }

  const handleExportMd = async () => {
    if (!session) return
    setShowExportMenu(false)
    await window.api.exportSessionMd(getExportData())
  }

  // Empty state
  if (!session) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg)] app-shell relative overflow-hidden">
        <div className="text-center max-w-sm px-6">
          <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shadow-[var(--shadow-2)]">
            <svg className="w-7 h-7 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-[var(--text)] text-base font-medium mb-1">No session selected</p>
          <p className="text-[var(--text2)] text-sm">Choose a session from the sidebar to start browsing the conversation.</p>
        </div>
      </div>
    )
  }

  const title = session.customTitle || session.summary || cleanPrompt(session.firstPrompt) || session.sessionId
  const createdTime = session.created ? new Date(session.created).toLocaleString() : ''
  const modifiedTime = session.modified ? new Date(session.modified).toLocaleString() : ''

  return (
    <CollapseContext.Provider value={collapseControl}>
      <div className="h-full flex flex-col bg-[var(--bg)] app-shell relative">
        {/* Session header */}
        <div className="flex-shrink-0 border-b border-[var(--border)] px-6 py-3 bg-[var(--bg)]/85 backdrop-blur">
          {/* Row 1: Title + Actions */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text)] truncate min-w-0 flex-1" title={title}>
              {title}
            </h2>

            <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
              {/* View mode toggle */}
              <div className="flex rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
                {(['chat', 'stats', 'insights', ...(session?.source === 'opencode' ? ['todos', 'timeline'] : []), 'raw'] as ViewMode[]).map((mode) => (
                  <button key={mode} type="button" onClick={() => setViewMode(mode)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === mode ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)]'}`}>
                    {mode === 'chat' ? 'Chat' : mode === 'stats' ? 'Stats' : mode === 'insights' ? 'Insights' : mode === 'todos' ? 'Todos' : mode === 'timeline' ? 'Timeline' : 'Raw JSON'}
                  </button>
                ))}
              </div>

              {/* Expand/Collapse All (only in chat view) */}
              {viewMode === 'chat' && (
                <div className="flex rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
                  <button type="button" onClick={collapseControl.expandAll} title="Expand all blocks"
                    className="px-2 py-1.5 text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                  </button>
                  <button type="button" onClick={collapseControl.collapseAll} title="Collapse all blocks"
                    className="px-2 py-1.5 text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" /></svg>
                  </button>
                </div>
              )}

              {/* Search */}
              <button type="button" onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchText('') }}
                className={`p-1.5 rounded-md transition-colors ${showSearch ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface)]'}`}
                title="Search (Ctrl+F)">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </button>

              {/* Open in folder — only for Claude sessions */}
              {(!session.source || session.source === 'claude') && (
              <button type="button" onClick={() => window.api.showInFolder(session.fullPath)}
                className="p-1.5 rounded-md text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                title="Show in file explorer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
              </button>
              )}

              {/* Replay */}
              <button type="button" onClick={() => { setReplayMode(true); setReplayPos(0); setViewMode('chat'); setRenderCount(messages.length) }}
                className="p-1.5 rounded-md text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                title="Replay mode">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>

              {/* Open in Claude — only for Claude sessions */}
              {(!session.source || session.source === 'claude') && (
              <button type="button"
                onClick={() => window.api.openInClaude({ sessionId: session.sessionId, projectPath: session.projectPath })}
                className="csv-btn-primary px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1"
                title="Open in Claude Code (Ctrl+O)">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Resume
              </button>
              )}

              {/* Export dropdown */}
              <div className="relative">
                <button ref={exportBtnRef} type="button" onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={exporting || loading}
                  className="px-3 py-1.5 bg-[var(--green)] hover:opacity-90 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-all inline-flex items-center gap-1">
                  {exporting ? 'Exporting...' : 'Export'}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showExportMenu && exportBtnRef.current && createPortal(
                  <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setShowExportMenu(false)} />
                    <div
                      className="fixed bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-[var(--shadow-3)] z-[9999] py-1 min-w-[160px] csv-pop"
                      style={{
                        top: exportBtnRef.current.getBoundingClientRect().bottom + 6,
                        right: window.innerWidth - exportBtnRef.current.getBoundingClientRect().right,
                      }}
                    >
                      <button type="button" onClick={handleExportHtml}
                        className="w-full text-left px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface2)] transition-colors">
                        Export as HTML
                      </button>
                      <button type="button" onClick={handleExportMd}
                        className="w-full text-left px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface2)] transition-colors">
                        Export as Markdown
                      </button>
                    </div>
                  </>,
                  document.body
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Session details */}
          <div className="flex items-center flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-[var(--text3)]">
            <span className="inline-flex items-center gap-1" title={session.projectPath}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              {session.projectPath}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              {messages.length} messages
            </span>
            {session.gitBranch && (
              <span className="inline-flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span className="text-[var(--accent)]">{session.gitBranch}</span>
              </span>
            )}
            {createdTime && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {createdTime}{modifiedTime && modifiedTime !== createdTime ? ` ~ ${modifiedTime}` : ''}
              </span>
            )}
            <span className="font-mono text-[var(--text3)] opacity-60">ID: {session.sessionId}</span>
            {session.source === 'opencode' && (
              <>
                {session.agent && (
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <span className="text-[var(--accent)]">{session.agent}</span>
                  </span>
                )}
                {session.model && (
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <span className="text-[var(--accent)] font-mono">{session.model}</span>
                  </span>
                )}
                {session.cost != null && session.cost > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-green-400">${session.cost.toFixed(4)}</span>
                  </span>
                )}
                {session.tokensInput != null && (
                  <span className="text-[var(--text3)] tabular-nums">
                    {formatTokens(session.tokensInput)} in / {session.tokensOutput != null ? formatTokens(session.tokensOutput) : '?'} out
                  </span>
                )}
              </>
            )}
          </div>

          {/* Search bar */}
          {showSearch && (
            <div className="mt-2 flex items-center gap-2">
              <div className="relative flex-1">
                <input autoFocus type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search messages... (Enter: next, Shift+Enter: prev)"
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text3)] focus:outline-none focus:border-[var(--accent)]" />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {searchText && (
                <>
                  <span className="text-xs text-[var(--text3)] whitespace-nowrap tabular-nums">
                    {matchedIds.length > 0 ? `${currentMatchIdx + 1} / ${matchedIds.length}` : '0 results'}
                  </span>
                  <button type="button" title="Previous match" onClick={() => jumpToMatch(currentMatchIdx - 1)} disabled={matchedIds.length === 0}
                    className="p-1 rounded hover:bg-[var(--surface2)] text-[var(--text2)] hover:text-[var(--text)] disabled:opacity-30">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button type="button" title="Next match" onClick={() => jumpToMatch(currentMatchIdx + 1)} disabled={matchedIds.length === 0}
                    className="p-1 rounded hover:bg-[var(--surface2)] text-[var(--text2)] hover:text-[var(--text)] disabled:opacity-30">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Content area */}
        {viewMode === 'raw' ? (
          <div className="flex-1 min-h-0"><RawJsonView filePath={session.fullPath} searchActive={showSearch} /></div>
        ) : viewMode === 'stats' ? (
          <div className="flex-1 overflow-y-auto"><SessionStats messages={messages} sessionFilePath={session.fullPath} onJumpToMessage={(msgId) => {
            // Ensure message is rendered, switch to chat, scroll to it
            const idx = messages.findIndex((m) => m.id === msgId)
            if (idx >= 0) setRenderCount((prev) => Math.max(prev, idx + 5))
            setViewMode('chat')
            requestAnimationFrame(() => {
              const el = document.querySelector(`[data-msg-id="${msgId}"]`)
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            })
          }} /></div>
        ) : viewMode === 'insights' ? (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 py-6">
              <InsightsPanel filePath={session.fullPath} />
            </div>
          </div>
        ) : viewMode === 'todos' && session.source === 'opencode' && session.dbPath ? (
          <div className="flex-1 overflow-y-auto">
            <TodoPanel dbPath={session.dbPath} sessionId={session.sessionId} />
          </div>
        ) : viewMode === 'timeline' && session.source === 'opencode' ? (
          <div className="flex-1 overflow-y-auto">
            <AgentTimeline messages={messages} />
          </div>
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-y-auto relative" onScroll={handleScroll}>
            <div className="max-w-4xl mx-auto px-6 py-6">
              {loading && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-3" />
                    <p className="text-[var(--text2)] text-sm">Parsing session...</p>
                  </div>
                </div>
              )}
              {error && (
                <div className="bg-[var(--error-soft)] border border-[var(--error)]/30 rounded-lg p-4 text-[var(--error)] text-sm">{error}</div>
              )}
              {!loading && !error && messages.length === 0 && (
                <div className="text-center py-20 text-[var(--text2)]">No messages in this session</div>
              )}
              {!loading && searchText && matchedIds.length === 0 && messages.length > 0 && (
                <div className="text-center py-4 text-[var(--text2)] text-sm">No messages match "{searchText}"</div>
              )}

              {(() => {
                const displayCount = replayMode ? replayPos + 1 : renderCount
                const visibleMessages = messages.slice(0, displayCount)
                return visibleMessages.map((msg, idx) => {
                  const isMatch = searchText && matchedIdSet.has(msg.id)
                  const isCurrent = msg.id === currentMatchId
                  const isReplayLatest = replayMode && idx === visibleMessages.length - 1
                  return (
                    <div key={msg.id} data-msg-id={msg.id}
                      ref={isReplayLatest ? (el) => { el?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } : undefined}
                      className={`transition-all duration-300 ${
                        isReplayLatest ? 'ring-2 ring-[var(--green)] rounded-2xl' :
                        isCurrent ? 'ring-2 ring-[var(--accent)] rounded-2xl' :
                        isMatch ? 'ring-1 ring-[var(--accent-ring)] rounded-2xl' : ''
                      } ${replayMode && idx > replayPos ? 'hidden' : ''}`}>
                      <ErrorBoundary context={`Message ${msg.id?.slice(0, 8)}`}>
                        {msg.role === 'user'
                        ? <UserMessage message={msg} />
                        : <AssistantMessage message={msg} onViewSubagent={(desc) => { setSubagentDescription(desc); setShowSubagents(true) }} />}
                      </ErrorBoundary>
                    </div>
                  )
                })
              })()}

              {!replayMode && renderCount < messages.length && (
                <div className="text-center py-6">
                  <button type="button"
                    onClick={() => setRenderCount((prev) => Math.min(prev + BATCH_SIZE * 2, messages.length))}
                    className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
                    Load more ({messages.length - renderCount} remaining)
                  </button>
                  <div className="text-[10px] text-[var(--text3)] mt-1">Scroll down to auto-load</div>
                </div>
              )}

              {/* Replay bottom padding */}
              {replayMode && <div className="h-24" />}
            </div>

            {/* Scroll buttons */}
            {showScrollTop && (
              <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-30">
                <button type="button" title="Scroll to top" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface2)] text-[var(--text)] flex items-center justify-center shadow-[var(--shadow-3)] transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>
                <button type="button" title="Scroll to bottom" onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
                  className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface2)] text-[var(--text)] flex items-center justify-center shadow-[var(--shadow-3)] transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subagent panel */}
      {showSubagents && session && (
        <SubagentPanel
          sessionFilePath={session.fullPath}
          agentDescription={subagentDescription}
          onClose={() => setShowSubagents(false)}
        />
      )}

      {/* Replay controls */}
      {replayMode && messages.length > 0 && (
        <ReplayControls
          totalMessages={messages.length}
          messageRoles={messages.map((m) => m.role)}
          onPositionChange={setReplayPos}
          onExit={() => setReplayMode(false)}
        />
      )}
      {/* Shortcuts help */}
      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
    </CollapseContext.Provider>
  )
}
