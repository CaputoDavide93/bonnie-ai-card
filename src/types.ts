// ── Card config ──────────────────────────────────────────────────────────────

export interface BonnieCardConfig {
  type: string
  backend_url: string
  kiosk_token: string
  title?: string
  height?: number | string
  model?: string
}

// ── API types ─────────────────────────────────────────────────────────────────

export interface AuthResponse {
  session_token: string
  user: unknown
}

export interface Session {
  id: string
  title: string
  claude_session_id: string | null
  created_at: string
  updated_at: string
}

export interface Turn {
  id: string
  role: 'user' | 'assistant' | 'tool_use' | 'tool_result'
  content: TurnContent[]
  created_at: string
}

export type TurnContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: unknown }

export interface SessionDetail extends Session {
  turns: RawTurn[]
}

// Raw turn shape returned from GET /api/sessions/{id}
export interface RawTurn {
  id: string
  role: string
  content: TurnContent[]
  created_at: string
}

// ── SSE event shapes ──────────────────────────────────────────────────────────

export interface SseSystemEvent {
  type: 'system'
  subtype: 'init'
  session_id: string
}

export interface SseAssistantEvent {
  type: 'assistant'
  message: {
    content: Array<
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; input: unknown }
    >
  }
}

export interface SseUserEvent {
  type: 'user'
  message: {
    content: Array<{ type: 'tool_result'; tool_use_id: string; content: unknown }>
  }
}

export interface SseResultEvent {
  type: 'result'
  subtype: 'success' | 'error'
  session_id: string
}

export type SseEvent = SseSystemEvent | SseAssistantEvent | SseUserEvent | SseResultEvent

// ── UI bubble types ───────────────────────────────────────────────────────────

export type BubbleRole = 'user' | 'assistant' | 'tool'

export interface Bubble {
  id: string
  role: BubbleRole
  /** For user/assistant: markdown text. For tool: not used. */
  text?: string
  toolName?: string
  toolInput?: unknown
  toolResult?: unknown
  toolResultExpanded?: boolean
  /** Accumulates during streaming */
  streaming?: boolean
  error?: boolean
  /** Animation state */
  isNew?: boolean
}

// ── API rename session ────────────────────────────────────────────────────────

export interface RenameSessionPayload {
  title: string
}
