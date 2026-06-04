import en from './en.json'
import zh from './zh.json'

export type Locale = 'en' | 'zh'

type TranslationMap = Record<string, string>

const map: Record<Locale, TranslationMap> = { en, zh }

/**
 * Look up a translation key in the given locale.
 * Falls back to English, then to the raw key if missing.
 */
export function lookup(locale: Locale, key: string): string {
  const val = map[locale]?.[key]
  if (!val && locale !== 'en') {
    // Dev-only warning for missing translations
    if (typeof window !== 'undefined') {
      console.warn(`[i18n] Missing "${locale}" translation for key: ${key}`)
    }
  }
  return val ?? map.en[key] ?? key
}

/** Type-safe helper: all valid translation keys */
export type TranslationKey = keyof typeof en
