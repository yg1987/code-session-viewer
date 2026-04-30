import { useState } from 'react'
import { useSettings, BUILTIN_PRICING, getAllPricing, type ModelPricing } from '../hooks/useSettings'

const FONT_OPTIONS = [
  { label: 'System Default', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' },
  { label: 'Consolas', value: 'Consolas, "Courier New", monospace' },
  { label: 'Cascadia Code', value: '"Cascadia Code", Consolas, monospace' },
  { label: 'Fira Code', value: '"Fira Code", Consolas, monospace' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", Consolas, monospace' },
  { label: 'Microsoft YaHei', value: '"Microsoft YaHei", sans-serif' }
]

interface Props { onClose: () => void }

export function SettingsPanel({ onClose }: Props) {
  const { settings, updateSettings } = useSettings()
  const [tab, setTab] = useState<'appearance' | 'pricing'>('appearance')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 csv-overlay" onClick={onClose} />
      <div className="relative csv-pop bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-4)] w-[560px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-base font-semibold text-[var(--text)]">Settings</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 mb-4">
          {(['appearance', 'pricing'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${tab === t ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text2)] hover:bg-[var(--surface2)]'}`}>
              {t === 'appearance' ? 'Appearance' : 'Model Pricing'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {tab === 'appearance' ? (
            <AppearanceTab />
          ) : (
            <PricingTab />
          )}
        </div>
      </div>
    </div>
  )
}

function AppearanceTab() {
  const { settings, updateSettings } = useSettings()

  return (
    <div className="space-y-5">
      {/* Theme */}
      <div>
        <label className="text-xs font-semibold text-[var(--text2)] uppercase block mb-2">Theme</label>
        <div className="flex gap-2">
          {(['dark', 'light', 'sepia'] as const).map((t) => (
            <button key={t} type="button" onClick={() => updateSettings({ theme: t })}
              className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${settings.theme === t ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-1)]' : 'border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface2)] hover:border-[var(--border-strong)]'}`}>
              <span className="flex items-center justify-center gap-1.5">
                {t === 'dark' && (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                )}
                {t === 'light' && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" /></svg>
                )}
                {t === 'sepia' && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20V5a2 2 0 00-2-2H6.5A2.5 2.5 0 004 5.5v14zM6.5 17H20v4H6.5a2.5 2.5 0 010-5z" /></svg>
                )}
                {t === 'dark' ? 'Dark' : t === 'light' ? 'Light' : 'Sepia'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div>
        <label className="text-xs font-semibold text-[var(--text2)] uppercase block mb-2">Font Size: {settings.fontSize}px</label>
        <input type="range" min={12} max={18} step={1} value={settings.fontSize}
          onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })} className="w-full accent-[var(--accent)]" />
        <div className="flex justify-between text-[10px] text-[var(--text2)]"><span>12px</span><span>15px</span><span>18px</span></div>
      </div>

      {/* Font family */}
      <div>
        <label className="text-xs font-semibold text-[var(--text2)] uppercase block mb-2">Font Family</label>
        <div className="space-y-1.5">
          {FONT_OPTIONS.map((opt) => (
            <button key={opt.label} type="button" onClick={() => updateSettings({ fontFamily: opt.value })}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${settings.fontFamily === opt.value ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface2)]'}`}
              style={{ fontFamily: opt.value }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3">
        <div className="text-xs text-[var(--text2)] mb-1">Preview</div>
        <div className="text-[var(--text)]" style={{ fontSize: settings.fontSize, fontFamily: settings.fontFamily }}>
          The quick brown fox jumps over the lazy dog.
        </div>
      </div>
    </div>
  )
}

function PricingTab() {
  const { settings, updateSettings } = useSettings()
  const allPricing = getAllPricing(settings)
  const [showAdd, setShowAdd] = useState(false)
  const [newModel, setNewModel] = useState<ModelPricing>({
    id: '', pattern: '', displayName: '', inputPer1M: 10, outputPer1M: 30, cacheReadPer1M: 1, cacheWritePer1M: 2.5
  })

  const updateBuiltinPrice = (id: string, field: keyof ModelPricing, value: number) => {
    const overrides = { ...settings.builtinPricingOverrides }
    if (!overrides[id]) overrides[id] = {}
    ;(overrides[id] as any)[field] = value
    updateSettings({ builtinPricingOverrides: overrides })
  }

  const updateCustomPrice = (idx: number, field: keyof ModelPricing, value: number | string) => {
    const customs = [...settings.customModelPricing]
    ;(customs[idx] as any)[field] = value
    updateSettings({ customModelPricing: customs })
  }

  const removeCustom = (idx: number) => {
    const customs = settings.customModelPricing.filter((_, i) => i !== idx)
    updateSettings({ customModelPricing: customs })
  }

  const addModel = () => {
    if (!newModel.pattern.trim()) return
    const model: ModelPricing = {
      ...newModel,
      id: newModel.pattern.replace(/[^a-z0-9]/gi, '-').toLowerCase(),
      displayName: newModel.displayName || newModel.pattern
    }
    updateSettings({ customModelPricing: [...settings.customModelPricing, model] })
    setNewModel({ id: '', pattern: '', displayName: '', inputPer1M: 10, outputPer1M: 30, cacheReadPer1M: 1, cacheWritePer1M: 2.5 })
    setShowAdd(false)
  }

  const resetToDefaults = () => {
    updateSettings({ builtinPricingOverrides: {}, customModelPricing: [] })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text2)]">Configure token pricing per model ($/1M tokens). Models are matched by name prefix.</p>
        <button type="button" onClick={resetToDefaults} className="text-[10px] text-[var(--text2)] hover:text-[var(--error)] transition-colors">Reset</button>
      </div>

      {/* Builtin models */}
      <div>
        <h3 className="text-xs font-semibold text-[var(--text2)] uppercase mb-2">Claude Models</h3>
        <div className="space-y-2">
          {BUILTIN_PRICING.map((builtin) => {
            const effective = allPricing.find((p) => p.id === builtin.id) || builtin
            return (
              <PricingRow key={builtin.id} pricing={effective}
                onChange={(field, val) => updateBuiltinPrice(builtin.id, field, val)} />
            )
          })}
        </div>
      </div>

      {/* Custom models */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-[var(--text2)] uppercase">Custom Models</h3>
          <button type="button" onClick={() => setShowAdd(true)}
            className="text-xs text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors">
            + Add Model
          </button>
        </div>

        {settings.customModelPricing.length === 0 && !showAdd && (
          <div className="text-xs text-[var(--text2)] bg-[var(--bg)] rounded-lg p-3 border border-[var(--border)]">
            No custom models. Add one for non-Claude models like GPT-4o, Gemini, DeepSeek, etc.
          </div>
        )}

        <div className="space-y-2">
          {settings.customModelPricing.map((model, idx) => (
            <PricingRow key={model.id + idx} pricing={model}
              onChange={(field, val) => updateCustomPrice(idx, field as any, val)}
              onChangeName={(field, val) => updateCustomPrice(idx, field as any, val)}
              onDelete={() => removeCustom(idx)} />
          ))}
        </div>

        {/* Add new model form */}
        {showAdd && (
          <div className="bg-[var(--bg)] border border-[var(--accent)]/30 rounded-lg p-3 mt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--text2)]">Pattern (prefix match)</label>
                <input type="text" value={newModel.pattern} onChange={(e) => setNewModel({ ...newModel, pattern: e.target.value })}
                  placeholder="e.g. gpt-4o" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text2)]">Display Name</label>
                <input type="text" value={newModel.displayName} onChange={(e) => setNewModel({ ...newModel, displayName: e.target.value })}
                  placeholder="e.g. GPT-4o" className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <PriceInput label="Input" value={newModel.inputPer1M} onChange={(v) => setNewModel({ ...newModel, inputPer1M: v })} />
              <PriceInput label="Output" value={newModel.outputPer1M} onChange={(v) => setNewModel({ ...newModel, outputPer1M: v })} />
              <PriceInput label="Cache R" value={newModel.cacheReadPer1M} onChange={(v) => setNewModel({ ...newModel, cacheReadPer1M: v })} />
              <PriceInput label="Cache W" value={newModel.cacheWritePer1M} onChange={(v) => setNewModel({ ...newModel, cacheWritePer1M: v })} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowAdd(false)} className="text-xs text-[var(--text2)] px-3 py-1 rounded hover:bg-[var(--surface2)]">Cancel</button>
              <button type="button" onClick={addModel} disabled={!newModel.pattern.trim()}
                className="text-xs bg-[var(--accent)] text-white px-3 py-1 rounded disabled:opacity-30 hover:opacity-90 transition-colors">Add</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PricingRow({ pricing, onChange, onChangeName, onDelete }: {
  pricing: ModelPricing
  onChange: (field: keyof ModelPricing, value: number) => void
  onChangeName?: (field: 'pattern' | 'displayName', value: string) => void
  onDelete?: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="text-xs transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : '' }}>&#9654;</span>
        <span className="text-xs font-medium text-[var(--text)]">{pricing.displayName}</span>
        <span className="text-[10px] text-[var(--text2)] font-mono">{pricing.pattern}</span>
        <span className="text-[10px] text-[var(--text2)] ml-auto">
          ${pricing.inputPer1M}/${pricing.outputPer1M}
        </span>
        {onDelete && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="text-[var(--text2)] hover:text-[var(--error)] transition-colors p-0.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-[var(--border)] pt-2 space-y-2">
          {onChangeName && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--text2)]">Pattern</label>
                <input type="text" value={pricing.pattern} onChange={(e) => onChangeName('pattern', e.target.value)}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text2)]">Display Name</label>
                <input type="text" value={pricing.displayName} onChange={(e) => onChangeName('displayName', e.target.value)}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            <PriceInput label="Input $/1M" value={pricing.inputPer1M} onChange={(v) => onChange('inputPer1M', v)} />
            <PriceInput label="Output $/1M" value={pricing.outputPer1M} onChange={(v) => onChange('outputPer1M', v)} />
            <PriceInput label="Cache Read $/1M" value={pricing.cacheReadPer1M} onChange={(v) => onChange('cacheReadPer1M', v)} />
            <PriceInput label="Cache Write $/1M" value={pricing.cacheWritePer1M} onChange={(v) => onChange('cacheWritePer1M', v)} />
          </div>
        </div>
      )}
    </div>
  )
}

function PriceInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-[10px] text-[var(--text2)]">{label}</label>
      <input type="number" step="0.01" min="0" value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]" />
    </div>
  )
}
