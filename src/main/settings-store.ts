/**
 * Simple JSON settings store for session viewer preferences.
 * Persists user settings (like custom OpenCode DB path) to disk.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface ViewerSettings {
  /** Manually specified OpenCode DB path (overrides auto-detect) */
  openCodeDbPath?: string
  /** Manually specified Codex home directory (overrides auto-detect) */
  codexHomeDir?: string
}

const DEFAULT_SETTINGS: ViewerSettings = {}

function getSettingsDir(): string {
  // Use a platform-appropriate config location
  if (process.platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Local', 'claude-session-viewer')
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'claude-session-viewer')
  }
  // Linux / XDG
  const xdgConfig = process.env['XDG_CONFIG_HOME']
  if (xdgConfig) {
    return path.join(xdgConfig, 'claude-session-viewer')
  }
  return path.join(os.homedir(), '.config', 'claude-session-viewer')
}

function getSettingsPath(): string {
  return path.join(getSettingsDir(), 'settings.json')
}

export function loadSettings(): ViewerSettings {
  try {
    const filePath = getSettingsPath()
    if (!fs.existsSync(filePath)) return { ...DEFAULT_SETTINGS }
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<ViewerSettings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch (err) {
    console.error('Failed to load settings:', err)
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: ViewerSettings): boolean {
  try {
    const dir = getSettingsDir()
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const filePath = getSettingsPath()
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('Failed to save settings:', err)
    return false
  }
}
