import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface SearchResult {
  sessionId: string
  projectPath: string
  fullPath: string
  customTitle: string
  firstPrompt: string
  timestamp: string
  matchType: 'user' | 'assistant' | 'tool'
  preview: string // matched text snippet
}

export async function crossSessionSearch(query: string, maxResults = 100): Promise<SearchResult[]> {
  if (!query.trim()) return []

  const projectsDir = path.join(os.homedir(), '.claude', 'projects')
  if (!fs.existsSync(projectsDir)) return []

  const q = query.toLowerCase()
  const results: SearchResult[] = []

  const dirs = fs.readdirSync(projectsDir, { withFileTypes: true })
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue
    if (results.length >= maxResults) break

    const projectDir = path.join(projectsDir, dir.name)
    const files = fs.readdirSync(projectDir).filter(
      (f) => f.endsWith('.jsonl') && !f.startsWith('agent-')
    )

    for (const file of files) {
      if (results.length >= maxResults) break
      const filePath = path.join(projectDir, file)
      const sessionId = file.replace('.jsonl', '')

      try {
        searchInFile(filePath, sessionId, dir.name, q, results, maxResults)
      } catch (e) {
        console.debug('cross-search: searchInFile failed for', filePath, e)
      }
    }
  }

  return results
}

function searchInFile(
  filePath: string,
  sessionId: string,
  projectEncoded: string,
  query: string,
  results: SearchResult[],
  maxResults: number
): void {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  let customTitle = ''
  let firstPrompt = ''
  let projectPath = projectEncoded
  let found = false

  for (const line of lines) {
    if (results.length >= maxResults) break
    if (!line.trim()) continue

    // Quick text match before parsing JSON
    if (!line.toLowerCase().includes(query)) {
      // Still check for metadata
      if (line.includes('custom-title') || (!firstPrompt && line.includes('"user"'))) {
        try {
          const obj = JSON.parse(line)
          if (obj.type === 'custom-title' && obj.customTitle) customTitle = obj.customTitle
          if (!firstPrompt && obj.type === 'user' && obj.message?.content) {
            const c = obj.message.content
            firstPrompt = typeof c === 'string' ? c.slice(0, 100) : ''
            if (Array.isArray(c)) {
              const t = c.find((b: any) => b.type === 'text')
              if (t?.text) firstPrompt = t.text.slice(0, 100)
            }
          }
          if (obj.cwd && projectPath === projectEncoded) projectPath = obj.cwd
        } catch { /* skip */ }
      }
      continue
    }

    try {
      const obj = JSON.parse(line)

      // Metadata extraction
      if (obj.type === 'custom-title' && obj.customTitle) customTitle = obj.customTitle
      if (obj.cwd && projectPath === projectEncoded) projectPath = obj.cwd

      if (obj.type === 'user' && obj.message) {
        const c = obj.message.content
        if (!firstPrompt) {
          firstPrompt = typeof c === 'string' ? c.slice(0, 100) : ''
          if (Array.isArray(c)) {
            const t = c.find((b: any) => b.type === 'text')
            if (t?.text) firstPrompt = t.text.slice(0, 100)
          }
        }

        // Check user text match
        let text = ''
        if (typeof c === 'string') text = c
        else if (Array.isArray(c)) {
          text = c.filter((b: any) => b.type === 'text').map((b: any) => b.text || '').join(' ')
        }
        if (text.toLowerCase().includes(query)) {
          results.push({
            sessionId, projectPath, fullPath: filePath,
            customTitle, firstPrompt,
            timestamp: obj.timestamp || '',
            matchType: 'user',
            preview: extractSnippet(text, query)
          })
          found = true
        }
      }

      if (obj.type === 'assistant' && obj.message?.content && Array.isArray(obj.message.content)) {
        for (const block of obj.message.content) {
          if (results.length >= maxResults) break

          if (block.type === 'text' && block.text?.toLowerCase().includes(query)) {
            results.push({
              sessionId, projectPath, fullPath: filePath,
              customTitle, firstPrompt,
              timestamp: obj.timestamp || '',
              matchType: 'assistant',
              preview: extractSnippet(block.text, query)
            })
            found = true
          }

          if (block.type === 'tool_use') {
            const inputStr = JSON.stringify(block.input || {})
            if (block.name?.toLowerCase().includes(query) || inputStr.toLowerCase().includes(query)) {
              results.push({
                sessionId, projectPath, fullPath: filePath,
                customTitle, firstPrompt,
                timestamp: obj.timestamp || '',
                matchType: 'tool',
                preview: `${block.name}: ${extractSnippet(inputStr, query)}`
              })
              found = true
            }
          }
        }
      }
    } catch {
      // skip
    }
  }
}

function extractSnippet(text: string, query: string, contextChars = 80): string {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query)
  if (idx === -1) return text.slice(0, contextChars * 2)

  const start = Math.max(0, idx - contextChars)
  const end = Math.min(text.length, idx + query.length + contextChars)
  let snippet = text.slice(start, end)
  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet += '...'
  return snippet
}
