import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

interface DeleteResult {
  deleted: string[]
  errors: string[]
}

/**
 * Cleanly delete a Claude Code session and all associated files:
 * 1. projects/<proj>/<id>.jsonl          - main session file
 * 2. projects/<proj>/<id>/               - subagents + tool-results directory
 * 3. file-history/<id>/                  - file version snapshots
 * 4. telemetry/*.<id>.*.json             - telemetry events
 * 5. tasks/<id>/                         - task files
 * 6. projects/<proj>/sessions-index.json - remove entry from index
 */
export function deleteSession(sessionFilePath: string, sessionId: string): DeleteResult {
  const claudeDir = path.join(os.homedir(), '.claude')
  const projectDir = path.dirname(sessionFilePath)
  const deleted: string[] = []
  const errors: string[] = []

  function tryDelete(targetPath: string, isDir: boolean) {
    try {
      if (!fs.existsSync(targetPath)) return
      if (isDir) {
        fs.rmSync(targetPath, { recursive: true, force: true })
      } else {
        fs.unlinkSync(targetPath)
      }
      deleted.push(targetPath)
    } catch (e) {
      errors.push(`${targetPath}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 1. Main session JSONL file
  tryDelete(sessionFilePath, false)

  // 2. Session directory (subagents + tool-results)
  const sessionDir = path.join(projectDir, sessionId)
  tryDelete(sessionDir, true)

  // 3. File history snapshots
  const fileHistoryDir = path.join(claudeDir, 'file-history', sessionId)
  tryDelete(fileHistoryDir, true)

  // 4. Telemetry files matching the session ID
  const telemetryDir = path.join(claudeDir, 'telemetry')
  if (fs.existsSync(telemetryDir)) {
    try {
      const files = fs.readdirSync(telemetryDir)
      for (const file of files) {
        if (file.includes(sessionId)) {
          tryDelete(path.join(telemetryDir, file), false)
        }
      }
    } catch {
      // telemetry dir read error, non-critical
    }
  }

  // 5. Tasks directory
  const tasksDir = path.join(claudeDir, 'tasks', sessionId)
  tryDelete(tasksDir, true)

  // 6. Remove entry from sessions-index.json
  const indexPath = path.join(projectDir, 'sessions-index.json')
  if (fs.existsSync(indexPath)) {
    try {
      const raw = fs.readFileSync(indexPath, 'utf-8')
      const index = JSON.parse(raw)
      if (Array.isArray(index.entries)) {
        const before = index.entries.length
        index.entries = index.entries.filter(
          (e: { sessionId?: string }) => e.sessionId !== sessionId
        )
        if (index.entries.length < before) {
          fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8')
          deleted.push(`${indexPath} (removed entry)`)
        }
      }
    } catch (e) {
      errors.push(`sessions-index.json: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { deleted, errors }
}
