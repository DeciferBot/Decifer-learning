/**
 * Reward Vault Stage 2 — Prize Catalogue Seed.
 *
 * Seeds 8 UK-appropriate physical prize options into reward_catalog.
 * All items start inactive (is_active: false) — admin must activate them.
 * price_pence = 0 for all items (manual fulfilment, no automated ordering).
 *
 * Run: node --env-file=.env.local scripts/seed-vault-catalogue.mjs
 * Flags:
 *   --dry-run   Print items without inserting
 *   --activate  Set is_active: true on insertion (default: false)
 */

import { PrismaClient } from '@prisma/client'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const ACTIVATE = args.includes('--activate')

const ITEMS = [
  {
    name: 'Stationery set',
    description: 'Pens, pencils, highlighters, and fun notepads.',
    category: 'Stationery & Art',
    min_milestone: 'bronze',
    price_pence: 0,
  },
  {
    name: 'Art supply pack',
    description: 'Sketchpad, colouring pencils, and watercolour paints.',
    category: 'Stationery & Art',
    min_milestone: 'bronze',
    price_pence: 0,
  },
  {
    name: 'Book token',
    description: 'Choose any book from a local bookshop.',
    category: 'Books & Reading',
    min_milestone: 'bronze',
    price_pence: 0,
  },
  {
    name: 'Science kit',
    description: 'At-home experiments — slime, crystals, or chemistry starter kit.',
    category: 'Learning & Discovery',
    min_milestone: 'silver',
    price_pence: 0,
  },
  {
    name: 'Game or puzzle',
    description: 'Board game, card game, or jigsaw puzzle of their choice.',
    category: 'Games & Puzzles',
    min_milestone: 'silver',
    price_pence: 0,
  },
  {
    name: 'Cinema trip',
    description: 'A trip to the cinema to see the film of their choice.',
    category: 'Experiences',
    min_milestone: 'gold',
    price_pence: 0,
  },
  {
    name: 'Museum or science centre visit',
    description: 'A day out at a local museum, science centre, or gallery.',
    category: 'Experiences',
    min_milestone: 'gold',
    price_pence: 0,
  },
  {
    name: 'Special meal out',
    description: 'Dinner at the restaurant of their choice.',
    category: 'Experiences',
    min_milestone: 'platinum',
    price_pence: 0,
  },
]

if (DRY_RUN) {
  console.log('\n── Prize Catalogue Seed (DRY RUN) ──\n')
  for (const item of ITEMS) {
    console.log(`  ${item.name} [${item.category}] (${item.min_milestone}+)`)
  }
  console.log(`\n  ${ITEMS.length} items — not inserted (dry run)\n`)
  process.exit(0)
}

const prisma = new PrismaClient()

try {
  console.log('\n── Prize Catalogue Seed ──\n')
  let created = 0
  let skipped = 0

  for (const item of ITEMS) {
    const existing = await prisma.rewardCatalog.findFirst({
      where: { name: item.name },
      select: { id: true },
    })
    if (existing) {
      console.log(`  ~ Skipped (already exists): ${item.name}`)
      skipped++
      continue
    }
    await prisma.rewardCatalog.create({
      data: { ...item, is_active: ACTIVATE },
    })
    console.log(`  + Created${ACTIVATE ? ' (active)' : ''}: ${item.name}`)
    created++
  }

  console.log(`\n  Done — ${created} created, ${skipped} skipped\n`)
  if (!ACTIVATE) {
    console.log('  Items are inactive by default. Use --activate flag to make them active on seed,')
    console.log('  or activate individually in the admin catalogue (/dashboard/admin/vault/catalogue).\n')
  }
} finally {
  await prisma.$disconnect()
}
