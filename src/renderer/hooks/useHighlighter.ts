import { useState, useEffect } from 'react'
import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

let _highlighter: HighlighterCore | null = null
let _loading: Promise<HighlighterCore> | null = null

// Lazy-load grammars
const LANG_IMPORTS: Record<string, () => Promise<any>> = {
  javascript: () => import('shiki/langs/javascript.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  lua: () => import('shiki/langs/lua.mjs'),
  bash: () => import('shiki/langs/bash.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  dart: () => import('shiki/langs/dart.mjs'),
  swift: () => import('shiki/langs/swift.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  scss: () => import('shiki/langs/scss.mjs'),
  less: () => import('shiki/langs/less.mjs'),
  dockerfile: () => import('shiki/langs/dockerfile.mjs'),
  graphql: () => import('shiki/langs/graphql.mjs'),
  protobuf: () => import('shiki/langs/protobuf.mjs'),
}

async function initHighlighter(): Promise<HighlighterCore> {
  if (_highlighter) return _highlighter

  const themeImport = await import('shiki/themes/github-dark.mjs')

  const h = await createHighlighterCore({
    themes: [themeImport],
    langs: [],
    engine: createJavaScriptRegexEngine()
  })

  _highlighter = h
  return h
}

function getHighlighter(): Promise<HighlighterCore> {
  if (_highlighter) return Promise.resolve(_highlighter)
  if (_loading) return _loading
  _loading = initHighlighter()
  return _loading
}

export function useHighlighter() {
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(_highlighter)

  useEffect(() => {
    getHighlighter().then(setHighlighter)
  }, [])

  return highlighter
}

const LANG_NORMALIZE: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rb: 'ruby', rs: 'rust', cs: 'csharp',
  sh: 'bash', zsh: 'bash', yml: 'yaml', h: 'c', hpp: 'cpp',
  md: 'markdown', proto: 'protobuf',
}

function normalizeLang(lang: string): string {
  return LANG_NORMALIZE[lang] || lang
}

/** Highlight code to HTML. Loads grammar on demand if needed. */
export async function highlightCodeAsync(
  highlighter: HighlighterCore,
  code: string,
  lang: string
): Promise<string> {
  const normalized = normalizeLang(lang)
  const loaded = highlighter.getLoadedLanguages()

  if (!loaded.includes(normalized as any)) {
    const loader = LANG_IMPORTS[normalized]
    if (loader) {
      try {
        const grammar = await loader()
        await highlighter.loadLanguage(grammar)
      } catch {
        return escapeHtml(code)
      }
    } else {
      return escapeHtml(code)
    }
  }

  try {
    return highlighter.codeToHtml(code, {
      lang: normalized,
      theme: 'github-dark',
    })
  } catch {
    return escapeHtml(code)
  }
}

function escapeHtml(str: string): string {
  return `<pre style="padding:12px;overflow-x:auto"><code>${str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</code></pre>`
}
