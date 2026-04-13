import { css } from 'lit'

export const cardStyles = css`
  :host {
    display: block;
    font-family: inherit;
  }

  /* ── Outer card shell ─────────────────────────────────── */
  .bonnie-card {
    display: flex;
    flex-direction: column;
    background: var(--ha-card-background, var(--card-background-color, #fff));
    border-radius: var(--ha-card-border-radius, 12px);
    box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.15));
    overflow: hidden;
    height: var(--bonnie-card-height, auto);
    min-height: 400px;
    color: var(--primary-text-color);
    position: relative;
  }

  /* ── Header ──────────────────────────────────────────── */
  .header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    gap: 8px;
    flex-shrink: 0;
  }

  .header-title {
    flex: 1;
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--secondary-text-color);
    padding: 6px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
  }

  .icon-btn:hover {
    background: var(--divider-color, rgba(0, 0, 0, 0.08));
    color: var(--primary-text-color);
  }

  .icon-btn svg {
    width: 20px;
    height: 20px;
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
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: width 0.2s, opacity 0.2s;
  }

  .sidebar.hidden {
    width: 0;
    opacity: 0;
    pointer-events: none;
  }

  .sidebar-header {
    padding: 8px 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--secondary-text-color);
    flex-shrink: 0;
  }

  .session-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 6px 6px;
  }

  .session-item {
    padding: 8px 10px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--primary-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background 0.15s;
    margin-bottom: 2px;
  }

  .session-item:hover {
    background: var(--divider-color, rgba(0, 0, 0, 0.06));
  }

  .session-item.active {
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
  }

  .session-empty {
    padding: 12px 10px;
    font-size: 0.8rem;
    color: var(--secondary-text-color);
    text-align: center;
  }

  /* ── Narrow-mode sidebar overlay ─────────────────────── */
  .sidebar-overlay {
    display: none;
    position: absolute;
    inset: 0;
    z-index: 10;
    background: rgba(0, 0, 0, 0.35);
  }

  .sidebar-overlay.visible {
    display: block;
  }

  .sidebar-drawer {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 240px;
    z-index: 11;
    background: var(--ha-card-background, var(--card-background-color, #fff));
    border-right: 1px solid var(--divider-color);
    display: flex;
    flex-direction: column;
    transform: translateX(-100%);
    transition: transform 0.2s;
    overflow: hidden;
  }

  .sidebar-drawer.open {
    transform: translateX(0);
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 8px;
    border-bottom: 1px solid var(--divider-color);
    flex-shrink: 0;
  }

  .drawer-title {
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--secondary-text-color);
  }

  /* ── Chat pane ───────────────────────────────────────── */
  .chat-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  /* ── Messages ────────────────────────────────────────── */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  /* Empty state */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: var(--secondary-text-color);
    text-align: center;
    padding: 32px;
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    opacity: 0.35;
    color: var(--primary-color);
  }

  .empty-icon svg {
    width: 100%;
    height: 100%;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .empty-text {
    font-size: 0.95rem;
    color: var(--secondary-text-color);
  }

  .start-btn {
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
    border: none;
    border-radius: 24px;
    padding: 10px 24px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.15s;
  }

  .start-btn:hover {
    opacity: 0.85;
  }

  /* ── Bubbles ─────────────────────────────────────────── */
  .bubble-row {
    display: flex;
    max-width: 100%;
  }

  .bubble-row.user {
    justify-content: flex-end;
  }

  .bubble-row.assistant {
    justify-content: flex-start;
  }

  .bubble-row.tool {
    justify-content: flex-start;
  }

  .bubble {
    max-width: 80%;
    padding: 10px 14px;
    border-radius: 16px;
    font-size: 0.9rem;
    line-height: 1.5;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .bubble.user {
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
    border-bottom-right-radius: 4px;
  }

  .bubble.assistant {
    background: var(--divider-color, rgba(0, 0, 0, 0.06));
    color: var(--primary-text-color);
    border-bottom-left-radius: 4px;
  }

  .bubble.error {
    background: var(--error-color, #f44336);
    color: #fff;
  }

  /* Markdown inside assistant bubbles */
  .bubble.assistant p {
    margin: 0 0 0.5em;
  }

  .bubble.assistant p:last-child {
    margin-bottom: 0;
  }

  .bubble.assistant code {
    font-family: monospace;
    font-size: 0.85em;
    background: rgba(0, 0, 0, 0.08);
    padding: 0.1em 0.35em;
    border-radius: 4px;
  }

  .bubble.assistant pre {
    background: rgba(0, 0, 0, 0.06);
    border-radius: 8px;
    padding: 10px 12px;
    overflow-x: auto;
    font-size: 0.82em;
    margin: 0.5em 0;
  }

  .bubble.assistant pre code {
    background: none;
    padding: 0;
    border-radius: 0;
    font-size: 1em;
  }

  .bubble.assistant ul,
  .bubble.assistant ol {
    padding-left: 1.4em;
    margin: 0.4em 0;
  }

  .bubble.assistant a {
    color: var(--primary-color);
  }

  .bubble.assistant strong {
    font-weight: 700;
  }

  /* ── Tool bubble ─────────────────────────────────────── */
  .tool-bubble {
    max-width: 85%;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 10px;
    font-size: 0.82rem;
    overflow: hidden;
    color: var(--secondary-text-color);
  }

  .tool-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    cursor: pointer;
    background: var(--divider-color, rgba(0, 0, 0, 0.04));
    user-select: none;
  }

  .tool-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    opacity: 0.6;
  }

  .tool-icon svg {
    width: 100%;
    height: 100%;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .tool-name {
    flex: 1;
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--primary-text-color);
    opacity: 0.7;
  }

  .tool-chevron {
    width: 12px;
    height: 12px;
    opacity: 0.5;
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
    padding: 8px 12px;
    border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
    display: none;
  }

  .tool-body.visible {
    display: block;
  }

  .tool-section-label {
    font-size: 0.73rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--secondary-text-color);
    margin: 0 0 4px;
    opacity: 0.7;
  }

  .tool-pre {
    font-family: monospace;
    font-size: 0.78rem;
    background: rgba(0, 0, 0, 0.04);
    border-radius: 6px;
    padding: 6px 8px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--primary-text-color);
    margin: 0 0 8px;
  }

  .tool-pre:last-child {
    margin-bottom: 0;
  }

  /* Streaming cursor */
  .cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    background: currentColor;
    vertical-align: text-bottom;
    animation: blink 1s step-end infinite;
    margin-left: 1px;
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
    background: var(--error-color, #f44336);
    color: #fff;
    padding: 8px 16px;
    font-size: 0.85rem;
    text-align: center;
    flex-shrink: 0;
  }

  /* ── Composer ────────────────────────────────────────── */
  .composer {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 10px 12px;
    border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    flex-shrink: 0;
  }

  .composer-textarea {
    flex: 1;
    resize: none;
    background: var(--divider-color, rgba(0, 0, 0, 0.06));
    border: 1px solid transparent;
    border-radius: 20px;
    padding: 10px 14px;
    font-size: 0.9rem;
    font-family: inherit;
    color: var(--primary-text-color);
    line-height: 1.5;
    max-height: 160px;
    overflow-y: auto;
    outline: none;
    transition: border-color 0.15s;
    field-sizing: content; /* Progressive enhancement: auto-resize */
  }

  .composer-textarea:focus {
    border-color: var(--primary-color);
  }

  .composer-textarea::placeholder {
    color: var(--secondary-text-color);
    opacity: 0.7;
  }

  .send-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: opacity 0.15s, background 0.15s;
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .send-btn:not(:disabled):hover {
    opacity: 0.85;
  }

  .send-btn.stop {
    background: var(--error-color, #f44336);
  }

  .send-btn svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ── Spinner ─────────────────────────────────────────── */
  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
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
    border: 3px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
`
