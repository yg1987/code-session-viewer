import { createContext, useContext, useState, useCallback, useEffect } from 'react'

export interface ModelPricing {
  id: string
  pattern: string        // prefix match, e.g. "claude-opus" matches "claude-opus-4-6"
  displayName: string
  inputPer1M: number     // $/1M tokens
  outputPer1M: number
  cacheReadPer1M: number
  cacheWritePer1M: number
  isBuiltin?: boolean
}

export const BUILTIN_PRICING: ModelPricing[] = [
  { id: 'opus', pattern: 'claude-opus', displayName: 'Claude Opus', inputPer1M: 15, outputPer1M: 75, cacheReadPer1M: 1.5, cacheWritePer1M: 3.75, isBuiltin: true },
  { id: 'sonnet', pattern: 'claude-sonnet', displayName: 'Claude Sonnet', inputPer1M: 3, outputPer1M: 15, cacheReadPer1M: 0.3, cacheWritePer1M: 0.75, isBuiltin: true },
  { id: 'haiku', pattern: 'claude-haiku', displayName: 'Claude Haiku', inputPer1M: 0.8, outputPer1M: 4, cacheReadPer1M: 0.08, cacheWritePer1M: 0.2, isBuiltin: true },
]

const DEFAULT_FALLBACK: ModelPricing = {
  id: '_fallback', pattern: '', displayName: 'Unknown', inputPer1M: 10, outputPer1M: 30, cacheReadPer1M: 1, cacheWritePer1M: 2.5, isBuiltin: true
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'sepia'
  fontSize: number
  fontFamily: string
  locale: 'en' | 'zh'
  customModelPricing: ModelPricing[]  // user-added models
  builtinPricingOverrides: Record<string, Partial<ModelPricing>>  // overrides for builtin models, keyed by id
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  locale: 'en',
  customModelPricing: [],
  builtinPricingOverrides: {}
}

const STORAGE_KEY = 'claude-session-viewer-settings'

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch (e) { console.debug('useSettings: loadSettings failed', e) }
  return { ...DEFAULT_SETTINGS }
}

/** Get all model pricing: builtins (with overrides) + custom models */
export function getAllPricing(settings: AppSettings): ModelPricing[] {
  const builtins = BUILTIN_PRICING.map((b) => {
    const override = settings.builtinPricingOverrides[b.id]
    return override ? { ...b, ...override, isBuiltin: true } : b
  })
  return [...builtins, ...settings.customModelPricing]
}

/** Find pricing for a model name. Uses prefix matching on pattern field. */
export function getModelPricing(modelName: string, settings: AppSettings): ModelPricing {
  if (!modelName) return DEFAULT_FALLBACK
  const all = getAllPricing(settings)

  // Exact match first
  const exact = all.find((p) => p.pattern === modelName)
  if (exact) return exact

  // Prefix match (longest prefix wins)
  let best: ModelPricing | null = null
  for (const p of all) {
    if (modelName.startsWith(p.pattern) && (!best || p.pattern.length > best.pattern.length)) {
      best = p
    }
  }

  return best || DEFAULT_FALLBACK
}

/** Calculate cost for a single model's token usage */
export function calculateCost(
  pricing: ModelPricing,
  tokens: { input: number; output: number; cacheRead: number; cacheCreate: number }
): { inputCost: number; outputCost: number; cacheReadCost: number; cacheWriteCost: number; total: number } {
  const inputCost = (tokens.input / 1_000_000) * pricing.inputPer1M
  const outputCost = (tokens.output / 1_000_000) * pricing.outputPer1M
  const cacheReadCost = (tokens.cacheRead / 1_000_000) * pricing.cacheReadPer1M
  const cacheWriteCost = (tokens.cacheCreate / 1_000_000) * pricing.cacheWritePer1M
  return { inputCost, outputCost, cacheReadCost, cacheWriteCost, total: inputCost + outputCost + cacheReadCost + cacheWriteCost }
}

interface SettingsContextValue {
  settings: AppSettings
  updateSettings: (partial: Partial<AppSettings>) => void
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {}
})

export function useSettings() {
  return useContext(SettingsContext)
}

export function useSettingsProvider() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
    document.documentElement.style.fontSize = `${settings.fontSize}px`
    document.documentElement.style.fontFamily = settings.fontFamily
  }, [settings])

  return { settings, updateSettings }
}
