/**
 * Codex home directory detection.
 * Codex stores sessions at ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl.
 * The base directory can be overridden via the CODEX_HOME environment variable.
 */

import * as path from 'path'
import * as os from 'os'

/**
 * Detect the Codex home directory.
 * Checks $CODEX_HOME first, then falls back to ~/.codex/.
 * Returns the resolved path even if it doesn't exist yet.
 */
export function detectCodexHome(): string {
  const envHome = process.env['CODEX_HOME']
  if (envHome) {
    return path.resolve(envHome)
  }
  return path.join(os.homedir(), '.codex')
}
