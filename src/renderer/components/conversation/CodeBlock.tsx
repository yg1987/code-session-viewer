import { useState, useEffect } from 'react'
import { CopyButton } from '../common/CopyButton'
import { useHighlighter, highlightCodeAsync } from '../../hooks/useHighlighter'

interface Props {
  code: string
  language?: string
  fileName?: string
  maxHeight?: string
}

export function CodeBlock({ code, language, fileName, maxHeight = '500px' }: Props) {
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

  const displayLang = language || 'text'

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg)] shadow-[var(--shadow-1)]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          {fileName && <span className="text-xs text-[var(--text)] font-medium">{fileName}</span>}
          <span className="text-[10px] text-[var(--text3)] uppercase tracking-wider font-mono">{displayLang}</span>
        </div>
        <CopyButton text={code} />
      </div>
      {html ? (
        <div
          className="shiki-wrapper overflow-x-auto overflow-y-auto text-[13px] leading-relaxed"
          style={{ maxHeight }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="p-3 overflow-x-auto overflow-y-auto text-[13px] leading-relaxed text-[var(--text)]" style={{ maxHeight }}>
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}
