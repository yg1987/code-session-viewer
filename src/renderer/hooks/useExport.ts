import { useState, useCallback } from 'react'

export function useExport() {
  const [exporting, setExporting] = useState(false)

  const exportSession = useCallback(
    async (data: {
      filePath: string
      title: string
      projectPath: string
      sessionId: string
    }) => {
      setExporting(true)
      try {
        const result = await window.api.exportSession(data)
        return result
      } finally {
        setExporting(false)
      }
    },
    []
  )

  return { exporting, exportSession }
}
