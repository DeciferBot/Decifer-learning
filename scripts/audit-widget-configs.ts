/**
 * Audit all learn_content rows for bad drag_label widget configs.
 *
 * What it checks:
 * 1. drag_label with diagram_type='circle' on a non-geometry topic → MISMATCH
 * 2. drag_label on a Maths topic that isn't geometry/multiplication/fractions → SUSPICIOUS
 * 3. drag_label with hotspot x/y values outside 0-100 → BAD_POSITION
 * 4. drag_label with <2 or >6 items → BAD_ITEM_COUNT
 *
 * Usage:
 *   npx tsx scripts/audit-widget-configs.ts
 *   npx tsx scripts/audit-widget-configs.ts --fix   # marks bad rows for regeneration
 */

import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'

// Load .env.local manually (no dotenv dependency needed in scripts)
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FIX_MODE = process.argv.includes('--fix')

// Diagram types that are ONLY valid for geometry — never arithmetic/multiplication
const GEOMETRY_ONLY_DIAGRAMS = ['circle', 'triangle', 'right_triangle']

// Keywords in topic titles that indicate geometry
const GEOMETRY_KEYWORDS = ['circle', 'radius', 'diameter', 'circumference', 'triangle', 'angle', 'perimeter', 'area', 'shape', 'polygon', '2d', '3d']

// Keywords in topic titles that indicate arithmetic (where geometry diagrams are wrong)
const ARITHMETIC_KEYWORDS = ['multiplication', 'times table', 'multiply', 'division', 'divide', 'addition', 'subtract', 'number bond', 'place value', 'fraction', 'decimal', 'percentage']

interface Issue {
  topic_id: string
  topic_title: string
  subject: string
  learn_content_id: string
  widget_index: number
  diagram_type: string
  issue: string
  severity: 'ERROR' | 'WARN'
}

function parseWidgets(bodyHtml: string): any[] {
  try {
    const match = bodyHtml.match(/data-widgets='([^']+)'/) || bodyHtml.match(/data-widgets="([^"]+)"/)
    if (match) return JSON.parse(decodeURIComponent(match[1]))
  } catch {}
  // widgets stored as JSON in a script tag or comment
  try {
    const match = bodyHtml.match(/<!--widgets:(.+?)-->/)
    if (match) return JSON.parse(match[1])
  } catch {}
  return []
}

async function main() {
  console.log('Fetching learn_content rows...\n')

  // Get all learn_content with topic info
  const { data: rows, error } = await supabase
    .from('learn_content')
    .select(`
      id,
      topic_id,
      body_html,
      status,
      topics (
        title,
        subjects ( name )
      )
    `)
    .not('body_html', 'is', null)

  if (error) {
    console.error('DB error:', error.message)
    process.exit(1)
  }

  console.log(`Scanning ${rows?.length ?? 0} learn_content rows...\n`)

  const issues: Issue[] = []
  const badIds: string[] = []

  for (const row of rows ?? []) {
    const topic = (row as any).topics
    const topicTitle: string = topic?.title ?? ''
    const subject: string = topic?.subjects?.name ?? ''
    const bodyHtml: string = row.body_html ?? ''

    // Extract widgets JSON from body_html — it's embedded as a JSON script tag
    let widgets: any[] = []
    try {
      // Stored as: <script type="application/json" data-widgets>...</script>
      const scriptMatch = bodyHtml.match(/<script[^>]+data-widgets[^>]*>([\s\S]*?)<\/script>/i)
      if (scriptMatch) widgets = JSON.parse(scriptMatch[1])
    } catch {}

    // Also check if widgets are embedded directly in the HTML as a JSON comment
    if (!widgets.length) widgets = parseWidgets(bodyHtml)

    const dragLabels = widgets.filter((w: any) => w.type === 'drag_label')

    for (let wi = 0; wi < dragLabels.length; wi++) {
      const w = dragLabels[wi]
      const cfg = w.config ?? {}
      const dt: string = cfg.diagram_type ?? ''
      const items: any[] = cfg.items ?? []
      const titleLower = topicTitle.toLowerCase()

      // Check 1: geometry diagram on arithmetic topic
      if (GEOMETRY_ONLY_DIAGRAMS.includes(dt)) {
        const isGeometryTopic = GEOMETRY_KEYWORDS.some(k => titleLower.includes(k))
        const isArithmeticTopic = ARITHMETIC_KEYWORDS.some(k => titleLower.includes(k))
        if (isArithmeticTopic || (!isGeometryTopic && subject.toLowerCase().includes('maths'))) {
          issues.push({
            topic_id: row.topic_id,
            topic_title: topicTitle,
            subject,
            learn_content_id: row.id,
            widget_index: wi,
            diagram_type: dt,
            issue: `diagram_type='${dt}' on non-geometry topic "${topicTitle}"`,
            severity: 'ERROR',
          })
          badIds.push(row.id)
          continue
        }
      }

      // Check 2: item count out of range
      if (items.length < 2 || items.length > 6) {
        issues.push({
          topic_id: row.topic_id,
          topic_title: topicTitle,
          subject,
          learn_content_id: row.id,
          widget_index: wi,
          diagram_type: dt,
          issue: `drag_label has ${items.length} items (expected 2–6)`,
          severity: items.length === 0 ? 'ERROR' : 'WARN',
        })
        if (items.length === 0) badIds.push(row.id)
        continue
      }

      // Check 3: hotspot positions out of bounds
      const badHotspots = items.filter((item: any) => {
        const x = item.hotspot?.x ?? -1
        const y = item.hotspot?.y ?? -1
        return x < 0 || x > 100 || y < 0 || y > 100
      })
      if (badHotspots.length > 0) {
        issues.push({
          topic_id: row.topic_id,
          topic_title: topicTitle,
          subject,
          learn_content_id: row.id,
          widget_index: wi,
          diagram_type: dt,
          issue: `${badHotspots.length} hotspot(s) have x/y outside 0–100`,
          severity: 'ERROR',
        })
        badIds.push(row.id)
      }
    }
  }

  // Report
  if (issues.length === 0) {
    console.log('✅  No widget config issues found.\n')
    return
  }

  const errors = issues.filter(i => i.severity === 'ERROR')
  const warns  = issues.filter(i => i.severity === 'WARN')

  console.log(`Found ${issues.length} issue(s):  ${errors.length} ERROR  ${warns.length} WARN\n`)
  console.log('─'.repeat(80))

  for (const issue of issues) {
    const tag = issue.severity === 'ERROR' ? '🔴 ERROR' : '🟡 WARN '
    console.log(`${tag}  [${issue.subject}] "${issue.topic_title}"`)
    console.log(`       learn_content_id: ${issue.learn_content_id}`)
    console.log(`       widget #${issue.widget_index}: ${issue.issue}`)
    console.log()
  }

  // Write report to file
  const reportPath = path.join(process.cwd(), 'scripts', 'widget-audit-report.json')
  fs.writeFileSync(reportPath, JSON.stringify({ issues, badIds: [...new Set(badIds)] }, null, 2))
  console.log(`Report saved to: ${reportPath}\n`)

  if (FIX_MODE && badIds.length > 0) {
    const uniqueBad = [...new Set(badIds)]
    console.log(`Marking ${uniqueBad.length} learn_content row(s) as 'flagged' for regeneration...`)
    const { error: updateErr } = await supabase
      .from('learn_content')
      .update({ status: 'flagged' })
      .in('id', uniqueBad)
    if (updateErr) {
      console.error('Update failed:', updateErr.message)
    } else {
      console.log(`✅  Marked ${uniqueBad.length} row(s) as flagged.`)
      console.log(`    Re-run generate-widgets-retroactive.py to regenerate them.`)
    }
  } else if (badIds.length > 0) {
    console.log(`Run with --fix to mark ${[...new Set(badIds)].length} ERROR row(s) as flagged for regeneration.`)
  }
}

main().catch(console.error)
