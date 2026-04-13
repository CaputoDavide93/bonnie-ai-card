import { marked } from 'marked'

// Configure marked for safe, minimal output
marked.setOptions({
  gfm: true,
  breaks: true,
})

// Custom renderer to add language badge and copy button to code blocks
const renderer = new marked.Renderer()

renderer.code = function(code: string, infostring: string | undefined, _escaped: boolean): string {
  const language = (infostring || '').split(/\s/)[0] || ''
  const badge = language ? `<span class="code-lang">${language}</span>` : ''
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return `<div class="code-block-wrap">
    <div class="code-block-header">
      ${badge}
      <button class="code-copy-btn" data-code="${escaped}" title="Copy code">
        <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span>Copy</span>
      </button>
    </div>
    <pre><code class="language-${language}">${escaped}</code></pre>
  </div>`
}

renderer.blockquote = function(quote: string): string {
  return `<blockquote class="md-blockquote">${quote}</blockquote>`
}

renderer.table = function(header: string, body: string): string {
  return `<div class="md-table-wrap"><table class="md-table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`
}

marked.use({ renderer })

// Simple script-tag stripper (belt-and-suspenders after marked's own escaping)
function stripScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<script[^>]*>/gi, '')
}

export function renderMarkdown(text: string): string {
  const raw = marked.parse(text) as string
  return stripScripts(raw)
}
