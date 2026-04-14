import type { AuthResponse, ConversationTemplate, Session, SessionDetail, UploadResponse, Plugin } from './types.js'
export type { Session, Plugin }

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  url: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...fetchOptions } = options
  const headers = new Headers(fetchOptions.headers ?? {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Content-Type') && fetchOptions.body) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(url, { ...fetchOptions, headers })
  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status} ${res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function kioskExchange(
  baseUrl: string,
  kioskToken: string,
): Promise<AuthResponse> {
  return request<AuthResponse>(`${baseUrl}/api/auth/kiosk-exchange`, {
    method: 'POST',
    body: JSON.stringify({ kiosk_token: kioskToken }),
  })
}

export async function listSessions(baseUrl: string, token: string): Promise<Session[]> {
  return request<Session[]>(`${baseUrl}/api/sessions`, { token })
}

export async function createSession(
  baseUrl: string,
  token: string,
  title: string,
): Promise<Session> {
  return request<Session>(`${baseUrl}/api/sessions`, {
    method: 'POST',
    token,
    body: JSON.stringify({ title }),
  })
}

export async function renameSession(
  baseUrl: string,
  token: string,
  sessionId: string,
  title: string,
): Promise<Session> {
  return request<Session>(`${baseUrl}/api/sessions/${sessionId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ title }),
  })
}

export async function getSession(
  baseUrl: string,
  token: string,
  sessionId: string,
): Promise<SessionDetail> {
  return request<SessionDetail>(`${baseUrl}/api/sessions/${sessionId}`, { token })
}

export async function deleteSession(
  baseUrl: string,
  token: string,
  sessionId: string,
): Promise<void> {
  return request<void>(`${baseUrl}/api/sessions/${sessionId}`, {
    method: 'DELETE',
    token,
  })
}

export async function postChat(
  baseUrl: string,
  token: string,
  conversationId: string,
  message: string,
  model?: string,
  attachmentPaths?: string[],
): Promise<{ turn_id: string }> {
  return request<{ turn_id: string }>(`${baseUrl}/api/chat`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      conversation_id: conversationId,
      message,
      ...(model ? { model } : {}),
      ...(attachmentPaths?.length ? { attachment_paths: attachmentPaths } : {}),
    }),
  })
}

export async function cancelStream(
  baseUrl: string,
  token: string,
  turnId: string,
): Promise<void> {
  try {
    await request<void>(`${baseUrl}/api/stream/${turnId}`, {
      method: 'DELETE',
      token,
    })
  } catch {
    // Best-effort cancel; ignore errors
  }
}

/**
 * Request a short-lived single-use SSE ticket for the given turn.
 * The ticket is used instead of a bearer token in the SSE URL so that
 * long-lived session tokens never appear in server access logs.
 */
export async function requestStreamTicket(
  baseUrl: string,
  token: string,
  turnId: string,
): Promise<string> {
  const res = await request<{ ticket: string }>(`${baseUrl}/api/stream-ticket`, {
    method: 'POST',
    token,
    body: JSON.stringify({ turn_id: turnId }),
  })
  return res.ticket
}

/** Build SSE URL using a pre-fetched ticket (preferred) or bearer fallback.
 *
 * Security note: the `bearer` fallback puts the long-lived session token in
 * the query string, which means it can appear in server access logs and
 * browser history. This path only exists for EventSource compatibility on
 * backends that don't yet support the /stream-ticket endpoint. Always prefer
 * the ticket path (useTicket=true) in production.
 */
export function streamUrl(baseUrl: string, ticketOrToken: string, turnId: string, useTicket = false): string {
  const url = new URL(`${baseUrl}/api/stream/${turnId}`)
  if (useTicket) {
    url.searchParams.set('ticket', ticketOrToken)
  } else {
    url.searchParams.set('bearer', ticketOrToken)
  }
  return url.toString()
}

/** Update the session title (used for auto-titling from first user message) */
export async function updateSessionTitle(
  baseUrl: string,
  token: string,
  sessionId: string,
  title: string,
): Promise<void> {
  try {
    await request<unknown>(`${baseUrl}/api/sessions/${sessionId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ title }),
    })
  } catch {
    // Best-effort — don't break the chat flow on title update failure
  }
}

/** Upload a file (image, PDF, text); returns the server-assigned upload metadata */
export async function uploadImage(
  baseUrl: string,
  token: string,
  file: File,
): Promise<UploadResponse> {
  const form = new FormData()
  form.append('file', file)
  // Do NOT set Content-Type — browser sets it with the multipart boundary
  const headers = new Headers()
  headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${baseUrl}/api/uploads`, {
    method: 'POST',
    headers,
    body: form,
  })
  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<UploadResponse>
}

/** Alias for uploadImage — accepts images, PDFs, and text files */
export const uploadFile = uploadImage

/** Delete an uploaded file (best-effort) */
export async function deleteUpload(
  baseUrl: string,
  token: string,
  uploadId: string,
): Promise<void> {
  try {
    const headers = new Headers({ Authorization: `Bearer ${token}` })
    await fetch(`${baseUrl}/api/uploads/${uploadId}`, { method: 'DELETE', headers })
  } catch {
    // Best-effort — ignore errors
  }
}

/** Fork a conversation from a given turn, creating a new session */
export async function forkSession(
  baseUrl: string,
  token: string,
  convId: string,
  fromTurnId: string,
  newMessage: string,
): Promise<{ session_id: string; turn_id: string }> {
  return request<{ session_id: string; turn_id: string }>(
    `${baseUrl}/api/sessions/${convId}/fork`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ from_turn_id: fromTurnId, new_message: newMessage }),
    },
  )
}

/** PATCH session flags (pinned, archived, title, system_prompt) */
export async function patchSession(
  baseUrl: string,
  token: string,
  sessionId: string,
  patch: { pinned?: boolean; archived?: boolean; title?: string; system_prompt?: string | null },
): Promise<Session> {
  return request<Session>(`${baseUrl}/api/sessions/${sessionId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(patch),
  })
}

/** List sessions — optionally show archived ones */
export async function listSessionsArchived(
  baseUrl: string,
  token: string,
): Promise<Session[]> {
  return request<Session[]>(`${baseUrl}/api/sessions?archived=true`, { token })
}

/** Update the session system prompt (pass null/empty to clear) */
export async function updateSessionSystemPrompt(
  baseUrl: string,
  token: string,
  sessionId: string,
  systemPrompt: string | null,
): Promise<void> {
  try {
    await request<unknown>(`${baseUrl}/api/sessions/${sessionId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ system_prompt: systemPrompt ?? '' }),
    })
  } catch {
    // Best-effort
  }
}

/** Search messages within a conversation */
export async function searchSession(
  baseUrl: string,
  token: string,
  sessionId: string,
  query: string,
): Promise<{ turn_id: string; snippet: string; role: string }[]> {
  const url = new URL(`${baseUrl}/api/sessions/${sessionId}/search`)
  url.searchParams.set('q', query)
  return request<{ turn_id: string; snippet: string; role: string }[]>(url.toString(), { token })
}

/** Fetch conversation templates (public, no auth required) */
export async function fetchTemplates(baseUrl: string): Promise<ConversationTemplate[]> {
  try {
    return await request<ConversationTemplate[]>(`${baseUrl}/api/templates`)
  } catch {
    return []
  }
}

// ── User settings ────────────────────────────────────────────────────────────

export interface UserSettings {
  tone?: string
  language?: string
  model?: string
  personas?: { id: string; name: string; prompt: string }[]
  active_persona_id?: string
  auto_delete_days?: number
}

export async function fetchSettings(baseUrl: string, token: string): Promise<UserSettings> {
  return request<UserSettings>(`${baseUrl}/api/settings`, { token })
}

export async function patchSettings(
  baseUrl: string,
  token: string,
  patch: Partial<UserSettings>,
): Promise<UserSettings> {
  return request<UserSettings>(`${baseUrl}/api/settings`, {
    method: 'PUT',
    token,
    body: JSON.stringify(patch),
  })
}

// ── Analytics (admin only) ────────────────────────────────────────────────────

export interface AuditStats {
  total_turns: number
  total_cost_usd: number
  avg_duration_ms: number
  per_user: { user_id: string; turns: number; cost_usd: number }[]
}

export interface AuditDailyEntry {
  date: string
  turns: number
  cost: number
}

export async function fetchAuditStats(baseUrl: string, token: string): Promise<AuditStats> {
  return request<AuditStats>(`${baseUrl}/api/admin/audit/stats`, { token })
}

export async function fetchAuditDaily(
  baseUrl: string,
  token: string,
  days = 7,
): Promise<AuditDailyEntry[]> {
  return request<AuditDailyEntry[]>(`${baseUrl}/api/admin/audit/daily?days=${days}`, { token })
}

// ── Memories (Feature 6) ──────────────────────────────────────────────────────

export interface Memory {
  id: string
  user_id: string
  key: string
  value: string
  source: 'user' | 'inferred'
  created_at: number
  updated_at: number
}

export async function listMemories(baseUrl: string, token: string): Promise<Memory[]> {
  return request<Memory[]>(`${baseUrl}/api/memories`, { token })
}

export async function deleteMemory(baseUrl: string, token: string, memoryId: string): Promise<void> {
  return request<void>(`${baseUrl}/api/memories/${memoryId}`, { method: 'DELETE', token })
}

export async function createMemory(baseUrl: string, token: string, key: string, value: string): Promise<Memory> {
  return request<Memory>(`${baseUrl}/api/memories`, {
    method: 'POST',
    token,
    body: JSON.stringify({ key, value }),
  })
}

export async function searchMemories(baseUrl: string, token: string, q: string): Promise<Memory[]> {
  const url = new URL(`${baseUrl}/api/memories/search`)
  url.searchParams.set('q', q)
  return request<Memory[]>(url.toString(), { token })
}

// ── Plugins (Feature 12) ──────────────────────────────────────────────────────

export async function listPlugins(baseUrl: string, token: string): Promise<Plugin[]> {
  return request<Plugin[]>(`${baseUrl}/api/plugins`, { token })
}

export interface PluginCreate {
  name: string
  description: string
  endpoint: string
  method?: string
  auth_header?: string
  example_payload?: string
  enabled?: boolean
}

export async function createPlugin(baseUrl: string, token: string, data: PluginCreate): Promise<Plugin> {
  return request<Plugin>(`${baseUrl}/api/plugins`, {
    method: 'POST',
    token,
    body: JSON.stringify(data),
  })
}

export interface PluginUpdate {
  name?: string
  description?: string
  endpoint?: string
  method?: string
  auth_header?: string
  example_payload?: string
  enabled?: boolean
}

export async function updatePlugin(baseUrl: string, token: string, pluginId: string, data: PluginUpdate): Promise<Plugin> {
  return request<Plugin>(`${baseUrl}/api/plugins/${pluginId}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(data),
  })
}

export async function deletePlugin(baseUrl: string, token: string, pluginId: string): Promise<void> {
  return request<void>(`${baseUrl}/api/plugins/${pluginId}`, {
    method: 'DELETE',
    token,
  })
}

/** Respond to a permission request */
export async function respondPermission(
  baseUrl: string,
  token: string,
  turnId: string,
  approved: boolean,
): Promise<void> {
  try {
    await request<unknown>(`${baseUrl}/api/permission/${turnId}`, {
      method: 'POST',
      token,
      body: JSON.stringify({ approved }),
    })
  } catch {
    // Best-effort
  }
}

// ── User admin (admin only) ──────────────────────────────────────────────────

export interface UserView {
  id: string
  username: string
  role: { id: string; name: string } | null
  created_at: number
}

export interface RoleView {
  id: string
  name: string
  is_builtin: boolean
}

export async function listUsers(baseUrl: string, token: string): Promise<UserView[]> {
  return request<UserView[]>(`${baseUrl}/api/users`, { token })
}

export async function createUser(baseUrl: string, token: string, data: { username: string; password: string; role_id: string }): Promise<UserView> {
  return request<UserView>(`${baseUrl}/api/users`, { method: 'POST', token, body: JSON.stringify(data) })
}

export async function deleteUser(baseUrl: string, token: string, userId: string): Promise<void> {
  return request<void>(`${baseUrl}/api/users/${userId}`, { method: 'DELETE', token })
}

export async function changePassword(baseUrl: string, token: string, userId: string, password: string): Promise<void> {
  return request<void>(`${baseUrl}/api/users/${userId}/password`, { method: 'POST', token, body: JSON.stringify({ password }) })
}

export async function listRoles(baseUrl: string, token: string): Promise<RoleView[]> {
  return request<RoleView[]>(`${baseUrl}/api/roles`, { token })
}

// ── Proactive Rules (admin only) ────────────────────────────────────────────

export interface ProactiveRule {
  id: string
  name: string
  entity_id: string
  condition: string
  threshold: string
  message_template: string
  enabled: boolean
}

export async function listProactiveRules(baseUrl: string, token: string): Promise<ProactiveRule[]> {
  return request<ProactiveRule[]>(`${baseUrl}/api/proactive-rules`, { token })
}

export async function createProactiveRule(
  baseUrl: string,
  token: string,
  rule: Omit<ProactiveRule, 'id'>,
): Promise<ProactiveRule> {
  return request<ProactiveRule>(`${baseUrl}/api/proactive-rules`, {
    method: 'POST',
    token,
    body: JSON.stringify(rule),
  })
}

export async function updateProactiveRule(
  baseUrl: string,
  token: string,
  id: string,
  patch: Partial<ProactiveRule>,
): Promise<ProactiveRule> {
  return request<ProactiveRule>(`${baseUrl}/api/proactive-rules/${id}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(patch),
  })
}

export async function deleteProactiveRule(
  baseUrl: string,
  token: string,
  id: string,
): Promise<void> {
  return request<void>(`${baseUrl}/api/proactive-rules/${id}`, {
    method: 'DELETE',
    token,
  })
}
