/**
 * Codex session deletion.
 * Deletes a Codex rollout JSONL file from disk.
 */

import * as fs from 'fs'

/**
 * Delete a Codex session file.
 * Returns true on success, false on failure.
 */
export function deleteCodexSession(filePath: string): boolean {
  try {
    fs.unlinkSync(filePath)
    return true
  } catch {
    return false
  }
}
