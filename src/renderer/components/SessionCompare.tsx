import { useState, useEffect } from 'react'
import type { ParsedMessage } from '../types/message'
import type { SessionEntry, ProjectGroup } from '../types/session'
import { UserMessage } from './conversation/UserMessage'
import { AssistantMessage } from './conversation/AssistantMessage'
import { ErrorBoundary } from './common/ErrorBoundary'
import { useLocale } from '../hooks/useLocale'

interface Props {
  groups: ProjectGroup[]
  initialSession?: SessionEntry | null
  onClose: () => void
}

export function SessionCompare({ groups, initialSession, onClose }: Props) {
  const { t } = useLocale()
  const allSessions = groups.flatMap((g) => g.sessions)

  const [leftId, setLeftId] = useState(initialSession?.sessionId || '')
  const [rightId, setRightId] = useState('')
  const [leftMsgs, setLeftMsgs] = useState<ParsedMessage[]>([])
  const [rightMsgs, setRightMsgs] = useState<ParsedMessage[]>([])
  const [loadingL, setLoadingL] = useState(false)
  const [loadingR, setLoadingR] = useState(false)

  const loadSession = async (sessionId: string, side: 'left' | 'right') => {
    const session = allSessions.find((s) => s.sessionId === sessionId)
    if (!session) return
    const setLoading = side === 'left' ? setLoadingL : setLoadingR
    const setMsgs = side === 'left' ? setLeftMsgs : setRightMsgs
    setLoading(true)
    try {
      const msgs = await window.api.loadSession(session.fullPath)
      setMsgs(msgs)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (leftId) loadSession(leftId, 'left') }, [leftId])
  useEffect(() => { if (rightId) loadSession(rightId, 'right') }, [rightId])

  const getTitle = (id: string) => {
    const s = allSessions.find((s) => s.sessionId === id)
    return s ? (s.customTitle || s.summary || s.firstPrompt || id.slice(0, 8)) : ''
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-[var(--text)]">{t('compare.title')}</h1>
        <button type="button" onClick={onClose}
          className="p-1.5 rounded-md text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Session selectors */}
      <div className="flex-shrink-0 grid grid-cols-2 gap-0 border-b border-[var(--border)]">
        <SessionSelector label={t('compare.left')} value={leftId} onChange={setLeftId}
          sessions={allSessions} getTitle={getTitle} t={t} />
        <SessionSelector label={t('compare.right')} value={rightId} onChange={setRightId}
          sessions={allSessions} getTitle={getTitle} t={t} />
      </div>

      {/* Side by side messages */}
      <div className="flex-1 grid grid-cols-2 gap-0 min-h-0">
        <MessagePane messages={leftMsgs} loading={loadingL} placeholder={!leftId} t={t} />
        <MessagePane messages={rightMsgs} loading={loadingR} placeholder={!rightId} t={t} />
      </div>
    </div>
  )
}

function SessionSelector({ label, value, onChange, sessions, getTitle, t }: {
  label: string
  value: string
  onChange: (id: string) => void
  sessions: SessionEntry[]
  getTitle: (id: string) => string
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = search
    ? sessions.filter((s) => {
        const q = search.toLowerCase()
        return (s.customTitle || '').toLowerCase().includes(q) ||
               (s.summary || '').toLowerCase().includes(q) ||
               (s.firstPrompt || '').toLowerCase().includes(q) ||
               s.sessionId.includes(q)
      })
    : sessions.slice(0, 50)

  return (
    <div className={`px-3 py-2 ${label === 'Left' ? 'border-r border-[var(--border)]' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-[var(--text2)] uppercase">{label}</span>
        <div className="relative flex-1">
          <button type="button" onClick={() => setOpen(!open)}
            className="w-full text-left px-2 py-1 text-xs bg-[var(--bg)] border border-[var(--border)] rounded truncate text-[var(--text)]">
            {value ? getTitle(value) : t('compare.selectSession')}
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute left-0 top-full mt-1 w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl z-20 max-h-60 flex flex-col">
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('compare.searchPlaceholder')} autoFocus
                  className="w-full px-2 py-1.5 text-xs bg-transparent border-b border-[var(--border)] text-[var(--text)] placeholder-[var(--text2)] focus:outline-none" />
                <div className="overflow-y-auto">
                  {filtered.map((s) => (
                    <button key={s.sessionId} type="button"
                      onClick={() => { onChange(s.sessionId); setOpen(false); setSearch('') }}
                      className={`w-full text-left px-2 py-1.5 text-xs hover:bg-[var(--surface2)] transition-colors truncate ${s.sessionId === value ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
                      {s.customTitle || s.summary || s.firstPrompt || s.sessionId.slice(0, 8)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MessagePane({ messages, loading, placeholder, t }: {
  messages: ParsedMessage[]
  loading: boolean
  placeholder: boolean
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  if (placeholder) {
    return (
      <div className="flex items-center justify-center text-[var(--text2)] text-sm border-r border-[var(--border)]">
        {t('compare.selectSessionPrompt')}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center border-r border-[var(--border)]">
        <div className="animate-spin w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="overflow-y-auto border-r border-[var(--border)] px-3 py-3">
      {messages.length === 0 && (
        <div className="text-center py-8 text-[var(--text2)] text-xs">{t('compare.noMessages')}</div>
      )}
      {messages.map((msg) => (
        <ErrorBoundary key={msg.id} context={`Compare ${msg.id?.slice(0, 8)}`}>
          {msg.role === 'user' ? <UserMessage message={msg} /> : <AssistantMessage message={msg} />}
        </ErrorBoundary>
      ))}
    </div>
  )
}
