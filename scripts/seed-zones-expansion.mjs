/**
 * seed-zones-expansion.mjs
 *
 * Seeds zones for all subjects beyond the original Maths/English/Science MVP,
 * for both Year 3 and Year 7. Safe to re-run — uses upsert on (year_group_id, subject_id).
 *
 * Run: node scripts/seed-zones-expansion.mjs
 *      node scripts/seed-zones-expansion.mjs --dry-run   (print plan, no writes)
 */

import { PrismaClient } from '@prisma/client'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

// ── Zone definitions ──────────────────────────────────────────────────────────
// Format: { subjectName, yearGroupLabel, zoneName, theme }
// theme maps to an icon in ZoneMap's THEME_ICON — extend that map if adding new themes.

const ZONES = [
  // ── Year 3 ────────────────────────────────────────────────────────────────
  { subjectName: 'History',              yearGroupLabel: 'year-3', zoneName: 'Timeline Tower',    theme: 'tower'    },
  { subjectName: 'Geography',            yearGroupLabel: 'year-3', zoneName: 'Atlas Peak',         theme: 'mountain' },
  { subjectName: 'Computing',            yearGroupLabel: 'year-3', zoneName: 'Circuit City',       theme: 'circuit'  },
  { subjectName: 'Design and Technology',yearGroupLabel: 'year-3', zoneName: 'Maker\'s Market',    theme: 'forge'    },
  { subjectName: 'Art and Design',       yearGroupLabel: 'year-3', zoneName: 'Colour Canyon',      theme: 'cave'     },
  { subjectName: 'Music',                yearGroupLabel: 'year-3', zoneName: 'Melody Meadow',      theme: 'woodland' },
  { subjectName: 'Physical Education',   yearGroupLabel: 'year-3', zoneName: 'Champion\'s Field',  theme: 'field'    },
  { subjectName: 'Languages',            yearGroupLabel: 'year-3', zoneName: 'Language Lagoon',    theme: 'lagoon'   },

  // ── Year 7 ────────────────────────────────────────────────────────────────
  { subjectName: 'History',              yearGroupLabel: 'year-7', zoneName: 'Chronicle Citadel',  theme: 'tower'    },
  { subjectName: 'Geography',            yearGroupLabel: 'year-7', zoneName: 'Meridian Plateau',   theme: 'mountain' },
  { subjectName: 'Computing',            yearGroupLabel: 'year-7', zoneName: 'Binary Bastion',     theme: 'circuit'  },
  { subjectName: 'Design and Technology',yearGroupLabel: 'year-7', zoneName: 'Innovation Forge',   theme: 'forge'    },
  { subjectName: 'Art and Design',       yearGroupLabel: 'year-7', zoneName: 'Gallery of Echoes',  theme: 'library'  },
  { subjectName: 'Music',                yearGroupLabel: 'year-7', zoneName: 'Resonance Ridge',    theme: 'woodland' },
  { subjectName: 'Physical Education',   yearGroupLabel: 'year-7', zoneName: 'Titan\'s Arena',     theme: 'field'    },
  { subjectName: 'Languages',            yearGroupLabel: 'year-7', zoneName: 'Rosetta Ruins',      theme: 'cave'     },
  { subjectName: 'Citizenship',          yearGroupLabel: 'year-7', zoneName: 'Civic Square',       theme: 'tower'    },
]

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  ZONE EXPANSION SEED')
  if (DRY_RUN) console.log('  DRY RUN — no writes will be made')
  console.log(`${'═'.repeat(60)}\n`)

  // Fetch lookup maps
  const [yearGroups, subjects] = await Promise.all([
    prisma.yearGroup.findMany({ select: { id: true, label: true } }),
    prisma.subject.findMany({ select: { id: true, name: true } }),
  ])

  const ygMap = Object.fromEntries(yearGroups.map(y => [y.label, y.id]))
  const subMap = Object.fromEntries(subjects.map(s => [s.name, s.id]))

  let created = 0, skipped = 0, errors = 0

  for (const z of ZONES) {
    const yearGroupId = ygMap[z.yearGroupLabel]
    const subjectId   = subMap[z.subjectName]

    if (!yearGroupId) {
      console.log(`  ⚠ year_group not found: ${z.yearGroupLabel} — skipping "${z.zoneName}"`)
      errors++
      continue
    }
    if (!subjectId) {
      console.log(`  ⚠ subject not found: "${z.subjectName}" — skipping "${z.zoneName}"`)
      errors++
      continue
    }

    // Check if zone already exists for this year+subject combo
    const existing = await prisma.zone.findFirst({
      where: { year_group_id: yearGroupId, subject_id: subjectId },
      select: { id: true, name: true },
    })

    if (existing) {
      console.log(`  ── ${z.yearGroupLabel} · ${z.subjectName}: already exists as "${existing.name}" — skipped`)
      skipped++
      continue
    }

    console.log(`  + ${z.yearGroupLabel} · ${z.subjectName}: "${z.zoneName}" (theme: ${z.theme})`)

    if (!DRY_RUN) {
      await prisma.zone.create({
        data: {
          year_group_id: yearGroupId,
          subject_id:    subjectId,
          name:          z.zoneName,
          theme:         z.theme,
        },
      })
      created++
    } else {
      created++ // count as would-create in dry run
    }
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${DRY_RUN ? 'Would create' : 'Created'}: ${created}  |  Skipped (exists): ${skipped}  |  Errors: ${errors}`)
  if (errors > 0) {
    console.log(`  ⚠ Errors mean some subjects/year groups are not yet seeded.`)
    console.log(`    Run the subject seed scripts first, then re-run this script.`)
  }
  if (DRY_RUN && created > 0) {
    console.log(`\n  Re-run without --dry-run to apply.`)
  }
  console.log(`${'═'.repeat(60)}\n`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
