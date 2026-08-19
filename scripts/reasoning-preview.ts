/**
 * Render sample Reasoning Check items to an HTML file so a human can look at
 * them.
 *
 * The property tests prove an item has exactly one correct answer. They cannot
 * prove it LOOKS like a fair question. This is how you check that.
 *
 *   npx tsx scripts/reasoning-preview.ts > /tmp/reasoning.html
 *
 * Writes to stdout, so redirect it wherever you want.
 */

import { generateItem, REASONING_ITEM_TYPES, ITEM_TYPE_LABELS, type Level } from '../lib/reasoning/generate'
import { renderFigure, describeFigure, type Figure } from '../lib/reasoning/shapes'

const LEVELS: Level[] = [1, 2, 3, 4, 5, 6]
const PER_CELL = 2

let uid = 0
function cell(f: Figure | null, highlight = false): string {
  if (!f) {
    return `<div class="cell empty" title="the missing one">?</div>`
  }
  return `<div class="cell${highlight ? ' correct' : ''}" title="${describeFigure(f)}">${renderFigure(f, `f${uid++}`)}</div>`
}

function itemHtml(type: (typeof REASONING_ITEM_TYPES)[number], level: Level, seed: string): string {
  const item = generateItem(type, level, seed)
  let stimulus = ''

  switch (item.stimulus.kind) {
    case 'sequence':
      stimulus =
        `<div class="row">${item.stimulus.figures.map((f) => cell(f)).join('')}` +
        `<div class="cell empty">?</div></div>`
      break
    case 'matrix':
      stimulus =
        `<div class="grid">` +
        item.stimulus.grid.flat().map((f) => cell(f)).join('') +
        `</div>`
      break
    case 'analogy':
      stimulus =
        `<div class="row">${cell(item.stimulus.a)}<span class="op">→</span>${cell(item.stimulus.b)}` +
        `<span class="op">&nbsp;&nbsp;</span>${cell(item.stimulus.c)}<span class="op">→</span>` +
        `<div class="cell empty">?</div></div>`
      break
    case 'odd_one_out':
      stimulus = ''
      break
  }

  const options = `<div class="row options">${item.options
    .map((f, i) => cell(f, i === item.correctIndex))
    .join('')}</div>`

  return (
    `<section>` +
    `<h3>${ITEM_TYPE_LABELS[type]} · level ${level} <span class="seed">${seed}</span></h3>` +
    `<p class="prompt">${item.prompt}</p>` +
    stimulus +
    options +
    `</section>`
  )
}

const sections = REASONING_ITEM_TYPES.flatMap((type) =>
  LEVELS.flatMap((level) =>
    Array.from({ length: PER_CELL }, (_, i) => itemHtml(type, level, `preview-${i}`)),
  ),
).join('\n')

process.stdout.write(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Reasoning Check — item preview</title>
<style>
  :root { --ink:#2D3748; --muted:#718096; --line:#e2e8f0; --good:#40C057; }
  body { font-family: system-ui, sans-serif; color: var(--ink); background:#FAFBFF;
         margin:0; padding:24px; }
  h1 { font-size:20px; }
  .note { color:var(--muted); max-width:60ch; font-size:14px; line-height:1.5; }
  section { background:#fff; border:1px solid var(--line); border-radius:12px;
            padding:16px; margin:16px 0; }
  h3 { margin:0 0 4px; font-size:15px; }
  .seed { color:var(--muted); font-weight:400; font-size:12px; }
  .prompt { margin:0 0 12px; color:var(--muted); font-size:13px; }
  .row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .options { margin-top:12px; padding-top:12px; border-top:1px dashed var(--line); }
  .grid { display:grid; grid-template-columns:repeat(3, 60px); gap:6px; }
  .cell { width:60px; height:60px; border:1px solid var(--line); border-radius:8px;
          display:flex; align-items:center; justify-content:center; color:var(--ink);
          background:#fff; }
  .cell svg { width:100%; height:100%; }
  .cell.empty { color:var(--muted); font-size:22px; background:#f7fafc; }
  .cell.correct { border:2px solid var(--good); box-shadow:0 0 0 3px rgba(64,192,87,.15); }
  .op { color:var(--muted); font-size:18px; }
</style></head><body>
<h1>Reasoning Check — item preview</h1>
<p class="note">Two samples of every item type at every level. The green outline marks
the correct option, so this page is for checking the questions, not for taking them.
Hover a shape to read its screen-reader description.</p>
${sections}
</body></html>
`)
