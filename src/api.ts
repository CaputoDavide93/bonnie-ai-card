import type { AuthResponse, Session, SessionDetail, UploadResponse } from './types.js'
export type { Session }

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
): Promise<{ turn_id: string }> {
  return request<{ turn_id: string }>(`${baseUrl}/api/chat`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      conversation_id: conversationId,
      message,
      ...(model ? { model } : {}),
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

/** Upload an image file; returns the server-assigned upload metadata */
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
