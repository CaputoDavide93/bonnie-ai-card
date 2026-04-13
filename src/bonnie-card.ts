// bonnie-ai-card — native HA Lovelace card for Bonnie AI Chat
console.info(
  '%c bonnie-ai-card %c v0.3.0 ',
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

import type { BonnieCardConfig, Session, Bubble, SseEvent, TurnStats } from './types.js'
import {
  ApiError,
  kioskExchange,
  listSessions,
  createSession,
  renameSession,
  getSession,
  deleteSession,
  postChat,
  cancelStream,
  streamUrl,
  updateSessionTitle,
  respondPermission,
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

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const now = Date.now()
  const diff = Math.floor((now - date.getTime()) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 2) return 'yesterday'
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const LS_SIDEBAR_KEY = 'bonnie-ai-card:sidebar-open'

// ── Custom element ─────────────────────────────────────────────────────────

export class BonnieCard extends LitElement {
  static styles = cardStyles

  // ── Lovelace API ─────────────────────────────────────────────────────────

  @property({ attribute: false }) config!: BonnieCardConfig

  setConfig(config: BonnieCardConfig): void {
    if (!config.backend_url) throw new Error('bonnie-ai-card: backend_url is required')
    if (!config.kiosk_token) throw new Error('bonnie-ai-card: kiosk_token is required')
    const isFirstConfig = !this.config
    this.config = config
    if (config.height !== undefined) {
      const h = typeof config.height === 'number' ? `${config.height}px` : config.height
      this.style.setProperty('--bonnie-card-height', h)
    }
    // If the element was already connected before setConfig was called (test harness case),
    // bootstrap now since connectedCallback skipped it
    if (isFirstConfig && this.isConnected) {
      this._bootstrap()
    }
  }

  getCardSize(): number {
    return 6
  }

  // ── Internal state ────────────────────────────────────────────────────────

  @state() private sessionToken: string | null = null
  @state() private sessions: Session[] = []
  @state() private filteredSessions: Session[] = []
  @state() private searchQuery = ''
  @state() private activeSessionId: string | null = null
  @state() private activeSessionTitle = ''
  @state() private bubbles: Bubble[] = []
  @state() private streamingTurnId: string | null = null
  @state() private draft = ''
  @state() private sidebarOpen = false
  @state() private authError = false
  @state() private loading = true
  @state() private sessionLoading = false
  @state() private errorMessage: string | null = null
  @state() private isWide = false
  @state() private showScrollToBottom = false
  @state() private confirmDeleteId: string | null = null
  @state() private renamingId: string | null = null
  @state() private renameValue = ''
  @state() private editingBubbleId: string | null = null
  @state() private editDraft = ''
  @state() private copiedMsgId: string | null = null
  @state() private charCount = 0
  @state() private showCharCount = false
  @state() private showKbHelp = false
  // Feature 5: voice input
  @state() private isListening = false
  @state() private hasSpeechRecognition = !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition
  // Feature 6: export menu
  @state() private showExportMenu = false
  // Feature 10: theme toggle (auto / dark / light)
  @state() private themeMode: 'auto' | 'dark' | 'light' = 'auto'
  // Permission requests
  @state() private activePermissionRequest: { turnId: string; toolName: string; toolDescription?: string } | null = null

  private _eventSource: EventSource | null = null
  private _resizeObserver: ResizeObserver | null = null
  private _userScrolled = false
  private _scrollTimeout: ReturnType<typeof setTimeout> | null = null
  private _lastUserMessageText = ''
  private _speechRecognition: any = null
  private _turnStartTime: number | null = null

  // Auto-title: regex to detect auto-generated session titles
  private static readonly AUTO_TITLE_RE = /^(?:New conversation|Chat \d{1,2} \w+ (?:at )?\d{1,2}:\d{2})$/

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  override connectedCallback(): void {
    super.connectedCallback()
    // Restore sidebar open state from localStorage
    try {
      const saved = localStorage.getItem(LS_SIDEBAR_KEY)
      if (saved !== null) this.sidebarOpen = saved === 'true'
    } catch {}
    // Restore theme preference
    try {
      const savedTheme = localStorage.getItem('bonnie-theme') as 'auto' | 'dark' | 'light' | null
      if (savedTheme && ['auto', 'dark', 'light'].includes(savedTheme)) {
        this.themeMode = savedTheme
      }
    } catch {}
    // Bootstrap only if config is already set (HA sets it before connecting;
    // in the test harness setConfig is called after — setConfig will trigger it)
    if (this.config) {
      this._bootstrap()
    }
    document.addEventListener('keydown', this._onGlobalKeydown)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this._closeStream()
    this._resizeObserver?.disconnect()
    document.removeEventListener('keydown', this._onGlobalKeydown)
    this._stopListening()
  }

  override firstUpdated(): void {
    this._setupResizeObserver()
    this._setupScrollListener()
    this._setupCodeCopyListeners()
  }

  override updated(changed: Map<string, unknown>): void {
    super.updated(changed)
    // Re-attach code copy listeners when bubbles change
    if (changed.has('bubbles')) {
      this._setupCodeCopyListeners()
    }
    if (changed.has('sidebarOpen')) {
      try {
        localStorage.setItem(LS_SIDEBAR_KEY, String(this.sidebarOpen))
      } catch {}
    }
    if (changed.has('sessions') || changed.has('searchQuery')) {
      this._filterSessions()
    }
    if (changed.has('themeMode')) {
      try {
        localStorage.setItem('bonnie-theme', this.themeMode)
      } catch {}
      this._applyTheme()
    }
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

  private _filterSessions(): void {
    const q = this.searchQuery.trim().toLowerCase()
    if (!q) {
      this.filteredSessions = this.sessions
    } else {
      this.filteredSessions = this.sessions.filter((s) =>
        (s.title || '').toLowerCase().includes(q)
      )
    }
  }

  // ── Theme ─────────────────────────────────────────────────────────────────

  private _applyTheme(): void {
    const host = this.shadowRoot?.host as HTMLElement | null
    if (!host) return
    if (this.themeMode === 'dark') {
      host.setAttribute('data-theme', 'dark')
    } else if (this.themeMode === 'light') {
      host.setAttribute('data-theme', 'light')
    } else {
      host.removeAttribute('data-theme')
    }
  }

  private _cycleTheme(): void {
    const next: Record<string, 'auto' | 'dark' | 'light'> = { auto: 'dark', dark: 'light', light: 'auto' }
    this.themeMode = next[this.themeMode]
  }

  // ── Session actions ───────────────────────────────────────────────────────

  private async _openSession(id: string): Promise<void> {
    if (!this.sessionToken) return
    this._closeStream()
    this.activeSessionId = id
    this.bubbles = []
    this.sidebarOpen = false
    this._userScrolled = false
    this.showScrollToBottom = false

    const session = this.sessions.find((s) => s.id === id)
    this.activeSessionTitle = session?.title ?? ''

    this.sessionLoading = true
    try {
      const detail = await getSession(this.config.backend_url, this.sessionToken, id)
      this.bubbles = this._turnsToBubbles(detail.turns)
      this._scrollBottom()
    } catch (e) {
      this._handleApiError(e)
    } finally {
      this.sessionLoading = false
    }
  }

  private async _newSession(): Promise<void> {
    if (!this.sessionToken) return
    this._closeStream()
    this.sidebarOpen = false
    this.editingBubbleId = null
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
      this.activeSessionTitle = session.title
      this.bubbles = []
      this._userScrolled = false
      this.showScrollToBottom = false
      // Focus composer
      this._focusComposer()
    } catch (e) {
      this._handleApiError(e)
    }
  }

  private async _deleteSession(id: string): Promise<void> {
    if (!this.sessionToken) return
    this.confirmDeleteId = null
    try {
      await deleteSession(this.config.backend_url, this.sessionToken, id)
      this.sessions = this.sessions.filter((s) => s.id !== id)
      if (this.activeSessionId === id) {
        this.activeSessionId = null
        this.activeSessionTitle = ''
        this.bubbles = []
        this._closeStream()
      }
    } catch (e) {
      this._handleApiError(e)
    }
  }

  private _startRename(id: string, currentTitle: string, e: Event): void {
    e.stopPropagation()
    this.renamingId = id
    this.renameValue = currentTitle
    // Focus the input after render
    this.updateComplete.then(() => {
      const input = this.shadowRoot?.querySelector<HTMLInputElement>('.session-rename-input')
      if (input) {
        input.focus()
        input.select()
      }
    })
  }

  private async _commitRename(id: string): Promise<void> {
    if (!this.sessionToken || !this.renameValue.trim()) {
      this.renamingId = null
      return
    }
    const title = this.renameValue.trim()
    this.renamingId = null
    try {
      // Optimistic update
      this.sessions = this.sessions.map((s) => s.id === id ? { ...s, title } : s)
      if (this.activeSessionId === id) this.activeSessionTitle = title
      // Try backend rename (best-effort, PATCH may not exist on all backends)
      try {
        await renameSession(this.config.backend_url, this.sessionToken, id, title)
      } catch {
        // If PATCH fails (e.g. not implemented), keep the optimistic update
      }
    } catch (e) {
      this._handleApiError(e)
    }
  }

  private _cancelRename(): void {
    this.renamingId = null
    this.renameValue = ''
  }

  private async _startWithPrompt(text: string): Promise<void> {
    // If no active session, create one first
    if (!this.activeSessionId) {
      await this._newSession()
    }
    if (this.activeSessionId) {
      void this._send(text)
    }
  }

  private _onRenameKeydown(e: KeyboardEvent, id: string): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      void this._commitRename(id)
    } else if (e.key === 'Escape') {
      this._cancelRename()
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

  private async _send(messageOverride?: string): Promise<void> {
    const text = (messageOverride ?? this.draft).trim()
    if (!text || !this.sessionToken || this.streamingTurnId) return

    // Auto-create a session on first message — matches ChatGPT/Claude.ai UX.
    // User no longer needs to click "New conversation" first.
    if (!this.activeSessionId) {
      try {
        const session = await createSession(this.config.backend_url, this.sessionToken, 'New conversation')
        this.sessions = [session, ...this.sessions]
        this.activeSessionId = session.id
        this.activeSessionTitle = session.title
        this.bubbles = []
      } catch (err) {
        this.errorMessage = 'Could not start a new conversation.'
        return
      }
    }

    this.draft = ''
    this._resetTextarea()
    this.charCount = 0
    this.showCharCount = false
    this.editingBubbleId = null
    this._lastUserMessageText = text

    // Add user bubble immediately with animation
    const userBubble: Bubble = { id: uid(), role: 'user', text, isNew: true }
    this.bubbles = [...this.bubbles, userBubble]
    this._scrollBottom()

    // Remove isNew after animation
    setTimeout(() => {
      this.bubbles = this.bubbles.map((b) => b.id === userBubble.id ? { ...b, isNew: false } : b)
    }, 300)

    try {
      const { turn_id } = await postChat(
        this.config.backend_url,
        this.sessionToken,
        this.activeSessionId,
        text,
        this.config.model,
      )
      this.streamingTurnId = turn_id
      this._turnStartTime = Date.now()
      this._openStream(turn_id)
    } catch (e) {
      this._handleApiError(e)
      this.streamingTurnId = null
    }
  }

  private async _regenerate(): Promise<void> {
    if (!this._lastUserMessageText || this.streamingTurnId) return
    void this._send(this._lastUserMessageText)
  }

  private _startEditBubble(bubble: Bubble, e: Event): void {
    e.stopPropagation()
    this.editingBubbleId = bubble.id
    this.editDraft = bubble.text ?? ''
  }

  private _cancelEdit(): void {
    this.editingBubbleId = null
    this.editDraft = ''
  }

  private _submitEdit(): void {
    const text = this.editDraft.trim()
    this.editingBubbleId = null
    this.editDraft = ''
    if (text) void this._send(text)
  }

  private _openStream(turnId: string): void {
    this._closeStream()
    const url = streamUrl(this.config.backend_url, this.sessionToken!, turnId)
    const es = new EventSource(url)
    this._eventSource = es

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
              const bubble: Bubble = { id: uid(), role: 'assistant', text: '', streaming: true, isNew: true }
              currentAssistantId = bubble.id
              this.bubbles = [...this.bubbles, bubble]
              setTimeout(() => {
                this.bubbles = this.bubbles.map((b) => b.id === currentAssistantId ? { ...b, isNew: false } : b)
              }, 300)
            }
            this.bubbles = this.bubbles.map((b) =>
              b.id === currentAssistantId
                ? { ...b, text: (b.text ?? '') + block.text }
                : b,
            )
            if (!this._userScrolled) this._scrollBottom()
            else this.showScrollToBottom = true
          } else if (block.type === 'tool_use') {
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
              isNew: true,
            }
            currentToolId = toolBubble.id
            this.bubbles = [...this.bubbles, toolBubble]
            setTimeout(() => {
              this.bubbles = this.bubbles.map((b) => b.id === currentToolId ? { ...b, isNew: false } : b)
            }, 300)
            if (!this._userScrolled) this._scrollBottom()
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
        // Attach per-turn stats to the last assistant bubble
        const stats: TurnStats = {}
        if (parsed.usage?.input_tokens !== undefined) stats.inputTokens = parsed.usage.input_tokens
        if (parsed.usage?.output_tokens !== undefined) stats.outputTokens = parsed.usage.output_tokens
        if (parsed.total_cost_usd !== undefined) stats.costUsd = parsed.total_cost_usd
        if (parsed.duration_ms !== undefined) {
          stats.durationMs = parsed.duration_ms
        } else if (this._turnStartTime) {
          stats.durationMs = Date.now() - this._turnStartTime
        }
        const lastAssistantId = [...this.bubbles].reverse().find((b) => b.role === 'assistant' && b.streaming)?.id
        this.bubbles = this.bubbles.map((b) => {
          if (b.streaming) {
            return {
              ...b,
              streaming: false,
              error: parsed.subtype === 'error',
              // Only attach stats to the last streaming assistant bubble
              ...(b.id === lastAssistantId && Object.keys(stats).length > 0 ? { stats } : {}),
            }
          }
          return b
        })
        this._finishStream()
        // Feature 3: auto-title from first user message
        void this._maybeAutoTitle()
      } else if ((parsed as any).type === 'permission_request') {
        const perm = parsed as any
        this.activePermissionRequest = { turnId: perm.turn_id, toolName: perm.tool_name, toolDescription: perm.tool_description }
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
    this._turnStartTime = null
    void this._loadSessions()
  }

  // Feature 3: Auto-title from first user message
  private async _maybeAutoTitle(): Promise<void> {
    if (!this.sessionToken || !this.activeSessionId) return
    const session = this.sessions.find((s) => s.id === this.activeSessionId)
    if (!session) return
    const isAutoTitle = !session.title || session.title === '' ||
      BonnieCard.AUTO_TITLE_RE.test(session.title)
    if (!isAutoTitle) return

    // Get first user message text
    const firstUser = this.bubbles.find((b) => b.role === 'user')
    if (!firstUser?.text) return

    // Derive title: first 40 chars trimmed to word boundary
    let title = firstUser.text.slice(0, 60)
    if (firstUser.text.length > 60) {
      const lastSpace = title.lastIndexOf(' ')
      if (lastSpace > 20) title = title.slice(0, lastSpace)
    }
    title = title.trim()
    if (!title) return

    await updateSessionTitle(this.config.backend_url, this.sessionToken, this.activeSessionId, title)
    // Update local state
    this.sessions = this.sessions.map((s) => s.id === this.activeSessionId ? { ...s, title } : s)
    if (this.activeSessionId === this.activeSessionId) this.activeSessionTitle = title
  }

  // Feature 5: Voice input methods
  private _toggleVoice(): void {
    if (this.isListening) {
      this._stopListening()
    } else {
      this._startListening()
    }
  }

  private _startListening(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    try {
      const rec = new SpeechRecognition()
      rec.lang = navigator.language || 'en-US'
      rec.continuous = false
      rec.interimResults = true

      rec.onstart = () => {
        this.isListening = true
      }

      rec.onresult = (e: any) => {
        let interim = ''
        let final = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript
          if (e.results[i].isFinal) {
            final += transcript
          } else {
            interim += transcript
          }
        }
        // Update draft with the transcript so far
        const ta = this.shadowRoot?.querySelector<HTMLTextAreaElement>('.composer-textarea')
        if (ta) {
          const base = this.draft.replace(/\[…\]$/, '').trimEnd()
          if (final) {
            this.draft = base ? base + ' ' + final.trim() : final.trim()
            ta.value = this.draft
          } else if (interim) {
            ta.value = (base ? base + ' ' : '') + interim + ' […]'
          }
          ta.style.height = 'auto'
          ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'
        }
      }

      rec.onend = () => {
        this.isListening = false
        // Clean up interim indicator
        const ta = this.shadowRoot?.querySelector<HTMLTextAreaElement>('.composer-textarea')
        if (ta) {
          this.draft = ta.value.replace(/ \[…\]$/, '').trim()
          ta.value = this.draft
        }
        this._speechRecognition = null
      }

      rec.onerror = (e: any) => {
        this.isListening = false
        this._speechRecognition = null
        if (e.error === 'not-allowed' || e.error === 'permission-denied') {
          this._showToast('Microphone access denied')
        }
      }

      this._speechRecognition = rec
      rec.start()
    } catch {
      this._showToast('Voice input unavailable')
    }
  }

  private _stopListening(): void {
    if (this._speechRecognition) {
      try { this._speechRecognition.stop() } catch {}
      this._speechRecognition = null
    }
    this.isListening = false
  }

  // Feature 6: Export conversation
  private _exportMarkdown(): void {
    if (!this.activeSessionId) return
    this.showExportMenu = false
    const title = this.activeSessionTitle || 'Conversation'
    const date = new Date().toISOString().split('T')[0]
    const lines: string[] = [`# ${title}`, `_Exported: ${date}_`, '']
    for (const b of this.bubbles) {
      if (b.role === 'user') {
        lines.push('### User', b.text ?? '', '')
      } else if (b.role === 'assistant') {
        lines.push('### Bonnie', b.text ?? '', '')
      } else if (b.role === 'tool') {
        lines.push(`### Tool: ${b.toolName ?? 'unknown'}`)
        if (b.toolInput !== undefined) lines.push('**Input:**', '```json', JSON.stringify(b.toolInput, null, 2), '```', '')
        if (b.toolResult !== undefined) lines.push('**Result:**', '```', String(b.toolResult).slice(0, 2000), '```', '')
      }
    }
    this._downloadBlob(lines.join('\n'), `bonnie-${date}-${title.slice(0, 20).replace(/\s+/g, '-')}.md`, 'text/markdown')
  }

  private _exportJson(): void {
    if (!this.activeSessionId) return
    this.showExportMenu = false
    const session = this.sessions.find((s) => s.id === this.activeSessionId)
    const payload = {
      session,
      bubbles: this.bubbles.map(({ id, role, text, toolName, toolInput, toolResult, stats }) =>
        ({ id, role, text, toolName, toolInput, toolResult, stats })),
      exported_at: new Date().toISOString(),
    }
    const date = new Date().toISOString().split('T')[0]
    const title = this.activeSessionTitle || 'conversation'
    this._downloadBlob(JSON.stringify(payload, null, 2), `bonnie-${date}-${title.slice(0, 20).replace(/\s+/g, '-')}.json`, 'application/json')
  }

  private _downloadBlob(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  // Feature 8: Permission response
  private async _respondPermission(approved: boolean): Promise<void> {
    if (!this.activePermissionRequest || !this.sessionToken) return
    const req = this.activePermissionRequest
    this.activePermissionRequest = null
    await respondPermission(this.config.backend_url, this.sessionToken, req.turnId, approved)
  }

  // Toast notification (used by voice input for errors)
  @state() private _toastMessage: string | null = null
  private _toastTimer: ReturnType<typeof setTimeout> | null = null

  private _showToast(msg: string): void {
    this._toastMessage = msg
    if (this._toastTimer) clearTimeout(this._toastTimer)
    this._toastTimer = setTimeout(() => { this._toastMessage = null }, 3000)
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

  // ── Copy to clipboard ─────────────────────────────────────────────────────

  private async _copyMessage(id: string, text: string, e: Event): Promise<void> {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      this.copiedMsgId = id
      setTimeout(() => {
        if (this.copiedMsgId === id) this.copiedMsgId = null
      }, 2000)
    } catch {}
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
      if (msgs) {
        msgs.scrollTop = msgs.scrollHeight
        this.showScrollToBottom = false
      }
    })
  }

  private _setupScrollListener(): void {
    this.updateComplete.then(() => {
      const msgs = this.shadowRoot?.querySelector('.messages')
      if (!msgs) return
      msgs.addEventListener('scroll', () => {
        const el = msgs as HTMLElement
        const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
        if (isAtBottom) {
          this._userScrolled = false
          this.showScrollToBottom = false
        } else {
          this._userScrolled = true
        }
      }, { passive: true })
    })
  }

  private _setupCodeCopyListeners(): void {
    // Delegate copy button clicks inside shadow DOM for code blocks
    this.updateComplete.then(() => {
      const root = this.shadowRoot
      if (!root) return
      // Remove old listener if any (by re-adding with new handler)
      // We use event delegation on the messages container
      const msgs = root.querySelector('.messages')
      if (!msgs) return
      const handler = async (e: Event) => {
        const btn = (e.target as HTMLElement).closest('.code-copy-btn') as HTMLElement | null
        if (!btn) return
        const code = btn.getAttribute('data-code')
        if (!code) return
        e.stopPropagation()
        try {
          await navigator.clipboard.writeText(code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'))
          btn.classList.add('copied')
          const span = btn.querySelector('span')
          const origText = span?.textContent
          if (span) span.textContent = 'Copied!'
          setTimeout(() => {
            btn.classList.remove('copied')
            if (span && origText) span.textContent = origText
          }, 2000)
        } catch {}
      }
      // Store and remove previous to avoid duplicates
      ;(msgs as any)._copyHandler && msgs.removeEventListener('click', (msgs as any)._copyHandler)
      ;(msgs as any)._copyHandler = handler
      msgs.addEventListener('click', handler)
    })
  }

  private _resetTextarea(): void {
    const ta = this.shadowRoot?.querySelector<HTMLTextAreaElement>('.composer-textarea')
    if (ta) {
      ta.value = ''
      ta.style.height = 'auto'
    }
  }

  private _focusComposer(): void {
    this.updateComplete.then(() => {
      const ta = this.shadowRoot?.querySelector<HTMLTextAreaElement>('.composer-textarea')
      ta?.focus()
    })
  }

  private _setupResizeObserver(): void {
    const card = this.shadowRoot?.querySelector('.bonnie-card')
    if (!card) return
    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const wasWide = this.isWide
        this.isWide = entry.contentRect.width >= 640
        if (this.isWide && !wasWide) {
          // Switching to wide — don't force close the sidebar
        }
      }
    })
    this._resizeObserver.observe(card)
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  private _onGlobalKeydown = (e: KeyboardEvent): void => {
    const isMod = e.metaKey || e.ctrlKey
    if (isMod && e.key === 'n') {
      e.preventDefault()
      void this._newSession()
    } else if (isMod && e.key === 'k') {
      e.preventDefault()
      this._focusComposer()
    } else if (isMod && (e.key === '/' || e.key === 'b')) {
      e.preventDefault()
      if (!this.isWide) {
        this.sidebarOpen = !this.sidebarOpen
      }
    } else if (e.key === 'Escape' && this.showKbHelp) {
      this.showKbHelp = false
    }
  }

  // ── Textarea events ───────────────────────────────────────────────────────

  private _onInput(e: Event): void {
    const ta = e.target as HTMLTextAreaElement
    this.draft = ta.value
    this.charCount = ta.value.length
    this.showCharCount = ta.value.length > 500
    // Manual auto-resize fallback
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'
  }

  private _onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void this._send()
    } else if (e.key === 'Escape') {
      if (this.streamingTurnId) {
        void this._cancel()
      } else if (this.sidebarOpen && !this.isWide) {
        this.sidebarOpen = false
      } else if (this.showKbHelp) {
        this.showKbHelp = false
      } else {
        // Blur the composer
        const ta = this.shadowRoot?.querySelector<HTMLTextAreaElement>('.composer-textarea')
        ta?.blur()
      }
    } else if (e.key === 'ArrowUp' && !this.draft) {
      // Edit last user message
      const lastUser = [...this.bubbles].reverse().find((b) => b.role === 'user')
      if (lastUser) {
        this._startEditBubble(lastUser, e)
      }
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
    if (b.id === this.editingBubbleId && b.role === 'user') return this._renderEditBubble(b)

    const isUser = b.role === 'user'
    const isCopied = this.copiedMsgId === b.id
    // Feature 2: during streaming, show raw text with cursor; on completion parse markdown
    const html_ = isUser ? nothing : (b.streaming
      ? html`<span class="streaming-text">${b.text ?? ''}</span><span class="cursor"></span>`
      : unsafeHTML(renderMarkdown(b.text ?? '')))

    // Determine if this is the last assistant bubble (for regenerate action)
    const lastAssistant = [...this.bubbles].reverse().find((x) => x.role === 'assistant')
    const isLastAssistant = !b.streaming && b.id === lastAssistant?.id

    return html`
      <div class=${classMap({ 'bubble-row': true, [b.role]: true, 'new-msg': !!b.isNew })}>
        <!-- Message action bar (shown on hover) -->
        <div class="msg-actions">
          <button
            class=${classMap({ 'msg-action-btn': true, copied: isCopied })}
            @click=${(e: Event) => this._copyMessage(b.id, b.text ?? '', e)}
            title="Copy"
          >
            ${isCopied ? svgCheck() : svgCopy()}
            ${isCopied ? html`<span>Copied</span>` : html`<span>Copy</span>`}
          </button>
          ${isUser ? html`
            <button
              class="msg-action-btn"
              @click=${(e: Event) => this._startEditBubble(b, e)}
              title="Edit"
            >
              ${svgEdit()}
              <span>Edit</span>
            </button>
          ` : nothing}
          ${isLastAssistant ? html`
            <button
              class="msg-action-btn"
              @click=${() => this._regenerate()}
              title="Regenerate"
            >
              ${svgRefresh()}
              <span>Retry</span>
            </button>
          ` : nothing}
        </div>

        <div class=${classMap({ bubble: true, [b.role]: true, error: !!b.error })}>
          ${isUser
            ? b.text
            : html_}
        </div>

        <!-- Feature 7: Token/cost stats footer -->
        ${!isUser && !b.streaming && b.stats && (b.stats.outputTokens || b.stats.costUsd) ? html`
          <div class="turn-stats">
            ${b.stats.outputTokens ? html`${b.stats.outputTokens} tok` : nothing}${b.stats.inputTokens && b.stats.outputTokens ? html` · in:${b.stats.inputTokens}` : nothing}${b.stats.costUsd !== undefined ? html` · $${b.stats.costUsd.toFixed(5)}` : nothing}${b.stats.durationMs ? html` · ${(b.stats.durationMs / 1000).toFixed(1)}s` : nothing}
          </div>
        ` : nothing}
      </div>

      <!-- Feature 8: Permission card -->
      ${b.role === 'assistant' && !b.streaming && this.activePermissionRequest ? html`
        <div class="bubble-row assistant">
          <div class="permission-card">
            <div class="permission-header">
              ${svgKey()}
              <span class="permission-title">Permission required</span>
            </div>
            <div class="permission-body">
              Bonnie wants to use <strong>${this.activePermissionRequest.toolName}</strong>${this.activePermissionRequest.toolDescription ? html` — ${this.activePermissionRequest.toolDescription}` : nothing}
            </div>
            <div class="permission-actions">
              <button class="permission-deny-btn" @click=${() => this._respondPermission(false)}>Deny</button>
              <button class="permission-approve-btn" @click=${() => this._respondPermission(true)}>Approve</button>
            </div>
          </div>
        </div>
      ` : nothing}
    `
  }

  private _renderEditBubble(b: Bubble): TemplateResult {
    return html`
      <div class="bubble-row user">
        <div class="edit-bubble-wrap">
          <textarea
            class="edit-bubble-textarea"
            .value=${this.editDraft}
            @input=${(e: Event) => { this.editDraft = (e.target as HTMLTextAreaElement).value }}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._submitEdit() }
              else if (e.key === 'Escape') this._cancelEdit()
            }}
          ></textarea>
          <div class="edit-actions">
            <button class="edit-cancel-btn" @click=${() => this._cancelEdit()}>Cancel</button>
            <button class="edit-send-btn" @click=${() => this._submitEdit()}>Send</button>
          </div>
        </div>
      </div>
    `
  }

  private _renderToolBubble(b: Bubble): TemplateResult {
    const expanded = !!b.toolResultExpanded
    const hasDone = b.toolResult !== undefined
    const rawResult = truncate(b.toolResult)
    const isLong = rawResult.length > 500
    const displayResult = isLong && !expanded ? rawResult.slice(0, 500) + '…' : rawResult

    return html`
      <div class=${classMap({ 'bubble-row': true, tool: true, 'new-msg': !!b.isNew })}>
        <div class="tool-bubble">
          <div class="tool-header" @click=${() => this._toggleTool(b.id)}>
            <span class="tool-icon">${svgWrench()}</span>
            <span class="tool-name">${b.toolName ?? 'tool'}</span>
            ${hasDone
              ? html`<span class="tool-status done">done</span>`
              : html`<span class="tool-status">running…</span>`}
            <span class=${classMap({ 'tool-chevron': true, expanded })}>${svgChevron()}</span>
          </div>
          <div class=${classMap({ 'tool-body': true, visible: expanded })}>
            <p class="tool-section-label">Input</p>
            <pre class="tool-pre">${truncate(b.toolInput)}</pre>
            ${hasDone
              ? html`
                <p class="tool-section-label">Result</p>
                <pre class="tool-pre">${displayResult}</pre>
                ${isLong
                  ? html`<button class="show-more-btn" @click=${(e: Event) => { e.stopPropagation(); this._toggleTool(b.id) }}>
                      ${expanded ? '↑ Show less' : '↓ Show more'}
                    </button>`
                  : nothing}
              `
              : nothing}
          </div>
        </div>
      </div>
    `
  }

  private _renderSessionItem(s: Session): TemplateResult {
    const isRenaming = this.renamingId === s.id
    return html`
      <div
        class=${classMap({ 'session-item': true, active: s.id === this.activeSessionId })}
        @click=${() => this._openSession(s.id)}
      >
        <div class="session-item-content">
          ${isRenaming
            ? html`
              <input
                class="session-rename-input"
                .value=${this.renameValue}
                @input=${(e: Event) => { this.renameValue = (e.target as HTMLInputElement).value }}
                @keydown=${(e: KeyboardEvent) => this._onRenameKeydown(e, s.id)}
                @blur=${() => this._commitRename(s.id)}
                @click=${(e: Event) => e.stopPropagation()}
              />
            `
            : html`
              <span class="session-item-title">${s.title || 'Untitled'}</span>
              <span class="session-item-time">${relativeTime(s.updated_at)}</span>
            `}
        </div>
        ${!isRenaming ? html`
          <div class="session-actions">
            <button
              class="session-action-btn"
              title="Rename"
              @click=${(e: Event) => this._startRename(s.id, s.title, e)}
            >${svgPencil()}</button>
            <button
              class="session-action-btn delete"
              title="Delete"
              @click=${(e: Event) => { e.stopPropagation(); this.confirmDeleteId = s.id }}
            >${svgTrash()}</button>
          </div>
        ` : nothing}
      </div>
    `
  }

  private _renderSidebarContent(): TemplateResult {
    const items = this.filteredSessions
    return html`
      <div class="sidebar-top">
        <button class="new-chat-btn" @click=${this._newSession}>
          ${svgPlus()}
          New conversation
        </button>
        <div class="search-wrap">
          <span class="search-icon">${svgSearch()}</span>
          <input
            class="search-input"
            type="text"
            placeholder="Search conversations…"
            .value=${this.searchQuery}
            @input=${(e: Event) => { this.searchQuery = (e.target as HTMLInputElement).value }}
          />
        </div>
      </div>
      ${items.length === 0
        ? html`<div class="session-empty">
            ${this.searchQuery ? 'No matching conversations' : 'No conversations yet. Start a new one!'}
          </div>`
        : html`
          <div class="session-list">
            ${items.map((s) => this._renderSessionItem(s))}
          </div>
        `}
    `
  }

  private _renderSkeletonLoading(): TemplateResult {
    return html`
      <div class="skeleton-wrap">
        <div class="skeleton-msg">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-lines">
            <div class="skeleton-line" style="width:80%"></div>
            <div class="skeleton-line" style="width:55%"></div>
          </div>
        </div>
        <div class="skeleton-msg user">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-lines">
            <div class="skeleton-line" style="width:60%"></div>
          </div>
        </div>
        <div class="skeleton-msg">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-lines">
            <div class="skeleton-line" style="width:90%"></div>
            <div class="skeleton-line" style="width:70%"></div>
            <div class="skeleton-line" style="width:40%"></div>
          </div>
        </div>
      </div>
    `
  }

  // ── Main render ───────────────────────────────────────────────────────────

  override render(): TemplateResult {
    if (this.authError) {
      return html`
        <ha-card>
          <div class="bonnie-card">
            <div class="error-card" style="margin:16px">
              <div class="error-card-icon">${svgAlertCircle()}</div>
              <div class="error-card-body">
                <div class="error-card-title">Authentication failed</div>
                <div class="error-card-text">Session expired or invalid token.</div>
                <button class="error-retry-btn" @click=${() => this._bootstrap()}>Try again</button>
              </div>
            </div>
          </div>
        </ha-card>
      `
    }

    const title = this.config?.title ?? 'Bonnie'
    const isStreaming = !!this.streamingTurnId
    // Can send as long as there's text + auth + not already streaming.
    // No active session? _send() auto-creates one.
    const canSend = !!this.draft.trim() && !isStreaming && !!this.sessionToken

    return html`
      <ha-card>
        <div class="bonnie-card" @click=${() => { if (this.showExportMenu) this.showExportMenu = false }}>
          <!-- Delete confirm overlay -->
          ${this.confirmDeleteId ? html`
            <div class="confirm-overlay" @click=${() => { this.confirmDeleteId = null }}>
              <div class="confirm-card" @click=${(e: Event) => e.stopPropagation()}>
                <div class="confirm-title">Delete conversation?</div>
                <div class="confirm-body">This cannot be undone. The conversation and all its messages will be permanently deleted.</div>
                <div class="confirm-actions">
                  <button class="confirm-btn cancel" @click=${() => { this.confirmDeleteId = null }}>Cancel</button>
                  <button class="confirm-btn danger" @click=${() => this._deleteSession(this.confirmDeleteId!)}>Delete</button>
                </div>
              </div>
            </div>
          ` : nothing}

          <!-- Header -->
          <div class="header">
            ${!this.isWide
              ? html`<button class="icon-btn" @click=${() => (this.sidebarOpen = !this.sidebarOpen)} title="Sessions (Cmd+/)">
                  ${svgMenu()}
                </button>`
              : nothing}
            <div class="header-brand">
              <div class="brand-logo">${svgBrandMark()}</div>
              <div class="header-meta">
                <span class="header-title">${title}</span>
                ${this.activeSessionTitle
                  ? html`<span class="header-subtitle">${this.activeSessionTitle}</span>`
                  : nothing}
              </div>
            </div>
            ${isStreaming ? html`<div class="status-dot streaming" title="Streaming"></div>` : nothing}
            <!-- Feature 10: Theme toggle -->
            <button
              class="icon-btn"
              title="Theme: ${this.themeMode}"
              @click=${() => this._cycleTheme()}
            >${this.themeMode === 'light' ? svgSun() : this.themeMode === 'dark' ? svgMoon() : svgSunMoon()}</button>
            <!-- Feature 6: Export menu -->
            ${this.activeSessionId ? html`
              <div class="export-menu-wrap" style="position:relative">
                <button
                  class="icon-btn"
                  title="Export conversation"
                  @click=${() => { this.showExportMenu = !this.showExportMenu }}
                >${svgDots()}</button>
                ${this.showExportMenu ? html`
                  <div class="export-menu" @click=${(e: Event) => e.stopPropagation()}>
                    <button class="export-menu-item" @click=${() => this._exportMarkdown()}>
                      ${svgDownload()} Export as Markdown
                    </button>
                    <button class="export-menu-item" @click=${() => this._exportJson()}>
                      ${svgDownload()} Export as JSON
                    </button>
                  </div>
                ` : nothing}
              </div>
            ` : nothing}
            <div class="kb-help-wrap">
              <button
                class="icon-btn"
                title="Keyboard shortcuts"
                @click=${() => { this.showKbHelp = !this.showKbHelp }}
              >${svgQuestion()}</button>
              <div class=${classMap({ 'kb-help-popover': true, open: this.showKbHelp })}>
                <div class="kb-help-row">
                  <span class="kb-help-label">Send message</span>
                  <span class="kb-shortcuts"><span class="kb-key">Enter</span></span>
                </div>
                <div class="kb-help-row">
                  <span class="kb-help-label">New line</span>
                  <span class="kb-shortcuts"><span class="kb-key">Shift</span><span class="kb-key">Enter</span></span>
                </div>
                <div class="kb-help-row">
                  <span class="kb-help-label">New conversation</span>
                  <span class="kb-shortcuts"><span class="kb-key">⌘</span><span class="kb-key">N</span></span>
                </div>
                <div class="kb-help-row">
                  <span class="kb-help-label">Focus composer</span>
                  <span class="kb-shortcuts"><span class="kb-key">⌘</span><span class="kb-key">K</span></span>
                </div>
                <div class="kb-help-row">
                  <span class="kb-help-label">Toggle sidebar</span>
                  <span class="kb-shortcuts"><span class="kb-key">⌘</span><span class="kb-key">/</span></span>
                </div>
                <div class="kb-help-row">
                  <span class="kb-help-label">Cancel / close</span>
                  <span class="kb-shortcuts"><span class="kb-key">Esc</span></span>
                </div>
                <div class="kb-help-row">
                  <span class="kb-help-label">Re-ask last message</span>
                  <span class="kb-shortcuts"><span class="kb-key">↑</span></span>
                </div>
              </div>
            </div>
            ${this.isWide
              ? html`<button class="icon-btn" @click=${this._newSession} title="New conversation (Cmd+N)">
                  ${svgPlus()}
                </button>`
              : nothing}
          </div>

          <!-- Body -->
          <div class="body">
            <!-- Wide-mode sidebar -->
            ${this.isWide
              ? html`
                  <div class="sidebar">
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
                          <div class="empty-icon-wrap">${svgBrandMarkLarge()}</div>
                          <div class="empty-heading">Ask Bonnie anything</div>
                          <div class="empty-subtext">Your AI home assistant, ready to help with automations, devices, and more.</div>
                          <div class="suggested-prompts">
                            ${['What\'s playing on my speakers?', 'Turn off the living room lights', 'Summarise today\'s calendar'].map((p) => html`
                              <button class="suggested-prompt-btn" @click=${() => this._startWithPrompt(p)}>${p}</button>
                            `)}
                          </div>
                        </div>
                      </div>
                    `
                  : html`
                      <div class="messages">
                        ${this.sessionLoading
                          ? this._renderSkeletonLoading()
                          : this.bubbles.length === 0
                            ? html`<div class="empty-state">
                                <div class="empty-icon-wrap">${svgBrandMarkLarge()}</div>
                                <div class="empty-heading">Start the conversation</div>
                                <div class="empty-subtext">Ask Bonnie to control devices, set automations, or just chat.</div>
                                <div class="suggested-prompts">
                                  ${(['What\'s playing on my speakers?', 'Turn off the living room lights', 'Summarise today\'s calendar']).map((p) => html`
                                    <button class="suggested-prompt-btn" @click=${() => this._startWithPrompt(p)}>${p}</button>
                                  `)}
                                </div>
                              </div>`
                            : this.bubbles.map((b) => this._renderBubble(b))}
                      </div>
                    `}

              <!-- Scroll to bottom button -->
              ${this.showScrollToBottom
                ? html`<button class="scroll-to-bottom visible" @click=${() => { this._userScrolled = false; this._scrollBottom() }}>
                    ${svgArrowDown()} New messages
                  </button>`
                : nothing}

              <!-- Error message -->
              ${this.errorMessage
                ? html`<div class="error-card" style="margin:0 12px 8px">
                    <div class="error-card-icon">${svgAlertCircle()}</div>
                    <div class="error-card-body">
                      <div class="error-card-title">Error</div>
                      <div class="error-card-text">${this.errorMessage}</div>
                      <button class="error-retry-btn" @click=${() => { this.errorMessage = null }}>Dismiss</button>
                    </div>
                  </div>`
                : nothing}

              <!-- Composer -->
              <div class="composer-wrap">
                <div class="composer-inner">
                  <!-- Feature 5: Voice mic button -->
                  ${this.hasSpeechRecognition ? html`
                    <button
                      class=${classMap({ 'mic-btn': true, listening: this.isListening })}
                      @click=${() => this._toggleVoice()}
                      title=${this.isListening ? 'Stop listening' : 'Voice input'}
                      ?disabled=${isStreaming}
                    >${svgMic()}</button>
                  ` : nothing}
                  <textarea
                    class="composer-textarea"
                    rows="1"
                    placeholder=${isStreaming ? 'Bonnie is thinking…' : this.isListening ? 'Listening…' : 'Message Bonnie… (Enter to send, Shift+Enter for newline)'}
                    .value=${this.draft}
                    ?disabled=${isStreaming || this.loading || !this.sessionToken}
                    @input=${this._onInput}
                    @keydown=${this._onKeydown}
                  ></textarea>
                  <button
                    class=${classMap({ 'send-btn': true, stop: isStreaming })}
                    ?disabled=${!isStreaming && !canSend}
                    @click=${isStreaming ? this._cancel : this._send}
                    title=${isStreaming ? 'Stop generating (Esc)' : 'Send (Enter)'}
                  >
                    ${isStreaming ? svgStop() : svgSend()}
                  </button>
                </div>
                ${this.showCharCount
                  ? html`<div class="composer-footer">
                      <span class=${classMap({
                        'char-count': true,
                        warning: this.charCount > 1000 && this.charCount <= 2000,
                        danger: this.charCount > 2000,
                      })}>${this.charCount.toLocaleString()} chars</span>
                      <span class="composer-hint">Shift+Enter for newline</span>
                    </div>`
                  : nothing}
              </div>
              <!-- Toast notification -->
              ${this._toastMessage ? html`
                <div class="toast">${this._toastMessage}</div>
              ` : nothing}
            </div>
          </div>
        </div>
      </ha-card>
    `
  }
}

// ── SVG icons (inline, no external dep) ───────────────────────────────────

function svgMenu(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>`
}

function svgPlus(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
}

function svgClose(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
}

function svgSend(): TemplateResult {
  return html`<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`
}

function svgStop(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" stroke="none"/></svg>`
}

function svgWrench(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`
}

function svgChevron(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>`
}

function svgCopy(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
}

function svgCheck(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
}

function svgEdit(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`
}

function svgRefresh(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5.5"/></svg>`
}

function svgTrash(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`
}

function svgPencil(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`
}

function svgSearch(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`
}

function svgArrowDown(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`
}

function svgAlertCircle(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
}

// Stylized thistle — Scotland's national flower, minimalist silhouette that
// reads cleanly at 16px and 32px. Tufted crown + round bulb + tapered leaves.
function svgThistle(): TemplateResult {
  return html`<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <!-- Spiky crown: 5 tapered triangles forming a fan -->
    <path d="M12 2 L11.2 8 L12.8 8 Z"/>
    <path d="M8.5 3.2 L9.2 8.4 L10.5 8 Z"/>
    <path d="M15.5 3.2 L14.8 8.4 L13.5 8 Z"/>
    <path d="M5.5 5.5 L7.8 9 L9 8.3 Z"/>
    <path d="M18.5 5.5 L16.2 9 L15 8.3 Z"/>
    <!-- Bulb: egg shape with subtle cross-band for pineapple texture -->
    <path d="M12 8
             C 7.5 8, 5.5 11, 5.5 14.2
             C 5.5 17.2, 8 19, 12 19
             C 16 19, 18.5 17.2, 18.5 14.2
             C 18.5 11, 16.5 8, 12 8 Z"/>
    <!-- Horizontal band on bulb (darker overlay) -->
    <path d="M6 13.5 L18 13.5" stroke="rgba(0,0,0,0.22)" stroke-width="1" fill="none"/>
    <!-- Stem + 2 swept leaves -->
    <path d="M11.1 19 L11.1 23 L12.9 23 L12.9 19 Z"/>
    <path d="M11 20.5 C 8 20, 5 20.5, 4 22.5 C 7 22, 9.5 21.5, 11 21.5 Z"/>
    <path d="M13 20.5 C 16 20, 19 20.5, 20 22.5 C 17 22, 14.5 21.5, 13 21.5 Z"/>
  </svg>`
}

function svgBrandMark(): TemplateResult {
  return svgThistle()
}

function svgBrandMarkLarge(): TemplateResult {
  return svgThistle()
}

function svgQuestion(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
}

function svgMic(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`
}

function svgDots(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/></svg>`
}

function svgDownload(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`
}

function svgSun(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
}

function svgMoon(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
}

function svgSunMoon(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M12 8a2.83 2.83 0 0 0 4 4 4 4 0 1 1-4-4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/></svg>`
}

function svgKey(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`
}

// ── Register custom element ────────────────────────────────────────────────

if (!customElements.get('bonnie-ai-card')) {
  customElements.define('bonnie-ai-card', BonnieCard)
}
