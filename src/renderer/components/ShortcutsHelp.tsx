import { useLocale } from '../hooks/useLocale'

interface Props {
  onClose: () => void
}

export function ShortcutsHelp({ onClose }: Props) {
  const { t } = useLocale()

  const sections = [
    {
      title: t('shortcuts.general'),
      shortcuts: [
        { keys: ['Ctrl', 'F'], desc: t('shortcuts.searchCurrent') },
        { keys: ['Ctrl', 'Shift', 'F'], desc: t('shortcuts.crossSearch') },
        { keys: ['Ctrl', 'D'], desc: t('shortcuts.dashboard') },
        { keys: ['Ctrl', 'E'], desc: t('shortcuts.exportHtml') },
        { keys: ['Ctrl', 'O'], desc: t('shortcuts.openInClaude') },
        { keys: ['Alt', '\u2191/\u2193'], desc: t('shortcuts.switchSession') },
        { keys: ['?'], desc: t('shortcuts.toggleHelp') },
      ]
    },
    {
      title: t('shortcuts.search'),
      shortcuts: [
        { keys: ['Enter'], desc: t('shortcuts.nextMatch') },
        { keys: ['Shift', 'Enter'], desc: t('shortcuts.prevMatch') },
        { keys: ['Esc'], desc: t('shortcuts.closeSearch') },
      ]
    },
    {
      title: t('shortcuts.replay'),
      shortcuts: [
        { keys: ['Space', '/', 'K'], desc: t('shortcuts.playPause') },
        { keys: ['\u2192', '/', 'L'], desc: t('shortcuts.nextMsg') },
        { keys: ['\u2190', '/', 'J'], desc: t('shortcuts.prevMsg') },
        { keys: ['Shift', '\u2192'], desc: t('shortcuts.nextUser') },
        { keys: ['Shift', '\u2190'], desc: t('shortcuts.prevUser') },
        { keys: ['Esc'], desc: t('shortcuts.exitReplay') },
      ]
    }
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 csv-overlay" onClick={onClose} />
      <div className="relative csv-pop bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-4)] p-6 w-[480px] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[var(--text)]">{t('shortcuts.title')}</h2>
          <button type="button" onClick={onClose}
            className="p-1 rounded-md text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-[var(--text2)] uppercase mb-2">{section.title}</h3>
              <div className="space-y-1">
                {section.shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span className="text-xs text-[var(--text)]">{s.desc}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((key, j) => (
                        key === '/' ? (
                          <span key={j} className="text-xs text-[var(--text2)]">/</span>
                        ) : (
                          <kbd key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text2)] font-mono min-w-[24px] text-center">
                            {key}
                          </kbd>
                        )
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-[var(--border)] text-center">
          <span className="text-[10px] text-[var(--text2)]">{t('shortcuts.pressToggle')}</span>
        </div>
      </div>
    </div>
  )
}
