'use client'

import 'katex/dist/katex.min.css'
import katex from 'katex'
import { splitMath } from './mathParse'

interface Props {
  text: string
  className?: string
}

// Renders a string that may contain LaTeX delimited by $...$ or \(...\)
// Falls back to plain text if KaTeX throws.
export default function MathText({ text, className }: Props) {
  if (!text) return null
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

function renderMath(expr: string): string {
  try {
    return katex.renderToString(expr, { throwOnError: false, output: 'html' })
  } catch {
    return expr
  }
}
