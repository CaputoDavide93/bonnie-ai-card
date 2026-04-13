import type { AuthResponse, Session, SessionDetail } from './types.js'

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

/** Build SSE URL — bearer passed as query param because EventSource can't set headers */
export function streamUrl(baseUrl: string, token: string, turnId: string): string {
  const url = new URL(`${baseUrl}/api/stream/${turnId}`)
  url.searchParams.set('bearer', token)
  return url.toString()
}
