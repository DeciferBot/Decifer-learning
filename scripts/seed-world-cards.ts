/**
 * Seed Discovery Cards for the World Atlas explorer.
 * Run: npx ts-node --project tsconfig.scripts.json scripts/seed-world-cards.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const WORLD_CARDS = [
  // Continents — one per continent (mixed rarities)
  {
    title: 'The Amazon Guardian',
    fact_text: 'The Amazon rainforest produces 20% of Earth\'s oxygen and holds 10% of all species on Earth. It is the lungs of our planet.',
    rarity: 'legendary',
    is_seasonal: false,
  },
  {
    title: 'The Sahara Secret',
    fact_text: 'The Sahara Desert was green and lush just 6,000 years ago — hippos swam in rivers across modern Libya. Climate change ended the African Humid Period.',
    rarity: 'epic',
    is_seasonal: false,
  },
  {
    title: 'The Silk Road',
    fact_text: 'Asia\'s ancient Silk Road connected China to Rome — 4,000 miles of trade routes that carried not just silk, but ideas, religions, and plagues across the world.',
    rarity: 'epic',
    is_seasonal: false,
  },
  {
    title: 'The Midnight Sun',
    fact_text: 'In northern Europe above the Arctic Circle, the sun never sets for weeks in summer and never rises for weeks in winter. For two months, there is only darkness — or only light.',
    rarity: 'rare',
    is_seasonal: false,
  },
  {
    title: 'The Lost City',
    fact_text: 'Machu Picchu in Peru was built by the Inca Empire at 2,430m elevation — so remote that Spanish conquistadors never found it. It was rediscovered by the outside world only in 1911.',
    rarity: 'rare',
    is_seasonal: false,
  },
  {
    title: 'Marsupial Magic',
    fact_text: 'Australia\'s mammals evolved in isolation for 45 million years. 80% of Australian wildlife exists nowhere else on Earth — including kangaroos, koalas, and the venomous platypus.',
    rarity: 'uncommon',
    is_seasonal: false,
  },
  {
    title: 'The Midnight Ocean',
    fact_text: 'The deepest point of the Arctic Ocean is 5,550m down. It stays frozen year-round, yet supports polar bears, narwhals, and thousands of species adapted to permanent cold.',
    rarity: 'uncommon',
    is_seasonal: false,
  },
  // Country spotlight cards
  {
    title: 'Empire of the Sun',
    fact_text: 'Japan\'s Emperor is the world\'s oldest continuous hereditary monarchy — the same family has held the throne for 2,600 years, longer than any other royal dynasty on Earth.',
    rarity: 'legendary',
    is_seasonal: false,
  },
  {
    title: 'The Great Wall',
    fact_text: 'China\'s Great Wall took 2,000 years to build across multiple dynasties. It stretches over 21,000 km — long enough to circle the Earth\'s equator once and then half again.',
    rarity: 'epic',
    is_seasonal: false,
  },
  {
    title: 'Democracy\'s Birthplace',
    fact_text: 'Ancient Athens invented democracy around 507 BCE — letting citizens vote directly on laws. The word democracy comes from Greek: demos (people) + kratos (power).',
    rarity: 'rare',
    is_seasonal: false,
  },
  {
    title: 'The Golden Gate',
    fact_text: 'When the Golden Gate Bridge opened in 1937, it was the world\'s longest suspension bridge. Its distinctive International Orange colour was chosen to make it visible in San Francisco\'s famous fog.',
    rarity: 'rare',
    is_seasonal: false,
  },
  {
    title: 'The Pyramids',
    fact_text: 'Ancient Egyptians built the Great Pyramid using 2.3 million stone blocks averaging 2.5 tonnes each. Modern engineers still debate exactly how they did it in just 20 years.',
    rarity: 'uncommon',
    is_seasonal: false,
  },
  {
    title: 'The Taj Mahal',
    fact_text: 'The Taj Mahal was built by Mughal Emperor Shah Jahan as a tomb for his beloved wife Mumtaz Mahal, who died in childbirth. It took 20,000 workers 22 years to complete.',
    rarity: 'uncommon',
    is_seasonal: false,
  },
  {
    title: 'The Northern Lights',
    fact_text: 'The Aurora Borealis (Northern Lights) occurs when solar particles hit Earth\'s magnetic field. They appear above 65° latitude — visible from Norway, Iceland, Canada, and northern Russia.',
    rarity: 'common',
    is_seasonal: false,
  },
  {
    title: 'The Nile\'s Secret',
    fact_text: 'The Nile River was the world\'s longest river for over a century of measurement. Recent research suggests the Amazon may be slightly longer — but the Nile\'s annual floods built Egyptian civilisation.',
    rarity: 'common',
    is_seasonal: false,
  },
]

async function main() {
  console.log('Seeding world discovery cards...')

  let created = 0
  let skipped = 0

  for (const card of WORLD_CARDS) {
    const existing = await prisma.cardCatalog.findFirst({
      where: { title: card.title },
    })
    if (existing) {
      skipped++
      continue
    }
    await prisma.cardCatalog.create({
      data: {
        title: card.title,
        fact_text: card.fact_text,
        rarity: card.rarity,
        is_seasonal: card.is_seasonal,
        status: 'published',
        // subject_id and year_group_id intentionally null — world atlas cards are cross-subject
      },
    })
    created++
    console.log(`  ✓ ${card.title} (${card.rarity})`)
  }

  console.log(`\nDone. Created: ${created}, Skipped (already exist): ${skipped}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
