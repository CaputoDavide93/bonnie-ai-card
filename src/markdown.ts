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

// ── Feature 8: bonnie-chart inline SVG renderer ───────────────────────────

interface BonnieChartSpec {
  type: 'line' | 'bar'
  title: string
  data: number[]
  labels: string[]
  unit: string
  color: string
}

function parseBonnieChart(code: string): BonnieChartSpec | null {
  const lines = code.split('\n')
  const spec: Record<string, string> = {}
  for (const line of lines) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const k = line.slice(0, idx).trim()
    const v = line.slice(idx + 1).trim()
    if (k) spec[k] = v
  }
  const type = (spec['type'] || 'line').toLowerCase()
  if (type !== 'line' && type !== 'bar') return null
  let data: number[] = []
  try { data = JSON.parse(spec['data'] || '[]') } catch { return null }
  if (!Array.isArray(data) || data.length === 0) return null
  let labels: string[] = []
  try { labels = JSON.parse(spec['labels'] || '[]') } catch { labels = [] }
  if (labels.length !== data.length) {
    labels = data.map((_, i) => String(i))
  }
  return {
    type: type as 'line' | 'bar',
    title: spec['title'] || '',
    data,
    labels,
    unit: spec['unit'] || '',
    color: spec['color'] || '#E8A04C',
  }
}

function renderBonnieChart(code: string): string {
  const spec = parseBonnieChart(code)
  if (!spec) {
    // Fall back to plain code block on parse failure
    const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<pre><code>${esc}</code></pre>`
  }

  const W = 560
  const H = 200
  const PAD_L = 42
  const PAD_R = 12
  const PAD_T = 28
  const PAD_B = 40
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B
  const n = spec.data.length
  const min = Math.min(...spec.data)
  const max = Math.max(...spec.data)
  const range = max - min || 1

  const safeColor = escAttr(spec.color)
  const safeTitle = escAttr(spec.title)
  const safeUnit = escAttr(spec.unit)

  // Map data to SVG coordinates
  const px = (i: number) => PAD_L + (i / (n - 1 || 1)) * chartW
  const py = (v: number) => PAD_T + chartH - ((v - min) / range) * chartH
  const barW = Math.max(2, chartW / n - 2)
  const barPx = (i: number) => PAD_L + (i / n) * chartW + (chartW / n - barW) / 2

  // Grid lines (4 horizontal)
  const gridLines: string[] = []
  for (let i = 0; i <= 4; i++) {
    const y = PAD_T + (i / 4) * chartH
    const val = max - (i / 4) * range
    gridLines.push(
      `<line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${W - PAD_R}" y2="${y.toFixed(1)}" stroke="#444" stroke-width="0.5" stroke-dasharray="4,4"/>`,
      `<text x="${(PAD_L - 4).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="9" fill="#aaa">${val.toFixed(1)}</text>`,
    )
  }

  // Series
  let series = ''
  if (spec.type === 'line') {
    const points = spec.data.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')
    // Shaded area under the line
    const areaPoints = [
      `${px(0).toFixed(1)},${(PAD_T + chartH).toFixed(1)}`,
      ...spec.data.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`),
      `${px(n - 1).toFixed(1)},${(PAD_T + chartH).toFixed(1)}`,
    ].join(' ')
    series = `<polygon points="${areaPoints}" fill="${safeColor}" fill-opacity="0.15"/>
<polyline points="${points}" fill="none" stroke="${safeColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
${spec.data.map((v, i) => `<circle cx="${px(i).toFixed(1)}" cy="${py(v).toFixed(1)}" r="3" fill="${safeColor}"/>`).join('')}`
  } else {
    // Bar chart
    series = spec.data.map((v, i) => {
      const bx = barPx(i)
      const bh = ((v - min) / range) * chartH
      const by = PAD_T + chartH - bh
      return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, bh).toFixed(1)}" fill="${safeColor}" rx="2"/>`
    }).join('')
  }

  // X labels (show at most 12 to avoid crowding)
  const labelStep = n <= 12 ? 1 : Math.ceil(n / 12)
  const xLabels = spec.labels
    .map((lbl, i) => {
      if (i % labelStep !== 0) return ''
      const x = spec.type === 'line' ? px(i) : barPx(i) + barW / 2
      return `<text x="${x.toFixed(1)}" y="${(PAD_T + chartH + 16).toFixed(1)}" text-anchor="middle" font-size="9" fill="#aaa">${escAttr(lbl)}</text>`
    })
    .join('')

  const unitLabel = safeUnit ? `<text x="${(W - PAD_R).toFixed(1)}" y="${(PAD_T - 6).toFixed(1)}" text-anchor="end" font-size="9" fill="#aaa">${safeUnit}</text>` : ''

  const svg = `<div class="bonnie-chart-wrap">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;overflow:visible">
    <text x="${(W / 2).toFixed(1)}" y="16" text-anchor="middle" font-size="12" fill="#ddd" font-weight="600">${safeTitle}</text>
    ${unitLabel}
    ${gridLines.join('\n    ')}
    ${series}
    ${xLabels}
    <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${PAD_T + chartH}" stroke="#555" stroke-width="1"/>
    <line x1="${PAD_L}" y1="${PAD_T + chartH}" x2="${W - PAD_R}" y2="${PAD_T + chartH}" stroke="#555" stroke-width="1"/>
  </svg>
</div>`
  return svg
}

// Custom renderer
const renderer = new marked.Renderer()

renderer.code = function(code: string, infostring: string | undefined, _escaped: boolean): string {
  const language = (infostring || '').split(/\s/)[0].toLowerCase() || ''

  // Feature 8: bonnie-chart inline visualization
  if (language === 'bonnie-chart') {
    return renderBonnieChart(code)
  }

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
// Hard cap at 500 entries (evict oldest first) to prevent unbounded growth when
// the card stays mounted across many long sessions.
const _MARKDOWN_CACHE_MAX = 500
const _markdownCache = new Map<string, string>()

export function renderMarkdown(text: string): string {
  const cached = _markdownCache.get(text)
  if (cached !== undefined) return cached
  const raw = marked.parse(text) as string
  const result = sanitize(raw)
  if (_markdownCache.size >= _MARKDOWN_CACHE_MAX) {
    // Map preserves insertion order — delete the first (oldest) key
    _markdownCache.delete(_markdownCache.keys().next().value!)
  }
  _markdownCache.set(text, result)
  return result
}

export function clearMarkdownCache(): void {
  _markdownCache.clear()
}
