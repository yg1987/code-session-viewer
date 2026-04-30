import { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  totalMessages: number
  messageRoles: ('user' | 'assistant')[]  // role of each message by index
  onPositionChange: (position: number) => void
  onExit: () => void
}

const SPEED_OPTIONS = [
  { label: '0.5x', ms: 3000 },
  { label: '1x', ms: 1500 },
  { label: '2x', ms: 800 },
  { label: '3x', ms: 400 },
  { label: '5x', ms: 200 }
]

export function ReplayControls({ totalMessages, messageRoles, onPositionChange, onExit }: Props) {
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [speedIdx, setSpeedIdx] = useState(1) // default 1x
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const speed = SPEED_OPTIONS[speedIdx]

  // Notify parent of position changes
  useEffect(() => {
    onPositionChange(position)
  }, [position, onPositionChange])

  // Auto-play timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)

    if (playing && position < totalMessages) {
      timerRef.current = setInterval(() => {
        setPosition((prev) => {
          if (prev >= totalMessages - 1) {
            setPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, speed.ms)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [playing, speed.ms, totalMessages, position])

  const togglePlay = useCallback(() => {
    if (position >= totalMessages - 1) {
      // Restart from beginning
      setPosition(0)
      setPlaying(true)
    } else {
      setPlaying((p) => !p)
    }
  }, [position, totalMessages])

  const stepForward = () => {
    setPlaying(false)
    setPosition((p) => Math.min(p + 1, totalMessages - 1))
  }

  const stepBackward = () => {
    setPlaying(false)
    setPosition((p) => Math.max(p - 1, 0))
  }

  const jumpNextUser = () => {
    setPlaying(false)
    setPosition((prev) => {
      for (let i = prev + 1; i < totalMessages; i++) {
        if (messageRoles[i] === 'user') return i
      }
      return prev // no next user found
    })
  }

  const jumpPrevUser = () => {
    setPlaying(false)
    setPosition((prev) => {
      for (let i = prev - 1; i >= 0; i--) {
        if (messageRoles[i] === 'user') return i
      }
      return prev
    })
  }

  const cycleSpeed = () => {
    setSpeedIdx((prev) => (prev + 1) % SPEED_OPTIONS.length)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay() }
      if (e.key === 'ArrowRight' && e.shiftKey) { e.preventDefault(); jumpNextUser() }
      else if (e.key === 'ArrowLeft' && e.shiftKey) { e.preventDefault(); jumpPrevUser() }
      else if (e.key === 'ArrowRight' || e.key === 'l') { e.preventDefault(); stepForward() }
      else if (e.key === 'ArrowLeft' || e.key === 'j') { e.preventDefault(); stepBackward() }
      if (e.key === 'Escape') { e.preventDefault(); onExit() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePlay, onExit])

  const progress = totalMessages > 1 ? (position / (totalMessages - 1)) * 100 : 0

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d1117]/95 backdrop-blur border-t border-[#30363d] px-6 py-3">
      {/* Progress bar */}
      <div className="mb-2 group cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const pct = (e.clientX - rect.left) / rect.width
          const newPos = Math.round(pct * (totalMessages - 1))
          setPosition(Math.max(0, Math.min(newPos, totalMessages - 1)))
        }}>
        <div className="h-1.5 bg-[#30363d] rounded-full overflow-hidden group-hover:h-2.5 transition-all">
          <div className="h-full bg-[#58a6ff] rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        {/* Left: position info */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-mono w-28">
            {position + 1} / {totalMessages}
          </span>
        </div>

        {/* Center: controls */}
        <div className="flex items-center gap-1">
          {/* Jump to prev user */}
          <button type="button" onClick={jumpPrevUser}
            className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-[#161b22] transition-colors" title="Previous User (Shift+Left)">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 19l-7-7 7-7" /></svg>
          </button>

          {/* Step back */}
          <button type="button" onClick={stepBackward}
            className="p-1.5 rounded-md text-gray-400 hover:text-[#e6edf3] hover:bg-[#161b22] transition-colors" title="Previous (Left / J)">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>

          {/* Play/Pause */}
          <button type="button" onClick={togglePlay}
            className="p-2 rounded-full bg-[#58a6ff] hover:bg-[#79c0ff] text-white transition-colors" title="Play/Pause (Space)">
            {playing ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            ) : position >= totalMessages - 1 ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>

          {/* Step forward */}
          <button type="button" onClick={stepForward}
            className="p-1.5 rounded-md text-gray-400 hover:text-[#e6edf3] hover:bg-[#161b22] transition-colors" title="Next (Right / L)">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>

          {/* Jump to next user */}
          <button type="button" onClick={jumpNextUser}
            className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-[#161b22] transition-colors" title="Next User (Shift+Right)">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Right: speed + exit */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={cycleSpeed}
            className="px-2 py-1 text-xs font-mono rounded border border-[#30363d] text-[#58a6ff] hover:bg-[#161b22] transition-colors min-w-[40px]">
            {speed.label}
          </button>
          <button type="button" onClick={onExit}
            className="px-3 py-1 text-xs text-gray-400 hover:text-[#e6edf3] rounded hover:bg-[#161b22] transition-colors" title="Exit Replay (Esc)">
            Exit
          </button>
        </div>
      </div>
    </div>
  )
}
