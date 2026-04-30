interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar({ value, onChange, placeholder = 'Search sessions...' }: Props) {
  return (
    <div className="px-1 py-1">
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text3)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-8 pr-3 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text3)] focus:outline-none focus:border-[var(--accent)] focus:bg-[var(--bg)] transition-colors"
        />
      </div>
    </div>
  )
}
