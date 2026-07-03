// Pure string-parsing logic for MathText, split out from the React component
// (MathText.tsx) so it has no JSX/CSS/KaTeX-runtime dependency and can be
// unit tested cheaply in a plain node environment (see __tests__/math-text.test.ts).

export type Part = { type: 'text' | 'math'; value: string }

// Splits a string that may contain LaTeX delimited by $$...$$, $...$, or \(...\).
export function splitMath(text: string): Part[] {
  const parts: Part[] = []
  // Regex order matters: $$...$$ MUST come before $...$ so double-dollar
  // delimiters are consumed whole rather than leaving stray $ on each side.
  // $...$ is capped at 80 chars to avoid currency amounts being parsed as LaTeX.
  const re = /\$\$([^$]{1,120})\$\$|\$([^$\n]{1,80})\$|\\\((.+?)\\\)/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      const raw = text.slice(last, match.index)
      parts.push(...detectBareLaTeX(raw))
    }
    const singleDollar = match[2]
    if (singleDollar !== undefined && !looksLikeMath(singleDollar)) {
      // Single $...$ spans two independent currency amounts (e.g.
      // "costs $5 and $2") rather than one LaTeX expression — keep the
      // literal text, delimiters included, instead of feeding it to KaTeX.
      parts.push({ type: 'text', value: match[0] })
    } else {
      parts.push({ type: 'math', value: match[1] ?? match[2] ?? match[3] })
    }
    last = match.index + match[0].length
  }
  if (last < text.length) {
    parts.push(...detectBareLaTeX(text.slice(last)))
  }
  return parts.length ? parts : [{ type: 'text', value: text }]
}

// Heuristic guard for single-$ spans only (double-$ and \(...\) are
// unambiguous, so this never applies to them). Real math content in this
// pipeline is short symbolic expressions ("x", "3x+2"); prose contains
// multiple whitespace-separated alphabetic words. Two independent currency
// amounts in one sentence ("$5 ... $2") produce exactly that shape, so this
// rejects them without needing to know anything about currency specifically.
function looksLikeMath(content: string): boolean {
  const proseWords = content.split(/\s+/).filter((w) => /^[a-zA-Z]{2,}$/.test(w))
  return proseWords.length < 2
}

// Detect bare LaTeX commands like {-5}^\circ \text{C} that aren't wrapped in $
function detectBareLaTeX(text: string): Part[] {
  if (/\\circ|\\text\{|\\frac|\\times|\\div|\^\{/.test(text)) {
    return [{ type: 'math', value: text.trim() }]
  }
  return [{ type: 'text', value: text }]
}
