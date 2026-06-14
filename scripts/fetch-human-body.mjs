/**
 * Fetches real organ/system summaries from Wikipedia's REST API (CC BY-SA 4.0)
 * and merges them with curated body-diagram metadata, writing
 * scripts/data/human-body.json for the seed (reproducible, no hand-written facts
 * beyond the bedrock one-line "what it does"). Run: node scripts/fetch-human-body.mjs
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))

// key, display name, Wikipedia article title, body system, hotspot x/y (0-100),
// colour, and a bedrock kid-level function line.
const ORGANS = [
  { key: 'brain', name: 'Brain', title: 'Human brain', system: 'Nervous', x: 50, y: 8, color: '#A78BFA', kidFact: 'Your control centre — it thinks, remembers, and runs your whole body.' },
  { key: 'eye', name: 'Eyes', title: 'Human eye', system: 'Senses', x: 45, y: 11, color: '#74C0FC', kidFact: 'Turn light into signals so your brain can see the world.' },
  { key: 'ear', name: 'Ears', title: 'Ear', system: 'Senses', x: 55, y: 11, color: '#74C0FC', kidFact: 'Let you hear sound and help you keep your balance.' },
  { key: 'heart', name: 'Heart', title: 'Heart', system: 'Circulatory', x: 46, y: 32, color: '#FF6B6B', kidFact: 'Pumps blood all around your body, day and night.' },
  { key: 'lungs', name: 'Lungs', title: 'Lung', system: 'Respiratory', x: 54, y: 31, color: '#52D9A0', kidFact: 'Take in oxygen when you breathe in and remove carbon dioxide when you breathe out.' },
  { key: 'liver', name: 'Liver', title: 'Liver', system: 'Digestive', x: 57, y: 42, color: '#FFA94D', kidFact: 'Cleans your blood and helps turn food into energy.' },
  { key: 'stomach', name: 'Stomach', title: 'Stomach', system: 'Digestive', x: 44, y: 43, color: '#FFA94D', kidFact: 'Breaks down the food you eat using strong acids.' },
  { key: 'kidneys', name: 'Kidneys', title: 'Kidney', system: 'Urinary', x: 56, y: 49, color: '#FFD43B', kidFact: 'Filter your blood and make urine to remove waste.' },
  { key: 'intestine', name: 'Small intestine', title: 'Small intestine', system: 'Digestive', x: 50, y: 55, color: '#FFA94D', kidFact: 'Absorbs the goodness (nutrients) from food into your blood.' },
  { key: 'skeleton', name: 'Skeleton', title: 'Human skeleton', system: 'Skeletal', x: 43, y: 74, color: '#CED4DA', kidFact: 'Your 206 bones give your body its shape and protect your organs.' },
  { key: 'muscles', name: 'Muscles', title: 'Muscle', system: 'Muscular', x: 57, y: 74, color: '#F783AC', kidFact: 'Pull on your bones to move your body — you have over 600 of them!' },
  { key: 'skin', name: 'Skin', title: 'Skin', system: 'Integumentary', x: 30, y: 40, color: '#FFB088', kidFact: 'Your largest organ — it protects you and senses touch, heat and cold.' },
]

async function summary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`
  const res = await fetch(url, { headers: { 'User-Agent': 'DeciferLearning/1.0 (educational; contact: hello@decifer.app)' } })
  if (!res.ok) throw new Error(`${title}: HTTP ${res.status}`)
  const j = await res.json()
  return { extract: j.extract, source_url: j.content_urls?.desktop?.page ?? null }
}

const out = []
for (const o of ORGANS) {
  const s = await summary(o.title)
  out.push({ ...o, summary: s.extract, source_url: s.source_url })
  console.log(`✓ ${o.name} (${s.extract.length} chars)`)
}

writeFileSync(join(__dir, 'data', 'human-body.json'), JSON.stringify({ organs: out }, null, 2))
console.log(`\nWrote ${out.length} organs to scripts/data/human-body.json`)
