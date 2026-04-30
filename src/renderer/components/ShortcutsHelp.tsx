interface Props {
  onClose: () => void
}

const SECTIONS = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['Ctrl', 'F'], desc: 'Search in current view' },
      { keys: ['Ctrl', 'Shift', 'F'], desc: 'Cross-session search' },
      { keys: ['Ctrl', 'D'], desc: 'Global dashboard' },
      { keys: ['Ctrl', 'E'], desc: 'Export HTML' },
      { keys: ['Ctrl', 'O'], desc: 'Open in Claude Code' },
      { keys: ['Alt', '\u2191/\u2193'], desc: 'Switch session' },
      { keys: ['?'], desc: 'Toggle this help' },
    ]
  },
  {
    title: 'Search',
    shortcuts: [
      { keys: ['Enter'], desc: 'Jump to next match' },
      { keys: ['Shift', 'Enter'], desc: 'Jump to previous match' },
      { keys: ['Esc'], desc: 'Close search' },
    ]
  },
  {
    title: 'Replay Mode',
    shortcuts: [
      { keys: ['Space', '/', 'K'], desc: 'Play / Pause' },
      { keys: ['\u2192', '/', 'L'], desc: 'Next message' },
      { keys: ['\u2190', '/', 'J'], desc: 'Previous message' },
      { keys: ['Shift', '\u2192'], desc: 'Next user message' },
      { keys: ['Shift', '\u2190'], desc: 'Previous user message' },
      { keys: ['Esc'], desc: 'Exit replay' },
    ]
  }
]

export function ShortcutsHelp({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 csv-overlay" onClick={onClose} />
      <div className="relative csv-pop bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-4)] p-6 w-[480px] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[var(--text)]">Keyboard Shortcuts</h2>
          <button type="button" onClick={onClose}
            className="p-1 rounded-md text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {SECTIONS.map((section) => (
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
          <span className="text-[10px] text-[var(--text2)]">Press <kbd className="text-[10px] px-1 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] font-mono">?</kbd> to toggle</span>
        </div>
      </div>
    </div>
  )
}
