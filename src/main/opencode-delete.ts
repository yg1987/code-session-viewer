/**
 * OpenCode session deletion.
 * Deletes a session and all associated messages and parts from the SQLite database.
 * Uses sql.js — the database is loaded into memory, mutated, then saved back to disk.
 */

import { getOpenCodeDbWritable, saveOpenCodeDb, closeOpenCodeDb } from './opencode-db'

export async function deleteOpenCodeSession(dbPath: string, sessionId: string): Promise<boolean> {
  try {
    const db = await getOpenCodeDbWritable(dbPath)

    // Check session exists
    const check = db.exec('SELECT id FROM session WHERE id = ?', [sessionId])
    if (!check.length || !check[0].values.length) {
      return false
    }

    // Delete messages and parts
    // First get message IDs for this session
    const msgs = db.exec('SELECT id FROM message WHERE session_id = ?', [sessionId])
    const msgIds: string[] = []
    if (msgs.length > 0 && msgs[0].values) {
      for (const row of msgs[0].values) {
        msgIds.push(row[0] as string)
      }
    }

    // Delete parts for each message
    for (const mid of msgIds) {
      db.run('DELETE FROM part WHERE message_id = ?', [mid])
    }

    // Delete messages
    db.run('DELETE FROM message WHERE session_id = ?', [sessionId])

    // Delete session
    db.run('DELETE FROM session WHERE id = ?', [sessionId])

    // Persist to disk
    saveOpenCodeDb()

    return true
  } catch (err) {
    console.error('Failed to delete OpenCode session:', err)
    return false
  } finally {
    closeOpenCodeDb()
  }
}
