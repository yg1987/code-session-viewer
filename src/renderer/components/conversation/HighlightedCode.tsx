import { useState, useEffect } from 'react'
import { useHighlighter, highlightCodeAsync } from '../../hooks/useHighlighter'

interface Props {
  code: string
  language: string
  className?: string
  maxHeight?: string
}

export function HighlightedCode({ code, language, className = '', maxHeight = '400px' }: Props) {
  const highlighter = useHighlighter()
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    if (!highlighter || !language || !code) {
      setHtml(null)
      return
    }
    let cancelled = false
    highlightCodeAsync(highlighter, code, language).then((result) => {
      if (!cancelled) setHtml(result)
    })
    return () => { cancelled = true }
  }, [highlighter, code, language])

  if (html) {
    return (
      <div
        className={`shiki-wrapper overflow-x-auto overflow-y-auto text-xs leading-relaxed ${className}`}
        style={{ maxHeight }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return (
    <pre className={`p-3 text-xs overflow-x-auto overflow-y-auto text-[#e6edf3] ${className}`} style={{ maxHeight }}>
      <code>{code}</code>
    </pre>
  )
}
