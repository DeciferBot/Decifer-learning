/**
 * Phase 7 seed — Discovery Cards (card_catalog) and Badges.
 *
 * Seeds:
 *  - 30 published Maths cards across 5 rarities (Y3-specific, Y7-specific, shared)
 *  - 5 badges (Topic Star, Perfect Score, Subject Champion, Streak 7, Guardian Slayer)
 *
 * Idempotent: deletes all Phase 7 seed rows and re-inserts.
 *
 * Run: node --env-file=.env.local scripts/seed-phase7.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MATHS_ID = '1f769381-bd81-40c2-a84c-bb5c777a89ad'
const YEAR_3_ID = 'b81752f5-ae00-4b14-a7fe-f4be1eac5453'
const YEAR_7_ID = '6f858189-5913-406f-a3c8-4597942aa69d'
const SHARED = null  // visible to all year groups

// ── Card catalog — 30 cards ───────────────────────────────────────────────
// Format: { rarity, year_group_id, title, fact_text }
const CARDS = [
  // ── Common (12) ───────────────────────────────────────────────────────────
  {
    rarity: 'common', year_group_id: YEAR_3_ID,
    title: 'The 9-Times Trick',
    fact_text: "The digits of every 9 times table answer add up to 9! Try it: 9×2=18 (1+8=9), 9×7=63 (6+3=9). This works all the way to 9×11=99 (9+9=18, 1+8=9).",
  },
  {
    rarity: 'common', year_group_id: YEAR_3_ID,
    title: 'Zero — The Hero',
    fact_text: "Zero is neither positive nor negative — it's its own special thing! Ancient Romans had NO symbol for zero, making large calculations incredibly difficult.",
  },
  {
    rarity: 'common', year_group_id: YEAR_3_ID,
    title: 'Double Trouble',
    fact_text: "Doubling a grain of rice just 30 times gives you over 1 billion grains! This is called exponential growth — it's why 2×2×2... gets big so fast.",
  },
  {
    rarity: 'common', year_group_id: YEAR_3_ID,
    title: 'Even Numbers',
    fact_text: "You can tell if ANY number is even just by looking at its last digit. If it ends in 0, 2, 4, 6, or 8, it's even — no matter how many digits it has!",
  },
  {
    rarity: 'common', year_group_id: YEAR_7_ID,
    title: 'Where Algebra Comes From',
    fact_text: "The word 'algebra' comes from Arabic: 'al-jabr' meaning 'reunion of broken parts'. A 9th-century scholar called Al-Khwarizmi invented it — and his name gave us the word 'algorithm'!",
  },
  {
    rarity: 'common', year_group_id: YEAR_7_ID,
    title: 'Why We Use X',
    fact_text: "We use x for unknowns because of a translation mix-up! Medieval scholars translated Arabic texts where 'shay' (meaning 'thing') was shortened to 'sh', then to 'x' in Spanish manuscripts.",
  },
  {
    rarity: 'common', year_group_id: YEAR_7_ID,
    title: 'The Equals Sign',
    fact_text: "The = sign was invented in 1557 by Welsh mathematician Robert Recorde. He used two parallel lines because, as he wrote, 'no two things can be more equal' than parallel lines.",
  },
  {
    rarity: 'common', year_group_id: YEAR_7_ID,
    title: 'Negative Numbers',
    fact_text: "European mathematicians rejected negative numbers until the 1600s, calling them 'absurd'. But Chinese mathematicians used red rods for positive and black rods for negative over 2,000 years ago!",
  },
  {
    rarity: 'common', year_group_id: SHARED,
    title: 'Counting to a Billion',
    fact_text: "If you counted one number per second, reaching one million would take 11.5 days. Reaching one billion? 31.7 YEARS. Numbers get big very fast!",
  },
  {
    rarity: 'common', year_group_id: SHARED,
    title: 'Fractions in Disguise',
    fact_text: "Fractions and decimals are the same number wearing different clothes. 0.5 = ½, 0.25 = ¼, 0.75 = ¾. Mathematicians switch between them to make calculations easier.",
  },
  {
    rarity: 'common', year_group_id: SHARED,
    title: 'Maths in Your Pocket',
    fact_text: "Your smartphone does billions of mathematical calculations per second. Every photo you take, every song you play, and every message you send is secretly just maths — really fast maths.",
  },
  {
    rarity: 'common', year_group_id: SHARED,
    title: 'Why 360 Degrees?',
    fact_text: "A full circle is 360° because 360 has 24 divisors — more than almost any number its size. Ancient Babylonians chose it so a circle could be divided into equal slices in many ways.",
  },

  // ── Uncommon (8) ─────────────────────────────────────────────────────────
  {
    rarity: 'uncommon', year_group_id: YEAR_3_ID,
    title: 'Triangle Rule',
    fact_text: "Every triangle's three angles always add up to exactly 180°. This works for the tiniest sliver of a triangle and the largest one you can draw — always, without exception.",
  },
  {
    rarity: 'uncommon', year_group_id: YEAR_3_ID,
    title: 'Fibonacci in Nature',
    fact_text: "The sequence 1, 1, 2, 3, 5, 8, 13, 21... (where each number is the sum of the two before it) appears in sunflower seeds, pinecone spirals, and even the way leaves grow on stems!",
  },
  {
    rarity: 'uncommon', year_group_id: YEAR_3_ID,
    title: 'Palindrome Numbers',
    fact_text: "Palindrome numbers read the same forwards and backwards: 121, 1331, 45654. The year 2002 was the first palindrome year in 1,000 years. The next one won't be until 2112!",
  },
  {
    rarity: 'uncommon', year_group_id: YEAR_3_ID,
    title: 'Shape Inside Shape',
    fact_text: "A hexagon (6 sides) can be perfectly tiled with triangles, and hexagons tile perfectly with no gaps — that's why honeybees build hexagonal cells. It uses the least wax for the most space!",
  },
  {
    rarity: 'uncommon', year_group_id: YEAR_7_ID,
    title: 'Descartes and the Fly',
    fact_text: "The coordinate grid was invented when Descartes watched a fly on his bedroom ceiling. He realised he could describe its exact position with just two numbers — the birth of the coordinate system!",
  },
  {
    rarity: 'uncommon', year_group_id: YEAR_7_ID,
    title: 'Prime Building Blocks',
    fact_text: "Every whole number greater than 1 can be written as a unique product of primes. Just like atoms build molecules, prime numbers build ALL other numbers. This is the Fundamental Theorem of Arithmetic.",
  },
  {
    rarity: 'uncommon', year_group_id: YEAR_7_ID,
    title: 'Pyramid Ratios',
    fact_text: "The Ancient Egyptians used ratios to build the pyramids. The slope of the Great Pyramid of Giza has a rise-to-run ratio of 14:11, making it structurally stable after 4,500 years.",
  },
  {
    rarity: 'uncommon', year_group_id: SHARED,
    title: 'The Handshake Problem',
    fact_text: "If 10 people all shake hands with each other, there are exactly 45 handshakes. With 100 people? 4,950! The formula is n(n−1)÷2. Algebra lets you solve real problems without counting every single handshake.",
  },

  // ── Rare (4) ─────────────────────────────────────────────────────────────
  {
    rarity: 'rare', year_group_id: YEAR_3_ID,
    title: 'Triangular Numbers',
    fact_text: "1, 3, 6, 10, 15, 21 are triangular numbers — you can arrange their dots into perfect triangles. Carl Friedrich Gauss, aged 8, found the 100th triangular number (5,050) in seconds, astonishing his teacher.",
  },
  {
    rarity: 'rare', year_group_id: YEAR_7_ID,
    title: 'Primes Go On Forever',
    fact_text: "Euclid proved there are infinitely many prime numbers over 2,000 years ago. The largest known prime (found in 2024) has over 41 million digits — it would fill a small book if printed!",
  },
  {
    rarity: 'rare', year_group_id: YEAR_7_ID,
    title: "Euler's Formula",
    fact_text: "For any convex 3D shape, V − E + F = 2, where V = vertices, E = edges, F = faces. A cube: 8 − 12 + 6 = 2 ✓. A tetrahedron: 4 − 6 + 4 = 2 ✓. Always 2. Euler proved this in 1752.",
  },
  {
    rarity: 'rare', year_group_id: SHARED,
    title: "Pascal's Triangle",
    fact_text: "Pascal's Triangle hides extraordinary patterns. The diagonals contain triangular numbers. The rows contain powers of 2 (add each row!). Fibonacci numbers lurk in the diagonals. And it solves probability problems.",
  },

  // ── Epic (3) ──────────────────────────────────────────────────────────────
  {
    rarity: 'epic', year_group_id: YEAR_3_ID,
    title: 'Magic Squares',
    fact_text: "In a 3×3 magic square using 1–9, every row, column, and diagonal adds to 15. There's only ONE arrangement (ignoring rotations). The Chinese called it 'Lo Shu' and discovered it over 2,000 years ago!",
  },
  {
    rarity: 'epic', year_group_id: YEAR_7_ID,
    title: 'Pythagoras the Legend',
    fact_text: "Pythagoras (570–495 BC) proved a² + b² = c² for right-angled triangles. The Babylonians knew this pattern 1,000 years earlier — but Pythagoras proved WHY it is always true, for every right triangle that will ever exist.",
  },
  {
    rarity: 'epic', year_group_id: SHARED,
    title: 'Sizes of Infinity',
    fact_text: "There are different sizes of infinity! The infinity of whole numbers is smaller than the infinity of all decimals. Mathematician Georg Cantor proved this in 1874 — and his colleagues thought he had gone mad.",
  },

  // ── Legendary (3) ────────────────────────────────────────────────────────
  {
    rarity: 'legendary', year_group_id: YEAR_3_ID,
    title: 'Ada Lovelace',
    fact_text: "Ada Lovelace (1815–1852) wrote the world's first computer program — 100 years before computers existed! She also predicted that machines could compose music. She was right about everything.",
  },
  {
    rarity: 'legendary', year_group_id: YEAR_7_ID,
    title: 'The Golden Ratio',
    fact_text: "The Golden Ratio (≈1.618) appears in nature, art, and architecture. It's the ratio of your forearm to your hand, the spiral of a nautilus shell, and the proportions of the ancient Parthenon. Artists have used it for millennia.",
  },
  {
    rarity: 'legendary', year_group_id: SHARED,
    title: 'Pi — Forever',
    fact_text: "π never ends and never repeats. Humans have calculated it to 100 trillion decimal places. A single gram of DNA could theoretically store all those digits. Pi day is 14 March (3/14 in US format: 3.14).",
  },
]

// ── Badges ────────────────────────────────────────────────────────────────
const BADGES = [
  {
    name: 'Topic Star',
    description: 'Complete a topic for the first time.',
    trigger_rule: { type: 'topic_complete' },
  },
  {
    name: 'Perfect Score',
    description: 'Score 100% with no hints on any quiz.',
    trigger_rule: { type: 'perfect_score' },
  },
  {
    name: 'Subject Champion',
    description: 'Complete every topic in a subject.',
    trigger_rule: { type: 'subject_complete' },
  },
  {
    name: 'Streak 7',
    description: 'Keep a 7-day learning streak.',
    trigger_rule: { type: 'streak_days', threshold: 7 },
  },
  {
    name: 'Guardian Slayer',
    description: 'Defeat a Zone Guardian.',
    trigger_rule: { type: 'guardian_win' },
  },
]

async function main() {
  console.log('Seeding Phase 7: Discovery Cards + Badges\n')

  // ── Cards ─────────────────────────────────────────────────────────────────
  console.log(`Inserting ${CARDS.length} cards...`)
  // Delete existing Phase 7 cards (by subject = Maths and our known rarities)
  await prisma.cardCatalog.deleteMany({
    where: { subject_id: MATHS_ID, is_fusion: false, is_seasonal: false },
  })

  for (const card of CARDS) {
    await prisma.cardCatalog.create({
      data: {
        subject_id: MATHS_ID,
        year_group_id: card.year_group_id,
        rarity: card.rarity,
        title: card.title,
        fact_text: card.fact_text,
        is_seasonal: false,
        is_fusion: false,
        status: 'published',
      },
    })
  }

  // Count by rarity
  const rarityGroups = CARDS.reduce((acc, c) => {
    acc[c.rarity] = (acc[c.rarity] ?? 0) + 1
    return acc
  }, {})
  for (const [r, n] of Object.entries(rarityGroups))
    console.log(`  ${r}: ${n}`)

  // ── Badges ────────────────────────────────────────────────────────────────
  console.log(`\nInserting ${BADGES.length} badges...`)
  for (const badge of BADGES) {
    await prisma.badge.upsert({
      where: { name: badge.name },
      create: badge,
      update: { description: badge.description, trigger_rule: badge.trigger_rule },
    })
    console.log(`  ✅ ${badge.name}`)
  }

  const totalCards = await prisma.cardCatalog.count({ where: { status: 'published' } })
  console.log(`\n✅ Phase 7 seed complete. ${totalCards} published cards total.`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Seed error:', e.message)
  process.exit(1)
})
