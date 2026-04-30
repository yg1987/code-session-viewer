import { useState, useEffect, useCallback, useRef } from 'react'
import type { ProjectGroup } from '../types/session'

export function useSessionList() {
  const [groups, setGroups] = useState<ProjectGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.getSessions()
      setGroups(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Auto-refresh when files change (debounced to avoid rapid fire)
  useEffect(() => {
    const cleanup = window.api.onSessionsChanged(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => refresh(), 2000)
    })
    return cleanup
  }, [refresh])

  return { groups, loading, error, refresh }
}
