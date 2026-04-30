import { useState, useCallback } from 'react'
import type { ParsedMessage } from '../types/message'

export function useSessionMessages() {
  const [messages, setMessages] = useState<ParsedMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSession = useCallback(async (filePath: string) => {
    setLoading(true)
    setError(null)
    setMessages([])
    try {
      const result = await window.api.loadSession(filePath)
      setMessages(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse session')
    } finally {
      setLoading(false)
    }
  }, [])

  return { messages, loading, error, loadSession }
}
