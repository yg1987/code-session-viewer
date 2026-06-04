/**
 * OpenCode SQLite database access layer.
 * Uses sql.js (SQLite compiled to WASM, pure JS) — no native addon needed.
 * Manages the singleton connection to the opencode.db database,
 * providing auto-detection of the database file location across platforms.
 */

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'

let SQL: SqlJsStatic | null = null
let db: Database | null = null
let currentDbPath: string | null = null

/** Lazy-init the sql.js WASM runtime (called once) */
async function getSQL(): Promise<SqlJsStatic> {
  if (SQL) return SQL
  SQL = await initSqlJs()
  return SQL
}

/**
 * Detect the opencode.db path by checking common platform locations.
 * Returns the first existing path or the most likely default.
 */
export function detectOpenCodeDbPath(): string {
  const candidates: string[] = []

  if (process.platform === 'linux' || process.env['MSYSTEM'] || process.env['GIT_BASH']) {
    candidates.push(path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db'))
  }

  if (process.platform === 'win32') {
    candidates.push(path.join(os.homedir(), 'AppData', 'Local', 'opencode', 'opencode.db'))
  }

  if (process.platform === 'darwin') {
    candidates.push(path.join(os.homedir(), 'Library', 'Application Support', 'opencode', 'opencode.db'))
  }

  candidates.push(path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db'))
  candidates.push(path.join(os.homedir(), '.opencode', 'opencode.db'))

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return candidates[0] || path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db')
}

/**
 * Get (open if needed) the database connection for a given path.
 * Returns the sql.js Database instance.
 */
export async function getOpenCodeDb(dbPath: string): Promise<Database> {
  if (db && currentDbPath === dbPath) {
    return db
  }
  closeOpenCodeDb()
  const sql = await getSQL()
  const buffer = fs.readFileSync(dbPath)
  db = new sql.Database(buffer)
  currentDbPath = dbPath
  return db
}

/**
 * Open a writable connection for session deletion.
 */
export async function getOpenCodeDbWritable(dbPath: string): Promise<Database> {
  // sql.js databases are always writable in memory;
  // we need to save back to disk after mutation
  closeOpenCodeDb()
  const sql = await getSQL()
  const buffer = fs.readFileSync(dbPath)
  db = new sql.Database(buffer)
  currentDbPath = dbPath
  return db
}

/**
 * Persist the in-memory database back to disk.
 */
export function saveOpenCodeDb(): void {
  if (!db || !currentDbPath) return
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(currentDbPath, buffer)
}

/**
 * Close the database connection.
 */
export function closeOpenCodeDb(): void {
  if (db) {
    try { db.close() } catch { /* already closed */ }
    db = null
    currentDbPath = null
  }
}
