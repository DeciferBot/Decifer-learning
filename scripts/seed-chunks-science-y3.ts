/**
 * Seed curriculum_chunks for Year 3 Science.
 *
 * These chunks form the RAG knowledge base used by Stage 1 of the content pipeline.
 * Text is derived from NC 2014 Science Year 3 statutory programme of study and
 * age-appropriate factual summaries suitable for KS2 content generation grounding.
 *
 * Idempotent: chunks are skipped if an identical chunk_text already exists.
 *
 * NOTE: After seeding, run the /ingest endpoint to compute embeddings.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-chunks-science-y3.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUBJECT = 'Science'
const YEAR_GROUP = 'year-3'
const SOURCE = 'NC 2014 Science KS2 Year 3 Programme of Study'

const CHUNKS: string[] = [
  // Plants — parts and functions
  `Flowering plants have four main parts. Roots anchor the plant in the soil and absorb water and minerals. The stem supports the plant and carries water from the roots to the leaves. Leaves make food for the plant using sunlight, water, and carbon dioxide through photosynthesis. Flowers attract insects for pollination and help the plant reproduce.`,

  `Plants need the following to grow: light (for photosynthesis), water (absorbed through roots), air (carbon dioxide from the air), nutrients from the soil, and space to grow. Different plants need different amounts of these. For example, a cactus needs very little water and lots of light, while a fern needs shade and moisture.`,

  `Water travels through a plant from roots to leaves through a network of tubes called the xylem. This movement is called transpiration. You can observe this in an experiment: place a white flower in coloured water and watch the colour travel up the stem and into the petals over several hours.`,

  // Plants — life cycle and pollination
  `Pollination is the transfer of pollen from one flower to another. Insects such as bees are attracted to flowers by their colour, shape, and nectar. When a bee visits a flower, pollen sticks to its body. The bee carries the pollen to another flower, enabling fertilisation. Wind can also carry pollen between flowers.`,

  `After pollination, seeds form inside the flower. Seeds are dispersed (spread away from the parent plant) in several ways: by wind (sycamore and dandelion seeds have wings or parachutes), by animals (burrs attach to fur; berries are eaten and seeds pass through animals), by water (coconuts float), and by explosion (some seed pods burst open).`,

  `The life cycle of a flowering plant: seed → germination → seedling → mature plant → flowering → pollination → seed formation → seed dispersal → and back to seed. Germination requires water, warmth, and oxygen but does not need light to begin.`,

  // Animals including humans
  `Humans and other animals need nutrition to survive, grow, and repair their bodies. We cannot make our own food — we get nutrients by eating. There are seven types of nutrients: carbohydrates (energy), proteins (growth and repair), fats (energy storage and insulation), vitamins (healthy body functions), minerals (e.g. calcium for bones), fibre (healthy digestion), and water (vital for all body processes).`,

  `Many animals have a skeleton. The human skeleton has over 200 bones. The skeleton has three main jobs: support (holds the body upright), protection (the skull protects the brain, the ribcage protects heart and lungs), and movement (bones work with muscles to allow us to move). Joints are where two bones meet; they allow bending and rotation.`,

  `Muscles work in pairs. When one muscle contracts (gets shorter) its partner relaxes (gets longer). For example, when you bend your arm, the biceps muscle contracts and the triceps relaxes. To straighten your arm, the triceps contracts and the biceps relaxes. Tendons connect muscles to bones.`,

  // Rocks
  `There are three types of rock: igneous rocks form when molten rock (magma) cools and solidifies (e.g. granite, basalt). Sedimentary rocks form from layers of sediment that are compacted over millions of years (e.g. sandstone, limestone, chalk). Metamorphic rocks are formed when existing rocks are changed by heat or pressure deep underground (e.g. marble, slate).`,

  `Fossils are the preserved remains or traces of plants and animals that lived millions of years ago. They form when a plant or animal dies and is buried in sediment. Over millions of years, the sediment hardens into rock and the organic material is replaced by minerals. Fossils tell us about organisms that no longer exist. Mary Anning was a famous fossil hunter who found important ichthyosaur and plesiosaur fossils in Lyme Regis, England.`,

  `Soil is made from a mixture of small rock particles, organic matter (decayed plant and animal material called humus), air, water, and living organisms. There are different types of soil: clay soil has very small particles and holds water well; sandy soil has larger particles and drains quickly; loam (a mixture) is the most fertile. Worms help make soil by breaking down organic matter.`,

  // Light
  `We can only see objects when light enters our eyes. Light sources produce their own light (e.g. the Sun, torches, candles, light bulbs). Most objects do not produce their own light — we see them because they reflect light from a light source. The Moon is not a light source; it reflects light from the Sun. Dark is simply the absence of light.`,

  `When light hits a smooth, shiny surface it is reflected. The angle at which light hits a mirror (the angle of incidence) equals the angle at which it bounces off (the angle of reflection). This is the law of reflection. Rough surfaces scatter reflected light in many directions, which is why they appear dull rather than shiny.`,

  `The Sun produces ultraviolet (UV) radiation that can be harmful to our eyes and skin. We should never look directly at the Sun. We can protect our eyes by wearing sunglasses with UV protection. We can protect our skin with sunscreen. These precautions are especially important in summer and at high altitude.`,

  `A shadow forms when an opaque object blocks light from a source. The shadow appears on the opposite side of the object from the light source. The size of a shadow depends on: the distance between the light source and the object (closer = larger shadow), and the angle of the light. Translucent objects allow some light through and create faint shadows; transparent objects allow almost all light through.`,

  // Forces and magnets
  `A force is a push or a pull that can change the speed, direction, or shape of an object. Contact forces require two objects to touch: friction is a force between surfaces that slows moving objects down. Non-contact forces can act at a distance: gravity pulls all objects toward the Earth; magnetic force can attract or repel without touching.`,

  `Magnets attract some materials and not others. Materials attracted to magnets are called magnetic materials and are always metals, specifically: iron, steel, nickel, and cobalt. Most metals are NOT magnetic (e.g. aluminium, copper, gold, silver). Plastic, wood, glass, and rubber are not magnetic.`,

  `Every magnet has two poles: a north pole and a south pole. Opposite poles attract each other (north attracts south). Like poles repel each other (north repels north, south repels south). The area around a magnet where magnetic force acts is called the magnetic field. Magnetic field lines travel from the north pole to the south pole.`,

  `Friction is the force between two surfaces that are sliding or trying to slide past each other. Rough surfaces create more friction than smooth surfaces. Friction can be helpful (e.g. brakes on a bicycle, the grip of shoes on the floor) or unhelpful (e.g. it makes engines wear out). Streamlining reduces friction in air and water.`,
]

async function main() {
  console.log('Seeding Year 3 Science curriculum chunks...\n')

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

    await prisma.curriculumChunk.create({
      data: {
        subject: SUBJECT,
        year_group: YEAR_GROUP,
        source_name: SOURCE,
        chunk_text,
      },
    })
    inserted++
  }

  console.log(`  ✅ Inserted: ${inserted} chunks`)
  console.log(`  ⏭  Skipped: ${skipped} (already exist)`)
  console.log('\n  NOTE: Run the pipeline /ingest endpoint or seed-knowledge-base.py to compute embeddings.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
