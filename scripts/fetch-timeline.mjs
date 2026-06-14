/** Fetch historical-event summaries from Wikipedia (CC BY-SA 4.0) → scripts/data/timeline.json. */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const __dir = dirname(fileURLToPath(import.meta.url))

const ERA_COLOR = { Prehistory: '#868E96', Ancient: '#FFA94D', 'Middle Ages': '#A78BFA', Renaissance: '#FFD43B', Modern: '#74C0FC' }

// sortYear used only for ordering (negative = years ago / BCE). yearLabel is what's shown.
const EVENTS = [
  { key: 'dinosaur-extinction', name: 'Dinosaurs go extinct', title: 'Cretaceous–Paleogene extinction event', sortYear: -66000000, yearLabel: '66 million years ago', era: 'Prehistory', kidFact: 'A giant asteroid struck Earth and wiped out the dinosaurs.' },
  { key: 'first-humans', name: 'First modern humans', title: 'Homo sapiens', sortYear: -300000, yearLabel: '~300,000 years ago', era: 'Prehistory', kidFact: 'Our species, Homo sapiens, first appeared in Africa.' },
  { key: 'farming', name: 'Farming begins', title: 'Neolithic Revolution', sortYear: -10000, yearLabel: '~10,000 BCE', era: 'Ancient', kidFact: 'People began growing crops and keeping animals instead of only hunting.' },
  { key: 'pyramids', name: 'The Great Pyramid', title: 'Great Pyramid of Giza', sortYear: -2560, yearLabel: '~2560 BCE', era: 'Ancient', kidFact: 'Ancient Egyptians built the Great Pyramid as a pharaoh\'s tomb.' },
  { key: 'roman-empire', name: 'Roman Empire begins', title: 'Roman Empire', sortYear: -27, yearLabel: '27 BCE', era: 'Ancient', kidFact: 'Rome grew into an empire that ruled much of the known world.' },
  { key: 'fall-rome', name: 'Fall of Western Rome', title: 'Fall of the Western Roman Empire', sortYear: 476, yearLabel: '476 CE', era: 'Middle Ages', kidFact: 'The Western Roman Empire collapsed, beginning the Middle Ages.' },
  { key: 'norman-conquest', name: 'Norman Conquest', title: 'Norman Conquest', sortYear: 1066, yearLabel: '1066', era: 'Middle Ages', kidFact: 'William the Conqueror invaded England and changed it forever.' },
  { key: 'black-death', name: 'The Black Death', title: 'Black Death', sortYear: 1347, yearLabel: '1347', era: 'Middle Ages', kidFact: 'A terrible plague killed up to half of the people in Europe.' },
  { key: 'printing-press', name: 'The printing press', title: 'Printing press', sortYear: 1440, yearLabel: '~1440', era: 'Renaissance', kidFact: 'Gutenberg\'s press made books quick to produce, spreading ideas everywhere.' },
  { key: 'columbus', name: 'Reaching the Americas', title: 'Voyages of Christopher Columbus', sortYear: 1492, yearLabel: '1492', era: 'Renaissance', kidFact: 'European contact with the Americas began, changing both worlds.' },
  { key: 'industrial-revolution', name: 'Industrial Revolution', title: 'Industrial Revolution', sortYear: 1760, yearLabel: 'from ~1760', era: 'Modern', kidFact: 'Machines and factories transformed how things were made.' },
  { key: 'first-flight', name: 'First powered flight', title: 'Wright Flyer', sortYear: 1903, yearLabel: '1903', era: 'Modern', kidFact: 'The Wright brothers flew the first powered aeroplane.' },
  { key: 'ww1', name: 'World War I', title: 'World War I', sortYear: 1914, yearLabel: '1914–1918', era: 'Modern', kidFact: 'A global war that reshaped countries and borders.' },
  { key: 'ww2', name: 'World War II', title: 'World War II', sortYear: 1939, yearLabel: '1939–1945', era: 'Modern', kidFact: 'The largest and deadliest war in human history.' },
  { key: 'moon-landing', name: 'Moon landing', title: 'Apollo 11', sortYear: 1969, yearLabel: '1969', era: 'Modern', kidFact: 'Humans walked on the Moon for the very first time.' },
  { key: 'world-wide-web', name: 'The World Wide Web', title: 'World Wide Web', sortYear: 1989, yearLabel: '1989', era: 'Modern', kidFact: 'Tim Berners-Lee invented the web, connecting the whole world.' },
]

async function summary(title, attempt = 0) {
  await new Promise((r) => setTimeout(r, 450))
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`, { headers: { 'User-Agent': 'DeciferLearning/1.0 (educational)' } })
  if (res.status === 429 && attempt < 5) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); return summary(title, attempt + 1) }
  if (!res.ok) throw new Error(`${title}: ${res.status}`)
  const j = await res.json()
  return { extract: j.extract, source_url: j.content_urls?.desktop?.page ?? null }
}

const out = []
for (const e of EVENTS) {
  const s = await summary(e.title)
  out.push({ ...e, color: ERA_COLOR[e.era], summary: s.extract, source_url: s.source_url })
  console.log(`✓ ${e.name}`)
}
writeFileSync(join(__dir, 'data', 'timeline.json'), JSON.stringify({ events: out }, null, 2))
console.log(`Wrote ${out.length} events.`)
