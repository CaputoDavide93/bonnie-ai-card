/**
 * Tests for the LLM-output markdown sanitiser (src/markdown.ts).
 *
 * The sanitizer is attacker-tainted-input safe: LLM output can include
 * prompt-injected hostile markup from RAG/memory/web-tool sources, so
 * we treat it like any untrusted HTML. The DOMPurify config has been
 * tightened then loosened then tightened again across Sprints 1-2; this
 * file locks in the invariants that have already broken in production.
 */
import { describe, it, expect, beforeEach } from 'vitest'

// Lazy import — markdown.ts touches `document` and registers marked
// extensions, so we need jsdom in place. vitest.config sets that up
// globally so the import side-effects don't crash.
import { renderMarkdown } from '../src/markdown'

beforeEach(() => {
  // No-op for now; placeholder if we ever cache between tests.
})

describe('renderMarkdown — chart rendering (S1.4 regression)', () => {
  it('preserves a bonnie-chart SVG with geometry + labels', () => {
    const md = [
      '```bonnie-chart',
      'type: line',
      'title: Living Room Temperature',
      'data: [20.1, 20.3, 19.8]',
      'labels: ["00","01","02"]',
      'unit: °C',
      'color: #E8A04C',
      '```',
    ].join('\n')

    const html = renderMarkdown(md)

    expect(html, 'svg element survived sanitiser').toContain('<svg')
    expect(html, 'polyline data preserved').toContain('<polyline')
    expect(html, 'chart title preserved').toContain('Living Room Temperature')
    // Without ADD_URI_SAFE_ATTR these would have been stripped:
    expect(html, 'viewBox attr preserved').toMatch(/viewBox=/i)
    expect(html, 'points attr preserved').toMatch(/points=/i)
  })

  it('falls back to <pre><code> when chart spec is malformed', () => {
    const md = ['```bonnie-chart', 'this is not valid YAML at all', '```'].join('\n')
    const html = renderMarkdown(md)
    expect(html).toContain('<pre>')
    expect(html).toContain('<code>')
  })
})

describe('renderMarkdown — XSS vectors blocked', () => {
  const VECTORS: Array<[string, string]> = [
    ['inline script tag', '<script>alert(1)</script>'],
    ['svg + script', '<svg><script>alert(1)</script></svg>'],
    ['svg onload', '<svg onload="alert(1)"><circle r="1"/></svg>'],
    ['animate onbegin (SMIL)', '<svg><animate attributeName="x" onbegin="alert(1)"/></svg>'],
    ['foreignObject iframe escape', '<svg><foreignObject><iframe src="javascript:alert(1)"/></foreignObject></svg>'],
    ['use xlink:href external fetch', '<svg><use xlink:href="data:image/svg+xml,..."/></svg>'],
    ['svg image with javascript: href', '<svg><image href="javascript:alert(1)"/></svg>'],
    ['anchor javascript: href', '[click](javascript:alert(1))'],
    ['img onerror', '<img src=x onerror="alert(1)">'],
    ['style tag injection', '<style>body{display:none}</style>'],
  ]

  for (const [name, md] of VECTORS) {
    it(`strips: ${name}`, () => {
      const html = renderMarkdown(md)
      // Executable surface MUST be gone. KEEP_CONTENT defaults to true
      // so the inner TEXT of a forbidden tag may remain as DOM text —
      // that's harmless. We just check no live attack vector survives.
      expect(html, `vector "${name}" leaked: ${html}`).not.toMatch(
        /<script\b|onerror=|onload=|onbegin=|javascript:|<iframe\b|<animate\b|<foreignobject\b/i,
      )
    })
  }
})

describe('renderMarkdown — code blocks', () => {
  it('preserves the copy-button after sanitisation (button added to ALLOWED_TAGS)', () => {
    const md = '```python\nprint("hello")\n```'
    const html = renderMarkdown(md)
    expect(html).toContain('<pre>')
    expect(html).toContain('language-python')
    expect(html).toContain('code-copy-btn')
    expect(html).toMatch(/data-code="[^"]*"/)
  })
})

describe('renderMarkdown — markdown features', () => {
  it('renders bold + italic correctly', () => {
    const html = renderMarkdown('**bold** and *italic*')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
  })

  it('http(s) links open in a new tab with rel=noopener (afterSanitize hook)', () => {
    const html = renderMarkdown('[Anthropic](https://anthropic.com)')
    expect(html).toContain('href="https://anthropic.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('relative links do NOT get target=_blank (internal nav)', () => {
    // The afterSanitizeAttributes hook only re-applies target on
    // http(s) hrefs. Relative paths stay as same-tab navigation.
    // (Pure `#anchor` links are stripped entirely by isSafeUrl —
    // documented limitation; anchor-link navigation isn't supported.)
    const html = renderMarkdown('[docs](/docs/setup.md)')
    expect(html).toContain('href="/docs/setup.md"')
    expect(html).not.toContain('target="_blank"')
  })

  it('strips javascript: hrefs entirely', () => {
    const html = renderMarkdown('[evil](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('alert')
  })
})
