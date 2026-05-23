/**
 * Reward Vault — milestone seed script.
 *
 * Seeds the 4 milestone bands used by the Reward Vault engine.
 * Idempotent: upserts by band name.
 *
 * Thresholds from docs/REWARD_VAULT_ARCHITECTURE.md:
 *   bronze   — 250 XP,  3 topics, 0 badges, no guardian, 1 credit
 *   silver   — 750 XP,  8 topics, 1 badge,  no guardian, 1 credit
 *   gold     — 1600 XP, 15 topics, 2 badges, no guardian, 2 credits
 *   platinum — 3200 XP, 25 topics, 3 badges, guardian win, 3 credits
 *
 * Run: node --env-file=.env.local scripts/seed-vault-milestones.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MILESTONES = [
  {
    band: 'bronze',
    display_name: 'Bronze Explorer',
    xp_required: 250,
    topics_required: 3,
    badges_required: 0,
    guardian_required: false,
    credits_awarded: 1,
    order_index: 1,
    is_active: true,
  },
  {
    band: 'silver',
    display_name: 'Silver Achiever',
    xp_required: 750,
    topics_required: 8,
    badges_required: 1,
    guardian_required: false,
    credits_awarded: 1,
    order_index: 2,
    is_active: true,
  },
  {
    band: 'gold',
    display_name: 'Gold Champion',
    xp_required: 1600,
    topics_required: 15,
    badges_required: 2,
    guardian_required: false,
    credits_awarded: 2,
    order_index: 3,
    is_active: true,
  },
  {
    band: 'platinum',
    display_name: 'Platinum Master',
    xp_required: 3200,
    topics_required: 25,
    badges_required: 3,
    guardian_required: true,
    credits_awarded: 3,
    order_index: 4,
    is_active: true,
  },
]

async function main() {
  console.log('Seeding vault milestones...')

  for (const milestone of MILESTONES) {
    await prisma.vaultMilestone.upsert({
      where: { band: milestone.band },
      create: milestone,
      update: {
        display_name: milestone.display_name,
        xp_required: milestone.xp_required,
        topics_required: milestone.topics_required,
        badges_required: milestone.badges_required,
        guardian_required: milestone.guardian_required,
        credits_awarded: milestone.credits_awarded,
        order_index: milestone.order_index,
        is_active: milestone.is_active,
      },
    })
    console.log(`  ✓ ${milestone.band} (${milestone.display_name})`)
  }

  const count = await prisma.vaultMilestone.count({ where: { is_active: true } })
  console.log(`\nDone — ${count} active milestone(s) in vault_milestones.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
