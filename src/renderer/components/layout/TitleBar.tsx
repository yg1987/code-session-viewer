import { useEffect, useState } from 'react'
import { useLocale } from '../../hooks/useLocale'

interface Props {
  title?: string
  /** Optional right-aligned slot rendered before the window control buttons. */
  right?: React.ReactNode
}

/**
 * Custom titlebar for frameless window. The whole bar acts as the OS drag
 * region except for interactive controls (which carry .no-drag via global css).
 */
export function TitleBar({ title, right }: Props) {
  const [maximized, setMaximized] = useState(false)
  const { t } = useLocale()

  useEffect(() => {
    let cancelled = false
    // Guard: window.api might not be available when previewed in a plain browser
    if (!window.api) return
    window.api.windowIsMaximized().then((v) => { if (!cancelled) setMaximized(v) })
    const off = window.api.onWindowStateChanged(({ isMaximized }) => {
      setMaximized(isMaximized)
    })
    return () => { cancelled = true; off?.() }
  }, [])

  const displayTitle = title || t('titlebar.defaultTitle')

  return (
    <div className="csv-titlebar app-drag-region select-none flex items-center h-8 flex-shrink-0 border-b border-[var(--border)] bg-[var(--bg)]">
      {/* Left: logo + app name */}
      <div className="flex items-center gap-2 px-3 min-w-0">
        <span className="csv-titlebar-dot" aria-hidden />
        <span className="text-[12px] font-medium text-[var(--text2)] truncate">{displayTitle}</span>
      </div>

      {/* Center: optional contextual title (truncates) */}
      <div className="flex-1 min-w-0 px-2" />

      {/* Right: caller-provided slot then window controls */}
      <div className="flex items-center gap-1 pr-1">
        {right}
      </div>

      {/* Window controls — Windows-style on the right edge */}
      <div className="flex items-center h-full">
        <button
          type="button"
          aria-label={t('titlebar.minimize')}
          title={t('titlebar.minimize')}
          onClick={() => window.api?.windowMinimize?.()}
          className="csv-titlebar-btn"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M0 5 H10" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={maximized ? t('titlebar.restore') : t('titlebar.maximize')}
          title={maximized ? t('titlebar.restore') : t('titlebar.maximize')}
          onClick={() => window.api?.windowMaximizeToggle?.()}
          className="csv-titlebar-btn"
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              {/* Restored: two stacked rectangles */}
              <path d="M2 1 H9 V8 H7 V3 H2 Z M1 3 H7 V9 H1 Z" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          )}
        </button>
        <button
          type="button"
          aria-label={t('titlebar.close')}
          title={t('titlebar.close')}
          onClick={() => window.api?.windowClose?.()}
          className="csv-titlebar-btn csv-titlebar-close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M0 0 L10 10 M10 0 L0 10" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        </button>
      </div>
    </div>
  )
}
