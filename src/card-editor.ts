import { LitElement, html, type TemplateResult } from 'lit'

/**
 * Visual config editor stub for bonnie-ai-card.
 * Full GUI editor deferred to a future release — YAML editing works fine for now.
 */
export class BonnieCardEditor extends LitElement {
  override render(): TemplateResult {
    return html`
      <div style="padding: 16px; font-family: inherit; color: var(--secondary-text-color);">
        Edit this card's configuration in YAML mode. See the README for all available options.
      </div>
    `
  }
}

if (!customElements.get('bonnie-ai-card-editor')) {
  customElements.define('bonnie-ai-card-editor', BonnieCardEditor)
}
