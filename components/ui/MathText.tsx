'use client'

import 'katex/dist/katex.min.css'
import katex from 'katex'

interface Props {
  text: string
  className?: string
}

// Renders a string that may contain LaTeX delimited by $...$ or \(...\)
// Falls back to plain text if KaTeX throws.
export default function MathText({ text, className }: Props) {
  const parts = splitMath(text)
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === 'math' ? (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: renderMath(part.value) }}
          />
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </span>
  )
}

type Part = { type: 'text' | 'math'; value: string }

function splitMath(text: string): Part[] {
  // Match $...$, \(...\), or {N}^\circ \text{C} style bare LaTeX
  const parts: Part[] = []
  // Regex: $...$ (max 80 chars — prevents currency amounts being parsed as LaTeX)
  // or \(...\) for explicit inline math
  const re = /\$([^$\n]{1,80})\$|\\\((.+?)\\\)/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      const raw = text.slice(last, match.index)
      parts.push(...detectBareLaTeX(raw))
    }
    parts.push({ type: 'math', value: match[1] ?? match[2] })
    last = match.index + match[0].length
  }
  if (last < text.length) {
    parts.push(...detectBareLaTeX(text.slice(last)))
  }
  return parts.length ? parts : [{ type: 'text', value: text }]
}

// Detect bare LaTeX patterns like {-5}^\circ \text{C} that aren't wrapped in $
const BARE_LATEX = /(\{[^}]*\}\^\\circ\\s*\\text\{[^}]*\}|[-\d]+\^\\circ\\s*\\text\{[^}]*\}|\{[^}]*\})/

function detectBareLaTeX(text: string): Part[] {
  // If it contains \circ or \text or ^ with braces treat the whole segment as math
  if (/\\circ|\\text\{|\\frac|\\times|\\div|\^\{/.test(text)) {
    return [{ type: 'math', value: text.trim() }]
  }
  return [{ type: 'text', value: text }]
}

function renderMath(expr: string): string {
  try {
    return katex.renderToString(expr, { throwOnError: false, output: 'html' })
  } catch {
    return expr
  }
}
