import { useState, useEffect, useCallback } from 'react'
import type { ProjectGroup, SessionEntry } from '../types/session'

/**
 * Hook for loading OpenCode session list.
 * Mirrors the structure of useSessionList but talks to the OpenCode SQLite pipeline.
 */
export function useOpenCodeSessionList() {
  const [groups, setGroups] = useState<ProjectGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dbPath, setDbPath] = useState<string | null>(null)
  const [dbNotFound, setDbNotFound] = useState(false)

  const refresh = useCallback(async (overridePath?: string) => {
    const targetPath = overridePath || dbPath
    if (!targetPath) return

    setLoading(true)
    setError(null)
    try {
      const result = await window.api.getOpenCodeSessions(targetPath)
      setGroups(result)
      setDbNotFound(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load OpenCode sessions')
    } finally {
      setLoading(false)
    }
  }, [dbPath])

  // Auto-detect DB path on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const detected = await window.api.detectOpenCodeDb()
        if (cancelled) return

        // Verify the detected path actually exists by trying to load sessions
        if (detected) {
          try {
            const result = await window.api.getOpenCodeSessions(detected)
            if (cancelled) return
            setDbPath(detected)
            setGroups(result)
            setDbNotFound(false)
          } catch {
            if (cancelled) return
            setDbPath(detected)
            setDbNotFound(true)
          }
        } else {
          setDbNotFound(true)
        }
      } catch {
        if (!cancelled) setDbNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Reload on refresh or when dbPath changes
  const reload = useCallback(async () => {
    await refresh()
  }, [refresh])

  return { groups, loading, error, dbPath, dbNotFound, refresh: reload }
}
