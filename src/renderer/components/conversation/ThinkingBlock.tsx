import { Collapsible } from '../common/Collapsible'
import { useLocale } from '../../hooks/useLocale'

interface Props {
  thinking: string
}

export function ThinkingBlock({ thinking }: Props) {
  const { t } = useLocale()
  const preview =
    thinking.length > 100 ? thinking.slice(0, 100) + '...' : thinking

  return (
    <Collapsible
      className="my-2 rounded-md overflow-hidden"
      header={
        <span className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md" style={{ background: 'var(--yellow-soft)' }}>
          <svg className="w-3.5 h-3.5 text-[var(--yellow)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.549-.547z" />
          </svg>
          <span className="text-[var(--yellow)] font-medium">{t('thinking.thinking')}</span>
          <span className="text-[var(--text3)] text-xs">({thinking.length}{t('thinking.chars')})</span>
          <span className="text-[var(--text3)] text-xs truncate max-w-xs">{preview}</span>
        </span>
      }
    >
      <div className="px-4 pb-3 pt-1 text-sm text-[var(--text2)] whitespace-pre-wrap leading-relaxed font-mono">
        {thinking}
      </div>
    </Collapsible>
  )
}
