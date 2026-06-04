/**
 * TodoPanel — displays a list of todos for the current OpenCode session.
 *
 * OpenCode stores todos in a `todo` table:
 *   id, session_id, description, status (pending / in_progress / completed),
 *   time_created, time_updated
 */

import { useState, useEffect, useMemo } from 'react'
import { useLocale } from '../../hooks/useLocale'

export interface OpenCodeTodo {
  id: string
  sessionId: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  created: string
  updated: string
}

interface Props {
  dbPath: string
  sessionId: string
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    dot: 'bg-yellow-500',
    bg: 'bg-yellow-900/20',
    border: 'border-yellow-700/40',
    text: 'text-yellow-300'
  },
  in_progress: {
    label: 'In Progress',
    dot: 'bg-blue-500',
    bg: 'bg-blue-900/20',
    border: 'border-blue-700/40',
    text: 'text-blue-300'
  },
  completed: {
    label: 'Completed',
    dot: 'bg-green-500',
    bg: 'bg-green-900/15',
    border: 'border-green-700/30',
    text: 'text-green-300'
  }
}

export function TodoPanel({ dbPath, sessionId }: Props) {
  const [todos, setTodos] = useState<OpenCodeTodo[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useLocale()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    window.api.getOpenCodeTodos(dbPath, sessionId).then((data) => {
      if (!cancelled) setTodos(data)
    }).catch(() => {
      if (!cancelled) setTodos([])
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [dbPath, sessionId])

  const grouped = useMemo(() => {
    const groups: { label: string; todos: OpenCodeTodo[] }[] = [
      { label: t('todos.inProgress'), todos: [] },
      { label: t('todos.pending'), todos: [] },
      { label: t('todos.completed'), todos: [] }
    ]
    for (const t of todos) {
      if (t.status === 'in_progress') groups[0].todos.push(t)
      else if (t.status === 'pending') groups[1].todos.push(t)
      else if (t.status === 'completed') groups[2].todos.push(t)
    }
    return groups.filter((g) => g.todos.length > 0)
  }, [todos])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (todos.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8 text-center">
          <svg className="w-8 h-8 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-sm text-gray-500">{t('todos.noTodos')}</p>
          <p className="text-xs text-gray-600 mt-1">{t('todos.emptyHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#30363d] flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className="text-sm font-medium text-gray-300">
            {t('todos.title')} <span className="text-gray-500 font-normal">({todos.length})</span>
          </span>
        </div>

        {/* Groups */}
        <div className="divide-y divide-[#30363d]/50">
          {grouped.map((group) => (
            <div key={group.label}>
              <div className="px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-[#0d1117]/50">
                {group.label} ({group.todos.length})
              </div>
              {group.todos.map((todo) => {
                const cfg = STATUS_CONFIG[todo.status]
                return (
                  <div key={todo.id} className="px-4 py-3 hover:bg-[#1c2333] transition-colors">
                    <div className="flex items-start gap-3">
                      {/* Status dot */}
                      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                          {todo.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                            {cfg.label}
                          </span>
                          {todo.updated && (
                            <span className="text-[10px] text-gray-600">
                              {new Date(todo.updated).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
