import { useState, useEffect, type ReactNode } from 'react'
import { useCollapseControl } from '../../hooks/useCollapseControl'

interface Props {
  header: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

export function Collapsible({ header, children, defaultOpen = false, className = '' }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const { expandSignal, collapseSignal } = useCollapseControl()

  useEffect(() => {
    if (expandSignal > 0) setOpen(true)
  }, [expandSignal])

  useEffect(() => {
    if (collapseSignal > 0) setOpen(false)
  }, [collapseSignal])

  return (
    <div className={className}>
      <div className="cursor-pointer select-none flex items-start" onClick={() => setOpen(!open)}>
        <svg
          className="flex-shrink-0 w-3 h-3 mt-2 ml-1 mr-1 text-[var(--text3)] transition-transform duration-200"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
        <div className="flex-1 min-w-0">{header}</div>
      </div>
      {open && <div className="mt-1 csv-msg-in">{children}</div>}
    </div>
  )
}
