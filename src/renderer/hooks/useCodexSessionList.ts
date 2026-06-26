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

  // Resolve Codex home on mount: custom path > $CODEX_HOME env > ~/.codex
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // 1. Check user-saved custom Codex home first
        const settings = await window.api.getSettings()
        const customHome: string | undefined = (settings as { codexHomeDir?: string } | null)?.codexHomeDir

        // 2. Resolve path: custom > auto-detect
        let resolvedHome: string | null = customHome || null
        if (!resolvedHome) {
          resolvedHome = await window.api.detectCodexHome()
        }

        if (cancelled) return

        // 3. Verify by trying to load sessions
        if (resolvedHome) {
          try {
            const result = await window.api.getCodexSessions(resolvedHome)
            if (cancelled) return
            setCodexHome(resolvedHome)
            setGroups(result)
            setHomeNotFound(false)
          } catch {
            if (cancelled) return
            setCodexHome(resolvedHome)
            setHomeNotFound(true)
          }
        } else {
          setHomeNotFound(true)
        }
      } catch (e) {
        console.debug('useCodexSessionList: init failed', e)
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
