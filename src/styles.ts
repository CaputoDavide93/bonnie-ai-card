import { css } from 'lit'

export const cardStyles = css`
  :host {
    /* Self-contained palette. HA theme vars override these if present. */
    --bonnie-accent: var(--bonnie-accent-override, #E8A04C);
    --bonnie-accent-soft: rgba(232, 160, 76, 0.14);
    --bonnie-accent-hover: #f0ae58;
    --bonnie-ink-0: #E6EDF3;
    --bonnie-ink-1: #C7D1DC;
    --bonnie-ink-2: #8B949E;
    --bonnie-ink-3: #6E7681;
    --bonnie-surface-0: #0F1419;
    --bonnie-surface-1: #161B22;
    --bonnie-surface-2: #1F262E;
    --bonnie-surface-3: #2A333D;
    --bonnie-border: rgba(255, 255, 255, 0.08);
    --bonnie-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    display: block;
    font-family: var(--paper-font-body1_-_font-family, 'Inter', system-ui, sans-serif);
    color: var(--bonnie-ink-0);
  }

  /* ── Outer card shell ─────────────────────────────────── */
  .bonnie-card {
    display: flex;
    flex-direction: column;
    background: var(--bonnie-surface-0);
    border-radius: 16px;
    overflow: hidden;
    height: var(--bonnie-card-height, 100%);
    min-height: 420px;
    position: relative;
  }

  /* ── Header ──────────────────────────────────────────── */
  .header {
    display: flex;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid var(--bonnie-border);
    gap: 10px;
    flex-shrink: 0;
    background: var(--bonnie-surface-1);
  }

  .header-title {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    color: var(--bonnie-ink-0);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: -0.01em;
  }

  .icon-btn {
    background: var(--bonnie-surface-3);
    border: 1px solid var(--bonnie-border);
    cursor: pointer;
    color: var(--bonnie-ink-1);
    padding: 0;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .icon-btn:hover {
    background: var(--bonnie-surface-2);
    border-color: rgba(232, 160, 76, 0.3);
    color: var(--bonnie-accent);
  }

  .icon-btn.primary {
    background: var(--bonnie-accent);
    color: #0F1419;
    border-color: transparent;
    box-shadow: 0 2px 8px rgba(232, 160, 76, 0.35);
  }

  .icon-btn.primary:hover {
    background: var(--bonnie-accent-hover);
    color: #0F1419;
  }

  .icon-btn svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ── Body layout (sidebar + messages) ────────────────── */
  .body {
    display: flex;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  /* ── Sidebar ─────────────────────────────────────────── */
  .sidebar {
    width: 232px;
    flex-shrink: 0;
    border-right: 1px solid var(--bonnie-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: width 0.2s, opacity 0.2s;
    background: var(--bonnie-surface-1);
  }

  .sidebar.hidden {
    width: 0;
    opacity: 0;
    pointer-events: none;
  }

  .sidebar-header {
    padding: 12px 14px 8px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--bonnie-ink-3);
    flex-shrink: 0;
  }

  .session-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px 8px;
  }

  .session-item {
    padding: 10px 12px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 13px;
    color: var(--bonnie-ink-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: all 0.15s;
    margin-bottom: 2px;
    border: 1px solid transparent;
  }

  .session-item:hover {
    background: var(--bonnie-surface-2);
    color: var(--bonnie-ink-0);
  }

  .session-item.active {
    background: var(--bonnie-accent-soft);
    color: var(--bonnie-accent);
    border-color: rgba(232, 160, 76, 0.2);
    font-weight: 500;
  }

  .session-empty {
    padding: 14px 12px;
    font-size: 12px;
    color: var(--bonnie-ink-3);
    text-align: center;
  }

  /* ── Narrow-mode sidebar overlay ─────────────────────── */
  .sidebar-overlay {
    display: none;
    position: absolute;
    inset: 0;
    z-index: 10;
    background: rgba(0, 0, 0, 0.5);
  }

  .sidebar-overlay.visible {
    display: block;
  }

  .sidebar-drawer {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 260px;
    max-width: 85vw;
    z-index: 11;
    background: var(--bonnie-surface-1);
    border-right: 1px solid var(--bonnie-border);
    display: flex;
    flex-direction: column;
    transform: translateX(-100%);
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
    box-shadow: var(--bonnie-shadow);
  }

  .sidebar-drawer.open {
    transform: translateX(0);
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 14px 10px;
    border-bottom: 1px solid var(--bonnie-border);
    flex-shrink: 0;
  }

  .drawer-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--bonnie-ink-3);
  }

  /* ── Chat pane ───────────────────────────────────────── */
  .chat-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    background: var(--bonnie-surface-0);
  }

  /* ── Messages ────────────────────────────────────────── */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .messages::-webkit-scrollbar {
    width: 8px;
  }
  .messages::-webkit-scrollbar-thumb {
    background: var(--bonnie-surface-3);
    border-radius: 4px;
  }

  /* Empty state */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    color: var(--bonnie-ink-2);
    text-align: center;
    padding: 32px;
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    color: var(--bonnie-accent);
    background: var(--bonnie-accent-soft);
    border: 1px solid rgba(232, 160, 76, 0.22);
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(232, 160, 76, 0.1);
  }

  .empty-icon svg {
    width: 30px;
    height: 30px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .empty-text {
    font-size: 14px;
    color: var(--bonnie-ink-2);
  }

  .start-btn {
    background: var(--bonnie-accent);
    color: #0F1419;
    border: none;
    border-radius: 14px;
    padding: 12px 22px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 18px rgba(232, 160, 76, 0.35);
  }

  .start-btn:hover {
    background: var(--bonnie-accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 6px 22px rgba(232, 160, 76, 0.5);
  }

  /* ── Bubbles ─────────────────────────────────────────── */
  .bubble-row {
    display: flex;
    max-width: 100%;
  }

  .bubble-row.user {
    justify-content: flex-end;
  }

  .bubble-row.assistant,
  .bubble-row.tool {
    justify-content: flex-start;
  }

  .bubble {
    max-width: 78%;
    padding: 11px 16px;
    border-radius: 18px;
    font-size: 14px;
    line-height: 1.55;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .bubble.user {
    background: var(--bonnie-accent);
    color: #0F1419;
    border-bottom-right-radius: 6px;
    font-weight: 500;
  }

  .bubble.assistant {
    background: var(--bonnie-surface-2);
    color: var(--bonnie-ink-0);
    border-bottom-left-radius: 6px;
    border: 1px solid var(--bonnie-border);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .bubble.error {
    background: rgba(229, 115, 115, 0.15);
    color: #ff8a80;
    border: 1px solid rgba(229, 115, 115, 0.3);
  }

  /* Markdown inside assistant bubbles */
  .bubble.assistant p {
    margin: 0 0 0.5em;
  }

  .bubble.assistant p:last-child {
    margin-bottom: 0;
  }

  .bubble.assistant code {
    font-family: 'JetBrains Mono', Menlo, monospace;
    font-size: 0.85em;
    background: var(--bonnie-surface-0);
    padding: 0.12em 0.4em;
    border-radius: 4px;
    color: var(--bonnie-accent);
  }

  .bubble.assistant pre {
    background: var(--bonnie-surface-0);
    border: 1px solid var(--bonnie-border);
    border-radius: 10px;
    padding: 10px 12px;
    overflow-x: auto;
    font-size: 12.5px;
    margin: 0.5em 0;
  }

  .bubble.assistant pre code {
    background: none;
    padding: 0;
    border-radius: 0;
    font-size: 1em;
    color: var(--bonnie-ink-0);
  }

  .bubble.assistant ul,
  .bubble.assistant ol {
    padding-left: 1.4em;
    margin: 0.4em 0;
  }

  .bubble.assistant a {
    color: var(--bonnie-accent);
  }

  .bubble.assistant strong {
    font-weight: 700;
    color: var(--bonnie-ink-0);
  }

  /* ── Tool bubble ─────────────────────────────────────── */
  .tool-bubble {
    max-width: 85%;
    background: var(--bonnie-surface-2);
    border: 1px solid var(--bonnie-border);
    border-radius: 14px;
    font-size: 12.5px;
    overflow: hidden;
    color: var(--bonnie-ink-1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .tool-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
  }

  .tool-header:hover {
    background: var(--bonnie-surface-3);
  }

  .tool-icon {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 6px;
    background: var(--bonnie-accent-soft);
    color: var(--bonnie-accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tool-icon svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .tool-name {
    flex: 1;
    font-weight: 600;
    font-size: 12.5px;
    color: var(--bonnie-ink-0);
    font-family: 'JetBrains Mono', Menlo, monospace;
  }

  .tool-chevron {
    width: 14px;
    height: 14px;
    color: var(--bonnie-ink-2);
    transition: transform 0.15s;
  }

  .tool-chevron svg {
    width: 100%;
    height: 100%;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .tool-chevron.expanded {
    transform: rotate(180deg);
  }

  .tool-body {
    padding: 10px 14px 12px;
    border-top: 1px solid var(--bonnie-border);
    display: none;
  }

  .tool-body.visible {
    display: block;
  }

  .tool-section-label {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--bonnie-ink-3);
    margin: 0 0 6px;
  }

  .tool-pre {
    font-family: 'JetBrains Mono', Menlo, monospace;
    font-size: 11.5px;
    background: var(--bonnie-surface-0);
    border: 1px solid var(--bonnie-border);
    border-radius: 8px;
    padding: 8px 10px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--bonnie-ink-1);
    margin: 0 0 10px;
    line-height: 1.5;
  }

  .tool-pre:last-child {
    margin-bottom: 0;
  }

  /* Streaming cursor */
  .cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    background: var(--bonnie-accent);
    vertical-align: text-bottom;
    animation: blink 1s step-end infinite;
    margin-left: 2px;
    border-radius: 1px;
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  /* ── Error banner ────────────────────────────────────── */
  .error-banner {
    background: rgba(229, 115, 115, 0.15);
    color: #ff8a80;
    border-bottom: 1px solid rgba(229, 115, 115, 0.3);
    padding: 10px 16px;
    font-size: 13px;
    text-align: center;
    flex-shrink: 0;
  }

  /* ── Composer ────────────────────────────────────────── */
  .composer {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    padding: 12px 14px 14px;
    border-top: 1px solid var(--bonnie-border);
    flex-shrink: 0;
    background: var(--bonnie-surface-0);
  }

  .composer-wrap {
    flex: 1;
    display: flex;
    align-items: flex-end;
    gap: 10px;
    background: var(--bonnie-surface-2);
    border: 1px solid var(--bonnie-border);
    border-radius: 20px;
    padding: 10px 10px 10px 16px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .composer-wrap:focus-within {
    border-color: rgba(232, 160, 76, 0.4);
    box-shadow: 0 0 0 1px rgba(232, 160, 76, 0.15);
  }

  .composer-textarea {
    flex: 1;
    resize: none;
    background: transparent;
    border: none;
    padding: 2px 0;
    font-size: 14px;
    font-family: inherit;
    color: var(--bonnie-ink-0);
    line-height: 1.55;
    min-height: 22px;
    max-height: 180px;
    overflow-y: auto;
    outline: none;
    field-sizing: content;
  }

  .composer-textarea::placeholder {
    color: var(--bonnie-ink-3);
  }

  .send-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bonnie-accent);
    color: #0F1419;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s;
    box-shadow: 0 2px 8px rgba(232, 160, 76, 0.35);
  }

  .send-btn:disabled {
    background: var(--bonnie-surface-3);
    color: var(--bonnie-ink-3);
    box-shadow: none;
    cursor: not-allowed;
  }

  .send-btn:not(:disabled):hover {
    background: var(--bonnie-accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(232, 160, 76, 0.5);
  }

  .send-btn.stop {
    background: rgba(229, 115, 115, 0.22);
    color: #ff8a80;
    box-shadow: none;
  }

  .send-btn.stop:hover {
    background: rgba(229, 115, 115, 0.32);
    color: #ff8a80;
  }

  .send-btn svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ── Spinner ─────────────────────────────────────────── */
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(15, 20, 25, 0.25);
    border-top-color: #0F1419;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Loading state ───────────────────────────────────── */
  .loading-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--bonnie-surface-3);
    border-top-color: var(--bonnie-accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  /* ── Responsive: narrow ───────────────────────────────── */
  @media (max-width: 639px) {
    .sidebar {
      display: none;
    }
    .bubble {
      max-width: 88%;
    }
  }
`
