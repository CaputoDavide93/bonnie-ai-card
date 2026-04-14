// ── Card config ──────────────────────────────────────────────────────────────

export interface BonnieCardConfig {
  type: string
  backend_url: string
  kiosk_token: string
  title?: string
  height?: number | string
  model?: string
  locale?: string
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
  system_prompt?: string | null
  pinned?: number
  archived?: number
  created_at: string
  updated_at: string
}

export interface SearchResult {
  turn_id: string
  snippet: string
  role: string
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
  user_message: string
  events: Record<string, any>[]
  status: string
  created_at: number
  completed_at: number | null
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
  total_cost_usd?: number
  usage?: {
    input_tokens?: number
    output_tokens?: number
    cache_read_input_tokens?: number
  }
  duration_ms?: number
}

export interface SsePermissionEvent {
  type: 'permission_request'
  turn_id: string
  tool_name: string
  tool_description?: string
}

export type SseEvent = SseSystemEvent | SseAssistantEvent | SseUserEvent | SseResultEvent | SsePermissionEvent

// ── UI bubble types ───────────────────────────────────────────────────────────

export type BubbleRole = 'user' | 'assistant' | 'tool'

export interface TurnStats {
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  durationMs?: number
}

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
  /** Per-turn stats (populated on result event) */
  stats?: TurnStats
  /** Permission request pending for this assistant bubble's turn */
  permissionRequest?: { turnId: string; toolName: string; toolDescription?: string }
  /** Uploaded image attachments on user bubbles */
  attachments?: UploadedAttachment[]
  /** Source turn ID — used for message search scroll-to */
  turnId?: string
}

// ── API rename session ────────────────────────────────────────────────────────

export interface RenameSessionPayload {
  title: string
}

// ── Conversation template ─────────────────────────────────────────────────────

export interface ConversationTemplate {
  id: string
  name: string
  name_it: string
  icon: string
  prompt: string
}

// ── Upload attachment ─────────────────────────────────────────────────────────

export interface UploadResponse {
  upload_id: string
  filename: string
  path: string
  mime_type: string
  size: number
}

export interface UploadedAttachment {
  uploadId: string
  filename: string
  path: string        // /workspace/.bonnie-uploads/...
  mimeType: string
  size: number
  /** URL.createObjectURL of the original File — for preview thumbnail */
  localPreviewUrl: string
}

// ── Plugin ─────────────────────────────────────────────────────────────────

export interface Plugin {
  id: string
  name: string
  description: string
  endpoint: string
  method: string
  auth_header: string
  example_payload: string
  enabled: boolean
  created_at: number
  updated_at: number
}
