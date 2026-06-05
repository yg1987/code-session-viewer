import { useState, useEffect, useCallback } from 'react'
import type { ProjectGroup, SessionEntry } from '../types/session'

/**
 * Hook for loading Codex session list.
 * Mirrors the structure of useOpenCodeSessionList but talks to the Codex JSONL pipeline.
 */
export function useCodexSessionList() {
  const [groups, setGroups] = useState<ProjectGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [codexHome, setCodexHome] = useState<string | null>(null)
  const [homeNotFound, setHomeNotFound] = useState(false)

  const refresh = useCallback(async (overridePath?: string) => {
    const targetPath = overridePath || codexHome
    if (!targetPath) return

    setLoading(true)
    setError(null)
    try {
      const result = await window.api.getCodexSessions(targetPath)
      setGroups(result)
      setHomeNotFound(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Codex sessions')
    } finally {
      setLoading(false)
    }
  }, [codexHome])

  // Auto-detect Codex home on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const detected = await window.api.detectCodexHome()
        if (cancelled) return

        // Verify the detected path actually exists by trying to load sessions
        if (detected) {
          try {
            const result = await window.api.getCodexSessions(detected)
            if (cancelled) return
            setCodexHome(detected)
            setGroups(result)
            setHomeNotFound(false)
          } catch {
            if (cancelled) return
            setCodexHome(detected)
            setHomeNotFound(true)
          }
        } else {
          setHomeNotFound(true)
        }
      } catch {
        if (!cancelled) setHomeNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Reload on refresh or when codexHome changes
  const reload = useCallback(async () => {
    await refresh()
  }, [refresh])

  return { groups, loading, error, codexHome, homeNotFound, refresh: reload }
}
