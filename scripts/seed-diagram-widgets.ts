/**
 * Seed example `diagram` widgets and a `foundation_images` raster figure onto a
 * handful of real published lessons — to prove the rich-illustration surface
 * end-to-end (CLAUDE.md §10).
 *
 *   - `diagram` widget   → static labelled inline-SVG figure from the registry
 *                          (components/learn/diagrams). Offline-safe, scalable.
 *   - foundation_images  → raster escape hatch ({url, alt, caption}[]) for the
 *                          one topic where a photo beats an SVG.
 *
 * Idempotent: each seeded widget carries a `seed_marker` so re-runs never
 * duplicate. foundation_images is only set when the column is empty.
 *
 * Usage:
 *   npx tsx scripts/seed-diagram-widgets.ts            # dry run (prints plan)
 *   npx tsx scripts/seed-diagram-widgets.ts --apply    # write to the database
 */

import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'

// Load .env.local manually (matches the other scripts — no dotenv dependency).
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const APPLY = process.argv.includes('--apply')
const SEED_MARKER = 'diagram-seed-v1'

interface DiagramSeed {
  content_id: string
  topic: string
  widget: {
    type: 'diagram'
    position: 'middle'
    seed_marker: string
    config: {
      title?: string
      caption?: string
      diagram_type: string
      labels?: { text: string; x: number; y: number }[]
    }
  }
}

// Static `diagram` widgets — each chosen so the illustration genuinely fits the
// lesson. Positioned 'middle' so it renders in both flat and chapter layouts.
const DIAGRAM_SEEDS: DiagramSeed[] = [
  {
    content_id: 'a7b29ba6-5ba7-4dbc-94bf-aac938b5aa71',
    topic: 'Y3 Maths — Multiplication Tables',
    widget: {
      type: 'diagram',
      position: 'middle',
      seed_marker: SEED_MARKER,
      config: {
        title: 'Multiplication as an array',
        diagram_type: 'array_grid',
        caption: '3 rows of 4 makes 3 × 4 = 12. Arrays show multiplication as equal rows.',
      },
    },
  },
  {
    content_id: '1830505f-6559-45a3-937c-3b997acf3836',
    topic: 'Y3 Maths — Number: Fractions',
    widget: {
      type: 'diagram',
      position: 'middle',
      seed_marker: SEED_MARKER,
      config: {
        title: 'Three quarters',
        diagram_type: 'fraction_circle',
        caption: 'The circle is split into 4 equal parts. 3 are shaded — that is three quarters (¾).',
      },
    },
  },
  {
    content_id: 'e0b3d046-e236-42ba-96f5-6584d44ecf8d',
    topic: 'Y3 Maths — Measurement: Time',
    widget: {
      type: 'diagram',
      position: 'middle',
      seed_marker: SEED_MARKER,
      config: {
        title: 'Reading a clock',
        diagram_type: 'clock_face',
        caption: 'The short hand points to the hour, the long hand to the minutes. This clock shows 3 o’clock.',
      },
    },
  },
  {
    content_id: '5e5c75f6-5267-4c52-a650-5de2ff4ea60d',
    topic: 'Y3 Science — Plants: Parts and Functions',
    widget: {
      type: 'diagram',
      position: 'middle',
      seed_marker: SEED_MARKER,
      config: {
        title: 'Parts of a plant',
        diagram_type: 'plant',
        labels: [
          { text: 'Flower', x: 50, y: 16 },
          { text: 'Leaf', x: 76, y: 40 },
          { text: 'Stem', x: 58, y: 56 },
          { text: 'Roots', x: 30, y: 84 },
        ],
        caption: 'Each part has a job: roots drink water, leaves catch sunlight, the flower makes seeds.',
      },
    },
  },
  {
    content_id: 'cdd50039-1c9c-4729-8ed2-4be314ce8543',
    topic: 'Y7 Science — Ecosystems: Food Chains and Webs',
    widget: {
      type: 'diagram',
      position: 'middle',
      seed_marker: SEED_MARKER,
      config: {
        title: 'A simple food chain',
        diagram_type: 'food_chain',
        caption: 'Arrows point in the direction energy flows: from the Sun, to plants, to animals.',
      },
    },
  },
]

// foundation_images raster example — a real photo beats an SVG here.
// Uses a same-origin public asset so it renders without a Storage upload and is
// cached by the service worker for offline (worker.js image cache).
const FIGURE_SEED = {
  content_id: '81111669-8681-40ee-8c6c-098a5b45b937',
  topic: 'Y7 Science — Physics: Space and the Solar System',
  images: [
    {
      url: '/textures/earth.jpg',
      alt: 'Planet Earth seen from space, showing blue oceans, green-brown land and white clouds.',
      caption: 'Earth is the third planet from the Sun and the only one known to support life.',
    },
  ],
}

type WidgetRow = { learn_widgets: unknown }

function asArray(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }
  return []
}

async function run() {
  console.log(APPLY ? '▶ APPLY mode — writing to the database\n' : '◌ DRY RUN — pass --apply to write\n')
  let added = 0
  let skipped = 0

  for (const seed of DIAGRAM_SEEDS) {
    const { data, error } = await supabase
      .from('learn_content')
      .select('learn_widgets')
      .eq('id', seed.content_id)
      .maybeSingle<WidgetRow>()

    if (error || !data) {
      console.log(`✗ ${seed.topic}: content row not found (${error?.message ?? 'no row'})`)
      continue
    }

    const widgets = asArray(data.learn_widgets)
    const exists = widgets.some(
      (w) => w?.seed_marker === SEED_MARKER && w?.config?.diagram_type === seed.widget.config.diagram_type
    )
    if (exists) {
      console.log(`= ${seed.topic}: ${seed.widget.config.diagram_type} already seeded — skip`)
      skipped++
      continue
    }

    const next = [...widgets, seed.widget]
    console.log(`+ ${seed.topic}: add diagram "${seed.widget.config.diagram_type}"`)
    added++

    if (APPLY) {
      const { error: upErr } = await supabase
        .from('learn_content')
        .update({ learn_widgets: next })
        .eq('id', seed.content_id)
      if (upErr) console.log(`  ✗ write failed: ${upErr.message}`)
    }
  }

  // foundation_images example
  const { data: figRow } = await supabase
    .from('learn_content')
    .select('foundation_images')
    .eq('id', FIGURE_SEED.content_id)
    .maybeSingle<{ foundation_images: unknown }>()

  const existingFigs = asArray(figRow?.foundation_images)
  if (existingFigs.length > 0) {
    console.log(`= ${FIGURE_SEED.topic}: foundation_images already set — skip`)
  } else if (figRow) {
    console.log(`+ ${FIGURE_SEED.topic}: set foundation_images (${FIGURE_SEED.images.length} figure)`)
    if (APPLY) {
      const { error: figErr } = await supabase
        .from('learn_content')
        .update({ foundation_images: FIGURE_SEED.images })
        .eq('id', FIGURE_SEED.content_id)
      if (figErr) console.log(`  ✗ write failed: ${figErr.message}`)
    }
  } else {
    console.log(`✗ ${FIGURE_SEED.topic}: content row not found`)
  }

  console.log(`\nDone. ${added} diagram(s) ${APPLY ? 'written' : 'planned'}, ${skipped} already present.`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
