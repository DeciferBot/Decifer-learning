/** Fetch animal summaries from Wikipedia (CC BY-SA 4.0) → scripts/data/animals.json. */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const __dir = dirname(fileURLToPath(import.meta.url))

const GROUP_COLOR = { Mammal: '#FFA94D', Bird: '#74C0FC', Reptile: '#52D9A0', Amphibian: '#38D9A9', Fish: '#4DABF7', Invertebrate: '#F783AC' }

const ANIMALS = [
  { key: 'lion', name: 'Lion', title: 'Lion', group: 'Mammal', habitat: 'Savanna', emoji: '🦁', kidFact: 'Lions live in family groups called prides — the only big cats that do.' },
  { key: 'african-elephant', name: 'African Elephant', title: 'African bush elephant', group: 'Mammal', habitat: 'Savanna', emoji: '🐘', kidFact: 'The largest land animal on Earth — as heavy as about six cars.' },
  { key: 'blue-whale', name: 'Blue Whale', title: 'Blue whale', group: 'Mammal', habitat: 'Ocean', emoji: '🐋', kidFact: 'The largest animal that has ever lived — bigger than any dinosaur.' },
  { key: 'tiger', name: 'Tiger', title: 'Tiger', group: 'Mammal', habitat: 'Forest', emoji: '🐯', kidFact: 'The biggest wild cat, and every tiger\'s stripes are unique.' },
  { key: 'giant-panda', name: 'Giant Panda', title: 'Giant panda', group: 'Mammal', habitat: 'Forest', emoji: '🐼', kidFact: 'Eats bamboo for up to 12 hours every single day.' },
  { key: 'gray-wolf', name: 'Wolf', title: 'Wolf', group: 'Mammal', habitat: 'Forest', emoji: '🐺', kidFact: 'Hunts in packs and talks to its family by howling.' },
  { key: 'kangaroo', name: 'Kangaroo', title: 'Kangaroo', group: 'Mammal', habitat: 'Grassland', emoji: '🦘', kidFact: 'Carries its baby in a pouch and cannot walk backwards.' },
  { key: 'polar-bear', name: 'Polar Bear', title: 'Polar bear', group: 'Mammal', habitat: 'Arctic', emoji: '🐻‍❄️', kidFact: 'Has black skin under white fur to soak up the sun\'s warmth.' },
  { key: 'cheetah', name: 'Cheetah', title: 'Cheetah', group: 'Mammal', habitat: 'Savanna', emoji: '🐆', kidFact: 'The fastest land animal — as fast as a car on a motorway.' },
  { key: 'chimpanzee', name: 'Chimpanzee', title: 'Chimpanzee', group: 'Mammal', habitat: 'Forest', emoji: '🐒', kidFact: 'Shares about 98% of its DNA with humans and uses tools.' },
  { key: 'bald-eagle', name: 'Bald Eagle', title: 'Bald eagle', group: 'Bird', habitat: 'Mountains', emoji: '🦅', kidFact: 'Can spot prey from several kilometres away with incredible eyesight.' },
  { key: 'emperor-penguin', name: 'Emperor Penguin', title: 'Emperor penguin', group: 'Bird', habitat: 'Antarctica', emoji: '🐧', kidFact: 'Huddles in huge groups to survive the coldest place on Earth.' },
  { key: 'great-white-shark', name: 'Great White Shark', title: 'Great white shark', group: 'Fish', habitat: 'Ocean', emoji: '🦈', kidFact: 'Can sense tiny amounts of blood in the water from far away.' },
  { key: 'green-sea-turtle', name: 'Green Sea Turtle', title: 'Green sea turtle', group: 'Reptile', habitat: 'Ocean', emoji: '🐢', kidFact: 'Can live over 80 years and travels thousands of miles.' },
  { key: 'komodo-dragon', name: 'Komodo Dragon', title: 'Komodo dragon', group: 'Reptile', habitat: 'Island', emoji: '🦎', kidFact: 'The largest lizard on Earth, with a venomous bite.' },
  { key: 'poison-dart-frog', name: 'Poison Dart Frog', title: 'Poison dart frog', group: 'Amphibian', habitat: 'Rainforest', emoji: '🐸', kidFact: 'Its bright colours warn predators that it is poisonous.' },
  { key: 'honey-bee', name: 'Honey Bee', title: 'Western honey bee', group: 'Invertebrate', habitat: 'Meadow', emoji: '🐝', kidFact: 'Dances to tell other bees exactly where to find flowers.' },
  { key: 'monarch-butterfly', name: 'Monarch Butterfly', title: 'Monarch butterfly', group: 'Invertebrate', habitat: 'Meadow', emoji: '🦋', kidFact: 'Migrates thousands of kilometres — further than any other insect.' },
  { key: 'octopus', name: 'Octopus', title: 'Octopus', group: 'Invertebrate', habitat: 'Ocean', emoji: '🐙', kidFact: 'Has three hearts, blue blood, and can change colour instantly.' },
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
for (const a of ANIMALS) {
  const s = await summary(a.title)
  out.push({ ...a, color: GROUP_COLOR[a.group], summary: s.extract, source_url: s.source_url })
  console.log(`✓ ${a.name}`)
}
writeFileSync(join(__dir, 'data', 'animals.json'), JSON.stringify({ animals: out }, null, 2))
console.log(`Wrote ${out.length} animals.`)
