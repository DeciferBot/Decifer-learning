import { prisma } from '../lib/prisma'

const SPACE_CARDS = [
  {
    rarity: 'legendary',
    title: 'Our Star',
    fact_text: 'The Sun contains 99.86% of all the mass in the Solar System. One million Earths could fit inside it — and it burns 600 million tonnes of hydrogen every single second.',
  },
  {
    rarity: 'epic',
    title: 'Lord of the Rings',
    fact_text: "Saturn's rings are made mostly of ice and rock, stretching 282,000 km across — yet they are only about 10 metres thick. If Saturn were the size of a basketball, its rings would be thinner than a sheet of paper.",
  },
  {
    rarity: 'epic',
    title: 'The Giant Storm',
    fact_text: "Jupiter's Great Red Spot is a storm that has been raging for at least 350 years. It is so large that two Earths could fit inside it — though it has been slowly shrinking over the past century.",
  },
  {
    rarity: 'rare',
    title: 'The Red Planet',
    fact_text: 'Mars has the largest volcano in the Solar System: Olympus Mons. It is three times the height of Mount Everest and so wide that standing at its base, you could not see its summit — it would be beyond the horizon.',
  },
  {
    rarity: 'rare',
    title: 'The Blue Marble',
    fact_text: 'Earth is the only planet in the Solar System known to have liquid water on its surface — and liquid water is the one ingredient every known form of life requires. We are, so far, gloriously unique.',
  },
  {
    rarity: 'rare',
    title: 'The Inferno Twin',
    fact_text: "Venus is hotter than Mercury, despite being twice as far from the Sun. Its thick atmosphere traps heat in a runaway greenhouse effect, pushing surface temperatures to 465°C — hot enough to melt lead.",
  },
  {
    rarity: 'uncommon',
    title: 'The Tilted World',
    fact_text: 'Uranus orbits the Sun rolling on its side — tilted at 98 degrees. This means its poles experience 42 years of continuous sunlight followed by 42 years of total darkness.',
  },
  {
    rarity: 'uncommon',
    title: 'The Scarred Messenger',
    fact_text: 'Mercury is the most cratered world in the inner Solar System. Without wind or rain to erode them, its craters are perfectly preserved — a record of every cosmic collision stretching back billions of years.',
  },
  {
    rarity: 'common',
    title: 'The Mathematical Planet',
    fact_text: 'Neptune was discovered by mathematics, not by looking through a telescope first. Scientists noticed Uranus was wobbling slightly off course, calculated where an unseen planet must be pulling it — and found Neptune exactly where the equations predicted.',
  },
]

async function main() {
  console.log('Seeding space discovery cards...')

  for (const card of SPACE_CARDS) {
    const existing = await prisma.cardCatalog.findFirst({
      where: { title: card.title },
    })
    if (existing) {
      console.log(`  skip (exists): ${card.title}`)
      continue
    }

    await prisma.cardCatalog.create({
      data: {
        rarity: card.rarity,
        title: card.title,
        fact_text: card.fact_text,
        year_group_id: null, // available to all year groups
        subject_id: null,
        status: 'published',
      },
    })
    console.log(`  created [${card.rarity}]: ${card.title}`)
  }

  console.log('Done.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
