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

import type { BonnieCardConfig, Session, Bubble, SseEvent, TurnStats, UploadedAttachment, RawTurn, SearchResult, Plugin } from './types.js'
import type { AuditStats, AuditDailyEntry, Memory, PluginCreate, UserSettings, UserView, RoleView } from './api.js'
import {
  ApiError,
  kioskExchange,
  listSessions,
  listSessionsArchived,
  createSession,
  renameSession,
  getSession,
  deleteSession,
  postChat,
  cancelStream,
  streamUrl,
  requestStreamTicket,
  updateSessionTitle,
  updateSessionSystemPrompt,
  searchSession,
  respondPermission,
  uploadImage,
  deleteUpload,
  forkSession,
  patchSession,
  fetchAuditStats,
  fetchAuditDaily,
  listMemories,
  deleteMemory,
  createMemory,
  listPlugins,
  createPlugin,
  updatePlugin,
  deletePlugin,
  fetchSettings,
  patchSettings,
  listUsers,
  createUser,
  deleteUser,
  changePassword,
  listRoles,
} from './api.js'
import { renderMarkdown, clearMarkdownCache } from './markdown.js'
import { cardStyles } from './styles.js'
import { t, initLocale, suggestedPrompts } from './i18n.js'

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
  if (diff < 86400 * 2) return t('yesterday')
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

// ── Feature 11 (sidebar): Date grouping helper ─────────────────────────────

function groupByDate(sessions: Session[]): { label: string; sessions: Session[] }[] {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const week = new Date(today); week.setDate(week.getDate() - 7)

  const groups: { label: string; sessions: Session[] }[] = [
    { label: t('today'), sessions: [] },
    { label: t('yesterday'), sessions: [] },
    { label: t('previous7days'), sessions: [] },
    { label: t('older'), sessions: [] },
  ]
  for (const s of sessions) {
    const d = new Date(s.updated_at)
    if (d >= today) groups[0].sessions.push(s)
    else if (d >= yesterday) groups[1].sessions.push(s)
    else if (d >= week) groups[2].sessions.push(s)
    else groups[3].sessions.push(s)
  }
  return groups.filter((g) => g.sessions.length > 0)
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
    // Resolve locale from card config → HA language → navigator.language → 'en'
    const hassLang = (this as any).hass?.language as string | undefined
    initLocale(config.locale, hassLang)
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
  @state() private sidebarCollapsed = false
  @state() private dragOver = false
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
  // TTS: speak assistant bubbles
  @state() private hasSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window
  @state() private speakingBubbleId: string | null = null
  @state() private ttsAutoSpeak = localStorage.getItem('bonnie-tts-auto') === '1'
  @state() private ttsVoiceName = localStorage.getItem('bonnie-tts-voice') || ''
  @state() private ttsVoices: SpeechSynthesisVoice[] = []
  // Feature 6: export menu
  @state() private showExportMenu = false
  // Feature 10: theme toggle (auto / dark / light)
  // Permission requests
  @state() private activePermissionRequest: { turnId: string; toolName: string; toolDescription?: string } | null = null

  // Feature 11: Image upload
  @state() private pendingAttachments: UploadedAttachment[] = []
  @state() private uploadingCount = 0
  @state() private lightboxImage: string | null = null

  // Feature 12: Paste image — handler attached in firstUpdated
  private _onPaste: ((e: ClipboardEvent) => void) | null = null

  // Feature 10 (this sprint): Model selector
  @state() private allowedModels: string[] = []
  @state() private selectedModel = ''

  // Feature T4-1: Per-conversation system prompt
  @state() private showSystemPromptPanel = false
  @state() private systemPromptDraft = ''
  @state() private activeSystemPrompt: string | null = null

  // Feature T4-2: Message search
  @state() private showMessageSearch = false
  @state() private messageSearchQuery = ''
  @state() private messageSearchResults: SearchResult[] = []
  @state() private messageSearchLoading = false
  private _searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

  // Feature T4-3: Virtualization
  @state() private visibleStart = 0
  @state() private visibleEnd = 0
  private _topSentinelObserver: IntersectionObserver | null = null

  // Feature T4-8: Pin/archive
  @state() private showArchivedSessions = false
  @state() private archivedSessions: Session[] = []

  // Feature T4-9: Cumulative session token counter
  @state() private sessionTotalInputTokens = 0
  @state() private sessionTotalOutputTokens = 0
  @state() private sessionTotalCostUsd = 0
  @state() private sessionTurnCount = 0

  // Conversation templates (Feature 11)

  // Feature 13: Analytics dashboard
  @state() private showAnalytics = false
  @state() private isAdmin = false
  @state() private analyticsStats: AuditStats | null = null
  @state() private analyticsDaily: AuditDailyEntry[] = []
  @state() private analyticsLoading = false

  // Feature 14: Offline mode banner
  @state() private offlineBanner = false

  // Feature 6 (Conversation Memory): memories panel
  @state() private showMemories = false
  @state() private memories: Memory[] = []
  @state() private memoriesLoading = false
  @state() private memoryAddMode = false
  @state() private memoryFormKey = ''
  @state() private memoryFormValue = ''

  // User settings panel
  @state() private showSettings = false
  @state() private userSettings: import('./api.js').UserSettings = {}
  @state() private settingsLoading = false
  @state() private settingsSaving = false

  // Feature 12: Plugin admin panel (admin only)
  @state() private showPlugins = false
  @state() private plugins: Plugin[] = []
  @state() private pluginsLoading = false
  @state() private pluginAddMode = false
  @state() private pluginForm: PluginCreate = { name: '', description: '', endpoint: '', method: 'POST', auth_header: '', example_payload: '', enabled: true }
  @state() private pluginFormError = ''
  @state() private pluginFormSaving = false

  // User admin panel (admin only)
  @state() private showUsers = false
  @state() private users: UserView[] = []
  @state() private roles: RoleView[] = []
  @state() private usersLoading = false
  @state() private userAddMode = false
  @state() private userFormUsername = ''
  @state() private userFormPassword = ''
  @state() private userFormRoleId = ''
  @state() private userFormError = ''
  @state() private userFormSaving = false
  @state() private userPasswordEditId: string | null = null
  @state() private userPasswordDraft = ''

  private _fileInput: HTMLInputElement | null = null

  private _eventSource: EventSource | null = null
  private _streamGeneration = 0
  private _scrollHandler: (() => void) | null = null
  private _resizeObserver: ResizeObserver | null = null
  private _currentUserId = ''
  private _userScrolled = false
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
    // Theme: always follow HA dashboard theme (no override)
    try { localStorage.removeItem('bonnie-theme') } catch {}
    // Bootstrap only if config is already set (HA sets it before connecting;
    // in the test harness setConfig is called after — setConfig will trigger it)
    if (this.config) {
      this._bootstrap()
    }
    document.addEventListener('keydown', this._onGlobalKeydown)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    // Cancel backend subprocess to stop burning Claude API tokens
    if (this.streamingTurnId && this.sessionToken) {
      void cancelStream(this.config.backend_url, this.sessionToken, this.streamingTurnId)
    }
    this._closeStream()
    this._revokeAttachmentUrls(this.bubbles)
    this._resizeObserver?.disconnect()
    this._topSentinelObserver?.disconnect()
    document.removeEventListener('keydown', this._onGlobalKeydown)
    this._stopListening()
    this._stopSpeaking()
    if (this._toastTimer) { clearTimeout(this._toastTimer); this._toastTimer = null }
    if (this._searchDebounceTimer) { clearTimeout(this._searchDebounceTimer); this._searchDebounceTimer = null }
    // Remove paste listener attached in _setupPasteListener
    if (this._onPaste) {
      const ta = this.shadowRoot?.querySelector<HTMLTextAreaElement>('.composer-textarea')
      if (ta) ta.removeEventListener('paste', this._onPaste as EventListener)
      this._onPaste = null
    }
    // Remove scroll + code-copy listeners to prevent memory leaks
    const msgs = this.shadowRoot?.querySelector('.messages')
    if (msgs) {
      if (this._scrollHandler) { msgs.removeEventListener('scroll', this._scrollHandler); this._scrollHandler = null }
      if ((msgs as any)._copyHandler) { msgs.removeEventListener('click', (msgs as any)._copyHandler); (msgs as any)._copyHandler = null }
    }
  }

  /** Revoke blob: URLs from attachment previews to prevent memory leaks. */
  private _revokeAttachmentUrls(bubbles: Bubble[]): void {
    for (const b of bubbles) {
      if (!b.attachments) continue
      for (const a of b.attachments) {
        if (a.localPreviewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(a.localPreviewUrl)
        }
      }
    }
  }

  override firstUpdated(): void {
    this._setupResizeObserver()
    this._setupScrollListener()
    this._setupCodeCopyListeners()
    this._setupPasteListener()
  }

  override updated(changed: Map<string, unknown>): void {
    super.updated(changed)
    // Re-attach code copy listeners when bubbles change — skip during streaming
    // to avoid queueing microtasks on every SSE chunk
    if (changed.has('bubbles') && !this.streamingTurnId) {
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
    // Feature T4-3: re-attach sentinel observer when visible range or bubbles change
    if (changed.has('visibleStart') || changed.has('bubbles')) {
      if (this.bubbles.length > BonnieCard.VIRT_THRESHOLD && this.visibleStart > 0) {
        this._setupTopSentinel()
      }
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
      // Extract allowed models from the user's role permissions
      const user = auth.user as any
      const models: string[] = user?.role?.permissions?.limits?.allowed_models ?? []
      this.allowedModels = models
      this.selectedModel = this.config.model ?? models[0] ?? ''
      // Feature 13: detect admin role
      this.isAdmin = user?.role?.name === 'admin'
      this._currentUserId = user?.id ?? ''
      await this._loadSessions()
      // Feature 2: Request browser notification permission for proactive alerts
      this._requestNotificationPermission()
      this._loadTtsVoices()
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

  private _requestNotificationPermission(): void {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {
        // Ignore — permission denied or API not available
      })
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

  // ── Feature 13: Analytics ─────────────────────────────────────────────────

  private async _openAnalytics(): Promise<void> {
    if (!this.sessionToken) return
    this.showAnalytics = true
    this.analyticsLoading = true
    try {
      const [stats, daily] = await Promise.all([
        fetchAuditStats(this.config.backend_url, this.sessionToken),
        fetchAuditDaily(this.config.backend_url, this.sessionToken, 7),
      ])
      this.analyticsStats = stats
      this.analyticsDaily = daily
    } catch {
      // Non-fatal — show whatever loaded
    } finally {
      this.analyticsLoading = false
    }
  }

  private _closeAnalytics(): void {
    this.showAnalytics = false
  }

  // ── User Settings panel ──────────────────────────────────────────────────

  private async _openSettings(): Promise<void> {
    this.showSettings = true
    this.settingsLoading = true
    try {
      this.userSettings = await fetchSettings(this.config.backend_url, this.sessionToken!)
    } catch {
      this.userSettings = {}
    } finally {
      this.settingsLoading = false
    }
  }

  private _closeSettings(): void {
    this.showSettings = false
  }

  private async _saveSettings(patch: Partial<UserSettings>): Promise<void> {
    if (!this.sessionToken) return
    this.settingsSaving = true
    try {
      this.userSettings = await patchSettings(this.config.backend_url, this.sessionToken, patch)
      this._showToast('Settings saved')
    } catch {
      this._showToast('Failed to save settings')
    } finally {
      this.settingsSaving = false
    }
  }

  // ── Feature 6: Conversation Memory ────────────────────────────────────────

  private async _openMemories(): Promise<void> {
    this.showMemories = true
    this.memoriesLoading = true
    try {
      this.memories = await listMemories(this.config.backend_url, this.sessionToken!)
    } catch {
      this.memories = []
    } finally {
      this.memoriesLoading = false
    }
  }

  private _closeMemories(): void {
    this.showMemories = false
  }

  private async _deleteMemory(memId: string): Promise<void> {
    if (!this.sessionToken) return
    try {
      await deleteMemory(this.config.backend_url, this.sessionToken, memId)
      this.memories = this.memories.filter((m) => m.id !== memId)
    } catch {
      // best-effort; ignore
    }
  }

  private async _addMemory(): Promise<void> {
    if (!this.sessionToken || !this.memoryFormKey.trim() || !this.memoryFormValue.trim()) return
    try {
      const mem = await createMemory(this.config.backend_url, this.sessionToken, this.memoryFormKey.trim(), this.memoryFormValue.trim())
      this.memories = [mem, ...this.memories]
      this.memoryFormKey = ''
      this.memoryFormValue = ''
      this.memoryAddMode = false
    } catch {
      this._showToast('Failed to save memory')
    }
  }

  // ── Feature 12: Plugin admin panel ───────────────────────────────────────

  private async _openPlugins(): Promise<void> {
    this.showPlugins = true
    this.pluginsLoading = true
    this.pluginAddMode = false
    this.pluginFormError = ''
    try {
      this.plugins = await listPlugins(this.config.backend_url, this.sessionToken!)
    } catch {
      this.plugins = []
    } finally {
      this.pluginsLoading = false
    }
  }

  private _closePlugins(): void {
    this.showPlugins = false
    this.pluginAddMode = false
    this.pluginFormError = ''
  }

  private async _togglePluginEnabled(plugin: Plugin): Promise<void> {
    if (!this.sessionToken) return
    try {
      const updated = await updatePlugin(this.config.backend_url, this.sessionToken, plugin.id, { enabled: !plugin.enabled })
      this.plugins = this.plugins.map((p) => p.id === plugin.id ? updated : p)
    } catch {
      // best-effort
    }
  }

  private async _deletePlugin(pluginId: string): Promise<void> {
    if (!this.sessionToken) return
    try {
      await deletePlugin(this.config.backend_url, this.sessionToken, pluginId)
      this.plugins = this.plugins.filter((p) => p.id !== pluginId)
    } catch {
      // best-effort
    }
  }

  private async _saveNewPlugin(): Promise<void> {
    if (!this.sessionToken) return
    this.pluginFormError = ''
    const { name, description, endpoint } = this.pluginForm
    if (!name.trim() || !description.trim() || !endpoint.trim()) {
      this.pluginFormError = 'Name, description and endpoint are required.'
      return
    }
    this.pluginFormSaving = true
    try {
      const created = await createPlugin(this.config.backend_url, this.sessionToken, this.pluginForm)
      this.plugins = [...this.plugins, created]
      this.pluginAddMode = false
      this.pluginForm = { name: '', description: '', endpoint: '', method: 'POST', auth_header: '', example_payload: '', enabled: true }
    } catch (err) {
      this.pluginFormError = err instanceof Error ? err.message : 'Failed to save plugin.'
    } finally {
      this.pluginFormSaving = false
    }
  }

  // ── User admin panel (admin only) ─────────────────────────────────────────

  private async _openUsers(): Promise<void> {
    this.showUsers = true
    this.usersLoading = true
    this.userAddMode = false
    this.userFormError = ''
    this.userPasswordEditId = null
    try {
      const [users, roles] = await Promise.all([
        listUsers(this.config.backend_url, this.sessionToken!),
        listRoles(this.config.backend_url, this.sessionToken!),
      ])
      this.users = users
      this.roles = roles
    } catch {
      this.users = []
      this.roles = []
    } finally {
      this.usersLoading = false
    }
  }

  private _closeUsers(): void {
    this.showUsers = false
    this.userAddMode = false
    this.userFormError = ''
    this.userPasswordEditId = null
  }

  private async _createUser(): Promise<void> {
    if (!this.sessionToken) return
    this.userFormError = ''
    const username = this.userFormUsername.trim()
    const password = this.userFormPassword
    const role_id = this.userFormRoleId
    if (!username || !password) {
      this.userFormError = 'Username and password are required.'
      return
    }
    if (!role_id) {
      this.userFormError = 'Please select a role.'
      return
    }
    this.userFormSaving = true
    try {
      const created = await createUser(this.config.backend_url, this.sessionToken, { username, password, role_id })
      this.users = [...this.users, created]
      this.userAddMode = false
      this.userFormUsername = ''
      this.userFormPassword = ''
      this.userFormRoleId = ''
    } catch (err) {
      this.userFormError = err instanceof Error ? err.message : 'Failed to create user.'
    } finally {
      this.userFormSaving = false
    }
  }

  private async _deleteUser(userId: string): Promise<void> {
    if (!this.sessionToken || userId === this._currentUserId) return
    try {
      await deleteUser(this.config.backend_url, this.sessionToken, userId)
      this.users = this.users.filter((u) => u.id !== userId)
    } catch {
      // best-effort
    }
  }

  private async _changeUserPassword(userId: string): Promise<void> {
    if (!this.sessionToken || !this.userPasswordDraft.trim()) return
    try {
      await changePassword(this.config.backend_url, this.sessionToken, userId, this.userPasswordDraft)
      this.userPasswordEditId = null
      this.userPasswordDraft = ''
      this._showToast('Password updated')
    } catch {
      this._showToast('Failed to update password')
    }
  }

  // ── Feature 14: Offline banner ────────────────────────────────────────────

  private _dismissOfflineBanner(): void {
    this.offlineBanner = false
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

  // ── Session actions ───────────────────────────────────────────────────────

  private async _openSession(id: string): Promise<void> {
    if (!this.sessionToken) return
    this._closeStream()
    this._revokeAttachmentUrls(this.bubbles)
    this.activeSessionId = id
    this.bubbles = []
    this.sidebarOpen = false
    this._userScrolled = false
    this.showScrollToBottom = false
    this.showSystemPromptPanel = false
    this.showMessageSearch = false
    this.messageSearchQuery = ''
    this.messageSearchResults = []
    // T4-9: reset cumulative token counter for this session
    this._resetSessionStats()
    clearMarkdownCache()

    const session = this.sessions.find((s) => s.id === id)
    this.activeSessionTitle = session?.title ?? ''
    this.activeSystemPrompt = session?.system_prompt ?? null
    this.systemPromptDraft = this.activeSystemPrompt ?? ''

    this.sessionLoading = true
    try {
      const detail = await getSession(this.config.backend_url, this.sessionToken, id)
      this.activeSystemPrompt = (detail as any).system_prompt ?? null
      this.systemPromptDraft = this.activeSystemPrompt ?? ''
      this.bubbles = this._turnsToBubbles(detail.turns)
      // Feature T4-3: init visible range
      this._initVisibleRange()
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
    this._revokeAttachmentUrls(this.bubbles)
    this.sidebarOpen = false
    this.editingBubbleId = null
    this.showSystemPromptPanel = false
    this.showMessageSearch = false
    this.messageSearchQuery = ''
    this.messageSearchResults = []
    this.activeSystemPrompt = null
    this.systemPromptDraft = ''
    // T4-9: reset cumulative token counter for new session
    this._resetSessionStats()
    clearMarkdownCache()
    try {
      const ts = new Date().toLocaleString(undefined, {
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
      this._initVisibleRange()
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
        this._revokeAttachmentUrls(this.bubbles)
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

  // ── Conversation templates ────────────────────────────────────────────────

  // ── Feature 2: Personalized suggested prompts ────────────────────────────
  // Combines locale-specific defaults with up to 2 recent session titles.

  private _buildSuggestedPrompts(): string[] {
    const defaults = [...suggestedPrompts()]
    // Grab last 5 non-archived sessions, filter out auto-generated titles
    const recentTitles = this.sessions
      .filter((s) => !s.archived)
      .slice(0, 5)
      .map((s) => s.title?.trim())
      .filter((title): title is string =>
        !!title &&
        !BonnieCard.AUTO_TITLE_RE.test(title) &&
        title.length > 3 &&
        title.length < 60,
      )
    // Convert to "Continue: <title>" prompts, deduplicate against defaults
    const recent = recentTitles
      .slice(0, 2)
      .map((title) => `Continue: ${title}`)
      .filter((p) => !defaults.includes(p))
    return [...defaults, ...recent]
  }

  private _onRenameKeydown(e: KeyboardEvent, id: string): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      void this._commitRename(id)
    } else if (e.key === 'Escape') {
      this._cancelRename()
    }
  }

  // ── Feature T4-1: Per-conversation system prompt ──────────────────────────

  private _toggleSystemPromptPanel(): void {
    this.showSystemPromptPanel = !this.showSystemPromptPanel
    if (this.showSystemPromptPanel) {
      this.showMessageSearch = false
      this.systemPromptDraft = this.activeSystemPrompt ?? ''
      this.updateComplete.then(() => {
        const ta = this.shadowRoot?.querySelector<HTMLTextAreaElement>('.system-prompt-textarea')
        ta?.focus()
      })
    }
  }

  private async _saveSystemPrompt(): Promise<void> {
    if (!this.sessionToken || !this.activeSessionId) return
    const prompt = this.systemPromptDraft.trim() || null
    this.activeSystemPrompt = prompt
    this.showSystemPromptPanel = false
    await updateSessionSystemPrompt(this.config.backend_url, this.sessionToken, this.activeSessionId, prompt)
    // Update local sessions list
    this.sessions = this.sessions.map((s) =>
      s.id === this.activeSessionId ? { ...s, system_prompt: prompt } : s
    )
  }

  private _clearSystemPrompt(): void {
    this.systemPromptDraft = ''
  }

  // ── Feature T4-2: Message search ─────────────────────────────────────────

  private _toggleMessageSearch(): void {
    this.showMessageSearch = !this.showMessageSearch
    if (this.showMessageSearch) {
      this.showSystemPromptPanel = false
      this.messageSearchQuery = ''
      this.messageSearchResults = []
      this.updateComplete.then(() => {
        const input = this.shadowRoot?.querySelector<HTMLInputElement>('.msg-search-input')
        input?.focus()
      })
    }
  }

  private _onMessageSearchInput(e: Event): void {
    this.messageSearchQuery = (e.target as HTMLInputElement).value
    if (this._searchDebounceTimer) clearTimeout(this._searchDebounceTimer)
    if (!this.messageSearchQuery.trim()) {
      this.messageSearchResults = []
      return
    }
    this._searchDebounceTimer = setTimeout(() => void this._doMessageSearch(), 300)
  }

  private async _doMessageSearch(): Promise<void> {
    if (!this.sessionToken || !this.activeSessionId || !this.messageSearchQuery.trim()) return
    this.messageSearchLoading = true
    try {
      this.messageSearchResults = await searchSession(
        this.config.backend_url,
        this.sessionToken,
        this.activeSessionId,
        this.messageSearchQuery.trim(),
      )
    } catch {
      this.messageSearchResults = []
    } finally {
      this.messageSearchLoading = false
    }
  }

  private _scrollToTurn(turnId: string): void {
    // Find the bubble index whose source turn_id matches — we store them by uid()
    // so we can't match directly. Instead we scroll by searching for turn_id in
    // bubble data-turn-id attributes (set in render).
    const el = this.shadowRoot?.querySelector(`[data-turn-id="${turnId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('search-highlight-flash')
      setTimeout(() => el.classList.remove('search-highlight-flash'), 1500)
    }
  }

  private _highlightSnippet(snippet: string): string {
    // HTML-escape the server-supplied snippet before inserting <mark> tags
    // to prevent XSS via crafted search result snippets.
    const safe = snippet
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
    if (!this.messageSearchQuery) return safe
    const escapedQuery = this.messageSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return safe.replace(new RegExp(`(${escapedQuery})`, 'gi'), '<mark>$1</mark>')
  }

  private _turnsToBubbles(turns: RawTurn[]): Bubble[] {
    const out: Bubble[] = []
    for (const turn of turns) {
      // User bubble from user_message
      if (turn.user_message) {
        out.push({ id: uid(), role: 'user', text: turn.user_message, turnId: turn.id })
      }

      if (!Array.isArray(turn.events)) continue

      // Reconstruct assistant + tool bubbles from stored events
      let lastAssistantBubble: Bubble | null = null
      let lastToolBubble: Bubble | null = null
      let turnStats: TurnStats | undefined

      for (const ev of turn.events) {
        if (ev.type === 'assistant') {
          const isOffline = !!ev.offline
          for (const block of ev.message?.content ?? []) {
            if (block.type === 'text') {
              if (!lastAssistantBubble) {
                lastAssistantBubble = { id: uid(), role: 'assistant', text: '', turnId: turn.id }
                out.push(lastAssistantBubble)
              }
              lastAssistantBubble.text = (lastAssistantBubble.text ?? '') + block.text
              if (isOffline) lastAssistantBubble.error = false // offline fallback, not error
            } else if (block.type === 'tool_use') {
              // Close current assistant bubble
              lastAssistantBubble = null
              lastToolBubble = {
                id: uid(),
                role: 'tool',
                toolName: block.name,
                toolInput: block.input,
                turnId: turn.id,
              }
              out.push(lastToolBubble)
            }
          }
        } else if (ev.type === 'user') {
          // tool_result events
          for (const block of ev.message?.content ?? []) {
            if (block.type === 'tool_result' && lastToolBubble) {
              lastToolBubble.toolResult = block.content
              lastToolBubble = null
            }
          }
        } else if (ev.type === 'result') {
          // Attach stats to last assistant bubble
          turnStats = {}
          if (ev.usage?.input_tokens !== undefined) turnStats.inputTokens = ev.usage.input_tokens
          if (ev.usage?.output_tokens !== undefined) turnStats.outputTokens = ev.usage.output_tokens
          if (ev.total_cost_usd !== undefined) turnStats.costUsd = ev.total_cost_usd
          if (ev.duration_ms !== undefined) turnStats.durationMs = ev.duration_ms
          if (ev.subtype === 'error' && lastAssistantBubble) {
            lastAssistantBubble.error = true
          }
        } else if (ev.type === '_error') {
          // Mark last assistant bubble as error
          if (lastAssistantBubble) lastAssistantBubble.error = true
        }
      }

      // Attach stats to last assistant bubble in this turn
      if (turnStats && Object.keys(turnStats).length > 0) {
        const lastAst = [...out].reverse().find((b) => b.role === 'assistant' && b.turnId === turn.id)
        if (lastAst) lastAst.stats = turnStats
        this._accumulateSessionStats(turnStats)
      }
    }
    return out
  }

  // ── Chat / stream ─────────────────────────────────────────────────────────

  private async _send(messageOverride?: string): Promise<void> {
    const text = (messageOverride ?? this.draft).trim()
    const hasAttachments = this.pendingAttachments.length > 0
    if (!text && !hasAttachments) return
    if (!this.sessionToken || this.streamingTurnId) return

    // Build the message with attachment refs appended
    const attachmentRefs = this.pendingAttachments.map((a) => `[Attached image: ${a.path}]`).join('\n')
    const messageWithAttachments = attachmentRefs
      ? (text ? `${text}\n\n${attachmentRefs}` : attachmentRefs)
      : text

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
    this._lastUserMessageText = messageWithAttachments

    // Snapshot attachments then clear pending list
    const sentAttachments = this.pendingAttachments.slice()
    this.pendingAttachments = []

    // Add user bubble immediately with animation
    const userBubble: Bubble = {
      id: uid(),
      role: 'user',
      text: text || undefined,
      isNew: true,
      attachments: sentAttachments.length ? sentAttachments : undefined,
    }
    this.bubbles = [...this.bubbles, userBubble]
    // Feature T4-3: extend visible range to include new bubble
    if (this.bubbles.length > BonnieCard.VIRT_THRESHOLD) {
      this.visibleEnd = this.bubbles.length
    }
    this._scrollBottom()

    // Remove isNew after animation
    setTimeout(() => {
      this.bubbles = this.bubbles.map((b) => b.id === userBubble.id ? { ...b, isNew: false } : b)
    }, 300)

    try {
      const paths = sentAttachments.filter((a) => a.path).map((a) => a.path!)
      const { turn_id } = await postChat(
        this.config.backend_url,
        this.sessionToken,
        this.activeSessionId,
        messageWithAttachments,
        this.selectedModel || this.config.model,
        paths.length > 0 ? paths : undefined,
      )
      this.streamingTurnId = turn_id
      this._turnStartTime = Date.now()
      void this._openStream(turn_id)
    } catch (e) {
      this._handleApiError(e)
      this.streamingTurnId = null
      // Remove orphaned user bubble and restore draft
      this.bubbles = this.bubbles.filter((b) => b.id !== userBubble.id)
      this.draft = text
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

  // ── Pin / archive ─────────────────────────────────────────────────────────

  private async _togglePin(s: Session, e: Event): Promise<void> {
    e.stopPropagation()
    if (!this.sessionToken) return
    const newPinned = !(s.pinned === 1)
    try {
      await patchSession(this.config.backend_url, this.sessionToken, s.id, { pinned: newPinned })
      await this._loadSessions()
    } catch {}
  }

  private async _archiveSession(s: Session, e: Event): Promise<void> {
    e.stopPropagation()
    if (!this.sessionToken) return
    try {
      await patchSession(this.config.backend_url, this.sessionToken, s.id, { archived: true })
      // If current session was archived, open a new one
      if (this.activeSessionId === s.id) {
        await this._newSession()
      }
      await this._loadSessions()
      if (this.showArchivedSessions) await this._loadArchivedSessions()
    } catch (e) { this._handleApiError(e) }
  }

  private async _unarchiveSession(s: Session, e: Event): Promise<void> {
    e.stopPropagation()
    if (!this.sessionToken) return
    try {
      await patchSession(this.config.backend_url, this.sessionToken, s.id, { archived: false })
      await this._loadSessions()
      await this._loadArchivedSessions()
    } catch (e) { this._handleApiError(e) }
  }

  private async _loadArchivedSessions(): Promise<void> {
    if (!this.sessionToken) return
    try {
      this.archivedSessions = await listSessionsArchived(this.config.backend_url, this.sessionToken)
    } catch {}
  }

  private async _toggleArchivedView(): Promise<void> {
    this.showArchivedSessions = !this.showArchivedSessions
    if (this.showArchivedSessions) await this._loadArchivedSessions()
  }

  private _submitEdit(): void {
    const text = this.editDraft.trim()
    const editId = this.editingBubbleId
    this.editingBubbleId = null
    this.editDraft = ''
    if (!text || !editId) return

    // Check if the edited bubble is the last user message in the conversation.
    // If not → fork. If yes (or no prior context) → plain send.
    const userBubbles = this.bubbles.filter((b) => b.role === 'user')
    const editedBubble = this.bubbles.find((b) => b.id === editId)
    const isLastUserMsg = userBubbles.length > 0 && userBubbles[userBubbles.length - 1].id === editId

    if (!isLastUserMsg && editedBubble?.turnId && this.activeSessionId && this.sessionToken) {
      void this._forkAndOpen(editedBubble.turnId, text)
    } else {
      void this._send(text)
    }
  }

  private async _forkAndOpen(fromTurnId: string, newMessage: string): Promise<void> {
    if (!this.activeSessionId || !this.sessionToken) return
    try {
      const result = await forkSession(
        this.config.backend_url,
        this.sessionToken,
        this.activeSessionId,
        fromTurnId,
        newMessage,
      )
      // Refresh session list to include the new forked session
      await this._loadSessions()
      // Open the new forked session
      await this._openSession(result.session_id)
      // Set streamingTurnId BEFORE opening the stream so any synchronous
      // render triggered inside _openStream sees the correct turn ID.
      this.streamingTurnId = result.turn_id
      void this._openStream(result.turn_id)
      this._showToast('Conversation forked') // intentionally not translated (dev message)

    } catch (e) {
      this.errorMessage = e instanceof Error ? e.message : 'Fork failed'
    }
  }

  private async _openStream(turnId: string): Promise<void> {
    this._closeStream()
    const gen = ++this._streamGeneration
    // Fetch a short-lived ticket so the session token never appears in the SSE URL
    let url: string
    try {
      const ticket = await requestStreamTicket(this.config.backend_url, this.sessionToken!, turnId)
      url = streamUrl(this.config.backend_url, ticket, turnId, true)
    } catch {
      // Fall back to bearer-in-query-param if ticket endpoint is unavailable
      url = streamUrl(this.config.backend_url, this.sessionToken!, turnId)
    }
    // Guard: if user navigated away during the await, abort
    if (gen !== this._streamGeneration) return
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
        // Feature 14: detect offline fallback — backend marks these with `offline: true`
        const isOfflineFallback = !!(parsed as any).offline
        if (isOfflineFallback) {
          this.offlineBanner = true
        }
        for (const block of parsed.message.content) {
          if (block.type === 'text') {
            if (!currentAssistantId) {
              const bubble: Bubble = { id: uid(), role: 'assistant', text: '', streaming: true, isNew: true }
              currentAssistantId = bubble.id
              const aSnapId = bubble.id
              this.bubbles = [...this.bubbles, bubble]
              setTimeout(() => {
                this.bubbles = this.bubbles.map((b) => b.id === aSnapId ? { ...b, isNew: false } : b)
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
            const tSnapId = toolBubble.id
            this.bubbles = [...this.bubbles, toolBubble]
            setTimeout(() => {
              this.bubbles = this.bubbles.map((b) => b.id === tSnapId ? { ...b, isNew: false } : b)
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
        // T4-9: accumulate session-level token totals
        if (Object.keys(stats).length > 0) {
          this._accumulateSessionStats(stats)
        }
        // Feature 14: clear offline banner on successful turn
        if (parsed.subtype !== 'error') {
          this.offlineBanner = false
        }
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

    es.onerror = (e: Event) => {
      const target = e.target as EventSource
      if (target.readyState === EventSource.CONNECTING) {
        // Browser is attempting reconnect — server closed naturally without
        // sending an explicit `done` event. Close the ES to stop retries.
        // If there's an active streaming bubble, mark it done (not error)
        // but flag that the response may be incomplete.
        target.close()
        const hasStreamingBubble = this.bubbles.some((b) => b.streaming)
        if (hasStreamingBubble) {
          this.bubbles = this.bubbles.map((b) =>
            b.streaming
              ? { ...b, streaming: false, text: (b.text ?? '') + ` *${t('responseIncomplete')}*` }
              : b,
          )
          this._showToast(t('connectionClosed'))
        }
        this._finishStream()
        return
      }
      // readyState === CLOSED (2): genuine connection failure
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
    // Extend visible range to include the newly added bubbles
    if (this.bubbles.length > 50) {
      this.visibleEnd = this.bubbles.length
    }
    // Auto-speak last assistant bubble if enabled
    if (this.ttsAutoSpeak && this.hasSpeechSynthesis) {
      const lastAst = [...this.bubbles].reverse().find((b) => b.role === 'assistant' && b.text)
      if (lastAst) this._speak(lastAst.id, lastAst.text!)
    }
    void this._loadSessions()
  }

  // ── Feature T4-9: Session token counter helpers ──────────────────────────

  private _resetSessionStats(): void {
    this.sessionTotalInputTokens = 0
    this.sessionTotalOutputTokens = 0
    this.sessionTotalCostUsd = 0
    this.sessionTurnCount = 0
  }

  private _accumulateSessionStats(stats: TurnStats): void {
    if (stats.inputTokens != null) this.sessionTotalInputTokens += stats.inputTokens
    if (stats.outputTokens != null) this.sessionTotalOutputTokens += stats.outputTokens
    if (stats.costUsd != null) this.sessionTotalCostUsd += stats.costUsd
    this.sessionTurnCount += 1
  }

  private _formatTokenCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return String(n)
  }

  private _renderSessionTokenBar(): TemplateResult | typeof nothing {
    const total = this.sessionTotalInputTokens + this.sessionTotalOutputTokens
    if (total === 0) return nothing
    const hasCost = this.sessionTotalCostUsd > 0
    return html`
      <div class="session-token-bar">
        <span class="token-bar-tokens">${this._formatTokenCount(total)} ${t('tokens')}</span>
        ${hasCost ? html`<span class="token-bar-sep">·</span><span class="token-bar-cost">$${this.sessionTotalCostUsd.toFixed(4)}</span>` : nothing}
        <span class="token-bar-sep">·</span>
        <span class="token-bar-turns">${this.sessionTurnCount} ${this.sessionTurnCount === 1 ? t('turn') : t('turns')}</span>
      </div>
    `
  }

  // ── Feature T4-3: Virtualization helpers ─────────────────────────────────

  private static readonly VIRT_THRESHOLD = 50
  private static readonly VIRT_BUFFER = 15 // extra bubbles to keep rendered above/below viewport

  private _initVisibleRange(): void {
    const n = this.bubbles.length
    if (n <= BonnieCard.VIRT_THRESHOLD) {
      this.visibleStart = 0
      this.visibleEnd = n
    } else {
      // Show the last VIRT_THRESHOLD + BUFFER bubbles on initial load
      this.visibleStart = Math.max(0, n - BonnieCard.VIRT_THRESHOLD)
      this.visibleEnd = n
    }
  }

  private _setupTopSentinel(): void {
    this._topSentinelObserver?.disconnect()
    const sentinel = this.shadowRoot?.querySelector('.virt-top-sentinel')
    if (!sentinel) return
    this._topSentinelObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && this.visibleStart > 0) {
            // Load earlier messages
            const newStart = Math.max(0, this.visibleStart - BonnieCard.VIRT_THRESHOLD)
            this.visibleStart = newStart
          }
        }
      },
      { root: this.shadowRoot?.querySelector('.messages'), threshold: 0.1 }
    )
    this._topSentinelObserver.observe(sentinel)
  }

  // Feature 3: Auto-title from first user message
  private async _maybeAutoTitle(): Promise<void> {
    if (!this.sessionToken || !this.activeSessionId) return
    const capturedSessionId = this.activeSessionId
    const session = this.sessions.find((s) => s.id === capturedSessionId)
    if (!session) return
    const isAutoTitle = !session.title || session.title === '' ||
      BonnieCard.AUTO_TITLE_RE.test(session.title)
    if (!isAutoTitle) return

    // Get first user message text
    const firstUser = this.bubbles.find((b) => b.role === 'user')
    if (!firstUser?.text) return

    // Derive title: first 60 chars trimmed to word boundary
    let title = firstUser.text.slice(0, 60)
    if (firstUser.text.length > 60) {
      const lastSpace = title.lastIndexOf(' ')
      if (lastSpace > 20) title = title.slice(0, lastSpace)
    }
    title = title.trim()
    if (!title) return

    await updateSessionTitle(this.config.backend_url, this.sessionToken, capturedSessionId!, title)
    // Update local state — only if user is still on the same session
    this.sessions = this.sessions.map((s) => s.id === capturedSessionId ? { ...s, title } : s)
    if (this.activeSessionId === capturedSessionId) this.activeSessionTitle = title
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
    if (!SpeechRecognition) {
      this.errorMessage = 'Dictation not available in this browser. Try Chrome or Safari over HTTPS.'
      setTimeout(() => { this.errorMessage = null }, 4000)
      return
    }

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

  // ── TTS (Web Speech Synthesis) ───────────────────────────────────────────

  private _loadTtsVoices(): void {
    if (!this.hasSpeechSynthesis) return
    const update = () => { this.ttsVoices = window.speechSynthesis.getVoices() }
    update()
    // Chrome loads voices async
    window.speechSynthesis.onvoiceschanged = update
  }

  private _stripMarkdown(text: string): string {
    // Remove code blocks entirely (don't speak code)
    let out = text.replace(/```[\s\S]*?```/g, ' code block ')
    // Remove inline code
    out = out.replace(/`[^`]*`/g, '')
    // Remove markdown syntax
    out = out.replace(/\*\*([^*]+)\*\*/g, '$1')
    out = out.replace(/\*([^*]+)\*/g, '$1')
    out = out.replace(/~~([^~]+)~~/g, '$1')
    out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    out = out.replace(/#+\s*/g, '')
    out = out.replace(/<[^>]+>/g, '')
    return out.trim()
  }

  private _speak(bubbleId: string, text: string): void {
    if (!this.hasSpeechSynthesis) return
    window.speechSynthesis.cancel()
    const clean = this._stripMarkdown(text)
    if (!clean) return
    const utter = new SpeechSynthesisUtterance(clean)
    if (this.ttsVoiceName) {
      const v = this.ttsVoices.find((vv) => vv.name === this.ttsVoiceName)
      if (v) utter.voice = v
    }
    utter.rate = 1
    utter.pitch = 1
    utter.onstart = () => { this.speakingBubbleId = bubbleId }
    utter.onend = () => { if (this.speakingBubbleId === bubbleId) this.speakingBubbleId = null }
    utter.onerror = () => { if (this.speakingBubbleId === bubbleId) this.speakingBubbleId = null }
    window.speechSynthesis.speak(utter)
  }

  private _stopSpeaking(): void {
    if (!this.hasSpeechSynthesis) return
    window.speechSynthesis.cancel()
    this.speakingBubbleId = null
  }

  private _toggleSpeak(bubbleId: string, text: string): void {
    if (!this.hasSpeechSynthesis) {
      this.errorMessage = 'Text-to-speech not available in this browser.'
      setTimeout(() => { this.errorMessage = null }, 4000)
      return
    }
    if (this.speakingBubbleId === bubbleId) {
      this._stopSpeaking()
    } else {
      this._speak(bubbleId, text)
    }
  }

  private _setAutoSpeak(enabled: boolean): void {
    this.ttsAutoSpeak = enabled
    localStorage.setItem('bonnie-tts-auto', enabled ? '1' : '0')
  }

  private _setTtsVoice(name: string): void {
    this.ttsVoiceName = name
    localStorage.setItem('bonnie-tts-voice', name)
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

  // Feature 14: Copy full conversation to clipboard
  private async _copyAllConversation(): Promise<void> {
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
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      this._showToast('Conversation copied')
    } catch {
      this._showToast('Copy failed')
    }
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

  // ── Feature 11: Image upload ──────────────────────────────────────────────

  private _ensureFileInput(): HTMLInputElement {
    if (!this._fileInput) {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/png,image/jpeg,image/webp,image/gif,.pdf,.txt,.csv'
      input.multiple = true
      input.style.display = 'none'
      input.addEventListener('change', () => void this._onFilesSelected(input))
      this.shadowRoot!.appendChild(input)
      this._fileInput = input
    }
    return this._fileInput
  }

  private _openFilePicker(): void {
    if (this.pendingAttachments.length >= 3) {
      this._showToast('Max 3 attachments per message')
      return
    }
    const input = this._ensureFileInput()
    input.value = ''
    input.click()
  }

  private async _onFilesSelected(source: HTMLInputElement | File[]): Promise<void> {
    const files = Array.isArray(source) ? source : Array.from(source.files ?? [])
    if (!files.length) return

    const remaining = 3 - this.pendingAttachments.length
    if (files.length > remaining) {
      this._showToast(`Max 3 attachments per message`)
    }
    const toUpload = files.slice(0, remaining)

    await Promise.all(toUpload.map((file) => this._uploadFile(file)))
  }

  // ── Feature 12: Paste image handler ───────────────────────────────────────

  private _setupPasteListener(): void {
    this._onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const images = Array.from(items).filter((i) => i.type.startsWith('image/'))
      if (images.length === 0) return
      e.preventDefault()
      const files = images.map((i) => i.getAsFile()).filter(Boolean) as File[]
      void this._onFilesSelected(files)
    }
    this.updateComplete.then(() => {
      const ta = this.shadowRoot?.querySelector<HTMLTextAreaElement>('.composer-textarea')
      if (ta && this._onPaste) {
        ta.addEventListener('paste', this._onPaste as EventListener)
      }
    })
  }

  // ── Feature: Drag-and-drop image upload ────────────────────────────────────

  private _handleDroppedFiles(e: DragEvent): void {
    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    const accepted = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/csv']
    const valid = Array.from(files).filter((f) => accepted.includes(f.type))
    if (valid.length === 0) return
    void this._onFilesSelected(valid)
  }

  private async _uploadFile(file: File): Promise<void> {
    if (!this.sessionToken) return

    const localPreviewUrl = URL.createObjectURL(file)
    // Create a placeholder chip (uploading state)
    const placeholderId = `uploading-${uid()}`
    const placeholder: UploadedAttachment = {
      uploadId: placeholderId,
      filename: file.name,
      path: '',
      mimeType: file.type,
      size: file.size,
      localPreviewUrl,
    }
    this.pendingAttachments = [...this.pendingAttachments, placeholder]
    this.uploadingCount++

    try {
      const res = await uploadImage(this.config.backend_url, this.sessionToken, file)
      // Replace placeholder with real attachment
      this.pendingAttachments = this.pendingAttachments.map((a) =>
        a.uploadId === placeholderId
          ? {
              uploadId: res.upload_id,
              filename: res.filename,
              path: res.path,
              mimeType: res.mime_type,
              size: res.size,
              localPreviewUrl,
            }
          : a,
      )
    } catch (err) {
      // Mark as error, auto-remove after 4 s
      this.pendingAttachments = this.pendingAttachments.map((a) =>
        a.uploadId === placeholderId ? { ...a, uploadId: `error-${placeholderId}` } : a,
      )
      const errorId = `error-${placeholderId}`
      setTimeout(() => {
        this.pendingAttachments = this.pendingAttachments.filter((a) => a.uploadId !== errorId)
        URL.revokeObjectURL(localPreviewUrl)
      }, 4000)
    } finally {
      this.uploadingCount--
    }
  }

  private _removeAttachment(uploadId: string): void {
    const att = this.pendingAttachments.find((a) => a.uploadId === uploadId)
    if (!att) return
    // Revoke preview URL — skip for error chips (auto-removal timer handles those)
    if (!uploadId.startsWith('error-') && att.localPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(att.localPreviewUrl)
    }
    this.pendingAttachments = this.pendingAttachments.filter((a) => a.uploadId !== uploadId)
    // Best-effort delete from server (only for successfully uploaded files)
    if (!uploadId.startsWith('uploading-') && !uploadId.startsWith('error-') && this.sessionToken) {
      void deleteUpload(this.config.backend_url, this.sessionToken, uploadId)
    }
  }

  private _openLightbox(url: string): void {
    this.lightboxImage = url
  }

  private _closeLightbox(): void {
    this.lightboxImage = null
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
    let ok = false
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        ok = true
      }
    } catch {}
    if (!ok) {
      // Fallback for HTTP / insecure context (HA over http://)
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.top = '0'
        ta.style.left = '0'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        ta.setSelectionRange(0, text.length)
        ok = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {}
    }
    if (ok) {
      this.copiedMsgId = id
      setTimeout(() => {
        if (this.copiedMsgId === id) this.copiedMsgId = null
      }, 2000)
    } else {
      this.errorMessage = 'Copy blocked by browser (HA not on HTTPS). Long-press the text to select.'
      setTimeout(() => { this.errorMessage = null }, 4000)
    }
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
      this._scrollHandler = () => {
        const el = msgs as HTMLElement
        const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
        if (isAtBottom) {
          this._userScrolled = false
          this.showScrollToBottom = false
        } else {
          this._userScrolled = true
        }
      }
      msgs.addEventListener('scroll', this._scrollHandler, { passive: true })
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

  // ── Feature 15: Session navigation shortcuts ─────────────────────────────

  private _navigateSession(direction: 'prev' | 'next'): void {
    const sessions = this.filteredSessions
    if (sessions.length === 0) return
    const idx = sessions.findIndex((s) => s.id === this.activeSessionId)
    let next: number
    if (idx === -1) {
      next = direction === 'prev' ? sessions.length - 1 : 0
    } else {
      next = direction === 'prev' ? idx - 1 : idx + 1
    }
    if (next < 0 || next >= sessions.length) return
    void this._openSession(sessions[next].id)
  }

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
    } else if (isMod && e.key === '[') {
      e.preventDefault()
      this._navigateSession('prev')
    } else if (isMod && e.key === ']') {
      e.preventDefault()
      this._navigateSession('next')
    } else if (e.key === 'Escape' && this.lightboxImage) {
      this.lightboxImage = null
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
    // Hide tool-use bubbles for non-admin users — show only the final answer
    if (b.role === 'tool' && !this.isAdmin) return html``
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
      <div class=${classMap({ 'bubble-row': true, [b.role]: true, 'new-msg': !!b.isNew })} data-turn-id=${b.turnId ?? ''}>
        <!-- Message action bar (shown on hover) -->
        <div class="msg-actions">
          <button
            class=${classMap({ 'msg-action-btn': true, copied: isCopied })}
            aria-label=${isCopied ? 'Copied' : 'Copy message'}
            @click=${(e: Event) => this._copyMessage(b.id, b.text ?? '', e)}
            title="Copy"
          >
            ${isCopied ? svgCheck() : svgCopy()}
            ${isCopied ? html`<span>Copied</span>` : html`<span>Copy</span>`}
          </button>
          ${isUser ? html`
            <button
              class="msg-action-btn"
              aria-label="Edit message"
              @click=${(e: Event) => this._startEditBubble(b, e)}
              title="Edit"
            >
              ${svgEdit()}
              <span>Edit</span>
            </button>
          ` : nothing}
          ${!isUser && b.text ? html`
            <button
              class=${classMap({ 'msg-action-btn': true, speaking: this.speakingBubbleId === b.id })}
              aria-label=${this.speakingBubbleId === b.id ? 'Stop speaking' : 'Speak message'}
              @click=${() => this._toggleSpeak(b.id, b.text ?? '')}
              title=${this.speakingBubbleId === b.id ? 'Stop' : 'Speak'}
            >
              ${this.speakingBubbleId === b.id ? svgVolumeOff() : svgVolume()}
              <span>${this.speakingBubbleId === b.id ? 'Stop' : 'Speak'}</span>
            </button>
          ` : nothing}
          ${isLastAssistant ? html`
            <button
              class="msg-action-btn"
              aria-label="Regenerate response"
              @click=${() => this._regenerate()}
              title="Regenerate"
            >
              ${svgRefresh()}
              <span>Retry</span>
            </button>
          ` : nothing}
        </div>

        <div class=${classMap({ bubble: true, [b.role]: true, error: !!b.error })}>
          ${isUser && b.attachments?.length ? html`
            <div class="bubble-attachments">
              ${b.attachments.map((a) => {
                const isImg = a.mimeType.startsWith('image/')
                return isImg
                  ? html`<img
                      src=${a.localPreviewUrl}
                      alt=${a.filename}
                      title=${a.filename}
                      @click=${() => this._openLightbox(a.localPreviewUrl)}
                    />`
                  : html`<span class="bubble-file-chip" title=${a.filename}>
                      ${a.mimeType === 'application/pdf' ? '\u{1F4C4}' : '\u{1F4DD}'} ${a.filename}
                    </span>`
              })}
            </div>
          ` : nothing}
          ${isUser
            ? (b.text ? b.text : nothing)
            : html_}
        </div>

        <!-- Feature 7: Token/cost stats footer -->
        ${!isUser && !b.streaming && b.stats && (b.stats.outputTokens || b.stats.costUsd) ? html`
          <div class="turn-stats">
            ${b.stats.outputTokens ? html`${b.stats.outputTokens} tok` : nothing}${b.stats.inputTokens && b.stats.outputTokens ? html` · in:${b.stats.inputTokens}` : nothing}${b.stats.costUsd !== undefined ? html` · $${b.stats.costUsd.toFixed(5)}` : nothing}${b.stats.durationMs ? html` · ${(b.stats.durationMs / 1000).toFixed(1)}s` : nothing}
          </div>
        ` : nothing}
      </div>

    `
  }

  // ── Feature 9: Typing indicator ────────────────────────────────────────────

  private _renderTypingIndicator(): TemplateResult | typeof nothing {
    // Show only when streaming has started but no assistant text has arrived yet
    if (!this.streamingTurnId) return nothing
    const hasAssistantText = this.bubbles.some((b) => b.streaming && b.text)
    if (hasAssistantText) return nothing
    return html`
      <div class="bubble-row assistant">
        <div class="bubble assistant typing-indicator-bubble">
          <div class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
        </div>
      </div>
    `
  }

  /** Render the permission card once (outside the bubble loop). */
  private _renderPermissionCard(): TemplateResult | typeof nothing {
    if (!this.activePermissionRequest) return nothing
    return html`
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
            <button class="edit-cancel-btn" @click=${() => this._cancelEdit()}>${t('cancel')}</button>
            <button class="edit-send-btn" @click=${() => this._submitEdit()}>${t('send')}</button>
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

  private _renderSessionItem(s: Session, isArchived = false): TemplateResult {
    const isRenaming = this.renamingId === s.id
    const isPinned = s.pinned === 1
    return html`
      <div
        class=${classMap({ 'session-item': true, active: s.id === this.activeSessionId, pinned: isPinned })}
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
              ${isPinned ? html`<span class="pin-indicator" title="Pinned">📌</span>` : nothing}
              <span class="session-item-title">${s.title || 'Untitled'}</span>
              <span class="session-item-time">${relativeTime(s.updated_at)}</span>
            `}
        </div>
        ${!isRenaming ? html`
          <div class="session-actions">
            ${isArchived
              ? html`
                <button
                  class="session-action-btn"
                  aria-label=${t('unarchive')}
                  title=${t('unarchive')}
                  @click=${(e: Event) => this._unarchiveSession(s, e)}
                >${svgUnarchive()}</button>
              `
              : html`
                <button
                  class=${classMap({ 'session-action-btn': true, 'pinned-btn': isPinned })}
                  aria-label=${isPinned ? t('unpin') : t('pin')}
                  title=${isPinned ? t('unpin') : t('pin')}
                  @click=${(e: Event) => this._togglePin(s, e)}
                >${svgPin()}</button>
                <button
                  class="session-action-btn"
                  aria-label=${t('rename')}
                  title=${t('rename')}
                  @click=${(e: Event) => this._startRename(s.id, s.title, e)}
                >${svgPencil()}</button>
                <button
                  class="session-action-btn"
                  aria-label=${t('archive')}
                  title=${t('archive')}
                  @click=${(e: Event) => this._archiveSession(s, e)}
                >${svgArchive()}</button>
                <button
                  class="session-action-btn delete"
                  aria-label=${t('delete')}
                  title=${t('delete')}
                  @click=${(e: Event) => { e.stopPropagation(); this.confirmDeleteId = s.id }}
                >${svgTrash()}</button>
              `}
          </div>
        ` : nothing}
      </div>
    `
  }

  private _renderSidebarContent(): TemplateResult {
    const items = this.filteredSessions
    // Separate pinned from unpinned for display
    const pinnedItems = items.filter((s) => s.pinned === 1)
    const unpinnedItems = items.filter((s) => s.pinned !== 1)
    const groups = groupByDate(unpinnedItems)
    return html`
      <div class="sidebar-top">
        <button class="new-chat-btn" @click=${this._newSession}>
          ${svgPlus()}
          ${t('newConversation')}
        </button>
        <div class="search-wrap">
          <span class="search-icon">${svgSearch()}</span>
          <input
            class="search-input"
            type="text"
            placeholder=${t('searchConversations')}
            .value=${this.searchQuery}
            @input=${(e: Event) => { this.searchQuery = (e.target as HTMLInputElement).value }}
          />
        </div>
      </div>
      ${items.length === 0
        ? html`<div class="session-empty">
            ${this.searchQuery ? 'No matching conversations' : t('noConversations')}
          </div>`
        : html`
          <div class="session-list">
            ${pinnedItems.length > 0 ? html`
              <div class="sidebar-section-label pinned-label">${t('pinned')}</div>
              ${pinnedItems.map((s) => this._renderSessionItem(s))}
            ` : nothing}
            ${groups.map((g) => html`
              <div class="sidebar-section-label">${g.label}</div>
              ${g.sessions.map((s) => this._renderSessionItem(s))}
            `)}
          </div>
        `}
      <!-- Archived toggle -->
      <div class="archived-toggle-wrap">
        <button class="archived-toggle-btn" @click=${() => this._toggleArchivedView()}>
          ${this.showArchivedSessions ? '▾' : '▸'} ${t('archived')}
          ${this.archivedSessions.length > 0 ? html`<span class="archived-count">${this.archivedSessions.length}</span>` : nothing}
        </button>
      </div>
      ${this.showArchivedSessions && this.archivedSessions.length > 0 ? html`
        <div class="session-list archived-list">
          <div class="sidebar-section-label">${t('archived')}</div>
          ${this.archivedSessions.map((s) => this._renderSessionItem(s, true))}
        </div>
      ` : nothing}
      ${this.showArchivedSessions && this.archivedSessions.length === 0 ? html`
        <div class="session-empty" style="font-size:0.75rem;padding:0.5rem 1rem;">No archived conversations</div>
      ` : nothing}
    `
  }

  // Feature T4-3: Virtualized bubble rendering
  private _renderVirtualizedBubbles(): TemplateResult {
    const all = this.bubbles
    const n = all.length
    if (n <= BonnieCard.VIRT_THRESHOLD) {
      // No virtualization needed
      return html`
        ${all.map((b) => this._renderBubble(b))}
        ${this._renderTypingIndicator()}
        ${this._renderPermissionCard()}
      `
    }
    const start = Math.max(0, this.visibleStart)
    const end = Math.min(n, this.visibleEnd || n)
    const visible = all.slice(start, end)

    // Estimate spacer height: roughly 80px per bubble average
    const topSpacerHeight = start * 80
    const bottomBubbles = all.slice(end)
    // We keep bottom bubbles rendered since streaming may add them,
    // but for a large gap we can skip them. For safety, keep end = n during streaming.

    return html`
      ${start > 0 ? html`<div class="virt-top-spacer" style="height:${topSpacerHeight}px"></div>` : nothing}
      <div class="virt-top-sentinel"></div>
      ${visible.map((b) => this._renderBubble(b))}
      ${this._renderTypingIndicator()}
      ${this._renderPermissionCard()}
    `
  }

  /** Ensure a turn's bubbles are in the visible range (for search scroll). */
  private _ensureTurnVisible(turnId: string): void {
    if (this.bubbles.length <= BonnieCard.VIRT_THRESHOLD) return
    const idx = this.bubbles.findIndex((b) => b.turnId === turnId)
    if (idx === -1) return
    if (idx < this.visibleStart || idx >= this.visibleEnd) {
      const buffer = BonnieCard.VIRT_BUFFER
      this.visibleStart = Math.max(0, idx - buffer)
      this.visibleEnd = Math.min(this.bubbles.length, idx + buffer + 1)
    }
  }

  // Feature T4-2: render search result snippet with mark tags
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
    // Can send as long as there's text (or pending attachments) + auth + not already streaming.
    // No active session? _send() auto-creates one.
    const canSend = (!!this.draft.trim() || this.pendingAttachments.length > 0) && !isStreaming && !!this.sessionToken

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
                  <button class="confirm-btn cancel" @click=${() => { this.confirmDeleteId = null }}>${t('cancel')}</button>
                  <button class="confirm-btn danger" @click=${() => this._deleteSession(this.confirmDeleteId!)}>${t('delete')}</button>
                </div>
              </div>
            </div>
          ` : nothing}

          <!-- Settings overlay -->
          ${this.showSettings ? html`
            <div class="analytics-overlay" @click=${() => this._closeSettings()}>
              <div class="analytics-panel" @click=${(e: Event) => e.stopPropagation()}>
                <div class="analytics-header">
                  <span class="analytics-title">${svgGear()} Settings</span>
                  <button class="icon-btn" @click=${() => this._closeSettings()} aria-label="Close">${svgClose()}</button>
                </div>
                ${this.settingsLoading ? html`<div style="padding:1rem;color:var(--bonnie-ink-2)">Loading...</div>` : html`
                  <div style="padding:1rem;display:flex;flex-direction:column;gap:12px;overflow-y:auto;max-height:calc(80vh - 60px)">
                    <div class="settings-field">
                      <label class="settings-label">Tone</label>
                      <select class="sys-prompt-input" .value=${this.userSettings.tone ?? ''}
                        @change=${(e: Event) => void this._saveSettings({ tone: (e.target as HTMLSelectElement).value })}>
                        <option value="">Default</option>
                        <option value="friendly" ?selected=${this.userSettings.tone === 'friendly'}>Friendly</option>
                        <option value="professional" ?selected=${this.userSettings.tone === 'professional'}>Professional</option>
                        <option value="concise" ?selected=${this.userSettings.tone === 'concise'}>Concise</option>
                        <option value="casual" ?selected=${this.userSettings.tone === 'casual'}>Casual</option>
                      </select>
                    </div>
                    <div class="settings-field">
                      <label class="settings-label">Language</label>
                      <select class="sys-prompt-input" .value=${this.userSettings.language ?? ''}
                        @change=${(e: Event) => void this._saveSettings({ language: (e.target as HTMLSelectElement).value })}>
                        <option value="">Auto-detect</option>
                        <option value="en" ?selected=${this.userSettings.language === 'en'}>English</option>
                        <option value="it" ?selected=${this.userSettings.language === 'it'}>Italiano</option>
                      </select>
                    </div>
                    <div class="settings-field">
                      <label class="settings-label">Auto-delete conversations after (days)</label>
                      <input type="number" class="sys-prompt-input" min="0" max="365" placeholder="0 = never"
                        .value=${String(this.userSettings.auto_delete_days ?? '')}
                        @change=${(e: Event) => {
                          const v = parseInt((e.target as HTMLInputElement).value, 10)
                          void this._saveSettings({ auto_delete_days: isNaN(v) ? 0 : v })
                        }}
                      />
                    </div>
                    ${this.hasSpeechSynthesis ? html`
                      <div class="settings-field">
                        <label class="settings-label">
                          <input type="checkbox" .checked=${this.ttsAutoSpeak}
                            @change=${(e: Event) => this._setAutoSpeak((e.target as HTMLInputElement).checked)}
                          />
                          Auto-speak assistant responses
                        </label>
                      </div>
                      <div class="settings-field">
                        <label class="settings-label">Voice</label>
                        <select class="sys-prompt-input" .value=${this.ttsVoiceName}
                          @change=${(e: Event) => this._setTtsVoice((e.target as HTMLSelectElement).value)}>
                          <option value="">Default (browser)</option>
                          ${this.ttsVoices.map((v) => html`
                            <option value=${v.name} ?selected=${this.ttsVoiceName === v.name}>${v.name} (${v.lang})</option>
                          `)}
                        </select>
                      </div>
                    ` : nothing}
                    ${this.settingsSaving ? html`<div style="font-size:0.8rem;color:var(--bonnie-accent)">Saving...</div>` : nothing}
                  </div>
                `}
              </div>
            </div>
          ` : nothing}

          <!-- Feature 13: Analytics overlay -->
          ${this.showAnalytics ? html`
            <div class="analytics-overlay" @click=${() => this._closeAnalytics()}>
              <div class="analytics-panel" @click=${(e: Event) => e.stopPropagation()}>
                <div class="analytics-header">
                  <span class="analytics-title">${svgBarChart()} Usage Analytics</span>
                  <button class="icon-btn" @click=${() => this._closeAnalytics()}>${svgClose()}</button>
                </div>
                ${this.analyticsLoading ? html`
                  <div class="analytics-loading"><div class="loading-spinner"></div></div>
                ` : this.analyticsStats ? html`
                  <!-- Summary row -->
                  <div class="analytics-summary">
                    <div class="analytics-stat">
                      <div class="analytics-stat-value">${this.analyticsStats.total_turns.toLocaleString()}</div>
                      <div class="analytics-stat-label">Total turns</div>
                    </div>
                    <div class="analytics-stat">
                      <div class="analytics-stat-value">$${this.analyticsStats.total_cost_usd.toFixed(3)}</div>
                      <div class="analytics-stat-label">Total cost</div>
                    </div>
                    <div class="analytics-stat">
                      <div class="analytics-stat-value">${this.analyticsStats.avg_duration_ms > 0 ? (this.analyticsStats.avg_duration_ms / 1000).toFixed(1) + 's' : '—'}</div>
                      <div class="analytics-stat-label">Avg response</div>
                    </div>
                    <div class="analytics-stat">
                      <div class="analytics-stat-value">${(() => {
                        const today = new Date().toISOString().slice(0, 10)
                        return (this.analyticsDaily.find((d) => d.date === today)?.turns ?? 0).toString()
                      })()}</div>
                      <div class="analytics-stat-label">Turns today</div>
                    </div>
                  </div>

                  <!-- Daily bar chart (last 7 days) -->
                  ${this.analyticsDaily.length > 0 ? html`
                    <div class="analytics-section-label">Daily turns (last 7 days)</div>
                    <div class="analytics-chart">
                      ${(() => {
                        const maxTurns = Math.max(...this.analyticsDaily.map((d) => d.turns), 1)
                        return this.analyticsDaily.map((d) => {
                          const pct = Math.round((d.turns / maxTurns) * 100)
                          const label = d.date.slice(5) // MM-DD
                          return html`
                            <div class="chart-col">
                              <div class="chart-bar-wrap">
                                <div class="chart-bar" style="height:${pct}%" title="${d.turns} turns on ${d.date}"></div>
                              </div>
                              <div class="chart-label">${label}</div>
                            </div>
                          `
                        })
                      })()}
                    </div>
                  ` : nothing}

                  <!-- Per-user table -->
                  ${this.analyticsStats.per_user.length > 0 ? html`
                    <div class="analytics-section-label">Per user</div>
                    <table class="analytics-table">
                      <thead><tr><th>User</th><th>Turns</th><th>Cost</th></tr></thead>
                      <tbody>
                        ${this.analyticsStats.per_user.map((u) => html`
                          <tr>
                            <td>${u.user_id}</td>
                            <td>${u.turns}</td>
                            <td>$${u.cost_usd.toFixed(4)}</td>
                          </tr>
                        `)}
                      </tbody>
                    </table>
                  ` : nothing}
                ` : html`<div class="analytics-empty">No data yet.</div>`}
              </div>
            </div>
          ` : nothing}

          <!-- Feature 6: Memories overlay -->
          ${this.showMemories ? html`
            <div class="analytics-overlay" @click=${() => this._closeMemories()}>
              <div class="analytics-panel" @click=${(e: Event) => e.stopPropagation()}>
                <div class="analytics-header">
                  <span class="analytics-title">${svgMemory()} Saved Memories (${this.memories.length})</span>
                  <div style="display:flex;gap:4px;align-items:center">
                    <button class="icon-btn" title="Add memory" @click=${() => { this.memoryAddMode = !this.memoryAddMode }}>${svgPlus()}</button>
                    <button class="icon-btn" @click=${() => this._closeMemories()}>${svgClose()}</button>
                  </div>
                </div>
                ${this.memoryAddMode ? html`
                  <div style="padding:8px 12px;border-bottom:1px solid var(--bonnie-border);display:flex;flex-direction:column;gap:6px">
                    <input class="sys-prompt-input" placeholder="Key (e.g. favorite_color)" .value=${this.memoryFormKey}
                      @input=${(e: Event) => { this.memoryFormKey = (e.target as HTMLInputElement).value }} />
                    <input class="sys-prompt-input" placeholder="Value (e.g. blue)" .value=${this.memoryFormValue}
                      @input=${(e: Event) => { this.memoryFormValue = (e.target as HTMLInputElement).value }}
                      @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this._addMemory() }} />
                    <div style="display:flex;gap:6px;justify-content:flex-end">
                      <button class="system-prompt-cancel-btn" @click=${() => { this.memoryAddMode = false }}>Cancel</button>
                      <button class="system-prompt-save-btn" @click=${() => void this._addMemory()}>Save</button>
                    </div>
                  </div>
                ` : nothing}
                ${this.memoriesLoading ? html`
                  <div class="analytics-loading"><div class="loading-spinner"></div></div>
                ` : this.memories.length === 0 && !this.memoryAddMode ? html`
                  <div class="analytics-empty" style="padding:1.5rem;text-align:center;color:var(--bonnie-ink-2)">
                    No memories saved yet. Bonnie will automatically save facts you tell her, or click + to add one.
                  </div>
                ` : html`
                  <div class="memories-list">
                    ${this.memories.map((m) => html`
                      <div class="memory-item">
                        <div class="memory-content">
                          <span class="memory-key">${m.key}</span>
                          <span class="memory-value">${m.value}</span>
                          ${m.source === 'inferred' ? html`<span class="memory-badge">auto</span>` : nothing}
                        </div>
                        <button
                          class="icon-btn memory-delete-btn"
                          aria-label="Delete memory"
                          title="Delete"
                          @click=${() => void this._deleteMemory(m.id)}
                        >${svgClose()}</button>
                      </div>
                    `)}
                  </div>
                `}
              </div>
            </div>
          ` : nothing}

          <!-- Feature 12: Plugins admin overlay -->
          ${this.showPlugins ? html`
            <div class="analytics-overlay" @click=${() => this._closePlugins()}>
              <div class="analytics-panel" @click=${(e: Event) => e.stopPropagation()}>
                <div class="analytics-header">
                  <span class="analytics-title">${svgPuzzle()} Plugins</span>
                  <button class="icon-btn" @click=${() => this._closePlugins()}>${svgClose()}</button>
                </div>
                ${this.pluginsLoading ? html`
                  <div class="analytics-loading"><div class="loading-spinner"></div></div>
                ` : html`
                  <!-- Plugin list -->
                  ${this.plugins.length === 0 && !this.pluginAddMode ? html`
                    <div class="analytics-empty" style="padding:1.5rem;text-align:center;color:var(--bonnie-ink-2)">
                      No plugins registered yet.
                    </div>
                  ` : html`
                    <div class="memories-list">
                      ${this.plugins.map((p) => html`
                        <div class="memory-item" style="flex-direction:column;align-items:flex-start;gap:0.25rem">
                          <div style="display:flex;align-items:center;gap:0.5rem;width:100%">
                            <span class="memory-key" style="flex:1">${p.name}</span>
                            <span class="memory-badge" style="background:${p.method === 'GET' ? 'var(--bonnie-accent)' : 'var(--bonnie-ink-2)'};color:white;font-size:0.65rem;padding:0.1rem 0.35rem;border-radius:3px">${p.method}</span>
                            <!-- enabled toggle -->
                            <button
                              class="icon-btn"
                              title="${p.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}"
                              style="color:${p.enabled ? 'var(--bonnie-accent)' : 'var(--bonnie-ink-2)'}"
                              @click=${() => void this._togglePluginEnabled(p)}
                            >${p.enabled ? svgCheck() : svgClose()}</button>
                            <!-- delete button -->
                            <button
                              class="icon-btn memory-delete-btn"
                              aria-label="Delete plugin"
                              title="Delete plugin"
                              @click=${() => void this._deletePlugin(p.id)}
                            >${svgTrash()}</button>
                          </div>
                          <span class="memory-value" style="font-size:0.78rem;color:var(--bonnie-ink-2)">${p.description}</span>
                          <span style="font-size:0.7rem;color:var(--bonnie-ink-2);word-break:break-all">${p.endpoint}</span>
                        </div>
                      `)}
                    </div>
                  `}

                  <!-- Add plugin form -->
                  ${this.pluginAddMode ? html`
                    <div style="padding:0.75rem 0;border-top:1px solid var(--bonnie-border);margin-top:0.5rem">
                      <div style="font-size:0.8rem;font-weight:600;margin-bottom:0.5rem">New plugin</div>
                      <div style="display:flex;flex-direction:column;gap:0.4rem">
                        <input
                          class="sys-prompt-input"
                          placeholder="Name (e.g. my_tool)"
                          .value=${this.pluginForm.name}
                          @input=${(e: Event) => { this.pluginForm = { ...this.pluginForm, name: (e.target as HTMLInputElement).value } }}
                        />
                        <input
                          class="sys-prompt-input"
                          placeholder="Description"
                          .value=${this.pluginForm.description}
                          @input=${(e: Event) => { this.pluginForm = { ...this.pluginForm, description: (e.target as HTMLInputElement).value } }}
                        />
                        <input
                          class="sys-prompt-input"
                          placeholder="Endpoint URL"
                          .value=${this.pluginForm.endpoint}
                          @input=${(e: Event) => { this.pluginForm = { ...this.pluginForm, endpoint: (e.target as HTMLInputElement).value } }}
                        />
                        <div style="display:flex;gap:0.4rem;align-items:center">
                          <select
                            class="model-selector"
                            style="flex:0 0 auto"
                            .value=${this.pluginForm.method ?? 'POST'}
                            @change=${(e: Event) => { this.pluginForm = { ...this.pluginForm, method: (e.target as HTMLSelectElement).value } }}
                          >
                            ${['GET','POST','PUT','PATCH','DELETE'].map((m) => html`<option value=${m} ?selected=${m === (this.pluginForm.method ?? 'POST')}>${m}</option>`)}
                          </select>
                          <input
                            class="sys-prompt-input"
                            placeholder="Auth header (optional)"
                            style="flex:1"
                            .value=${this.pluginForm.auth_header ?? ''}
                            @input=${(e: Event) => { this.pluginForm = { ...this.pluginForm, auth_header: (e.target as HTMLInputElement).value } }}
                          />
                        </div>
                        <input
                          class="sys-prompt-input"
                          placeholder='Example payload (optional, e.g. {"text":"hello"})'
                          .value=${this.pluginForm.example_payload ?? ''}
                          @input=${(e: Event) => { this.pluginForm = { ...this.pluginForm, example_payload: (e.target as HTMLInputElement).value } }}
                        />
                        ${this.pluginFormError ? html`
                          <div style="color:var(--error-color,#F85149);font-size:0.78rem">${this.pluginFormError}</div>
                        ` : nothing}
                        <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.25rem">
                          <button class="confirm-btn cancel" @click=${() => { this.pluginAddMode = false; this.pluginFormError = '' }}>Cancel</button>
                          <button class="confirm-btn" ?disabled=${this.pluginFormSaving} @click=${() => void this._saveNewPlugin()}>
                            ${this.pluginFormSaving ? 'Saving…' : 'Save plugin'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ` : html`
                    <div style="padding-top:0.75rem;border-top:1px solid var(--bonnie-border);margin-top:0.5rem">
                      <button
                        class="icon-btn"
                        style="display:flex;align-items:center;gap:0.35rem;font-size:0.8rem;padding:0.3rem 0.5rem"
                        @click=${() => { this.pluginAddMode = true; this.pluginFormError = '' }}
                      >${svgPlus()} Add plugin</button>
                    </div>
                  `}
                `}
              </div>
            </div>
          ` : nothing}

          <!-- User admin overlay -->
          ${this.showUsers ? html`
            <div class="analytics-overlay" @click=${() => this._closeUsers()}>
              <div class="analytics-panel" @click=${(e: Event) => e.stopPropagation()}>
                <div class="analytics-header">
                  <span class="analytics-title">${svgUsers()} Users</span>
                  <div style="display:flex;gap:4px;align-items:center">
                    <button class="icon-btn" title="Add user" @click=${() => { this.userAddMode = !this.userAddMode; this.userFormError = '' }}>${svgPlus()}</button>
                    <button class="icon-btn" @click=${() => this._closeUsers()}>${svgClose()}</button>
                  </div>
                </div>
                ${this.userAddMode ? html`
                  <div style="padding:8px 12px;border-bottom:1px solid var(--bonnie-border);display:flex;flex-direction:column;gap:6px">
                    <input class="sys-prompt-input" placeholder="Username" .value=${this.userFormUsername}
                      @input=${(e: Event) => { this.userFormUsername = (e.target as HTMLInputElement).value }} />
                    <input class="sys-prompt-input" type="password" placeholder="Password" .value=${this.userFormPassword}
                      @input=${(e: Event) => { this.userFormPassword = (e.target as HTMLInputElement).value }} />
                    <select class="sys-prompt-input" .value=${this.userFormRoleId}
                      @change=${(e: Event) => { this.userFormRoleId = (e.target as HTMLSelectElement).value }}>
                      <option value="">Select role...</option>
                      ${this.roles.map((r) => html`<option value=${r.id} ?selected=${r.id === this.userFormRoleId}>${r.name}</option>`)}
                    </select>
                    ${this.userFormError ? html`
                      <div style="color:var(--error-color,#F85149);font-size:0.78rem">${this.userFormError}</div>
                    ` : nothing}
                    <div style="display:flex;gap:6px;justify-content:flex-end">
                      <button class="system-prompt-cancel-btn" @click=${() => { this.userAddMode = false; this.userFormError = '' }}>Cancel</button>
                      <button class="system-prompt-save-btn" ?disabled=${this.userFormSaving} @click=${() => void this._createUser()}>
                        ${this.userFormSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ` : nothing}
                ${this.usersLoading ? html`
                  <div class="analytics-loading"><div class="loading-spinner"></div></div>
                ` : this.users.length === 0 && !this.userAddMode ? html`
                  <div class="analytics-empty" style="padding:1.5rem;text-align:center;color:var(--bonnie-ink-2)">
                    No users found.
                  </div>
                ` : html`
                  <div class="memories-list">
                    ${this.users.map((u) => html`
                      <div class="memory-item" style="flex-direction:column;align-items:flex-start;gap:4px">
                        <div style="display:flex;align-items:center;gap:0.5rem;width:100%">
                          <span class="memory-key" style="flex:1">${u.username}</span>
                          ${u.role ? html`
                            <span class="user-role-badge ${u.role.name === 'admin' ? 'admin' : ''}">${u.role.name}</span>
                          ` : nothing}
                          <!-- Change password button -->
                          <button
                            class="icon-btn"
                            title="Change password"
                            style="opacity:0.5"
                            @click=${() => { this.userPasswordEditId = this.userPasswordEditId === u.id ? null : u.id; this.userPasswordDraft = '' }}
                          >${svgKey()}</button>
                          <!-- Delete button (disabled for self) -->
                          ${u.id !== this._currentUserId ? html`
                            <button
                              class="icon-btn memory-delete-btn"
                              aria-label="Delete user"
                              title="Delete user"
                              @click=${() => void this._deleteUser(u.id)}
                            >${svgTrash()}</button>
                          ` : nothing}
                        </div>
                        <span style="font-size:0.7rem;color:var(--bonnie-ink-2)">Created ${new Date(u.created_at * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        ${this.userPasswordEditId === u.id ? html`
                          <div style="display:flex;gap:6px;width:100%;margin-top:2px">
                            <input class="sys-prompt-input" type="password" placeholder="New password" style="flex:1"
                              .value=${this.userPasswordDraft}
                              @input=${(e: Event) => { this.userPasswordDraft = (e.target as HTMLInputElement).value }}
                              @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this._changeUserPassword(u.id) }} />
                            <button class="system-prompt-save-btn" style="flex-shrink:0" @click=${() => void this._changeUserPassword(u.id)}>Set</button>
                            <button class="system-prompt-cancel-btn" style="flex-shrink:0" @click=${() => { this.userPasswordEditId = null }}>Cancel</button>
                          </div>
                        ` : nothing}
                      </div>
                    `)}
                  </div>
                `}
              </div>
            </div>
          ` : nothing}

          <!-- Header -->
          <div class="header">
            ${!this.isWide
              ? html`<button class="icon-btn" aria-label="Menu" @click=${() => (this.sidebarOpen = !this.sidebarOpen)} title="Sessions (Cmd+/)">
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
            <!-- Feature 10 (this sprint): Model selector -->
            ${this.allowedModels.length > 1 ? html`
              <select
                class="model-selector"
                .value=${this.selectedModel}
                @change=${(e: Event) => { this.selectedModel = (e.target as HTMLSelectElement).value }}
                title="Select model"
              >
                ${this.allowedModels.map((m) => html`
                  <option value=${m} ?selected=${m === this.selectedModel}>${m.replace('claude-', '').replace(/-\d+$/, (v) => v)}</option>
                `)}
              </select>
            ` : nothing}
            <!-- Feature T4-1: System prompt icon button -->
            ${this.activeSessionId ? html`
              <button
                class=${classMap({ 'icon-btn': true, 'icon-btn--active': !!this.activeSystemPrompt })}
                aria-label="Custom system prompt"
                title=${this.activeSystemPrompt ? 'Custom system prompt active' : 'Set custom system prompt'}
                @click=${() => this._toggleSystemPromptPanel()}
              >${svgSystemPrompt()}</button>
            ` : nothing}
            <!-- Feature T4-2: Message search icon button -->
            ${this.activeSessionId ? html`
              <button
                class=${classMap({ 'icon-btn': true, 'icon-btn--active': this.showMessageSearch })}
                aria-label="Search messages"
                title="Search messages"
                @click=${() => this._toggleMessageSearch()}
              >${svgSearch()}</button>
            ` : nothing}
            <!-- Feature 6 + 14: Export / Copy menu -->
            ${this.activeSessionId ? html`
              <div class="export-menu-wrap" style="position:relative">
                <button
                  class="icon-btn"
                  aria-label="Export"
                  title="More options"
                  @click=${() => { this.showExportMenu = !this.showExportMenu }}
                >${svgDots()}</button>
                ${this.showExportMenu ? html`
                  <div class="export-menu" @click=${(e: Event) => e.stopPropagation()}>
                    <button class="export-menu-item" @click=${() => this._copyAllConversation()}>
                      ${svgCopy()} ${t('copyAll')}
                    </button>
                    <button class="export-menu-item" @click=${() => this._exportMarkdown()}>
                      ${svgDownload()} ${t('exportMarkdown')}
                    </button>
                    <button class="export-menu-item" @click=${() => this._exportJson()}>
                      ${svgDownload()} ${t('exportJson')}
                    </button>
                  </div>
                ` : nothing}
              </div>
            ` : nothing}
            <div class="kb-help-wrap">
              <button
                class="icon-btn"
                aria-label="Keyboard shortcuts"
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
                <div class="kb-help-row">
                  <span class="kb-help-label">Previous session</span>
                  <span class="kb-shortcuts"><span class="kb-key">⌘</span><span class="kb-key">[</span></span>
                </div>
                <div class="kb-help-row">
                  <span class="kb-help-label">Next session</span>
                  <span class="kb-shortcuts"><span class="kb-key">⌘</span><span class="kb-key">]</span></span>
                </div>
              </div>
            </div>
            <!-- Settings button -->
            ${this.sessionToken ? html`
              <button
                class=${classMap({ 'icon-btn': true, 'icon-btn--active': this.showSettings })}
                aria-label="Settings"
                title="User settings"
                @click=${() => this.showSettings ? this._closeSettings() : void this._openSettings()}
              >${svgGear()}</button>
            ` : nothing}
            <!-- Feature 6: Memories button -->
            ${this.sessionToken ? html`
              <button
                class=${classMap({ 'icon-btn': true, 'icon-btn--active': this.showMemories })}
                aria-label="Memories"
                title="Saved memories"
                @click=${() => this.showMemories ? this._closeMemories() : void this._openMemories()}
              >${svgMemory()}</button>
            ` : nothing}
            <!-- Feature 13: Analytics button (admin only) -->
            ${this.isAdmin ? html`
              <button
                class=${classMap({ 'icon-btn': true, 'icon-btn--active': this.showAnalytics })}
                aria-label="Analytics"
                title="Usage analytics (admin)"
                @click=${() => this.showAnalytics ? this._closeAnalytics() : void this._openAnalytics()}
              >${svgBarChart()}</button>
            ` : nothing}
            <!-- Feature 12: Plugins button (admin only) -->
            ${this.isAdmin ? html`
              <button
                class=${classMap({ 'icon-btn': true, 'icon-btn--active': this.showPlugins })}
                aria-label="Plugins"
                title="Plugin registry (admin)"
                @click=${() => this.showPlugins ? this._closePlugins() : void this._openPlugins()}
              >${svgPuzzle()}</button>
            ` : nothing}
            <!-- User admin button (admin only) -->
            ${this.isAdmin ? html`
              <button
                class=${classMap({ 'icon-btn': true, 'icon-btn--active': this.showUsers })}
                aria-label="Users"
                title="User management (admin)"
                @click=${() => this.showUsers ? this._closeUsers() : void this._openUsers()}
              >${svgUsers()}</button>
            ` : nothing}
            ${this.isWide
              ? html`<button class="icon-btn" aria-label=${t('newConversation')} @click=${this._newSession} title="${t('newConversation')} (Cmd+N)">
                  ${svgPlus()}
                </button>`
              : nothing}
          </div>

          <!-- Body -->
          <div class="body">
            <!-- Wide-mode sidebar -->
            ${this.isWide
              ? html`
                  <div class=${classMap({ sidebar: true, collapsed: this.sidebarCollapsed })}>
                    <button class="sidebar-collapse-btn" aria-label=${this.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} @click=${() => { this.sidebarCollapsed = !this.sidebarCollapsed }}>
                      <svg viewBox="0 0 24 24"><path d=${this.sidebarCollapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'}/></svg>
                    </button>
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
                      <button class="icon-btn" aria-label="Close sidebar" @click=${() => (this.sidebarOpen = false)}>
                        ${svgClose()}
                      </button>
                    </div>
                    ${this._renderSidebarContent()}
                  </div>
                `
              : nothing}

            <!-- Chat pane -->
            <div class=${classMap({ 'chat-pane': true, 'drag-over': this.dragOver })}
              @dragover=${(e: DragEvent) => { e.preventDefault(); this.dragOver = true }}
              @dragleave=${() => { this.dragOver = false }}
              @drop=${(e: DragEvent) => { e.preventDefault(); this.dragOver = false; this._handleDroppedFiles(e) }}
            >
              ${this.dragOver ? html`<div class="drop-overlay">Drop file here</div>` : nothing}
              ${this.loading
                ? html`<div class="loading-state"><div class="loading-spinner"></div></div>`
                : !this.activeSessionId
                  ? html`
                      <div class="messages">
                        <div class="empty-state">
                          <div class="empty-icon-wrap">${svgBrandMarkLarge()}</div>
                          <div class="empty-heading">${t('askAnything')}</div>
                          <div class="empty-subtext">Your AI home assistant, ready to help with automations, devices, and more.</div>
                          <div class="suggested-prompts">
                            ${this._buildSuggestedPrompts().map((p) => html`
                              <button class="suggested-prompt-btn" @click=${() => this._startWithPrompt(p)}>${p}</button>
                            `)}
                          </div>
                        </div>
                      </div>
                    `
                  : html`
                      <!-- Feature T4-1: System prompt inline panel -->
                      ${this.showSystemPromptPanel ? html`
                        <div class="system-prompt-panel">
                          <div class="system-prompt-header">
                            <span class="system-prompt-title">Custom system prompt</span>
                            <span class="system-prompt-hint">Overrides Bonnie's default persona for this conversation.</span>
                          </div>
                          <textarea
                            class="system-prompt-textarea"
                            rows="4"
                            placeholder="e.g. You are a Linux terminal. Output only commands, no explanations."
                            .value=${this.systemPromptDraft}
                            @input=${(e: Event) => { this.systemPromptDraft = (e.target as HTMLTextAreaElement).value }}
                            @keydown=${(e: KeyboardEvent) => {
                              if (e.key === 'Escape') { this.showSystemPromptPanel = false }
                            }}
                          ></textarea>
                          <div class="system-prompt-actions">
                            <button class="system-prompt-clear-btn" @click=${() => this._clearSystemPrompt()}>${t('clear')}</button>
                            <button class="system-prompt-cancel-btn" @click=${() => { this.showSystemPromptPanel = false }}>${t('cancel')}</button>
                            <button class="system-prompt-save-btn" @click=${() => void this._saveSystemPrompt()}>${t('save')}</button>
                          </div>
                        </div>
                      ` : nothing}

                      <!-- Feature T4-2: Message search inline panel -->
                      ${this.showMessageSearch ? html`
                        <div class="msg-search-panel">
                          <div class="msg-search-input-wrap">
                            <span class="msg-search-icon">${svgSearch()}</span>
                            <input
                              class="msg-search-input"
                              type="text"
                              placeholder="Search messages…"
                              .value=${this.messageSearchQuery}
                              @input=${(e: Event) => this._onMessageSearchInput(e)}
                              @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') { this.showMessageSearch = false } }}
                            />
                            <button class="icon-btn msg-search-close" @click=${() => { this.showMessageSearch = false }}>${svgClose()}</button>
                          </div>
                          ${this.messageSearchLoading
                            ? html`<div class="msg-search-loading">Searching…</div>`
                            : this.messageSearchQuery && this.messageSearchResults.length === 0
                              ? html`<div class="msg-search-empty">No results for "${this.messageSearchQuery}"</div>`
                              : this.messageSearchResults.length > 0 ? html`
                                <div class="msg-search-results">
                                  ${this.messageSearchResults.map((r) => html`
                                    <button
                                      class="msg-search-result"
                                      @click=${() => {
                                        // Ensure turn is visible before scrolling
                                        this._ensureTurnVisible(r.turn_id)
                                        this.updateComplete.then(() => this._scrollToTurn(r.turn_id))
                                      }}
                                    >
                                      <span class="msg-search-result-role">${r.role}</span>
                                      <span class="msg-search-result-snippet">${unsafeHTML(this._highlightSnippet(r.snippet))}</span>
                                    </button>
                                  `)}
                                </div>
                              ` : nothing}
                        </div>
                      ` : nothing}

                      <div class="messages" role="log" aria-live="polite">
                        ${this.sessionLoading
                          ? this._renderSkeletonLoading()
                          : this.bubbles.length === 0
                            ? html`<div class="empty-state">
                                <div class="empty-icon-wrap">${svgBrandMarkLarge()}</div>
                                <div class="empty-heading">${t('startConversation')}</div>
                                <div class="empty-subtext">Ask Bonnie to control devices, set automations, or just chat.</div>
                                <div class="suggested-prompts">
                                  ${this._buildSuggestedPrompts().map((p) => html`
                                    <button class="suggested-prompt-btn" @click=${() => this._startWithPrompt(p)}>${p}</button>
                                  `)}
                                </div>
                              </div>`
                            : this._renderVirtualizedBubbles()}
                      </div>
                    `}

              <!-- Scroll to bottom button -->
              ${this.showScrollToBottom
                ? html`<button class="scroll-to-bottom visible" @click=${() => { this._userScrolled = false; this._scrollBottom() }}>
                    ${svgArrowDown()} New messages
                  </button>`
                : nothing}

              <!-- Feature 14: Offline mode banner -->
              ${this.offlineBanner ? html`
                <div class="offline-banner">
                  <span class="offline-banner-icon">${svgAlertCircle()}</span>
                  <span class="offline-banner-text">Bonnie is in offline mode — limited responses</span>
                  <button class="offline-banner-dismiss" @click=${() => this._dismissOfflineBanner()}>×</button>
                </div>
              ` : nothing}

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

              <!-- Feature T4-9: Cumulative session token counter -->
              ${this._renderSessionTokenBar()}

              <!-- Composer -->
              <div class="composer-wrap">
                <!-- Feature 11: Attachment chips (above textarea row) -->
                ${this.pendingAttachments.length > 0 ? html`
                  <div class="attach-strip">
                    ${this.pendingAttachments.map((a) => {
                      const isUploading = a.uploadId.startsWith('uploading-')
                      const isError = a.uploadId.startsWith('error-')
                      const isImage = a.mimeType.startsWith('image/')
                      return html`
                        <div class=${classMap({ 'attach-chip': true, uploading: isUploading, error: isError })}>
                          ${isImage
                            ? html`<img src=${a.localPreviewUrl} alt="" />`
                            : html`<span class="file-icon">${a.mimeType === 'application/pdf' ? '\u{1F4C4}' : '\u{1F4DD}'}</span>`}
                          <span class="filename">${a.filename}</span>
                          ${isUploading
                            ? html`<span class="chip-uploading-indicator"></span>`
                            : html`<button
                                class="chip-remove"
                                title="Remove attachment"
                                @click=${() => this._removeAttachment(a.uploadId)}
                              >×</button>`}
                        </div>
                      `
                    })}
                  </div>
                ` : nothing}
                <div class="composer-inner">
                  <!-- Feature 11: Attach button -->
                  <button
                    class="attach-btn"
                    aria-label=${t('attach')}
                    title=${t('attach')}
                    ?disabled=${isStreaming || this.uploadingCount > 0 || this.pendingAttachments.length >= 3}
                    @click=${() => this._openFilePicker()}
                  >${svgPaperclip()}</button>
                  <textarea
                    class="composer-textarea"
                    rows="1"
                    placeholder=${isStreaming ? t('thinking') : this.isListening ? 'Listening…' : t('messagePlaceholder')}
                    .value=${this.draft}
                    ?disabled=${isStreaming || this.loading || !this.sessionToken}
                    @input=${this._onInput}
                    @keydown=${this._onKeydown}
                  ></textarea>
                  <!-- Feature 5: Voice mic button (dictation — speech to text) -->
                  <button
                    class=${classMap({ 'mic-btn': true, listening: this.isListening })}
                    aria-label=${t('voice')}
                    @click=${() => this._toggleVoice()}
                    title=${this.isListening ? 'Stop dictation' : 'Dictate (speech → text)'}
                    ?disabled=${isStreaming}
                  >${svgMic()}</button>
                  <button
                    class=${classMap({ 'send-btn': true, stop: isStreaming })}
                    aria-label=${isStreaming ? t('stop') : t('send')}
                    ?disabled=${!isStreaming && !canSend}
                    @click=${isStreaming ? this._cancel : this._send}
                    title=${isStreaming ? `${t('stop')} (Esc)` : `${t('send')} (Enter)`}
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
              <!-- Feature 11: Lightbox -->
              ${this.lightboxImage ? html`
                <div class="lightbox" @click=${() => this._closeLightbox()}>
                  <img src=${this.lightboxImage} alt="Attachment" @click=${(e: Event) => e.stopPropagation()} />
                </div>
              ` : nothing}
            </div>
          </div>
        </div>
      </ha-card>
    `
  }
}

// ── SVG icons (inline, no external dep) ───────────────────────────────────

function svgBarChart(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>`
}

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

function svgPin(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
}

function svgArchive(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`
}

function svgUnarchive(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><polyline points="10 14 12 12 14 14"/><line x1="12" y1="12" x2="12" y2="18"/></svg>`
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

function svgPaperclip(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`
}

function svgDots(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/></svg>`
}

function svgDownload(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`
}

function svgKey(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`
}

function svgSystemPrompt(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><polyline points="9 16 12 13 15 16"/><line x1="12" y1="13" x2="12" y2="19"/></svg>`
}

/** Brain/memory icon (Feature 6) */
function svgMemory(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z"/></svg>`
}

/** Puzzle / plugin icon (Feature 12) */
function svgVolume(): TemplateResult {
  return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`
}

function svgVolumeOff(): TemplateResult {
  return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
}

function svgGear(): TemplateResult {
  return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
}

function svgPuzzle(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4c-1.1 0-2 .9-2 2v4h1.5a2.5 2.5 0 0 1 0 5H2v4c0 1.1.9 2 2 2h4v-1.5a2.5 2.5 0 0 1 5 0V21h4c1.1 0 2-.9 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/></svg>`
}

/** Users icon (Feather) */
function svgUsers(): TemplateResult {
  return html`<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
}

/** Return a simple SVG icon for a template id/name string. */
// ── Register custom element ────────────────────────────────────────────────

if (!customElements.get('bonnie-ai-card')) {
  customElements.define('bonnie-ai-card', BonnieCard)
}
