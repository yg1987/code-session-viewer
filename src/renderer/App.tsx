import { useState, useCallback, useEffect, useMemo } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { TitleBar } from './components/layout/TitleBar'
import { ConversationView } from './components/conversation/ConversationView'
import { GlobalDashboard } from './components/GlobalDashboard'
import { CrossSearch } from './components/CrossSearch'
import { SettingsPanel } from './components/SettingsPanel'
import { SessionCompare } from './components/SessionCompare'
import { useSessionList } from './hooks/useSessionList'
import { useOpenCodeSessionList } from './hooks/useOpenCodeSessionList'
import { useCodexSessionList } from './hooks/useCodexSessionList'
import { useSessionMessages } from './hooks/useSessionMessages'
import { SettingsContext, useSettingsProvider } from './hooks/useSettings'
import type { SessionEntry } from './types/session'
import type { SessionSource } from '../shared/constants'
import type { ParsedMessage } from './types/message'
import { useLocale } from './hooks/useLocale'

/** Applies `html.lang` to document root whenever locale changes */
function LocaleEffect() {
  const { locale } = useLocale()
  useEffect(() => {
    document.documentElement.setAttribute('lang', locale)
  }, [locale])
  return null
}

export function App() {
  const settingsCtx = useSettingsProvider()
  const { t } = useLocale()

  // ── Source toggle ──
  const [source, setSource] = useState<SessionSource>('claude')

  // ── Claude Code pipeline ──
  const {
    groups: claudeGroups,
    loading: claudeLoading,
    refresh: claudeRefresh
  } = useSessionList()

  // ── OpenCode pipeline ──
  const {
    groups: openCodeGroups,
    loading: openCodeLoading,
    dbPath: openCodeDbPath,
    dbNotFound: openCodeDbNotFound,
    refresh: openCodeRefresh
  } = useOpenCodeSessionList()

  // ── Codex pipeline (NEW) ──
  const {
    groups: codexGroups,
    loading: codexLoading,
    codexHome,
    homeNotFound: codexHomeNotFound,
    refresh: codexRefresh
  } = useCodexSessionList()

  // Select active pipeline based on source
  const groups = source === 'claude' ? claudeGroups : source === 'opencode' ? openCodeGroups : codexGroups
  const listLoading = source === 'claude' ? claudeLoading : source === 'opencode' ? openCodeLoading : codexLoading

  const refresh = useCallback(() => {
    if (source === 'claude') claudeRefresh()
    else if (source === 'opencode') openCodeRefresh()
    else codexRefresh()
  }, [source, claudeRefresh, openCodeRefresh, codexRefresh])

  const { messages, loading: msgLoading, error, loadSession } = useSessionMessages()
  const [selectedSession, setSelectedSession] = useState<SessionEntry | null>(null)

  const [sidebarWidth, setSidebarWidth] = useState(300)
  const [isResizing, setIsResizing] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<SessionEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Overlays
  const [showDashboard, setShowDashboard] = useState(false)
  const [showCrossSearch, setShowCrossSearch] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCompare, setShowCompare] = useState(false)

  // Batch delete
  const [batchMode, setBatchMode] = useState(false)
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set())

  const allSessions = useMemo(() => groups.flatMap((g) => g.sessions), [groups])
  const claudeTotalSessions = useMemo(
    () => claudeGroups.reduce((sum, g) => sum + g.sessions.length, 0),
    [claudeGroups]
  )
  const openCodeTotalSessions = useMemo(
    () => openCodeGroups.reduce((sum, g) => sum + g.sessions.length, 0),
    [openCodeGroups]
  )
  const codexTotalSessions = useMemo(
    () => codexGroups.reduce((sum, g) => sum + g.sessions.length, 0),
    [codexGroups]
  )

  const [jumpToTimestamp, setJumpToTimestamp] = useState<string | null>(null)

  // ── OpenCode message state (separate from Claude pipeline) ──
  const [openCodeMessages, setOpenCodeMessages] = useState<ParsedMessage[]>([])
  const [openCodeMsgLoading, setOpenCodeMsgLoading] = useState(false)
  const [openCodeMsgError, setOpenCodeMsgError] = useState<string | null>(null)

  // ── Codex message state (separate from Claude/OpenCode pipeline) ──
  const [codexMessages, setCodexMessages] = useState<ParsedMessage[]>([])
  const [codexMsgLoading, setCodexMsgLoading] = useState(false)
  const [codexMsgError, setCodexMsgError] = useState<string | null>(null)

  const handleSelectSession2 = useCallback(
    async (
      session: SessionEntry | (Partial<SessionEntry> & { sessionId: string; fullPath: string }),
      timestamp?: string
    ) => {
      const s = session as SessionEntry
      setSelectedSession(s)
      setJumpToTimestamp(timestamp ?? null)
      setShowCrossSearch(false)

      // Route to correct pipeline
      if (s.source === 'opencode' && s.dbPath) {
        setOpenCodeMsgLoading(true)
        setOpenCodeMsgError(null)
        try {
          const result = await window.api.loadOpenCodeSession(s.dbPath, s.sessionId)
          setOpenCodeMessages(result)
        } catch (e) {
          setOpenCodeMsgError(e instanceof Error ? e.message : t('app.failedLoadOpenCode'))
          setOpenCodeMessages([])
        } finally {
          setOpenCodeMsgLoading(false)
        }
      } else if (s.source === 'codex') {
        setCodexMsgLoading(true)
        setCodexMsgError(null)
        try {
          const result = await window.api.loadCodexSession(s.fullPath)
          setCodexMessages(result)
        } catch (e) {
          setCodexMsgError(e instanceof Error ? e.message : t('app.failedLoadCodex'))
          setCodexMessages([])
        } finally {
          setCodexMsgLoading(false)
        }
      } else {
        loadSession(s.fullPath)
      }
    },
    [loadSession]
  )

  // Use the correct messages based on source
  const displayMessages = selectedSession?.source === 'opencode' ? openCodeMessages
    : selectedSession?.source === 'codex' ? codexMessages
    : messages
  const displayLoading = selectedSession?.source === 'opencode' ? openCodeMsgLoading
    : selectedSession?.source === 'codex' ? codexMsgLoading
    : msgLoading
  const displayError = selectedSession?.source === 'opencode' ? openCodeMsgError
    : selectedSession?.source === 'codex' ? codexMsgError
    : error

  const handleSourceChange = useCallback((newSource: SessionSource) => {
    setSource(newSource)
    setSelectedSession(null)
    setOpenCodeMessages([])
    setCodexMessages([])
    setBatchMode(false)
    setBatchSelected(new Set())
  }, [])

  const handleDeleteSession = useCallback(async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      if (deleteConfirm.source === 'opencode' && deleteConfirm.dbPath) {
        await window.api.deleteOpenCodeSession(deleteConfirm.dbPath, deleteConfirm.sessionId)
      } else if (deleteConfirm.source === 'codex') {
        await window.api.deleteCodexSession(deleteConfirm.fullPath)
      } else {
        await window.api.deleteSession({
          filePath: deleteConfirm.fullPath,
          sessionId: deleteConfirm.sessionId
        })
      }
      if (selectedSession?.sessionId === deleteConfirm.sessionId) setSelectedSession(null)
      refresh()
    } finally {
      setDeleting(false)
      setDeleteConfirm(null)
    }
  }, [deleteConfirm, selectedSession, refresh])

  const handleBatchDelete = useCallback(async () => {
    if (batchSelected.size === 0) return
    setDeleting(true)
    try {
      for (const sid of batchSelected) {
        const session = allSessions.find((s) => s.sessionId === sid)
        if (session) {
          if (session.source === 'opencode' && session.dbPath) {
            await window.api.deleteOpenCodeSession(session.dbPath, session.sessionId)
          } else if (session.source === 'codex') {
            await window.api.deleteCodexSession(session.fullPath)
          } else {
            await window.api.deleteSession({ filePath: session.fullPath, sessionId: session.sessionId })
          }
        }
      }
      if (selectedSession && batchSelected.has(selectedSession.sessionId)) setSelectedSession(null)
      setBatchSelected(new Set())
      setBatchMode(false)
      refresh()
    } finally {
      setDeleting(false)
    }
  }, [batchSelected, allSessions, selectedSession, refresh])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && allSessions.length > 0) {
        e.preventDefault()
        const idx = selectedSession ? allSessions.findIndex((s) => s.sessionId === selectedSession.sessionId) : -1
        const next = e.key === 'ArrowDown'
          ? (idx < allSessions.length - 1 ? idx + 1 : 0)
          : (idx > 0 ? idx - 1 : allSessions.length - 1)
        handleSelectSession2(allSessions[next])
      }
      // Ctrl+Shift+F: cross-session search
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        setShowCrossSearch(true)
      }
      // Ctrl+D: dashboard
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        setShowDashboard(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [allSessions, selectedSession, handleSelectSession2])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = sidebarWidth
    const onMouseMove = (e: MouseEvent) => setSidebarWidth(Math.max(220, Math.min(600, startWidth + e.clientX - startX)))
    const onMouseUp = () => { setIsResizing(false); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp) }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [sidebarWidth])

  return (
    <SettingsContext.Provider value={settingsCtx}>
      <LocaleEffect />
      <div className="h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <TitleBar />
        <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="flex-shrink-0 h-full overflow-hidden transition-all duration-200" style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}>
          <Sidebar
            groups={groups}
            loading={listLoading}
            selectedSessionId={selectedSession?.sessionId ?? null}
            onSelectSession={handleSelectSession2}
            onRefresh={refresh}
            onDeleteSession={(s) => setDeleteConfirm(s)}
            batchMode={batchMode}
            batchSelected={batchSelected}
            onBatchToggle={(id) => {
              setBatchSelected((prev) => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id); else next.add(id)
                return next
              })
            }}
            onToggleBatchMode={() => { setBatchMode(!batchMode); setBatchSelected(new Set()) }}
            onBatchDelete={handleBatchDelete}
            onOpenDashboard={() => setShowDashboard(true)}
            onOpenCrossSearch={() => setShowCrossSearch(true)}
            onOpenSettings={() => setShowSettings(true)}
            onOpenCompare={() => setShowCompare(true)}
            source={source}
            onSourceChange={handleSourceChange}
            claudeCount={claudeTotalSessions}
            openCodeCount={openCodeTotalSessions}
            codexCount={codexTotalSessions}
          />
        </div>

        {/* Sidebar toggle + resize */}
        <div className="flex-shrink-0 flex h-full">
          <button type="button" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-5 flex items-center justify-center text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
            title={sidebarCollapsed ? t('conversation.sidebarShow') : t('conversation.sidebarHide')}>
            <svg className="w-3 h-3 transition-transform" style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : '' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {!sidebarCollapsed && (
            <div className={`w-1 cursor-col-resize hover:bg-[var(--accent)]/30 transition-colors ${isResizing ? 'bg-[var(--accent)]/50' : ''}`}
              onMouseDown={handleMouseDown} />
          )}
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0 h-full">
          <ConversationView
            messages={displayMessages}
            loading={displayLoading}
            error={displayError}
            session={selectedSession}
            jumpToTimestamp={jumpToTimestamp}
            onJumpDone={() => setJumpToTimestamp(null)}
          />
        </div>
        </div>

        {/* Overlays */}
        {showDashboard && <GlobalDashboard onClose={() => setShowDashboard(false)} source={source} openCodeDbPath={openCodeDbPath} />}
        {showCrossSearch && <CrossSearch onClose={() => setShowCrossSearch(false)} onOpenSession={(session, timestamp) => handleSelectSession2(session, timestamp)} source={source} openCodeDbPath={openCodeDbPath} />}
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} openCodeDbPath={openCodeDbPath} openCodeDbNotFound={openCodeDbNotFound} codexHomePath={codexHome} codexHomeNotFound={codexHomeNotFound} />}
        {showCompare && <SessionCompare groups={groups} initialSession={selectedSession} onClose={() => setShowCompare(false)} />}

        {/* Delete confirmation */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 csv-overlay" onClick={() => !deleting && setDeleteConfirm(null)} />
            <div className="relative csv-pop bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-4)] p-6 max-w-md mx-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--error-soft)' }}>
                  <svg className="w-5 h-5 text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-[var(--text)]">{t('app.deleteSession')}</h3>
                  <p className="text-xs text-[var(--text2)] mt-0.5">{t('app.deleteCannotUndo')}</p>
                </div>
              </div>
              <div className="bg-[var(--bg)] rounded-lg p-3 mb-3 border border-[var(--border)]">
                <div className="text-sm text-[var(--text)] truncate">
                  {deleteConfirm.customTitle || deleteConfirm.summary || deleteConfirm.firstPrompt || deleteConfirm.sessionId}
                </div>
                <div className="text-xs text-[var(--text3)] mt-1 font-mono">{deleteConfirm.sessionId}</div>
              </div>
              <p className="text-xs text-[var(--text3)] mb-4">
                {t('app.deletePermanently')}
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDeleteConfirm(null)} disabled={deleting}
                  className="px-4 py-2 text-sm text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)] rounded-lg transition-colors disabled:opacity-50">
                  {t('app.cancel')}
                </button>
                <button type="button" onClick={handleDeleteSession} disabled={deleting}
                  className="px-4 py-2 text-sm bg-[var(--error)] hover:opacity-90 text-white rounded-lg transition-all disabled:opacity-50 inline-flex items-center gap-2">
                  {deleting && <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />}
                  {deleting ? t('app.deleting') : t('app.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsContext.Provider>
  )
}
