import { useState, useMemo, useEffect } from 'react'
import type { ProjectGroup, SessionEntry } from '../../types/session'
import type { SessionSource } from '../../../shared/constants'
import { SearchBar } from './SearchBar'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useLocale } from '../../hooks/useLocale'
import { useSettings } from '../../hooks/useSettings'

interface Props {
  groups: ProjectGroup[]
  loading: boolean
  selectedSessionId: string | null
  onSelectSession: (session: SessionEntry) => void
  onRefresh: () => void
  onDeleteSession: (session: SessionEntry) => void
  batchMode?: boolean
  batchSelected?: Set<string>
  onBatchToggle?: (id: string) => void
  onToggleBatchMode?: () => void
  onBatchDelete?: () => void
  onOpenDashboard?: () => void
  onOpenCrossSearch?: () => void
  onOpenSettings?: () => void
  onOpenCompare?: () => void
  /** Data source tabs support */
  source?: SessionSource
  onSourceChange?: (source: SessionSource) => void
  openCodeCount?: number
  claudeCount?: number
}

export function Sidebar({
  groups,
  loading,
  selectedSessionId,
  onSelectSession,
  onRefresh,
  onDeleteSession,
  batchMode,
  batchSelected,
  onBatchToggle,
  onToggleBatchMode,
  onBatchDelete,
  onOpenDashboard,
  onOpenCrossSearch,
  onOpenSettings,
  onOpenCompare,
  source,
  onSourceChange,
  openCodeCount,
  claudeCount
}: Props) {
  const [search, setSearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const { t } = useLocale()
  const { settings } = useSettings()

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups

    const q = search.toLowerCase()
    return groups
      .map((g) => ({
        ...g,
        sessions: g.sessions.filter(
          (s) =>
            s.customTitle.toLowerCase().includes(q) ||
            s.firstPrompt.toLowerCase().includes(q) ||
            s.summary.toLowerCase().includes(q) ||
            s.sessionId.toLowerCase().includes(q)
        )
      }))
      .filter((g) => g.sessions.length > 0)
  }, [groups, search])

  const toggleGroup = (encodedName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(encodedName)) {
        next.delete(encodedName)
      } else {
        next.add(encodedName)
      }
      return next
    })
  }

  // Auto-expand first group only on initial load
  useEffect(() => {
    if (filteredGroups.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set([filteredGroups[0].encodedName]))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const totalSessions = groups.reduce((sum, g) => sum + g.sessions.length, 0)

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)', borderRight: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {source === 'opencode' ? t('sidebar.title.opencode') : t('sidebar.title.claude')}
          </h1>
          <span className="text-xs" style={{ color: 'var(--text2)' }}>{t('sidebar.sessionsCount', { count: totalSessions })}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {onOpenDashboard && (
            <button onClick={onOpenDashboard} className="p-1.5 rounded-md hover:bg-[var(--surface)] text-[var(--text2)] hover:text-[var(--text)] transition-colors" title={t('sidebar.dashboardTooltip')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </button>
          )}
          {onOpenCrossSearch && (
            <button onClick={onOpenCrossSearch} className="p-1.5 rounded-md hover:bg-[var(--surface)] text-[var(--text2)] hover:text-[var(--text)] transition-colors" title={t('sidebar.crossSearchTooltip')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
          )}
          {onOpenCompare && (
            <button onClick={onOpenCompare} className="p-1.5 rounded-md hover:bg-[var(--surface)] text-[var(--text2)] hover:text-[var(--text)] transition-colors" title={t('sidebar.compareTooltip')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
            </button>
          )}
          {onOpenSettings && (
            <button onClick={onOpenSettings} className="p-1.5 rounded-md hover:bg-[var(--surface)] text-[var(--text2)] hover:text-[var(--text)] transition-colors" title={t('sidebar.settingsTooltip')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          )}
          <button onClick={onRefresh} className="p-1.5 rounded-md hover:bg-[var(--surface)] text-[var(--text2)] hover:text-[var(--text)] transition-colors" title={t('sidebar.refreshTooltip')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      {/* Source tabs */}
      {onSourceChange && (
        <div className="flex px-4 py-2 gap-1" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => onSourceChange('claude')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              source === 'claude'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-1)]'
                : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
            }`}
          >
            Claude{` (${claudeCount})`}
          </button>
          <button
            type="button"
            onClick={() => onSourceChange('opencode')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              source === 'opencode'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-1)]'
                : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
            }`}
          >
            OpenCode{` (${openCodeCount})`}
          </button>
        </div>
      )}

      {/* Batch mode toolbar */}
      {batchMode && (
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <span className="text-xs" style={{ color: 'var(--text2)' }}>{t('sidebar.batchSelected', { count: batchSelected?.size ?? 0 })}</span>
          <div className="ml-auto flex gap-1">
            <button type="button" onClick={onBatchDelete} disabled={!batchSelected?.size}
              className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-30 transition-colors">
              {t('sidebar.batchDelete')}
            </button>
            <button type="button" onClick={onToggleBatchMode}
              className="px-2 py-1 text-xs rounded transition-colors" style={{ color: 'var(--text2)' }}>
              {t('sidebar.batchCancel')}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 px-3 pt-3 pb-2">
        <div className="flex-1"><SearchBar value={search} onChange={setSearch} placeholder={t('search.defaultPlaceholder')} /></div>
        {onToggleBatchMode && !batchMode && (
          <button type="button" onClick={onToggleBatchMode}
            className="p-1.5 rounded-md text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors flex-shrink-0"
            title={t('sidebar.batchSelectTooltip')}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </button>
        )}
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="px-4 py-8 text-center text-[var(--text3)] text-sm">{t('sidebar.loading')}</div>
        )}

        {!loading && filteredGroups.length === 0 && (
          <div className="px-4 py-8 text-center text-[var(--text3)] text-sm">
            {search
              ? t('sidebar.noMatchingSessions')
              : source === 'opencode'
                ? t('sidebar.noOpenCodeSessions')
                : t('sidebar.noSessions')}
          </div>
        )}

        {filteredGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.encodedName)
          const displayPath = group.projectPath
          const pathParts = displayPath.replace(/\\/g, '/').split('/')
          const shortPath =
            pathParts.length > 2
              ? '.../' + pathParts.slice(-2).join('/')
              : displayPath

          return (
            <div key={group.encodedName} className="border-b" style={{ borderColor: 'var(--border-soft)' }}>
              <button
                onClick={() => toggleGroup(group.encodedName)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface)] transition-colors text-left"
              >
                <svg
                  className="w-3 h-3 text-[var(--text3)] transition-transform duration-200 flex-shrink-0"
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
                <svg className="w-3.5 h-3.5 text-[var(--text3)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="text-xs font-medium text-[var(--text)] truncate" title={displayPath}>
                  {shortPath}
                </span>
                <span className="text-[10px] text-[var(--text3)] flex-shrink-0 ml-auto px-1.5 py-0.5 rounded bg-[var(--surface)] tabular-nums">
                  {group.sessions.length}
                </span>
              </button>

              {isExpanded && (
                <div className="pb-1">
                  {groupSessionsByDate(group.sessions).map((dateGroup) => (
                    <div key={dateGroup.label}>
                      <div className="px-4 pl-8 py-1 text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wider">
                        {dateGroup.label}
                      </div>
                      {dateGroup.sessions.map((session) => (
                        <SessionItem
                          key={session.sessionId}
                          session={session}
                          isSelected={session.sessionId === selectedSessionId}
                          onClick={() => batchMode ? onBatchToggle?.(session.sessionId) : onSelectSession(session)}
                          onDelete={() => onDeleteSession(session)}
                          batchMode={batchMode}
                          batchChecked={batchSelected?.has(session.sessionId)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function groupSessionsByDate(sessions: SessionEntry[]): { label: string; sessions: SessionEntry[] }[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: Record<string, SessionEntry[]> = {}
  const order = [t('sidebar.dateGroups.today'), t('sidebar.dateGroups.yesterday'), t('sidebar.dateGroups.thisWeek'), t('sidebar.dateGroups.earlier')]

  for (const s of sessions) {
    const d = new Date(s.modified)
    let label: string
    if (d >= today) label = t('sidebar.dateGroups.today')
    else if (d >= yesterday) label = t('sidebar.dateGroups.yesterday')
    else if (d >= weekAgo) label = t('sidebar.dateGroups.thisWeek')
    else label = t('sidebar.dateGroups.earlier')

    if (!groups[label]) groups[label] = []
    groups[label].push(s)
  }

  return order.filter((l) => groups[l]?.length).map((label) => ({ label, sessions: groups[label] }))
}

function fmtSize(bytes: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}

function cleanPrompt(prompt: string): string {
  if (!prompt || prompt === 'No prompt') return ''
  // Remove IDE tags like <ide_opened_file>...</ide_opened_file>, <ide_selection>...</ide_selection>
  let cleaned = prompt.replace(/<[^>]+>[^<]*<\/[^>]+>/g, '').trim()
  // Remove standalone tags like <command-name>...</command-name>
  cleaned = cleaned.replace(/<[^>]+>/g, '').trim()
  return cleaned || ''
}

function SessionItem({
  session,
  isSelected,
  onClick,
  onDelete,
  batchMode,
  batchChecked
}: {
  session: SessionEntry
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
  batchMode?: boolean
  batchChecked?: boolean
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const rawTitle = session.customTitle || session.summary || cleanPrompt(session.firstPrompt) || session.sessionId.slice(0, 8)
  const displayTitle = rawTitle.length > 60 ? rawTitle.slice(0, 60) + '...' : rawTitle

  let timeAgo = ''
  try {
    timeAgo = formatDistanceToNow(new Date(session.modified), {
      addSuffix: true,
      locale: settings.locale === 'zh' ? zhCN : undefined
    })
  } catch {
    timeAgo = ''
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); setShowMenu(true) }}
        className={`group w-full text-left pl-8 pr-3 py-2 transition-all duration-150 relative ${
          isSelected
            ? 'bg-[var(--accent-soft)]'
            : 'hover:bg-[var(--surface)]'
        }`}
      >
        {isSelected && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-[var(--accent)]" />
        )}
        <div className="flex items-center gap-2">
        {batchMode && (
          <span className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center transition-colors ${batchChecked ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border)]'}`}>
            {batchChecked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
          </span>
        )}
        {renaming ? (
          <input
            autoFocus
            type="text"
            placeholder={t('sidebar.renamePlaceholder')}
            aria-label={t('sidebar.renamePlaceholder')}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && renameValue.trim()) {
                await window.api.renameSession({ filePath: session.fullPath, sessionId: session.sessionId, newTitle: renameValue.trim() })
                session.customTitle = renameValue.trim()
                setRenaming(false)
              }
              if (e.key === 'Escape') setRenaming(false)
            }}
            onBlur={() => setRenaming(false)}
            onClick={(e) => e.stopPropagation()}
            className="text-sm leading-5 w-full bg-[var(--bg)] border border-[var(--accent)] rounded px-1 py-0 text-[var(--text)] focus:outline-none"
          />
        ) : (
          <span className={`text-sm truncate leading-5 ${isSelected ? 'text-[var(--text)] font-medium' : 'text-[var(--text)]'}`} title={rawTitle}>{displayTitle}</span>
        )}
      </div>
        <div className="flex items-center gap-2 mt-0.5">
          {session.source === 'opencode' && session.model ? (
            <span className="text-[10px] text-[var(--accent)] truncate max-w-[80px] font-mono">{session.model}</span>
          ) : (
            <span className="text-[10px] text-[var(--text3)] tabular-nums">{fmtSize(session.fileSize)}</span>
          )}
          {session.source === 'opencode' && session.cost != null && session.cost > 0 && (
            <span className="text-[10px] text-[var(--text3)] tabular-nums">${session.cost.toFixed(2)}</span>
          )}
          {session.gitBranch && (
            <span className="text-[10px] text-[var(--accent)] truncate max-w-[80px] font-mono">{session.gitBranch}</span>
          )}
          <span className="text-[10px] text-[var(--text3)] ml-auto tabular-nums">{timeAgo}</span>
        </div>
      </button>

      {/* Context menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
          <div className="absolute right-2 top-1 z-40 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-[var(--shadow-3)] py-1 min-w-[160px] csv-pop">
            <button type="button"
              onClick={() => { setShowMenu(false); setRenameValue(rawTitle); setRenaming(true) }}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface2)] transition-colors">
              {t('sidebar.rename')}
            </button>
            <button type="button"
              onClick={() => { setShowMenu(false); window.api.openInClaude({ sessionId: session.sessionId, projectPath: session.projectPath }) }}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--accent)] hover:bg-[var(--surface2)] transition-colors">
              {t('sidebar.openInClaude')}
            </button>
            {session.source === 'opencode' ? (
              <>
                <div className="border-t border-[var(--border)] my-1" />
                <button type="button"
                  onClick={() => { setShowMenu(false); onDelete() }}
                  className="w-full text-left px-3 py-1.5 text-xs text-[var(--error)] hover:bg-[var(--error-soft)] transition-colors">
                  {t('sidebar.deleteSession')}
                </button>
              </>
            ) : (
              <>
                <div className="border-t border-[var(--border)] my-1" />
                <button type="button"
                  onClick={() => { setShowMenu(false); window.api.showInFolder(session.fullPath) }}
                  className="w-full text-left px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface2)] transition-colors">
                  {t('sidebar.openFileLocation')}
                </button>
                <button type="button"
                  onClick={() => { setShowMenu(false); if (session.projectPath) window.api.openFolder(session.projectPath) }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--surface2)] transition-colors ${session.projectPath ? 'text-[var(--text)]' : 'text-[var(--text3)] cursor-not-allowed'}`}
                  disabled={!session.projectPath}
                  title={session.projectPath || t('sidebar.projectPathUnknown')}>
                  {t('sidebar.openProjectLocation')}
                </button>
                <button type="button"
                  onClick={() => { setShowMenu(false); onDelete() }}
                  className="w-full text-left px-3 py-1.5 text-xs text-[var(--error)] hover:bg-[var(--error-soft)] transition-colors">
                  {t('sidebar.deleteSession')}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
