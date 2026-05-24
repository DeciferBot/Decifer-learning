/**
 * Seed curriculum_chunks for Year 2 Science (KS1).
 *
 * These chunks form the RAG knowledge base for Stage 1 of the content pipeline.
 * Text is derived from NC 2014 Science KS1 Year 2 statutory programme of study.
 *
 * Idempotent: skips existing chunks.
 * NOTE: After seeding, run embed_chunks.py on the DO droplet.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-chunks-science-y2.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUBJECT = 'Science'
const YEAR_GROUP = 'year-2'
const SOURCE = 'NC 2014 Science KS1 Year 2 Programme of Study'

const CHUNKS: string[] = [
  // Living things and habitats
  `A habitat is the place where an animal or plant lives. Different habitats provide the food, shelter, water, and air that living things need to survive. Common UK habitats: woodland (squirrels, owls, bluebells), pond (frogs, dragonflies, water lilies), garden (robins, worms, daisies), seashore (crabs, seagulls, limpets), hedgerow (hedgehogs, butterflies, blackberries). Animals are adapted to their habitat — they have features that help them survive there.`,

  `Living things and non-living things: Living things share seven life processes (often remembered as MRS GREN): Movement, Respiration (releasing energy from food), Sensitivity (responding to changes), Growth, Reproduction (making more of the same kind), Excretion (removing waste), Nutrition (taking in food). Animals and plants are living. Rocks, water, and plastic are non-living. Some things were once living — wood, cotton, and paper come from living things.`,

  `Food chains in the local environment: A food chain shows what animals eat and who eats them. All food chains start with a plant (producer) that makes food using sunlight. Example: grass → caterpillar → robin → sparrowhawk. The arrow means "is eaten by." An animal that eats only plants is a herbivore (e.g. rabbit, cow, caterpillar). An animal that eats only other animals is a carnivore (e.g. fox, eagle). An animal that eats both plants and animals is an omnivore (e.g. human, badger, bear).`,

  // Plants
  `Plants need certain conditions to grow well: light (leaves use light for photosynthesis to make food), water (absorbed through roots, essential for all life processes), warmth (most plants grow better in warm conditions — seeds germinate best at around 20°C), and nutrients from the soil. Plants that do not get enough light grow tall and pale (etiolation) as they stretch towards the light. Without water, plants wilt and eventually die.`,

  `The basic parts of a plant and their jobs: Roots — grow down into the soil, anchor the plant, and absorb water and minerals. Stem — supports the plant, carries water from roots to leaves (through tubes called xylem). Leaves — capture sunlight and make food through photosynthesis; tiny pores (stomata) let gases in and out. Flowers — attract insects for pollination; seeds form inside flowers after pollination. Seeds — each seed contains a tiny plant (embryo) and a food store; seeds grow into new plants when conditions are right.`,

  `Growing and caring for plants: Seeds need water, warmth, and oxygen to germinate (start growing) — they do not need light at first. Once the seedling has leaves, it needs light. To grow plants from seeds: (1) fill a pot with compost, (2) press seeds in gently, (3) water and keep warm, (4) move to a sunny windowsill once germination occurs. Plants can also grow from bulbs (daffodils, tulips), cuttings (taking a piece of stem and rooting it), and runners (strawberries).`,

  // Animals
  `Offspring and their parents: Young animals look like their parents but are smaller. Some young look very different from their parents at first — this is metamorphosis. Complete metamorphosis (4 stages): egg → larva (caterpillar) → pupa (chrysalis) → adult butterfly. Incomplete metamorphosis (3 stages): egg → nymph (young grasshopper) → adult. Mammals give birth to live young and feed them milk. Birds lay eggs and sit on them to keep them warm (incubation). Fish and amphibians lay eggs in water.`,

  `Animal groups and their basic needs: Mammals — warm-blooded, have hair or fur, give birth to live young, feed young on milk. Birds — warm-blooded, have feathers, lay eggs, have a beak (no teeth). Reptiles — cold-blooded, have scales, lay eggs on land. Amphibians — cold-blooded, lay eggs in water, moist skin, live both on land and in water (e.g. frog, newt). Fish — cold-blooded, live in water, breathe through gills, most lay eggs. Insects — 6 legs, 3 body parts (head, thorax, abdomen), most have wings.`,

  `Animal survival needs: All animals need food, water, shelter, and the right temperature to survive. Animals that cannot find food or water, or that get too cold or hot, will die. Animals are adapted to the conditions in their habitat. A polar bear has thick white fur for warmth and camouflage. A camel has a hump for storing fat (energy), can go days without water, and has wide feet for walking on sand. A fish has gills to breathe underwater and a streamlined body for swimming.`,

  // Materials
  `Everyday materials and their properties: Wood — hard, rigid, can be carved, comes from trees. Metal — strong, hard, shiny, conducts heat and electricity, can be magnetic. Plastic — waterproof, lightweight, can be moulded into shapes. Glass — transparent (lets light through), hard but brittle (breaks easily). Fabric/textile — soft, flexible, can be woven. Rock — hard, heavy, found in the ground. Water — liquid, flows, transparent, freezes at 0°C.`,

  `Properties of materials: rigid (keeps its shape) vs. flexible (bends); transparent (you can see through it clearly) vs. translucent (some light passes through but you cannot see clearly) vs. opaque (no light passes through); waterproof (water does not pass through) vs. absorbent (soaks up water); hard vs. soft; rough vs. smooth. The correct material is chosen for each job based on its properties. A window is made of glass because it is transparent. A raincoat is made of waterproof material.`,

  `Changing the shape of materials: Some materials can be changed in shape by squashing (pressing), bending (curving), twisting, and stretching. These are physical changes — the material can often be returned to its original shape. Clay, dough, and rubber are examples of materials that can be shaped in these ways. Some changes are irreversible (cannot be undone): burning paper turns it to ash; cooking an egg changes it permanently. Other changes are reversible: melting chocolate (solid → liquid) can be cooled back to solid.`,
]

async function main() {
  console.log('Seeding Year 2 Science curriculum chunks...\n')

  let inserted = 0
  let skipped = 0

  for (const chunk_text of CHUNKS) {
    const existing = await prisma.curriculumChunk.findFirst({
      where: { subject: SUBJECT, year_group: YEAR_GROUP, chunk_text },
    })
    if (existing) {
      skipped++
      continue
    }
    try {
      await prisma.curriculumChunk.create({
        data: { subject: SUBJECT, year_group: YEAR_GROUP, source_name: SOURCE, chunk_text },
      })
      inserted++
    } catch (err) {
      console.error(`  ❌ Failed to insert chunk: ${err}`)
    }
  }

  console.log(`  Inserted: ${inserted}, Skipped: ${skipped}`)
  console.log('\n  ⚠  Embeddings are NULL — run embed_chunks.py on the DO droplet.\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
