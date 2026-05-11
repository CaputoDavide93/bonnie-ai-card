/**
 * Tests for src/api.ts — backend HTTP helpers.
 *
 * These are pure functions over fetch(); we spy on globalThis.fetch and
 * inspect the request shape. Covers regressions we've shipped fixes for:
 *  - cancelStream uses keepalive (S2.14)
 *  - kioskExchange / requestStreamTicket auth header shape
 *  - postChat body fields
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  cancelStream,
  kioskExchange,
  postChat,
  requestStreamTicket,
} from '../src/api'

let fetchSpy: ReturnType<typeof vi.spyOn>

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch')
})

afterEach(() => {
  fetchSpy.mockRestore()
})

describe('cancelStream — keepalive (S2.14)', () => {
  it('sends DELETE with keepalive=true so the cancel survives tab-close', async () => {
    fetchSpy.mockResolvedValue(mockResponse({}))

    await cancelStream('http://backend', 'session-tok', 'turn-abc')

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://backend/api/stream/turn-abc')
    expect(init.method).toBe('DELETE')
    expect(init.keepalive, 'keepalive missing — DELETE will be cancelled on tab-close').toBe(true)
    // request() builds the Authorization via Headers().set(...), so we
    // need .get() rather than dict access.
    const headers = init.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer session-tok')
  })

  it('swallows errors silently — best-effort cancel', async () => {
    fetchSpy.mockRejectedValue(new Error('network gone'))
    // Should not throw — observability comes from server-side logs.
    await expect(
      cancelStream('http://backend', 'session-tok', 'turn-xyz'),
    ).resolves.toBeUndefined()
  })
})

describe('requestStreamTicket', () => {
  it('returns the ticket string from the JSON body', async () => {
    fetchSpy.mockResolvedValue(mockResponse({ ticket: 'tkt-12345' }))

    const ticket = await requestStreamTicket('http://backend', 'sess', 'turn-1')

    expect(ticket).toBe('tkt-12345')
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://backend/api/stream-ticket')
    expect(init.method).toBe('POST')
    expect(init.body).toContain('turn_id')
  })
})

describe('kioskExchange', () => {
  it('POSTs the kiosk token in the body, not as a bearer', async () => {
    fetchSpy.mockResolvedValue(mockResponse({
      session_token: 'sess-new',
      user: { id: 'u1', role: { name: 'kiosk' } },
    }))

    const result = await kioskExchange('http://backend', 'KIOSK_URL_TOKEN')

    expect(result.session_token).toBe('sess-new')
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://backend/api/auth/kiosk-exchange')
    expect(init.method).toBe('POST')
    // The kiosk URL token must travel in the body, never as Authorization
    // (Authorization would imply it's a bearer — it isn't, it's a one-shot
    // exchange token).
    const headers = init.headers as Headers
    expect(headers.get('Authorization')).toBeNull()
    expect(init.body).toContain('KIOSK_URL_TOKEN')
  })
})

describe('postChat', () => {
  it('forwards model + attachment_paths only when provided', async () => {
    fetchSpy.mockResolvedValue(mockResponse({ turn_id: 'turn-9' }))

    await postChat('http://backend', 'sess', 'conv-1', 'hello', 'opus-4-7', ['/u/1.png'])

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://backend/api/chat')
    const body = JSON.parse(init.body as string)
    expect(body.message).toBe('hello')
    expect(body.model).toBe('opus-4-7')
    expect(body.attachment_paths).toEqual(['/u/1.png'])
  })

  it('omits model and attachment_paths when not provided (defaults applied server-side)', async () => {
    fetchSpy.mockResolvedValue(mockResponse({ turn_id: 'turn-10' }))

    await postChat('http://backend', 'sess', 'conv-1', 'hi')

    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(body.message).toBe('hi')
    expect(body.model).toBeUndefined()
    expect(body.attachment_paths).toBeUndefined()
  })

  it('raises ApiError on 401 so _handleApiError → _tryReauth fires (S2.13)', async () => {
    fetchSpy.mockResolvedValue(mockResponse({ detail: 'expired' }, 401))

    await expect(
      postChat('http://backend', 'expired-tok', 'conv-1', 'hi'),
    ).rejects.toMatchObject({ status: 401 })
  })
})
