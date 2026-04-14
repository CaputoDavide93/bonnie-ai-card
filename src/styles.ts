import { css } from 'lit'

export const cardStyles = css`
  :host {
    /* ── Accent: honour HA theme or fall back to Bonnie amber ── */
    --bonnie-accent: var(--bonnie-accent-override, var(--accent-color, var(--primary-color, #E8A04C)));
    --bonnie-accent-soft: color-mix(in srgb, var(--bonnie-accent) 12%, transparent);
    --bonnie-accent-mid: color-mix(in srgb, var(--bonnie-accent) 25%, transparent);
    --bonnie-accent-hover: color-mix(in srgb, var(--bonnie-accent) 85%, white);
    --bonnie-accent-focus: rgba(232, 160, 76, 0.35);
    --bonnie-accent-glow: rgba(232, 160, 76, 0.1);
    --bonnie-on-accent: #0D1117;

    /* ── Text: honour HA theme vars ─────────────────────────── */
    --bonnie-ink-0: var(--primary-text-color, #E6EDF3);
    --bonnie-ink-1: var(--primary-text-color, #C7D1DC);
    --bonnie-ink-2: var(--secondary-text-color, #8B949E);
    --bonnie-ink-3: var(--disabled-text-color, #586069);

    /* ── Surfaces: honour HA card background ────────────────── */
    --bonnie-surface-0: var(--ha-card-background, var(--card-background-color, #0D1117));
    --bonnie-surface-1: color-mix(in srgb, var(--bonnie-surface-0) 80%, white 5%);
    --bonnie-surface-2: color-mix(in srgb, var(--bonnie-surface-0) 65%, white 10%);
    --bonnie-surface-3: color-mix(in srgb, var(--bonnie-surface-0) 50%, white 15%);
    --bonnie-surface-4: color-mix(in srgb, var(--bonnie-surface-0) 35%, white 20%);

    /* ── Borders ─────────────────────────────────────────────── */
    --bonnie-border: var(--divider-color, rgba(255, 255, 255, 0.08));
    --bonnie-border-soft: var(--divider-color, rgba(255, 255, 255, 0.04));

    --bonnie-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    --bonnie-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
    --bonnie-radius: var(--ha-card-border-radius, 16px);
    --bonnie-radius-sm: 10px;
    display: block;
    font-family: var(--paper-font-body1_-_font-family, 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
    color: var(--bonnie-ink-0);
    font-size: 14px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Outer card shell ─────────────────────────────────── */
  .bonnie-card {
    display: flex;
    flex-direction: column;
    background: var(--bonnie-surface-0);
    border-radius: var(--bonnie-radius);
    overflow: hidden;
    height: var(--bonnie-card-height, 100%);
    min-height: 420px;
    position: relative;
  }

  /* ── Header ──────────────────────────────────────────── */
  .header {
    display: flex;
    align-items: center;
    padding: 12px 14px;
    border-bottom: 1px solid var(--bonnie-border);
    gap: 8px;
    flex-shrink: 0;
    background: var(--bonnie-surface-1);
    min-height: 52px;
    flex-wrap: wrap;
  }

  .header-brand {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
    min-width: 0;
  }

  .brand-logo {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--bonnie-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 2px 8px var(--bonnie-accent-focus);
  }

  .brand-logo svg {
    width: 20px;
    height: 20px;
    color: var(--bonnie-on-accent);
    fill: currentColor;
  }

  .header-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--bonnie-ink-0);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: -0.02em;
  }

  .header-subtitle {
    font-size: 11px;
    color: var(--bonnie-ink-3);
    font-weight: 400;
    letter-spacing: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-meta {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow: hidden;
    min-width: 0;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #3fb950;
    flex-shrink: 0;
  }

  .status-dot.streaming {
    background: var(--bonnie-accent);
    animation: pulse-dot 1.2s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  .icon-btn {
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    color: var(--bonnie-ink-2);
    padding: 0;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .icon-btn:hover {
    background: var(--bonnie-surface-3);
    border-color: var(--bonnie-border);
    color: var(--bonnie-ink-0);
  }

  .icon-btn.accent {
    background: var(--bonnie-accent-soft);
    border-color: var(--bonnie-accent-mid);
    color: var(--bonnie-accent);
  }

  .icon-btn.accent:hover {
    background: var(--bonnie-accent-mid);
    color: var(--bonnie-accent-hover);
  }

  .icon-btn svg {
    width: 15px;
    height: 15px;
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
    width: 240px;
    flex-shrink: 0;
    border-right: 1px solid var(--bonnie-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bonnie-surface-1);
    transition: width 0.15s ease, min-width 0.15s ease;
  }

  .sidebar.collapsed {
    width: 48px;
    min-width: 48px;
  }
  .sidebar.collapsed .session-list,
  .sidebar.collapsed .sidebar-search,
  .sidebar.collapsed .sidebar-header-text,
  .sidebar.collapsed .sidebar-top > .search-wrap,
  .sidebar.collapsed .sidebar-top > .new-chat-btn,
  .sidebar.collapsed .sidebar-section-label,
  .sidebar.collapsed .session-empty,
  .sidebar.collapsed .archived-toggle-wrap {
    display: none;
  }

  .sidebar-collapse-btn {
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    color: var(--bonnie-ink-2);
    padding: 0;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    transition: all 0.15s ease;
    flex-shrink: 0;
    margin: 10px auto 0;
  }
  .sidebar-collapse-btn:hover {
    background: var(--bonnie-surface-3);
    border-color: var(--bonnie-border);
    color: var(--bonnie-ink-0);
  }
  .sidebar-collapse-btn svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .sidebar-top {
    padding: 12px 10px 8px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-bottom: 1px solid var(--bonnie-border-soft);
  }

  .new-chat-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    background: var(--bonnie-accent);
    color: var(--bonnie-on-accent);
    border: none;
    border-radius: 10px;
    padding: 9px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    box-shadow: 0 2px 10px var(--bonnie-accent-focus);
  }

  .new-chat-btn:hover {
    background: var(--bonnie-accent-hover);
    box-shadow: 0 4px 16px var(--bonnie-accent-focus);
    transform: translateY(-1px);
  }

  .new-chat-btn svg {
    width: 13px;
    height: 13px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    flex-shrink: 0;
  }

  .search-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 9px;
    width: 13px;
    height: 13px;
    color: var(--bonnie-ink-3);
    pointer-events: none;
    flex-shrink: 0;
  }

  .search-icon svg {
    width: 100%;
    height: 100%;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .search-input {
    width: 100%;
    background: var(--bonnie-surface-2);
    border: 1px solid var(--bonnie-border);
    border-radius: 8px;
    padding: 7px 10px 7px 30px;
    font-size: 12.5px;
    font-family: inherit;
    color: var(--bonnie-ink-0);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    box-sizing: border-box;
  }

  .search-input::placeholder {
    color: var(--bonnie-ink-3);
  }

  .search-input:focus {
    border-color: var(--bonnie-accent-focus);
    box-shadow: 0 0 0 2px var(--bonnie-accent-glow);
  }

  .sidebar-section-label {
    padding: 14px 14px 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--bonnie-ink-2);
    flex-shrink: 0;
  }

  .session-list {
    flex: 1;
    overflow-y: auto;
    padding: 2px 8px 12px;
    scrollbar-width: thin;
    scrollbar-color: var(--bonnie-surface-4) transparent;
  }

  .session-list::-webkit-scrollbar {
    width: 4px;
  }

  .session-list::-webkit-scrollbar-thumb {
    background: var(--bonnie-surface-4);
    border-radius: 2px;
  }

  .session-item {
    position: relative;
    padding: 11px 10px 11px 12px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 13px;
    color: var(--bonnie-ink-2);
    transition: all 0.12s;
    margin-bottom: 3px;
    border: 1px solid transparent;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .session-item:hover {
    background: var(--bonnie-surface-2);
    color: var(--bonnie-ink-0);
  }

  .session-item.active {
    background: var(--bonnie-accent-soft);
    color: var(--bonnie-ink-0);
    border-color: var(--bonnie-accent-mid);
  }

  .session-item-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
  }

  .session-item-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 500;
    color: inherit;
  }

  .session-item.active .session-item-title {
    color: var(--bonnie-ink-0);
  }

  .session-item-time {
    font-size: 11px;
    color: var(--bonnie-ink-2);
    opacity: 0.75;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 1px;
  }

  .session-item .session-actions {
    display: none;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .session-item:hover .session-actions,
  .session-item.active .session-actions {
    display: flex;
  }

  /* Touch screens have no hover — always show actions on coarse pointers */
  @media (pointer: coarse) {
    .session-item .session-actions {
      display: flex;
    }
  }

  .session-action-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--bonnie-ink-3);
    padding: 3px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s;
    width: 22px;
    height: 22px;
  }

  .session-action-btn:hover {
    background: var(--bonnie-surface-3);
    color: var(--bonnie-ink-1);
  }

  .session-action-btn.delete:hover {
    background: rgba(229, 115, 115, 0.2);
    color: #ff8a80;
  }

  .session-action-btn svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Inline rename input */
  .session-rename-input {
    width: 100%;
    background: var(--bonnie-surface-3);
    border: 1px solid var(--bonnie-accent-focus);
    border-radius: 6px;
    padding: 3px 7px;
    font-size: 13px;
    font-family: inherit;
    color: var(--bonnie-ink-0);
    outline: none;
    box-shadow: 0 0 0 2px var(--bonnie-accent-glow);
  }

  .session-empty {
    padding: 20px 14px;
    font-size: 12px;
    color: var(--bonnie-ink-3);
    text-align: center;
    line-height: 1.5;
  }

  /* Confirm dialog overlay */
  .confirm-overlay {
    position: absolute;
    inset: 0;
    background: rgba(13, 17, 23, 0.85);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
    padding: 20px;
  }

  .confirm-card {
    background: var(--bonnie-surface-2);
    border: 1px solid var(--bonnie-border);
    border-radius: 14px;
    padding: 20px;
    max-width: 280px;
    width: 100%;
    box-shadow: var(--bonnie-shadow);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .confirm-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--bonnie-ink-0);
  }

  .confirm-body {
    font-size: 13px;
    color: var(--bonnie-ink-2);
    line-height: 1.5;
  }

  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .confirm-btn {
    padding: 7px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    border: none;
    transition: all 0.12s;
  }

  .confirm-btn.cancel {
    background: var(--bonnie-surface-3);
    color: var(--bonnie-ink-1);
    border: 1px solid var(--bonnie-border);
  }

  .confirm-btn.cancel:hover {
    background: var(--bonnie-surface-4);
    color: var(--bonnie-ink-0);
  }

  .confirm-btn.danger {
    background: rgba(229, 115, 115, 0.2);
    color: #ff8a80;
    border: 1px solid rgba(229, 115, 115, 0.3);
  }

  .confirm-btn.danger:hover {
    background: rgba(229, 115, 115, 0.3);
  }

  /* ── Narrow-mode sidebar overlay ─────────────────────── */
  .sidebar-overlay {
    display: none;
    position: absolute;
    inset: 0;
    z-index: 10;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
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
    padding: 14px 12px 10px;
    border-bottom: 1px solid var(--bonnie-border);
    flex-shrink: 0;
  }

  .drawer-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--bonnie-ink-1);
    letter-spacing: -0.01em;
  }

  /* ── Chat pane ───────────────────────────────────────── */
  .chat-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    position: relative;
    background: var(--bonnie-surface-0);
  }

  .chat-pane.drag-over {
    outline: 2px dashed var(--bonnie-accent);
    outline-offset: -4px;
  }

  .drop-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.4);
    color: var(--bonnie-accent);
    font-size: 1.2rem;
    font-weight: 600;
    z-index: 10;
    pointer-events: none;
    border-radius: var(--bonnie-radius);
  }

  /* ── Messages ────────────────────────────────────────── */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 0;
    scrollbar-width: thin;
    scrollbar-color: var(--bonnie-surface-4) transparent;
  }

  .messages::-webkit-scrollbar {
    width: 5px;
  }

  .messages::-webkit-scrollbar-thumb {
    background: var(--bonnie-surface-4);
    border-radius: 3px;
  }

  /* Scroll-to-bottom button */
  .scroll-to-bottom {
    position: absolute;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(8px);
    background: var(--bonnie-surface-3);
    border: 1px solid var(--bonnie-border);
    color: var(--bonnie-ink-1);
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    opacity: 0;
    pointer-events: none;
    transition: all 0.2s ease;
    box-shadow: var(--bonnie-shadow-sm);
    z-index: 5;
    white-space: nowrap;
  }

  .scroll-to-bottom.visible {
    opacity: 1;
    pointer-events: all;
    transform: translateX(-50%) translateY(0);
  }

  .scroll-to-bottom:hover {
    background: var(--bonnie-surface-4);
    color: var(--bonnie-ink-0);
  }

  .scroll-to-bottom svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Empty state */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: var(--bonnie-ink-2);
    text-align: center;
    padding: 32px 24px;
  }

  .empty-icon-wrap {
    width: 72px;
    height: 72px;
    border-radius: 24px;
    background: var(--bonnie-accent-soft);
    border: 1px solid var(--bonnie-accent-mid);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 24px var(--bonnie-accent-glow);
  }

  .empty-icon-wrap svg {
    width: 42px;
    height: 42px;
    color: var(--bonnie-accent);
    fill: currentColor;
  }

  .empty-heading {
    font-size: 22px;
    font-weight: 600;
    color: var(--bonnie-ink-0);
    letter-spacing: -0.025em;
    line-height: 1.2;
    line-height: 1.3;
  }

  .empty-subtext {
    font-size: 13px;
    color: var(--bonnie-ink-3);
    line-height: 1.5;
    max-width: 240px;
  }

  .start-btn {
    background: var(--bonnie-accent);
    color: var(--bonnie-on-accent);
    border: none;
    border-radius: 12px;
    padding: 11px 24px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 18px var(--bonnie-accent-focus);
    letter-spacing: -0.01em;
  }

  .start-btn:hover {
    background: var(--bonnie-accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 6px 24px var(--bonnie-accent-focus);
  }

  .start-btn svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Suggested prompt pills */
  .suggested-prompts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    max-width: 380px;
    flex-direction: column;
    width: 100%;
    margin-top: 8px;
  }

  .suggested-prompt-btn {
    background: var(--bonnie-surface-2);
    border: 1px solid var(--bonnie-border);
    color: var(--bonnie-ink-1);
    border-radius: 12px;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    line-height: 1.4;
  }

  .suggested-prompt-btn:hover {
    background: var(--bonnie-accent-soft);
    border-color: var(--bonnie-accent-focus);
    color: var(--bonnie-ink-0);
    transform: translateY(-1px);
  }


  /* Keyboard shortcut help popover */
  .kb-help-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .kb-help-popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    background: var(--bonnie-surface-2);
    border: 1px solid var(--bonnie-border);
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 12px;
    box-shadow: var(--bonnie-shadow);
    z-index: 50;
    min-width: 210px;
    display: none;
  }

  .kb-help-popover.open {
    display: block;
  }

  .kb-help-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 3px 0;
    color: var(--bonnie-ink-2);
  }

  .kb-help-row:not(:last-child) {
    border-bottom: 1px solid var(--bonnie-border-soft);
    margin-bottom: 3px;
    padding-bottom: 6px;
  }

  .kb-help-label {
    font-size: 11.5px;
    color: var(--bonnie-ink-2);
  }

  .kb-shortcuts {
    display: flex;
    gap: 3px;
    flex-shrink: 0;
  }

  .kb-key {
    background: var(--bonnie-surface-3);
    border: 1px solid var(--bonnie-border);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 10.5px;
    font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
    color: var(--bonnie-ink-1);
  }

  /* Skeleton loading lines */
  .skeleton-wrap {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px 16px;
  }

  .skeleton-msg {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .skeleton-msg.user {
    flex-direction: row-reverse;
  }

  .skeleton-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--bonnie-surface-3);
    flex-shrink: 0;
    animation: shimmer 1.5s ease-in-out infinite;
  }

  .skeleton-lines {
    display: flex;
    flex-direction: column;
    gap: 7px;
    flex: 1;
    max-width: 70%;
  }

  .skeleton-msg.user .skeleton-lines {
    align-items: flex-end;
  }

  .skeleton-line {
    height: 14px;
    border-radius: 7px;
    background: var(--bonnie-surface-3);
    animation: shimmer 1.5s ease-in-out infinite;
  }

  @keyframes shimmer {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  /* ── Bubbles ─────────────────────────────────────────── */
  .bubble-row {
    display: flex;
    max-width: 100%;
    padding: 2px 0;
    position: relative;
  }

  .bubble-row.user {
    justify-content: flex-end;
  }

  .bubble-row.assistant,
  .bubble-row.tool {
    justify-content: flex-start;
  }

  /* Bubble entry animation */
  @keyframes bubble-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .bubble-row.new-msg {
    animation: bubble-in 0.2s ease-out forwards;
  }

  /* Message actions hover bar */
  .msg-actions {
    position: absolute;
    top: -2px;
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
    background: var(--bonnie-surface-2);
    border: 1px solid var(--bonnie-border);
    border-radius: 8px;
    padding: 2px;
    box-shadow: var(--bonnie-shadow-sm);
    z-index: 2;
  }

  .bubble-row.user .msg-actions {
    right: 0;
    transform: translateY(-100%);
  }

  .bubble-row.assistant .msg-actions {
    left: 0;
    transform: translateY(-100%);
  }

  .bubble-row:hover .msg-actions {
    opacity: 1;
    pointer-events: all;
  }

  .msg-action-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--bonnie-ink-3);
    padding: 4px 6px;
    border-radius: 5px;
    font-size: 11px;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.12s;
    white-space: nowrap;
  }

  .msg-action-btn:hover {
    background: var(--bonnie-surface-3);
    color: var(--bonnie-ink-0);
  }

  .msg-action-btn.copied {
    color: #3fb950;
  }

  .msg-action-btn svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .bubble {
    max-width: 78%;
    padding: 10px 15px;
    border-radius: 18px;
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
    overflow-wrap: anywhere;
    position: relative;
  }

  .bubble.user {
    background: var(--bonnie-accent);
    color: var(--bonnie-on-accent);
    border-bottom-right-radius: 5px;
    font-weight: 500;
    letter-spacing: -0.01em;
    box-shadow: 0 2px 10px var(--bonnie-accent-focus);
  }

  .bubble.assistant {
    background: var(--bonnie-surface-2);
    color: var(--bonnie-ink-0);
    border-bottom-left-radius: 5px;
    border: 1px solid var(--bonnie-border);
    box-shadow: var(--bonnie-shadow-sm);
    max-width: 90%;
  }

  .bubble.error {
    background: rgba(229, 115, 115, 0.1);
    color: #ff8a80;
    border: 1px solid rgba(229, 115, 115, 0.25);
  }

  /* Edit user message */
  .edit-bubble-wrap {
    max-width: 78%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  }

  .edit-bubble-textarea {
    width: 100%;
    background: var(--bonnie-surface-2);
    border: 1.5px solid var(--bonnie-accent-focus);
    border-radius: 14px;
    padding: 10px 14px;
    font-size: 14px;
    font-family: inherit;
    color: var(--bonnie-ink-0);
    resize: none;
    outline: none;
    line-height: 1.6;
    box-shadow: 0 0 0 3px var(--bonnie-accent-glow);
    min-height: 60px;
    box-sizing: border-box;
  }

  .edit-actions {
    display: flex;
    gap: 6px;
  }

  .edit-cancel-btn, .edit-send-btn {
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    border: none;
    transition: all 0.12s;
  }

  .edit-cancel-btn {
    background: var(--bonnie-surface-3);
    color: var(--bonnie-ink-1);
    border: 1px solid var(--bonnie-border);
  }

  .edit-cancel-btn:hover {
    background: var(--bonnie-surface-4);
  }

  .edit-send-btn {
    background: var(--bonnie-accent);
    color: var(--bonnie-on-accent);
    font-weight: 600;
  }

  .edit-send-btn:hover {
    background: var(--bonnie-accent-hover);
  }

  /* Markdown inside assistant bubbles */
  .bubble.assistant p {
    margin: 0 0 0.6em;
  }

  .bubble.assistant p:last-child {
    margin-bottom: 0;
  }

  .bubble.assistant code {
    font-family: 'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', monospace;
    font-size: 0.83em;
    background: var(--bonnie-surface-0);
    padding: 0.13em 0.45em;
    border-radius: 5px;
    color: var(--bonnie-accent);
    border: 1px solid var(--bonnie-border);
  }

  /* Code block wrap */
  .bubble.assistant .code-block-wrap {
    background: var(--bonnie-surface-0);
    border: 1px solid var(--bonnie-border);
    border-radius: 12px;
    overflow: hidden;
    margin: 0.6em 0;
    font-size: 12.5px;
  }

  .bubble.assistant .code-block-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 12px;
    background: var(--bonnie-surface-1);
    border-bottom: 1px solid var(--bonnie-border);
    min-height: 32px;
  }

  .bubble.assistant .code-lang {
    font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
    font-size: 11px;
    color: var(--bonnie-ink-3);
    text-transform: lowercase;
    letter-spacing: 0.02em;
  }

  .bubble.assistant .code-copy-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--bonnie-ink-3);
    font-size: 11px;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 5px;
    transition: all 0.12s;
  }

  .bubble.assistant .code-copy-btn:hover {
    background: var(--bonnie-surface-3);
    color: var(--bonnie-ink-0);
  }

  .bubble.assistant .code-copy-btn.copied {
    color: #3fb950;
  }

  .bubble.assistant .code-copy-btn svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .bubble.assistant pre {
    margin: 0;
    padding: 12px 14px;
    overflow-x: auto;
    background: transparent;
  }

  .bubble.assistant pre code {
    background: none;
    padding: 0;
    border: none;
    border-radius: 0;
    font-size: 1em;
    color: var(--bonnie-ink-0);
    font-family: 'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', monospace;
  }

  .bubble.assistant ul,
  .bubble.assistant ol {
    padding-left: 1.5em;
    margin: 0.4em 0;
  }

  .bubble.assistant li {
    margin-bottom: 0.25em;
  }

  .bubble.assistant a {
    color: var(--bonnie-accent);
    text-decoration: none;
  }

  .bubble.assistant a:hover {
    text-decoration: underline;
  }

  .bubble.assistant strong {
    font-weight: 700;
    color: var(--bonnie-ink-0);
  }

  .bubble.assistant em {
    font-style: italic;
    color: var(--bonnie-ink-1);
  }

  .bubble.assistant h1, .bubble.assistant h2, .bubble.assistant h3,
  .bubble.assistant h4, .bubble.assistant h5, .bubble.assistant h6 {
    font-weight: 600;
    color: var(--bonnie-ink-0);
    margin: 0.8em 0 0.4em;
    line-height: 1.3;
  }

  .bubble.assistant h1 { font-size: 1.2em; }
  .bubble.assistant h2 { font-size: 1.1em; }
  .bubble.assistant h3 { font-size: 1em; }

  .bubble.assistant .md-blockquote {
    border-left: 3px solid var(--bonnie-accent-mid);
    padding: 4px 12px;
    margin: 0.5em 0;
    color: var(--bonnie-ink-2);
    background: var(--bonnie-accent-soft);
    border-radius: 0 6px 6px 0;
  }

  .bubble.assistant .md-table-wrap {
    overflow-x: auto;
    margin: 0.5em 0;
  }

  .bubble.assistant .md-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
  }

  .bubble.assistant .md-table th {
    background: var(--bonnie-surface-1);
    border: 1px solid var(--bonnie-border);
    padding: 7px 12px;
    text-align: left;
    font-weight: 600;
    color: var(--bonnie-ink-1);
  }

  .bubble.assistant .md-table td {
    border: 1px solid var(--bonnie-border);
    padding: 6px 12px;
    color: var(--bonnie-ink-1);
  }

  .bubble.assistant .md-table tr:hover td {
    background: var(--bonnie-surface-1);
  }

  .bubble.assistant hr {
    border: none;
    border-top: 1px solid var(--bonnie-border);
    margin: 0.8em 0;
  }

  /* ── Tool bubble ─────────────────────────────────────── */
  .tool-bubble {
    max-width: 88%;
    background: var(--bonnie-surface-1);
    border: 1px solid var(--bonnie-border);
    border-radius: 12px;
    font-size: 12.5px;
    overflow: hidden;
    color: var(--bonnie-ink-1);
    box-shadow: var(--bonnie-shadow-sm);
  }

  .tool-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    cursor: pointer;
    user-select: none;
    transition: background 0.12s;
  }

  .tool-header:hover {
    background: var(--bonnie-surface-2);
  }

  .tool-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    border-radius: 5px;
    background: var(--bonnie-accent-soft);
    color: var(--bonnie-accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tool-icon svg {
    width: 11px;
    height: 11px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .tool-name {
    flex: 1;
    font-weight: 600;
    font-size: 12px;
    color: var(--bonnie-ink-1);
    font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tool-status {
    font-size: 10.5px;
    color: var(--bonnie-ink-3);
    background: var(--bonnie-surface-3);
    padding: 2px 7px;
    border-radius: 10px;
    flex-shrink: 0;
  }

  .tool-status.done {
    color: #3fb950;
    background: rgba(63, 185, 80, 0.1);
  }

  .tool-chevron {
    width: 13px;
    height: 13px;
    color: var(--bonnie-ink-3);
    transition: transform 0.15s;
    flex-shrink: 0;
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
    padding: 0 12px;
    border-top: 0px solid var(--bonnie-border-soft);
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.25s cubic-bezier(0.16, 1, 0.3, 1), padding 0.2s ease, border-top-width 0.2s ease;
  }

  .tool-body.visible {
    max-height: 600px;
    padding: 10px 12px 12px;
    border-top-width: 1px;
  }

  .tool-section-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--bonnie-ink-3);
    margin: 0 0 5px;
  }

  .tool-pre {
    font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
    font-size: 11px;
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
    max-height: 200px;
    overflow-y: auto;
  }

  .tool-pre:last-child {
    margin-bottom: 0;
  }

  .show-more-btn {
    background: none;
    border: none;
    color: var(--bonnie-accent);
    font-size: 11.5px;
    font-family: inherit;
    cursor: pointer;
    padding: 4px 0;
    display: block;
    transition: opacity 0.12s;
  }

  .show-more-btn:hover {
    opacity: 0.8;
  }

  /* Streaming cursor */
  .cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    background: var(--bonnie-accent);
    vertical-align: text-bottom;
    animation: blink 0.9s step-end infinite;
    margin-left: 1px;
    border-radius: 1px;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  /* ── Error card (inline) ──────────────────────────────── */
  .error-card {
    background: rgba(229, 115, 115, 0.08);
    border: 1px solid rgba(229, 115, 115, 0.22);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin: 8px 0;
    font-size: 13px;
  }

  .error-card-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    color: #ff8a80;
    margin-top: 1px;
  }

  .error-card-icon svg {
    width: 100%;
    height: 100%;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .error-card-body {
    flex: 1;
    min-width: 0;
  }

  .error-card-title {
    font-weight: 600;
    color: #ff8a80;
    margin-bottom: 4px;
  }

  .error-card-text {
    color: rgba(255, 138, 128, 0.8);
    font-size: 12.5px;
    line-height: 1.4;
    word-break: break-word;
  }

  .error-retry-btn {
    background: rgba(229, 115, 115, 0.15);
    border: 1px solid rgba(229, 115, 115, 0.3);
    border-radius: 7px;
    color: #ff8a80;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    padding: 5px 12px;
    margin-top: 8px;
    transition: all 0.12s;
  }

  .error-retry-btn:hover {
    background: rgba(229, 115, 115, 0.22);
  }

  /* ── Composer ────────────────────────────────────────── */
  .composer-wrap {
    flex-shrink: 0;
    padding: 10px 12px 12px;
    border-top: 1px solid var(--bonnie-border);
    background: var(--bonnie-surface-0);
  }

  .composer-inner {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    background: var(--bonnie-surface-1);
    border: 1.5px solid var(--bonnie-border);
    border-radius: 16px;
    padding: 10px 10px 10px 16px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .composer-inner:focus-within {
    border-color: var(--bonnie-accent-focus);
    box-shadow: 0 0 0 3px var(--bonnie-accent-glow);
  }

  .composer-textarea {
    flex: 1;
    resize: none;
    background: transparent;
    border: none;
    padding: 0;
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

  .composer-textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .composer-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 4px 0;
    min-height: 0;
  }

  .char-count {
    font-size: 11px;
    color: var(--bonnie-ink-3);
    transition: color 0.15s;
  }

  .char-count.warning {
    color: #f9a825;
  }

  .char-count.danger {
    color: #ff8a80;
  }

  .composer-hint {
    font-size: 11px;
    color: var(--bonnie-ink-3);
  }

  .send-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--bonnie-accent);
    color: var(--bonnie-on-accent);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s;
    box-shadow: 0 2px 8px var(--bonnie-accent-focus);
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
    box-shadow: 0 4px 14px var(--bonnie-accent-focus);
  }

  .send-btn.stop {
    background: rgba(229, 115, 115, 0.18);
    color: #ff8a80;
    box-shadow: none;
    border: 1px solid rgba(229, 115, 115, 0.25);
  }

  .send-btn.stop:hover {
    background: rgba(229, 115, 115, 0.28);
    transform: none;
  }

  .send-btn svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ── Loading state (skeleton) ────────────────────────── */
  .loading-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
  }

  .loading-spinner {
    width: 28px;
    height: 28px;
    border: 2.5px solid var(--bonnie-surface-3);
    border-top-color: var(--bonnie-accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Responsive: narrow ───────────────────────────────── */
  @media (max-width: 639px) {
    .sidebar {
      display: none;
    }
    .bubble {
      max-width: 90%;
    }
    .bubble.assistant {
      max-width: 94%;
    }
  }

  /* ── Feature 1: Syntax highlighting (hljs dark theme) ── */
  .hljs {
    background: transparent;
    color: var(--bonnie-ink-0);
  }
  .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-section, .hljs-link {
    color: #E8A04C;
    font-weight: 600;
  }
  .hljs-string, .hljs-attr, .hljs-template-variable, .hljs-addition {
    color: #98C379;
  }
  .hljs-number, .hljs-variable, .hljs-template-tag, .hljs-deletion {
    color: #D19A66;
  }
  .hljs-comment, .hljs-quote, .hljs-meta {
    color: #6E7681;
    font-style: italic;
  }
  .hljs-title, .hljs-section, .hljs-function {
    color: #61AFEF;
  }
  .hljs-name, .hljs-selector-class, .hljs-selector-id {
    color: #E06C75;
  }
  .hljs-type, .hljs-built_in, .hljs-class .hljs-title {
    color: #E5C07B;
  }
  .hljs-params {
    color: var(--bonnie-ink-1);
  }
  .hljs-tag {
    color: #E06C75;
  }
  .hljs-emphasis { font-style: italic; }
  .hljs-strong { font-weight: 700; }

  /* ── Feature 2: Streaming text appearance ─────────────── */
  .bubble.assistant .streaming-text {
    white-space: pre-wrap;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
  }

  /* ── Feature 7: Token/cost stats ──────────────────────── */
  .turn-stats {
    font-size: 10.5px;
    font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
    color: var(--bonnie-ink-3);
    padding: 2px 4px;
    margin-top: 2px;
    opacity: 0;
    transition: opacity 0.2s;
    white-space: nowrap;
  }
  .bubble-row:hover .turn-stats {
    opacity: 1;
  }

  /* ── Feature 8: Permission card ───────────────────────── */
  .permission-card {
    max-width: 88%;
    background: rgba(255, 193, 7, 0.06);
    border: 1.5px solid rgba(255, 193, 7, 0.35);
    border-radius: 12px;
    overflow: hidden;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 2px 12px rgba(255, 193, 7, 0.08);
  }
  .permission-header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #F9A825;
    font-weight: 600;
    font-size: 13px;
  }
  .permission-header svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    flex-shrink: 0;
  }
  .permission-title { flex: 1; }
  .permission-body {
    font-size: 13px;
    color: var(--bonnie-ink-1);
    line-height: 1.5;
  }
  .permission-body strong {
    color: #F9A825;
    font-weight: 600;
  }
  .permission-actions {
    display: flex;
    gap: 8px;
  }
  .permission-deny-btn, .permission-approve-btn {
    padding: 6px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    border: none;
    transition: all 0.12s;
  }
  .permission-deny-btn {
    background: var(--bonnie-surface-3);
    color: var(--bonnie-ink-1);
    border: 1px solid var(--bonnie-border);
  }
  .permission-deny-btn:hover { background: var(--bonnie-surface-4); }
  .permission-approve-btn {
    background: rgba(255, 193, 7, 0.18);
    color: #F9A825;
    border: 1px solid rgba(255, 193, 7, 0.35);
  }
  .permission-approve-btn:hover { background: rgba(255, 193, 7, 0.28); }

  /* ── Feature 5: Voice mic button ──────────────────────── */
  .mic-btn {
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    color: var(--bonnie-ink-3);
    padding: 0;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .mic-btn:hover {
    background: var(--bonnie-surface-3);
    color: var(--bonnie-ink-1);
  }
  .mic-btn.listening {
    color: #E06C75;
    background: rgba(224, 108, 117, 0.12);
    border-color: rgba(224, 108, 117, 0.3);
    animation: mic-pulse 1.4s ease-in-out infinite;
  }
  .mic-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .mic-btn svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  @keyframes mic-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(224, 108, 117, 0.35); }
    50% { box-shadow: 0 0 0 5px rgba(224, 108, 117, 0); }
  }

  /* ── Feature 6: Export menu ───────────────────────────── */
  .export-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: var(--bonnie-surface-2);
    border: 1px solid var(--bonnie-border);
    border-radius: 10px;
    padding: 4px;
    box-shadow: var(--bonnie-shadow);
    z-index: 50;
    min-width: 180px;
  }
  .export-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--bonnie-ink-1);
    padding: 8px 10px;
    font-size: 13px;
    font-family: inherit;
    border-radius: 7px;
    text-align: left;
    transition: background 0.12s;
  }
  .export-menu-item:hover { background: var(--bonnie-surface-3); color: var(--bonnie-ink-0); }
  .export-menu-item svg {
    width: 13px;
    height: 13px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    flex-shrink: 0;
  }

  /* ── Toast notification ────────────────────────────────── */
  .toast {
    position: absolute;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bonnie-surface-3);
    border: 1px solid var(--bonnie-border);
    border-radius: 20px;
    padding: 7px 16px;
    font-size: 13px;
    color: var(--bonnie-ink-1);
    box-shadow: var(--bonnie-shadow-sm);
    z-index: 10;
    white-space: nowrap;
    pointer-events: none;
    animation: toast-in 0.2s ease-out;
  }
  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(6px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* ── Feature 11: Image upload ──────────────────────────── */

  /* Attach button — same base style as mic-btn */
  .attach-btn {
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    color: var(--bonnie-ink-3);
    padding: 0;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .attach-btn:hover {
    background: var(--bonnie-surface-3);
    color: var(--bonnie-ink-1);
  }
  .attach-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .attach-btn svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Attachment chip strip above the textarea */
  .attach-strip {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    padding: 0 4px 8px;
  }

  .attach-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px 6px 6px;
    background: var(--bonnie-surface-2);
    border: 1px solid var(--bonnie-border);
    border-radius: 12px;
    font-size: 12px;
    max-width: 200px;
  }
  .attach-chip img {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    object-fit: cover;
    flex-shrink: 0;
  }
  .attach-chip .filename {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--bonnie-ink-1);
  }
  .attach-chip button {
    background: transparent;
    border: 0;
    color: var(--bonnie-ink-3);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
    transition: color 0.12s;
  }
  .attach-chip button:hover { color: var(--bonnie-ink-0); }
  .attach-chip.uploading { opacity: 0.6; }
  .attach-chip.error {
    background: rgba(229, 115, 115, 0.1);
    border-color: rgba(229, 115, 115, 0.3);
    color: #ff8a80;
  }
  .chip-uploading-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--bonnie-border);
    border-top-color: var(--bonnie-accent);
    animation: chip-spin 0.8s linear infinite;
    flex-shrink: 0;
  }
  @keyframes chip-spin { to { transform: rotate(360deg); } }

  /* Attachments in user bubble */
  .bubble-attachments {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .bubble-attachments img {
    max-width: 200px;
    max-height: 200px;
    border-radius: 8px;
    cursor: zoom-in;
    object-fit: cover;
    border: 1px solid var(--bonnie-border);
    display: block;
  }
  .bubble-file-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: var(--bonnie-surface-2);
    border: 1px solid var(--bonnie-border);
    border-radius: 8px;
    font-size: 12px;
    color: var(--bonnie-ink-1);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* File icon in attach chip (for non-image files) */
  .attach-chip .file-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }

  /* Lightbox overlay */
  .lightbox {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    cursor: zoom-out;
  }
  .lightbox img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
    cursor: default;
  }

  /* ── Feature 9: Inline images ──────────────────────────── */
  .bubble.assistant .md-image {
    max-width: 100%;
    max-height: 320px;
    object-fit: contain;
    border-radius: 8px;
    border: 1px solid var(--bonnie-border);
    background: var(--bonnie-surface-0);
    display: block;
    margin: 0.5em 0;
  }

  /* ── Feature 10: Light mode (system preference) ────────── */
  @media (prefers-color-scheme: light) {
    :host(:not([data-theme="dark"])) {
      --bonnie-ink-0: #0F172A;
      --bonnie-ink-1: #334155;
      --bonnie-ink-2: #64748B;
      --bonnie-ink-3: #94A3B8;
      --bonnie-surface-0: #FFFFFF;
      --bonnie-surface-1: #F8FAFC;
      --bonnie-surface-2: #F1F5F9;
      --bonnie-surface-3: #E2E8F0;
      --bonnie-surface-4: #CBD5E1;
      --bonnie-border: rgba(15, 23, 42, 0.08);
      --bonnie-border-soft: rgba(15, 23, 42, 0.04);
      --bonnie-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
      --bonnie-shadow-sm: 0 2px 8px rgba(15, 23, 42, 0.06);
    }
  }

  /* Explicit light mode forced via toggle */
  :host([data-theme="light"]) {
    --bonnie-ink-0: #0F172A;
    --bonnie-ink-1: #334155;
    --bonnie-ink-2: #64748B;
    --bonnie-ink-3: #94A3B8;
    --bonnie-surface-0: #FFFFFF;
    --bonnie-surface-1: #F8FAFC;
    --bonnie-surface-2: #F1F5F9;
    --bonnie-surface-3: #E2E8F0;
    --bonnie-surface-4: #CBD5E1;
    --bonnie-border: rgba(15, 23, 42, 0.08);
    --bonnie-border-soft: rgba(15, 23, 42, 0.04);
    --bonnie-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
    --bonnie-shadow-sm: 0 2px 8px rgba(15, 23, 42, 0.06);
  }

  /* Explicit dark mode forced via toggle (overrides system light) */
  :host([data-theme="dark"]) {
    --bonnie-ink-0: #E6EDF3;
    --bonnie-ink-1: #C7D1DC;
    --bonnie-ink-2: #8B949E;
    --bonnie-ink-3: #586069;
    --bonnie-surface-0: #0D1117;
    --bonnie-surface-1: color-mix(in srgb, #0D1117 80%, white 5%);
    --bonnie-surface-2: color-mix(in srgb, #0D1117 65%, white 10%);
    --bonnie-surface-3: color-mix(in srgb, #0D1117 50%, white 15%);
    --bonnie-surface-4: color-mix(in srgb, #0D1117 35%, white 20%);
    --bonnie-border: rgba(255, 255, 255, 0.08);
    --bonnie-border-soft: rgba(255, 255, 255, 0.04);
    --bonnie-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    --bonnie-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  /* Light mode hljs overrides */
  :host([data-theme="light"]) .hljs-comment,
  :host([data-theme="light"]) .hljs-quote,
  :host([data-theme="light"]) .hljs-meta {
    color: #6B7280;
  }

  /* ── Feature 9: Typing indicator ──────────────────────── */
  .typing-indicator-bubble {
    display: inline-flex;
    padding: 0;
  }

  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 12px 16px;
  }

  .typing-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--bonnie-ink-3);
    animation: typing-bounce 1.4s ease-in-out infinite;
  }

  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes typing-bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-6px); }
  }

  /* ── Feature 10: Model selector pill ─────────────────── */
  .model-selector {
    background: var(--bonnie-surface-2);
    border: 1px solid var(--bonnie-border);
    border-radius: 8px;
    color: var(--bonnie-ink-2);
    font-size: 11px;
    font-family: inherit;
    padding: 4px 8px;
    cursor: pointer;
    outline: none;
    transition: all 0.12s;
    max-width: 130px;
    flex-shrink: 0;
  }

  .model-selector:hover,
  .model-selector:focus {
    border-color: var(--bonnie-accent);
    color: var(--bonnie-ink-0);
  }

  /* ── Feature T4-1: Active icon button variant ───────────────────────── */
  .icon-btn--active {
    color: var(--bonnie-accent) !important;
  }

  /* ── Feature T4-1: System prompt panel ─────────────────────────────── */
  .system-prompt-panel {
    flex-shrink: 0;
    padding: 10px 12px;
    border-bottom: 1px solid var(--bonnie-border);
    background: var(--bonnie-surface-1);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .system-prompt-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .system-prompt-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--bonnie-ink-0);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .system-prompt-hint {
    font-size: 11px;
    color: var(--bonnie-ink-2);
  }

  .system-prompt-textarea {
    background: var(--bonnie-surface-2);
    border: 1px solid var(--bonnie-border);
    border-radius: var(--bonnie-radius-sm);
    color: var(--bonnie-ink-0);
    font-family: inherit;
    font-size: 12px;
    line-height: 1.5;
    padding: 8px 10px;
    resize: vertical;
    width: 100%;
    box-sizing: border-box;
    outline: none;
  }

  .system-prompt-textarea:focus {
    border-color: var(--bonnie-accent);
  }

  .system-prompt-actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
  }

  .system-prompt-clear-btn,
  .system-prompt-cancel-btn,
  .system-prompt-save-btn {
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--bonnie-border);
    transition: background 0.12s;
  }

  .system-prompt-clear-btn {
    background: transparent;
    color: var(--bonnie-ink-2);
    margin-right: auto;
  }

  .system-prompt-cancel-btn {
    background: transparent;
    color: var(--bonnie-ink-1);
  }

  .system-prompt-save-btn {
    background: var(--bonnie-accent);
    color: #000;
    border-color: transparent;
  }

  .system-prompt-clear-btn:hover { color: var(--bonnie-ink-0); }
  .system-prompt-cancel-btn:hover { background: var(--bonnie-surface-3); }
  .system-prompt-save-btn:hover { filter: brightness(1.1); }

  /* ── Plugin admin form inputs ──────────────────────────────────────── */
  .sys-prompt-input {
    width: 100%;
    box-sizing: border-box;
    background: var(--bonnie-surface-2);
    border: 1px solid var(--bonnie-border);
    border-radius: var(--bonnie-radius-sm);
    color: var(--bonnie-ink-0);
    font-family: inherit;
    font-size: 12px;
    padding: 6px 10px;
    outline: none;
    transition: border-color 0.15s;
  }
  .sys-prompt-input:focus {
    border-color: var(--bonnie-accent);
  }
  .sys-prompt-input::placeholder {
    color: var(--bonnie-ink-3);
  }

  /* ── Settings panel fields ─────────────────────────────────────────── */
  .settings-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .settings-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--bonnie-ink-1);
  }

  /* ── Feature T4-2: Message search panel ────────────────────────────── */
  .msg-search-panel {
    flex-shrink: 0;
    background: var(--bonnie-surface-1);
    border-bottom: 1px solid var(--bonnie-border);
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .msg-search-input-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
  }

  .msg-search-icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    color: var(--bonnie-ink-2);
    display: flex;
  }

  .msg-search-icon svg {
    width: 100%;
    height: 100%;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .msg-search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-family: inherit;
    font-size: 13px;
    color: var(--bonnie-ink-0);
  }

  .msg-search-input::placeholder {
    color: var(--bonnie-ink-3);
  }

  .msg-search-close {
    flex-shrink: 0;
  }

  .msg-search-loading,
  .msg-search-empty {
    padding: 8px 12px;
    font-size: 12px;
    color: var(--bonnie-ink-2);
  }

  .msg-search-results {
    display: flex;
    flex-direction: column;
    max-height: 200px;
    overflow-y: auto;
    border-top: 1px solid var(--bonnie-border-soft);
  }

  .msg-search-result {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--bonnie-border-soft);
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
  }

  .msg-search-result:hover {
    background: var(--bonnie-surface-2);
  }

  .msg-search-result-role {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--bonnie-accent);
  }

  .msg-search-result-snippet {
    font-size: 12px;
    color: var(--bonnie-ink-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .msg-search-result-snippet mark {
    background: color-mix(in srgb, var(--bonnie-accent) 30%, transparent);
    color: var(--bonnie-ink-0);
    border-radius: 2px;
    padding: 0 1px;
  }

  /* Flash highlight when scrolling to a searched turn */
  .search-highlight-flash {
    animation: searchFlash 1.5s ease-out;
  }

  @keyframes searchFlash {
    0% { background: color-mix(in srgb, var(--bonnie-accent) 20%, transparent); }
    100% { background: transparent; }
  }

  /* ── Feature T4-3: Virtualization spacer ───────────────────────────── */
  .virt-top-spacer {
    flex-shrink: 0;
    pointer-events: none;
  }

  .virt-top-sentinel {
    height: 1px;
    flex-shrink: 0;
    pointer-events: none;
  }

  /* ── T4-8: Pin/archive ─────────────────────────────────── */

  .session-item.pinned {
    border-left: 2px solid var(--bonnie-accent);
  }

  .pin-indicator {
    font-size: 10px;
    margin-right: 3px;
    flex-shrink: 0;
  }

  .pinned-label {
    color: var(--bonnie-accent);
  }

  .session-action-btn.pinned-btn {
    color: var(--bonnie-accent);
  }

  .archived-toggle-wrap {
    padding: 6px 12px 4px;
    border-top: 1px solid var(--bonnie-border-soft);
    margin-top: 4px;
  }

  .archived-toggle-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--bonnie-ink-2);
    font-size: 0.75rem;
    padding: 2px 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: color 0.15s;
  }

  .archived-toggle-btn:hover {
    color: var(--bonnie-ink-1);
  }

  .archived-count {
    background: var(--bonnie-surface-3);
    color: var(--bonnie-ink-2);
    font-size: 10px;
    padding: 0 4px;
    border-radius: 8px;
    min-width: 16px;
    text-align: center;
  }

  .archived-list {
    opacity: 0.75;
  }

  /* ── T4-5: Toast notification ──────────────────────────── */

  .toast-notification {
    position: absolute;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bonnie-surface-3);
    color: var(--bonnie-ink-0);
    border: 1px solid var(--bonnie-border);
    border-radius: var(--bonnie-radius-sm);
    padding: 8px 16px;
    font-size: 0.8rem;
    white-space: nowrap;
    z-index: 100;
    box-shadow: var(--bonnie-shadow-sm);
    animation: toast-in 0.2s ease;
    pointer-events: none;
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* ── Feature T4-9: Session token counter bar ──────────────────────── */
  .session-token-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 14px;
    flex-shrink: 0;
    background: transparent;
  }

  .token-bar-tokens,
  .token-bar-cost,
  .token-bar-turns {
    font-size: 10.5px;
    font-family: ui-monospace, 'SFMono-Regular', 'Cascadia Code', monospace;
    color: var(--bonnie-ink-3);
    letter-spacing: 0.01em;
  }

  .token-bar-sep {
    font-size: 10.5px;
    color: var(--bonnie-ink-3);
    opacity: 0.5;
  }

  /* ── Feature 14: Offline banner ──────────────────────────────── */
  .offline-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 12px 6px;
    padding: 8px 12px;
    background: color-mix(in srgb, #F59E0B 15%, transparent);
    border: 1px solid color-mix(in srgb, #F59E0B 40%, transparent);
    border-radius: var(--bonnie-radius-sm);
    font-size: 12.5px;
    color: #F59E0B;
    animation: banner-in 0.2s ease;
  }

  @keyframes banner-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .offline-banner svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    stroke: #F59E0B;
  }

  .offline-banner-text {
    flex: 1;
    font-weight: 500;
  }

  .offline-banner-dismiss {
    background: none;
    border: none;
    cursor: pointer;
    color: #F59E0B;
    font-size: 16px;
    line-height: 1;
    padding: 0 2px;
    opacity: 0.8;
  }

  .offline-banner-dismiss:hover {
    opacity: 1;
  }

  /* ── Feature 13: Analytics overlay ──────────────────────────── */
  .analytics-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 50;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 20px 16px;
    border-radius: var(--bonnie-radius);
    overflow-y: auto;
  }

  .analytics-panel {
    background: var(--bonnie-surface-1);
    border: 1px solid var(--bonnie-border);
    border-radius: var(--bonnie-radius-sm);
    width: 100%;
    max-width: 560px;
    padding: 0 0 16px;
    box-shadow: var(--bonnie-shadow);
  }

  .analytics-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--bonnie-border-soft);
  }

  .analytics-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--bonnie-ink-0);
  }

  .analytics-title svg {
    width: 16px;
    height: 16px;
    stroke: var(--bonnie-accent);
  }

  .analytics-loading {
    display: flex;
    justify-content: center;
    padding: 32px;
  }

  .analytics-empty {
    padding: 32px;
    text-align: center;
    color: var(--bonnie-ink-2);
    font-size: 13px;
  }

  .analytics-summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    background: var(--bonnie-border-soft);
    margin: 0 0 12px;
  }

  .analytics-stat {
    background: var(--bonnie-surface-1);
    padding: 14px 12px;
    text-align: center;
  }

  .analytics-stat-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--bonnie-accent);
    font-family: ui-monospace, 'SFMono-Regular', monospace;
    line-height: 1.2;
  }

  .analytics-stat-label {
    font-size: 11px;
    color: var(--bonnie-ink-2);
    margin-top: 3px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .analytics-section-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--bonnie-ink-2);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 12px 16px 6px;
  }

  /* Bar chart */
  .analytics-chart {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    padding: 0 16px 4px;
    height: 80px;
  }

  .chart-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
  }

  .chart-bar-wrap {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
  }

  .chart-bar {
    width: 100%;
    min-height: 2px;
    background: var(--bonnie-accent);
    border-radius: 3px 3px 0 0;
    opacity: 0.8;
    transition: opacity 0.15s;
  }

  .chart-bar:hover {
    opacity: 1;
  }

  .chart-label {
    font-size: 9px;
    color: var(--bonnie-ink-3);
    margin-top: 3px;
    text-align: center;
    white-space: nowrap;
  }

  /* Per-user table */
  .analytics-table {
    width: calc(100% - 32px);
    margin: 0 16px;
    border-collapse: collapse;
    font-size: 12.5px;
  }

  .analytics-table th {
    text-align: left;
    color: var(--bonnie-ink-2);
    font-weight: 600;
    padding: 4px 8px 6px;
    border-bottom: 1px solid var(--bonnie-border-soft);
  }

  .analytics-table td {
    padding: 5px 8px;
    color: var(--bonnie-ink-1);
    border-bottom: 1px solid var(--bonnie-border-soft);
    font-family: ui-monospace, 'SFMono-Regular', monospace;
  }

  .analytics-table tr:last-child td {
    border-bottom: none;
  }

  /* ── Feature 6: Memories panel ─────────────────────────────────────────── */
  .memories-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--bonnie-border-soft);
    overflow-y: auto;
    max-height: 360px;
  }

  .memory-item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bonnie-surface-1);
    padding: 10px 14px;
  }

  .memory-item:hover {
    background: var(--bonnie-surface-2);
  }

  .memory-content {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }

  .memory-key {
    font-size: 12px;
    font-weight: 600;
    color: var(--bonnie-accent);
    font-family: ui-monospace, 'SFMono-Regular', monospace;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .memory-value {
    font-size: 13px;
    color: var(--bonnie-ink-1);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .memory-badge {
    font-size: 10px;
    background: var(--bonnie-accent);
    color: #000;
    padding: 1px 5px;
    border-radius: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .memory-delete-btn {
    flex-shrink: 0;
    opacity: 0.4;
    transition: opacity 0.15s;
  }

  .memory-delete-btn:hover {
    opacity: 1;
  }

  /* ── Feature 8: bonnie-chart ─────────────────────────────────────────────── */
  .bonnie-chart-wrap {
    background: var(--bonnie-surface-1);
    border: 1px solid var(--bonnie-border-soft);
    border-radius: 8px;
    padding: 12px 8px 8px;
    margin: 8px 0;
    overflow: hidden;
  }

  /* ── User admin panel ───────────────────────────────────────────────────── */
  .user-role-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    background: var(--bonnie-surface-3);
    color: var(--bonnie-ink-1);
  }
  .user-role-badge.admin {
    background: var(--bonnie-accent);
    color: var(--bonnie-on-accent);
  }
`
