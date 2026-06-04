import { useMemo } from 'react'
import { useSettings } from './useSettings'
import { lookup, type Locale } from '../i18n/translations'

/**
 * Hook that provides i18n translation function.
 * Locale is read from AppSettings (persisted in localStorage).
 * All components that display user-visible text should use this hook.
 */
export function useLocale() {
  const { settings } = useSettings()
  const locale: Locale = (settings.locale || 'en') as Locale

  const t = useMemo(() => {
    return (key: string, params?: Record<string, string | number>): string => {
      let text = lookup(locale, key)
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
        }
      }
      return text
    }
  }, [locale])

  return { locale, t }
}
