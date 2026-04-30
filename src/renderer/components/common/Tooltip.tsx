import { useState, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  content: ReactNode
  children: ReactNode
  className?: string
}

export function Tooltip({ content, children, className = '' }: Props) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)

  const show = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ x: rect.left + rect.width / 2, y: rect.top })
    setVisible(true)
  }

  return (
    <>
      <div ref={triggerRef} onMouseEnter={show} onMouseLeave={() => setVisible(false)} className={className}>
        {children}
      </div>
      {visible && createPortal(
        <div
          className="fixed z-[9999] bg-[#0d1117] border border-[#30363d] rounded p-2 text-[10px] whitespace-nowrap shadow-lg pointer-events-none"
          style={{
            left: Math.min(Math.max(pos.x, 80), window.innerWidth - 80),
            top: Math.max(pos.y - 8, 8),
            transform: 'translate(-50%, -100%)'
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  )
}
