export const IPC_CHANNELS = {
  SESSIONS_LIST: 'sessions:list',
  SESSION_LOAD: 'session:load',
  SESSION_LOAD_RAW: 'session:load-raw',
  SESSION_EXPORT: 'session:export',
  SESSION_EXPORT_MD: 'session:export-md',
  SESSION_RENAME: 'session:rename',
  SESSION_DELETE: 'session:delete',
  SESSION_INSIGHTS: 'session:insights',
  SESSION_INSIGHTS_DATA: 'session:insights-data',
  SESSION_MODEL_USAGE: 'session:model-usage',
  GLOBAL_STATS: 'stats:global',
  CROSS_SEARCH: 'search:cross-session',
  SUBAGENTS_LIST: 'subagents:list',
  SUBAGENT_LOAD: 'subagent:load',
  OPEN_IN_CLAUDE: 'session:open-in-claude',
  OPEN_EXTERNAL: 'shell:open-external',
  SHOW_IN_FOLDER: 'shell:show-in-folder',
  OPEN_FOLDER: 'shell:open-folder',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE_TOGGLE: 'window:maximize-toggle',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',
  // OpenCode channels (NEW)
  OPENCODE_SESSIONS_LIST: 'opencode:sessions-list',
  OPENCODE_SESSION_LOAD: 'opencode:session-load',
  OPENCODE_DETECT_DB: 'opencode:detect-db',
  OPENCODE_SESSION_DELETE: 'opencode:session-delete',
  OPENCODE_CROSS_SEARCH: 'opencode:cross-search',
  OPENCODE_GLOBAL_STATS: 'opencode:global-stats',
  OPENCODE_SESSION_TODOS: 'opencode:session-todos',
  // Codex channels (NEW)
  CODEX_DETECT_HOME: 'codex:detect-home',
  CODEX_SESSIONS_LIST: 'codex:sessions-list',
  CODEX_SESSION_LOAD: 'codex:session-load',
  CODEX_SESSION_DELETE: 'codex:session-delete',
  CODEX_GLOBAL_STATS: 'codex:global-stats',
  SETTINGS_LOAD: 'settings:load',
  SETTINGS_SAVE: 'settings:save'
} as const

/** Union of session data sources */
export type SessionSource = 'claude' | 'opencode' | 'codex'
