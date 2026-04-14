import { marked } from 'marked'
import hljs from 'highlight.js/lib/core'

// Tree-shakeable language imports — only ship what we need
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import yaml from 'highlight.js/lib/languages/yaml'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'  // covers html
import css from 'highlight.js/lib/languages/css'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import java from 'highlight.js/lib/languages/java'
import diff from 'highlight.js/lib/languages/diff'
import plaintext from 'highlight.js/lib/languages/plaintext'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('json', json)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('go', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('java', java)
hljs.registerLanguage('diff', diff)
hljs.registerLanguage('plaintext', plaintext)
hljs.registerLanguage('text', plaintext)

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: true,
})

// Custom renderer
const renderer = new marked.Renderer()

renderer.code = function(code: string, infostring: string | undefined, _escaped: boolean): string {
  const language = (infostring || '').split(/\s/)[0].toLowerCase() || ''

  // Apply syntax highlighting
  let highlighted: string
  try {
    if (language && hljs.getLanguage(language)) {
      highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value
    } else {
      highlighted = hljs.highlightAuto(code).value
    }
  } catch {
    highlighted = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // Also escape for data-code attribute
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  const safeLang = escAttr(language)
  const badge = language ? `<span class="code-lang">${safeLang}</span>` : ''

  return `<div class="code-block-wrap">
    <div class="code-block-header">
      ${badge}
      <button class="code-copy-btn" data-code="${escaped}" title="Copy code">
        <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span>Copy</span>
      </button>
    </div>
    <pre><code class="hljs language-${safeLang}">${highlighted}</code></pre>
  </div>`
}

renderer.blockquote = function(quote: string): string {
  return `<blockquote class="md-blockquote">${quote}</blockquote>`
}

renderer.table = function(header: string, body: string): string {
  return `<div class="md-table-wrap"><table class="md-table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`
}

// Attribute escaper for safe HTML construction
function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
// Only allow safe URL schemes to prevent javascript: XSS
function isSafeUrl(u: string): boolean {
  return /^(https?:|blob:|data:image\/|\/|\.\.?\/)/.test(u.trim())
}

// Image renderer: sanitized href/title/alt, max-width, lazy loading
renderer.image = function(href: string, title: string | null, text: string): string {
  if (!isSafeUrl(href)) return escAttr(text || href)
  const safeHref = escAttr(href)
  const titleAttr = title ? ` title="${escAttr(title)}"` : ''
  const altAttr = text ? ` alt="${escAttr(text)}"` : ''
  return `<img src="${safeHref}"${altAttr}${titleAttr} class="md-image" loading="lazy">`
}

// Link renderer: block javascript: URIs (marked v12 does not by default)
renderer.link = function(href: string, title: string | null, text: string): string {
  if (!isSafeUrl(href)) return escAttr(text || href)
  const safeHref = escAttr(href)
  const titleAttr = title ? ` title="${escAttr(title)}"` : ''
  return `<a href="${safeHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
}

marked.use({ renderer })

// Robust HTML sanitizer — strips all event handlers, dangerous elements, and
// javascript: URIs that marked v12's default renderer lets through. This
// replaces the previous stripScripts() which only caught <script> tags.
function sanitize(html: string): string {
  // 1. Strip dangerous tags entirely (including content)
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<iframe[^>]*>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<base[^>]*>/gi, '')
  // 2. Strip ALL event handler attributes (on*)
  out = out.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')
  // 3. Strip javascript: in href/src/action attributes
  out = out.replace(/(href|src|action)\s*=\s*["']\s*javascript:/gi, '$1="')
  return out
}

// ── Markdown memoization cache (Feature T4-4) ─────────────────────────────
// Keyed by raw text string, value is sanitized HTML. Cleared on session switch.
const _markdownCache = new Map<string, string>()

export function renderMarkdown(text: string): string {
  const cached = _markdownCache.get(text)
  if (cached !== undefined) return cached
  const raw = marked.parse(text) as string
  const result = sanitize(raw)
  _markdownCache.set(text, result)
  return result
}

export function clearMarkdownCache(): void {
  _markdownCache.clear()
}
