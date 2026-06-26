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

  // Resolve DB path on mount: custom path > auto-detect > not found
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // 1. Check user-saved custom path first
        const settings = await window.api.getSettings()
        const customPath: string | undefined = (settings as { openCodeDbPath?: string } | null)?.openCodeDbPath

        // 2. Determine which path to try: custom > auto-detect
        let resolvedPath: string | null = customPath || null
        if (!resolvedPath) {
          resolvedPath = await window.api.detectOpenCodeDb()
        }

        if (cancelled) return

        // 3. Verify the resolved path by trying to load sessions
        if (resolvedPath) {
          try {
            const result = await window.api.getOpenCodeSessions(resolvedPath)
            if (cancelled) return
            setDbPath(resolvedPath)
            setGroups(result)
            setDbNotFound(false)
          } catch {
            if (cancelled) return
            setDbPath(resolvedPath)
            setDbNotFound(true)
          }
        } else {
          setDbNotFound(true)
        }
      } catch (e) {
        console.debug('useOpenCodeSessionList: init failed', e)
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
