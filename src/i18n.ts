// ── i18n string table ─────────────────────────────────────────────────────────
// Add new locales by adding an entry to `strings` below.
// Keys deliberately mirror the HA language codes (en, it, de, fr, …).

const strings = {
  en: {
    askAnything: 'Ask Bonnie anything',
    newConversation: 'New conversation',
    searchConversations: 'Search conversations…',
    messagePlaceholder: 'Message Bonnie… (Enter to send, Shift+Enter for newline)',
    thinking: 'Bonnie is thinking…',
    today: 'Today',
    yesterday: 'Yesterday',
    previous7days: 'Previous 7 days',
    older: 'Older',
    pinned: 'Pinned',
    archived: 'Archived',
    export: 'Export',
    exportMarkdown: 'Export as Markdown',
    exportJson: 'Export as JSON',
    copyAll: 'Copy all as Markdown',
    send: 'Send',
    stop: 'Stop generating',
    attach: 'Attach image',
    voice: 'Voice input',
    copied: 'Copied',
    connectionClosed: 'Connection closed',
    responseIncomplete: '(response may be incomplete)',
    delete: 'Delete',
    rename: 'Rename',
    pin: 'Pin',
    unpin: 'Unpin',
    archive: 'Archive',
    unarchive: 'Unarchive',
    systemPrompt: 'System prompt',
    search: 'Search',
    cancel: 'Cancel',
    save: 'Save',
    clear: 'Clear',
    tokens: 'tokens',
    turns: 'turns',
    turn: 'turn',
    noConversations: 'No conversations yet. Start a new one!',
    startConversation: 'Start a conversation to get going',
    suggestedPrompts: [
      "What's playing on my speakers?",
      'Turn off the living room lights',
      "Summarise today's calendar",
    ],
  },
  it: {
    askAnything: 'Chiedi qualsiasi cosa a Bonnie',
    newConversation: 'Nuova conversazione',
    searchConversations: 'Cerca conversazioni…',
    messagePlaceholder: 'Scrivi a Bonnie… (Invio per inviare, Shift+Invio per nuova riga)',
    thinking: 'Bonnie sta pensando…',
    today: 'Oggi',
    yesterday: 'Ieri',
    previous7days: 'Ultimi 7 giorni',
    older: 'Più vecchie',
    pinned: 'Fissate',
    archived: 'Archiviate',
    export: 'Esporta',
    exportMarkdown: 'Esporta come Markdown',
    exportJson: 'Esporta come JSON',
    copyAll: 'Copia tutto come Markdown',
    send: 'Invia',
    stop: 'Interrompi generazione',
    attach: 'Allega immagine',
    voice: 'Input vocale',
    copied: 'Copiato',
    connectionClosed: 'Connessione chiusa',
    responseIncomplete: '(la risposta potrebbe essere incompleta)',
    delete: 'Elimina',
    rename: 'Rinomina',
    pin: 'Fissa',
    unpin: 'Sblocca',
    archive: 'Archivia',
    unarchive: 'Ripristina',
    systemPrompt: 'Prompt di sistema',
    search: 'Cerca',
    cancel: 'Annulla',
    save: 'Salva',
    clear: 'Cancella',
    tokens: 'token',
    turns: 'turni',
    turn: 'turno',
    noConversations: 'Nessuna conversazione. Iniziane una!',
    startConversation: 'Inizia una conversazione',
    suggestedPrompts: [
      'Cosa stanno suonando le casse?',
      'Spegni le luci del salotto',
      "Riassumi il calendario di oggi",
    ],
  },
} as const

export type Locale = keyof typeof strings
export type StringKey = keyof (typeof strings)['en']

// ── Locale resolution ─────────────────────────────────────────────────────────

let _locale: Locale = 'en'

/**
 * Initialise the locale. Priority:
 *  1. card config `locale` field
 *  2. HA `hass.language`
 *  3. `navigator.language`
 *  4. 'en' (fallback)
 */
export function initLocale(
  configLocale?: string | null,
  hassLanguage?: string | null,
): void {
  const candidates = [configLocale, hassLanguage, navigator?.language]
  for (const raw of candidates) {
    if (!raw) continue
    // Try exact match first (e.g. 'it'), then language subtag (e.g. 'it-IT' → 'it')
    const exact = raw.toLowerCase().trim() as Locale
    if (exact in strings) {
      _locale = exact
      return
    }
    const subtag = raw.split('-')[0].toLowerCase() as Locale
    if (subtag in strings) {
      _locale = subtag
      return
    }
  }
  _locale = 'en'
}

/** Translate a key using the current locale. Falls back to English. */
export function t(key: StringKey): string {
  const table = (strings[_locale] as Record<string, unknown>)[key]
  if (typeof table === 'string') return table
  // Fallback to en
  const enTable = (strings['en'] as Record<string, unknown>)[key]
  return typeof enTable === 'string' ? enTable : key
}

/** Get the array of suggested prompts for the current locale. */
export function suggestedPrompts(): readonly string[] {
  return strings[_locale]?.suggestedPrompts ?? strings['en'].suggestedPrompts
}
