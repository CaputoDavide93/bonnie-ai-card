import { marked } from 'marked'

// Configure marked for safe, minimal output
marked.setOptions({
  gfm: true,
  breaks: true,
})

// Simple script-tag stripper (belt-and-suspenders after marked's own escaping)
function stripScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<script[^>]*>/gi, '')
}

export function renderMarkdown(text: string): string {
  const raw = marked.parse(text) as string
  return stripScripts(raw)
}
