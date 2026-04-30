import { useState, useRef } from 'react'
import type { SessionEntry } from '../types/session'

interface SearchResult {
  sessionId: string
  projectPath: string
  fullPath: string
  customTitle: string
  firstPrompt: string
  timestamp: string
  matchType: 'user' | 'assistant' | 'tool'
  preview: string
}

interface Props {
  onClose: () => void
  onOpenSession: (session: Partial<SessionEntry> & { sessionId: string; fullPath: string }, timestamp?: string) => void
}

const MATCH_COLORS = {
  user: 'bg-blue-900/30 text-blue-300',
  assistant: 'bg-purple-900/30 text-purple-300',
  tool: 'bg-green-900/30 text-green-300'
}

export function CrossSearch({ onClose, onOpenSession }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = (q: string) => {
    if (!q.trim()) {
      setResults([])
      setSearched(false)
      setExpandedSessions(new Set())
      return
    }
    setLoading(true)
    setSearched(true)
    setExpandedSessions(new Set())
    window.api.crossSearch(q).then((data: SearchResult[]) => {
      setResults(data)
      setLoading(false)
    })
  }

  const handleInput = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 500)
  }

  // Group results by session
  const grouped = new Map<string, { session: SearchResult; matches: SearchResult[] }>()
  for (const r of results) {
    if (!grouped.has(r.sessionId)) {
      grouped.set(r.sessionId, { session: r, matches: [] })
    }
    grouped.get(r.sessionId)!.matches.push(r)
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg)] flex flex-col app-shell">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#30363d] px-6 py-3 flex items-center gap-4">
        <h1 className="text-sm font-semibold text-[#e6edf3] flex-shrink-0">Cross-Session Search</h1>
        <div className="relative flex-1 max-w-xl">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search across all sessions..."
            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-sm text-[#e6edf3] placeholder-gray-500 focus:outline-none focus:border-[#58a6ff]"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {searched && !loading && (
          <span className="text-xs text-gray-500 flex-shrink-0">
            {results.length} matches in {grouped.size} sessions
          </span>
        )}
        <button type="button" onClick={onClose}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-[#161b22] transition-colors flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-6 h-6 border-2 border-[#58a6ff] border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-20 text-gray-500">No results for "{query}"</div>
        )}

        {!loading && !searched && (
          <div className="text-center py-20 text-gray-500 text-sm">
            Type to search across all session conversations
          </div>
        )}

        <div className="max-w-4xl mx-auto px-6 py-4 space-y-3">
          {[...grouped.entries()].map(([sessionId, { session, matches }]) => (
            <div key={sessionId} className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
              {/* Session header */}
              <button type="button"
                onClick={() => onOpenSession({
                  sessionId: session.sessionId,
                  fullPath: session.fullPath,
                  customTitle: session.customTitle,
                  firstPrompt: session.firstPrompt,
                  projectPath: session.projectPath,
                  summary: '',
                  messageCount: 0,
                  created: '',
                  modified: '',
                  gitBranch: '',
                  isSidechain: false
                })}
                className="w-full text-left px-4 py-2.5 hover:bg-[#1c2333] transition-colors border-b border-[#30363d]">
                <div className="text-sm text-[#e6edf3]">
                  {session.customTitle || session.firstPrompt || sessionId.slice(0, 8)}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                  <span>{session.projectPath}</span>
                  <span>{matches.length} matches</span>
                </div>
              </button>

              {/* Matches */}
              <div className="divide-y divide-[#30363d]/50">
                {(expandedSessions.has(sessionId) ? matches : matches.slice(0, 5)).map((m, i) => (
                  <button type="button" key={i}
                    onClick={() => onOpenSession({
                      sessionId: session.sessionId,
                      fullPath: session.fullPath,
                      customTitle: session.customTitle,
                      firstPrompt: session.firstPrompt,
                      projectPath: session.projectPath,
                      summary: '',
                      messageCount: 0,
                      created: '',
                      modified: '',
                      gitBranch: '',
                      isSidechain: false
                    }, m.timestamp)}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-[#1c2333] transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${MATCH_COLORS[m.matchType]}`}>
                        {m.matchType}
                      </span>
                      {m.timestamp && (
                        <span className="text-gray-600">{new Date(m.timestamp).toLocaleString()}</span>
                      )}
                    </div>
                    <div className="text-gray-400 break-words">{m.preview}</div>
                  </button>
                ))}
                {matches.length > 5 && !expandedSessions.has(sessionId) && (
                  <button type="button"
                    onClick={() => setExpandedSessions((prev) => new Set([...prev, sessionId]))}
                    className="w-full text-left px-4 py-1.5 text-[10px] text-[#58a6ff] hover:text-blue-300 hover:bg-[#1c2333] transition-colors">
                    +{matches.length - 5} more matches
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
