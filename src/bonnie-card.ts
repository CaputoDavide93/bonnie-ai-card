// bonnie-ai-card — native HA Lovelace card for Bonnie AI Chat
console.info(
  '%c bonnie-ai-card %c v0.1.0 ',
  'color: white; background: #E8A04C; font-weight: 700;',
  'color: #E8A04C; background: white; font-weight: 700;',
)
;(window as any).customCards = (window as any).customCards || []
;(window as any).customCards.push({
  type: 'bonnie-ai-card',
  name: 'Bonnie AI Card',
  description: 'Chat with a Claude Code / Bonnie backend from Home Assistant',
})

import { LitElement, html, nothing, type TemplateResult } from 'lit'
import { property, state } from 'lit/decorators.js'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import { classMap } from 'lit/directives/class-map.js'

import type { BonnieCardConfig, Session, Bubble, SseEvent } from './types.js'
import {
  ApiError,
  kioskExchange,
  listSessions,
  createSession,
  getSession,
  deleteSession,
  postChat,
  cancelStream,
  streamUrl,
} from './api.js'
import { renderMarkdown } from './markdown.js'
import { cardStyles } from './styles.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2)
}

function truncate(val: unknown, max = 2000): string {
  const s = typeof val === 'string' ? val : JSON.stringify(val, null, 2)
  return s.length > max ? s.slice(0, max) + '…' : s
}

// ── Custom element ─────────────────────────────────────────────────────────

export class BonnieCard extends LitElement {
  static styles = cardStyles

  // ── Lovelace API ─────────────────────────────────────────────────────────

  @property({ attribute: false }) config!: BonnieCardConfig

  setConfig(config: BonnieCardConfig): void {
    if (!config.backend_url) throw new Error('bonnie-ai-card: backend_url is required')
    if (!config.kiosk_token) throw new Error('bonnie-ai-card: kiosk_token is required')
    this.config = config
    // Apply height as CSS custom property
    if (config.height !== undefined) {
      const h = typeof config.height === 'number' ? `${config.height}px` : config.height
      this.style.setProperty('--bonnie-card-height', h)
    }
  }

  getCardSize(): number {
    return 6
  }

  // ── Internal state ────────────────────────────────────────────────────────

  @state() private sessionToken: string | null = null
  @state() private sessions: Session[] = []
  @state() private activeSessionId: string | null = null
  @state() private bubbles: Bubble[] = []
  @state() private streamingTurnId: string | null = null
  @state() private draft = ''
  @state() private sidebarOpen = false
  @state() private authError = false
  @state() private loading = true
  @state() private errorMessage: string | null = null
  @state() private isWide = false

  private _eventSource: EventSource | null = null
  private _resizeObserver: ResizeObserver | null = null

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  override connectedCallback(): void {
    super.connectedCallback()
    this._bootstrap()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this._closeStream()
    this._resizeObserver?.disconnect()
  }

  override firstUpdated(): void {
    this._setupResizeObserver()
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  private async _bootstrap(): Promise<void> {
    this.loading = true
    this.authError = false
    this.errorMessage = null
    try {
      const auth = await kioskExchange(this.config.backend_url, this.config.kiosk_token)
      this.sessionToken = auth.session_token
      await this._loadSessions()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        this.authError = true
      } else {
        this.errorMessage = `Could not connect to Bonnie backend: ${(e as Error).message}`
      }
    } finally {
      this.loading = false
    }
  }

  private async _loadSessions(): Promise<void> {
    if (!this.sessionToken) return
    try {
      this.sessions = await listSessions(this.config.backend_url, this.sessionToken)
    } catch (e) {
      this._handleApiError(e)
    }
  }

  // ── Session actions ───────────────────────────────────────────────────────

  private async _openSession(id: string): Promise<void> {
    if (!this.sessionToken) return
    this._closeStream()
    this.activeSessionId = id
    this.bubbles = []
    this.sidebarOpen = false
    try {
      const detail = await getSession(this.config.backend_url, this.sessionToken, id)
      this.bubbles = this._turnsToBubbles(detail.turns)
      this._scrollBottom()
    } catch (e) {
      this._handleApiError(e)
    }
  }

  private async _newSession(): Promise<void> {
    if (!this.sessionToken) return
    this._closeStream()
    this.sidebarOpen = false
    try {
      const ts = new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
      const session = await createSession(
        this.config.backend_url,
        this.sessionToken,
        `Chat ${ts}`,
      )
      this.sessions = [session, ...this.sessions]
      this.activeSessionId = session.id
      this.bubbles = []
    } catch (e) {
      this._handleApiError(e)
    }
  }

  private _turnsToBubbles(turns: any[]): Bubble[] {
    const out: Bubble[] = []
    for (const turn of turns) {
      if (!Array.isArray(turn.content)) continue
      for (const block of turn.content) {
        if (block.type === 'text') {
          out.push({ id: uid(), role: turn.role === 'user' ? 'user' : 'assistant', text: block.text })
        } else if (block.type === 'tool_use') {
          out.push({
            id: uid(),
            role: 'tool',
            toolName: block.name,
            toolInput: block.input,
          })
        } else if (block.type === 'tool_result') {
          // Append result to the most recent matching tool bubble
          const match = [...out].reverse().find((b) => b.role === 'tool' && !b.toolResult)
          if (match) {
            match.toolResult = block.content
          }
        }
      }
    }
    return out
  }

  // ── Chat / stream ─────────────────────────────────────────────────────────

  private async _send(): Promise<void> {
    const text = this.draft.trim()
    if (!text || !this.sessionToken || !this.activeSessionId || this.streamingTurnId) return

    this.draft = ''
    this._resetTextarea()

    // Add user bubble immediately
    this.bubbles = [...this.bubbles, { id: uid(), role: 'user', text }]
    this._scrollBottom()

    try {
      const { turn_id } = await postChat(
        this.config.backend_url,
        this.sessionToken,
        this.activeSessionId,
        text,
        this.config.model,
      )
      this.streamingTurnId = turn_id
      this._openStream(turn_id)
    } catch (e) {
      this._handleApiError(e)
      this.streamingTurnId = null
    }
  }

  private _openStream(turnId: string): void {
    this._closeStream()
    const url = streamUrl(this.config.backend_url, this.sessionToken!, turnId)
    const es = new EventSource(url)
    this._eventSource = es

    // Current streaming assistant bubble id
    let currentAssistantId: string | null = null
    let currentToolId: string | null = null

    es.addEventListener('event', (e: MessageEvent) => {
      let parsed: SseEvent
      try {
        parsed = JSON.parse(e.data) as SseEvent
      } catch {
        return
      }

      if (parsed.type === 'assistant') {
        for (const block of parsed.message.content) {
          if (block.type === 'text') {
            if (!currentAssistantId) {
              const bubble: Bubble = { id: uid(), role: 'assistant', text: '', streaming: true }
              currentAssistantId = bubble.id
              this.bubbles = [...this.bubbles, bubble]
            }
            this.bubbles = this.bubbles.map((b) =>
              b.id === currentAssistantId
                ? { ...b, text: (b.text ?? '') + block.text }
                : b,
            )
            this._scrollBottom()
          } else if (block.type === 'tool_use') {
            // Finalize previous assistant bubble
            if (currentAssistantId) {
              this.bubbles = this.bubbles.map((b) =>
                b.id === currentAssistantId ? { ...b, streaming: false } : b,
              )
              currentAssistantId = null
            }
            const toolBubble: Bubble = {
              id: uid(),
              role: 'tool',
              toolName: block.name,
              toolInput: block.input,
            }
            currentToolId = toolBubble.id
            this.bubbles = [...this.bubbles, toolBubble]
            this._scrollBottom()
          }
        }
      } else if (parsed.type === 'user') {
        for (const block of parsed.message.content) {
          if (block.type === 'tool_result' && currentToolId) {
            this.bubbles = this.bubbles.map((b) =>
              b.id === currentToolId ? { ...b, toolResult: block.content } : b,
            )
            currentToolId = null
          }
        }
      } else if (parsed.type === 'result') {
        // Finalize streaming bubbles
        this.bubbles = this.bubbles.map((b) =>
          b.streaming ? { ...b, streaming: false, error: parsed.subtype === 'error' } : b,
        )
        this._finishStream()
      }
    })

    es.addEventListener('done', () => {
      this.bubbles = this.bubbles.map((b) =>
        b.streaming ? { ...b, streaming: false } : b,
      )
      this._finishStream()
    })

    es.onerror = () => {
      this.bubbles = this.bubbles.map((b) =>
        b.streaming
          ? { ...b, streaming: false, error: true, text: (b.text || '') + '\n\n[Connection error]' }
          : b,
      )
      this._finishStream()
    }
  }

  private _finishStream(): void {
    this._closeStream()
    this.streamingTurnId = null
    // Refresh sessions list to update titles
    void this._loadSessions()
  }

  private _closeStream(): void {
    if (this._eventSource) {
      this._eventSource.close()
      this._eventSource = null
    }
  }

  private async _cancel(): Promise<void> {
    if (!this.streamingTurnId || !this.sessionToken) return
    const tid = this.streamingTurnId
    this._closeStream()
    this.streamingTurnId = null
    this.bubbles = this.bubbles.map((b) =>
      b.streaming ? { ...b, streaming: false } : b,
    )
    await cancelStream(this.config.backend_url, this.sessionToken, tid)
  }

  // ── Error handling ────────────────────────────────────────────────────────

  private _handleApiError(e: unknown): void {
    if (e instanceof ApiError && e.status === 401) {
      this.authError = true
    } else {
      this.errorMessage = (e as Error).message
    }
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────

  private _scrollBottom(): void {
    requestAnimationFrame(() => {
      const msgs = this.shadowRoot?.querySelector('.messages')
      if (msgs) msgs.scrollTop = msgs.scrollHeight
    })
  }

  private _resetTextarea(): void {
    const ta = this.shadowRoot?.querySelector<HTMLTextAreaElement>('.composer-textarea')
    if (ta) {
      ta.value = ''
      ta.style.height = 'auto'
    }
  }

  private _setupResizeObserver(): void {
    const card = this.shadowRoot?.querySelector('.bonnie-card')
    if (!card) return
    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.isWide = entry.contentRect.width >= 640
        // In wide mode, close overlay drawer
        if (this.isWide) this.sidebarOpen = false
      }
    })
    this._resizeObserver.observe(card)
  }

  // ── Textarea events ───────────────────────────────────────────────────────

  private _onInput(e: Event): void {
    const ta = e.target as HTMLTextAreaElement
    this.draft = ta.value
    // Manual auto-resize fallback (for browsers not supporting field-sizing: content)
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }

  private _onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void this._send()
    } else if (e.key === 'Escape' && this.streamingTurnId) {
      void this._cancel()
    }
  }

  // ── Toggle tool result ────────────────────────────────────────────────────

  private _toggleTool(id: string): void {
    this.bubbles = this.bubbles.map((b) =>
      b.id === id ? { ...b, toolResultExpanded: !b.toolResultExpanded } : b,
    )
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  private _renderBubble(b: Bubble): TemplateResult {
    if (b.role === 'tool') return this._renderToolBubble(b)

    const isUser = b.role === 'user'
    const html_ = isUser
      ? nothing
      : unsafeHTML(renderMarkdown(b.text ?? ''))

    return html`
      <div class=${classMap({ 'bubble-row': true, [b.role]: true })}>
        <div class=${classMap({ bubble: true, [b.role]: true, error: !!b.error })}>
          ${isUser ? b.text : html`${html_}${b.streaming ? html`<span class="cursor"></span>` : nothing}`}
        </div>
      </div>
    `
  }

  private _renderToolBubble(b: Bubble): TemplateResult {
    const expanded = !!b.toolResultExpanded
    return html`
      <div class="bubble-row tool">
        <div class="tool-bubble">
          <div class="tool-header" @click=${() => this._toggleTool(b.id)}>
            <span class="tool-icon"
              >${svgWrench()}</span
            >
            <span class="tool-name">${b.toolName ?? 'tool'}</span>
            <span class=${classMap({ 'tool-chevron': true, expanded })}>${svgChevron()}</span>
          </div>
          <div class=${classMap({ 'tool-body': true, visible: expanded })}>
            <p class="tool-section-label">Input</p>
            <pre class="tool-pre">${truncate(b.toolInput)}</pre>
            ${b.toolResult !== undefined
              ? html`<p class="tool-section-label">Result</p>
                  <pre class="tool-pre">${truncate(b.toolResult)}</pre>`
              : nothing}
          </div>
        </div>
      </div>
    `
  }

  private _renderSidebarContent(): TemplateResult {
    return html`
      <div class="session-list">
        ${this.sessions.length === 0
          ? html`<div class="session-empty">No conversations yet</div>`
          : this.sessions.map(
              (s) => html`
                <div
                  class=${classMap({
                    'session-item': true,
                    active: s.id === this.activeSessionId,
                  })}
                  @click=${() => this._openSession(s.id)}
                >
                  ${s.title || 'Untitled'}
                </div>
              `,
            )}
      </div>
    `
  }

  // ── Main render ───────────────────────────────────────────────────────────

  override render(): TemplateResult {
    if (this.authError) {
      return html`
        <ha-card>
          <div class="bonnie-card">
            <div class="error-banner">Session expired or invalid token. Reload the card.</div>
          </div>
        </ha-card>
      `
    }

    const title = this.config?.title ?? 'Bonnie AI Chat'
    const isStreaming = !!this.streamingTurnId
    const canSend = !!this.draft.trim() && !isStreaming && !!this.activeSessionId

    return html`
      <ha-card>
        <div class="bonnie-card">
          <!-- Error banner -->
          ${this.errorMessage
            ? html`<div class="error-banner">${this.errorMessage}</div>`
            : nothing}

          <!-- Header -->
          <div class="header">
            ${!this.isWide
              ? html`<button class="icon-btn" @click=${() => (this.sidebarOpen = !this.sidebarOpen)} title="Sessions">
                  ${svgMenu()}
                </button>`
              : nothing}
            <span class="header-title">${title}</span>
            <button class="icon-btn" @click=${this._newSession} title="New conversation">
              ${svgPlus()}
            </button>
          </div>

          <!-- Body -->
          <div class="body">
            <!-- Wide-mode sidebar -->
            ${this.isWide
              ? html`
                  <div class="sidebar">
                    <div class="sidebar-header">Conversations</div>
                    ${this._renderSidebarContent()}
                  </div>
                `
              : nothing}

            <!-- Narrow-mode drawer overlay -->
            ${!this.isWide
              ? html`
                  <div
                    class=${classMap({ 'sidebar-overlay': true, visible: this.sidebarOpen })}
                    @click=${() => (this.sidebarOpen = false)}
                  ></div>
                  <div class=${classMap({ 'sidebar-drawer': true, open: this.sidebarOpen })}>
                    <div class="drawer-header">
                      <span class="drawer-title">Conversations</span>
                      <button class="icon-btn" @click=${() => (this.sidebarOpen = false)}>
                        ${svgClose()}
                      </button>
                    </div>
                    ${this._renderSidebarContent()}
                  </div>
                `
              : nothing}

            <!-- Chat pane -->
            <div class="chat-pane">
              ${this.loading
                ? html`<div class="loading-state"><div class="loading-spinner"></div></div>`
                : !this.activeSessionId
                  ? html`
                      <div class="messages">
                        <div class="empty-state">
                          <div class="empty-icon">${svgChat()}</div>
                          <div class="empty-text">Start a new conversation with Bonnie</div>
                          <button class="start-btn" @click=${this._newSession}>
                            New conversation
                          </button>
                        </div>
                      </div>
                    `
                  : html`
                      <div class="messages">
                        ${this.bubbles.length === 0
                          ? html`<div class="empty-state">
                              <div class="empty-icon">${svgChat()}</div>
                              <div class="empty-text">Type a message to get started</div>
                            </div>`
                          : this.bubbles.map((b) => this._renderBubble(b))}
                      </div>
                    `}

              <!-- Composer -->
              <div class="composer">
                <textarea
                  class="composer-textarea"
                  rows="1"
                  placeholder=${this.activeSessionId ? 'Message Bonnie…' : 'Select or start a conversation'}
                  .value=${this.draft}
                  ?disabled=${!this.activeSessionId || this.loading}
                  @input=${this._onInput}
                  @keydown=${this._onKeydown}
                ></textarea>
                <button
                  class=${classMap({ 'send-btn': true, stop: isStreaming })}
                  ?disabled=${!isStreaming && !canSend}
                  @click=${isStreaming ? this._cancel : this._send}
                  title=${isStreaming ? 'Stop' : 'Send'}
                >
                  ${isStreaming ? svgStop() : svgSend()}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ha-card>
    `
  }
}

// ── SVG icons (inline, no external dep) ───────────────────────────────────

function svgMenu(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`
}

function svgPlus(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
}

function svgClose(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
}

function svgSend(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`
}

function svgStop(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`
}

function svgWrench(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`
}

function svgChevron(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>`
}

function svgChat(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
}

// ── Register custom element ────────────────────────────────────────────────

if (!customElements.get('bonnie-ai-card')) {
  customElements.define('bonnie-ai-card', BonnieCard)
}
