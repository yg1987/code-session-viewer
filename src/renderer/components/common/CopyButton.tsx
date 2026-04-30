import { useState } from 'react'

interface Props {
  text: string
  className?: string
}

export function CopyButton({ text, className = '' }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className={`text-xs px-2 py-0.5 rounded transition-colors ${
        copied
          ? 'text-green-400 bg-green-400/10'
          : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
      } ${className}`}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}
