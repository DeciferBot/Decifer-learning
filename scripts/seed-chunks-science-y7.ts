/**
 * Seed curriculum_chunks for Year 7 Science (KS3).
 *
 * These chunks form the RAG knowledge base used by Stage 1 of the content pipeline.
 * Text is derived from NC 2014 Science KS3 statutory programme of study and
 * plain-language summaries appropriate for Year 7 content generation grounding.
 *
 * Idempotent: chunks are skipped if an identical chunk_text already exists.
 *
 * NOTE: After seeding, run embed_chunks.py on the DO droplet to compute embeddings.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-chunks-science-y7.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUBJECT = 'Science'
const YEAR_GROUP = 'year-7'
const SOURCE = 'NC 2014 Science KS3 Programme of Study'

const CHUNKS: string[] = [
  // Cells — structure and organisation
  `All living things are made of cells. The cell is the basic unit of life. Most cells are too small to be seen with the naked eye and must be viewed through a microscope. Robert Hooke first described cells in 1665 when he examined cork. A typical animal cell contains: a cell membrane (controls what enters and leaves), cytoplasm (jelly-like fluid where chemical reactions occur), and a nucleus (contains DNA, controlling cell activities and reproduction).`,

  `Plant cells have all the features of animal cells plus three additional features: a cell wall (made of cellulose, provides rigid support), a large central vacuole (filled with cell sap for support and storage), and chloroplasts (contain chlorophyll for photosynthesis — not all plant cells have these, e.g. root cells do not). The key differences: only plant cells have a cell wall, large vacuole, and chloroplasts.`,

  `Organisation in living organisms: cells → tissues → organs → organ systems → organism. A tissue is a group of similar cells working together (e.g. muscle tissue, epithelial tissue). An organ is made of different tissues working together (e.g. the heart contains muscle tissue, connective tissue, and epithelial tissue). An organ system is a group of organs working together (e.g. the digestive system). A multicellular organism contains all these levels of organisation.`,

  `Specialised cells are adapted to carry out specific functions. Red blood cells: no nucleus (more space for haemoglobin), biconcave disc shape (large surface area for absorbing oxygen). Sperm cells: long tail for swimming, many mitochondria for energy, acrosome containing enzymes to penetrate the egg. Root hair cells: long extension to increase surface area for water absorption. Nerve cells (neurones): very long with many connections for fast signal transmission.`,

  // Reproduction
  `Sexual reproduction requires two parents and involves the joining of sex cells (gametes). In animals, the male gamete is a sperm cell and the female gamete is an egg cell (ovum). Fertilisation occurs when a sperm fuses with an egg to form a zygote. The zygote divides repeatedly to form an embryo. Sexual reproduction produces variation in offspring because genetic material from two parents is combined.`,

  `Asexual reproduction requires only one parent and produces genetically identical offspring (clones). Examples: bacteria dividing in two (binary fission), plants producing runners (e.g. strawberries), bulb division (e.g. daffodils), taking cuttings. Asexual reproduction is faster than sexual reproduction and does not require a mate. However, it produces no genetic variation, making all offspring equally vulnerable to the same diseases or environmental changes.`,

  `Pollination in plants: Insect-pollinated flowers have large, colourful petals to attract insects, a scent to attract insects, nectar as a reward, and sticky pollen that clings to insects. Wind-pollinated flowers have small or no petals, produce large quantities of light, smooth pollen, have feathery stigmas to catch pollen, and often hang in catkins. After pollination (transfer of pollen to stigma), fertilisation occurs, forming seeds inside a fruit.`,

  // Ecosystems
  `An ecosystem consists of all the living organisms (biotic factors) in an area and the physical environment (abiotic factors: temperature, light, water, soil pH, wind). A habitat is the place where an organism lives. A community is all the populations of different species living in the same habitat. All the organisms of one species in a habitat form a population. Ecosystems are maintained by the cycling of materials and the flow of energy.`,

  `Food chains show the feeding relationships between organisms. They always start with a producer (a plant or other photosynthesising organism that makes its own food using light energy). Producers are eaten by primary consumers (herbivores). Primary consumers are eaten by secondary consumers. Secondary consumers may be eaten by tertiary consumers. Arrows in a food chain show the direction of energy flow ("is eaten by"). Example: grass → rabbit → fox → bacteria (decomposers).`,

  `Food webs show how multiple food chains in an ecosystem are interconnected. Most organisms eat more than one thing and are eaten by more than one predator. This makes food webs more realistic than single food chains. If one species is removed from a food web, it can affect many other species — this is called interdependence. Decomposers (bacteria and fungi) break down dead organisms and waste, returning nutrients to the soil for plants to use.`,

  // Chemistry — Particles and States of Matter
  `Everything is made of particles. The three states of matter are solid, liquid, and gas. In a solid, particles are packed closely together in a regular arrangement and vibrate in fixed positions — this gives solids a definite shape and volume. In a liquid, particles are close together but can move past each other — liquids have a definite volume but no fixed shape (they take the shape of their container). In a gas, particles are far apart and move rapidly in all directions — gases have no fixed shape or volume.`,

  `Changes of state: melting (solid → liquid, occurs at the melting point), freezing (liquid → solid, occurs at the freezing point = melting point), evaporation (liquid → gas, occurs at the surface at any temperature), boiling (liquid → gas throughout the liquid, occurs at the boiling point), condensation (gas → liquid), and sublimation (solid → gas without going through liquid, e.g. dry ice). Changes of state are physical changes — the substance is the same; only the arrangement of particles changes. No new substance is formed.`,

  `Diffusion is the movement of particles from an area of high concentration to an area of low concentration. It happens because particles are in constant random motion. Examples: the smell of perfume spreading across a room; oxygen moving from the lungs into the blood; glucose moving from the intestines into the bloodstream. Diffusion is faster at higher temperatures (particles move faster) and in gases compared to liquids (particles are further apart and move more freely).`,

  // Chemistry — Elements, Compounds and Mixtures
  `An element is a substance made of only one type of atom. It cannot be broken down into simpler substances by chemical means. There are 118 known elements, arranged in the Periodic Table. Elements are represented by chemical symbols: H (hydrogen), O (oxygen), C (carbon), Fe (iron from Latin 'ferrum'), Na (sodium from 'natrium'), Cu (copper from 'cuprum'). Metals are on the left and middle of the Periodic Table; non-metals are on the right.`,

  `A compound is a substance formed when two or more elements are chemically combined in fixed proportions. Compounds have completely different properties from the elements they are made of. For example, water (H₂O) is formed from hydrogen (a flammable gas) and oxygen (a gas that supports burning) — yet water puts out fires. Sodium chloride (NaCl, table salt) is formed from sodium (a dangerously reactive metal) and chlorine (a toxic green gas). Compounds can only be separated by chemical reactions.`,

  `A mixture contains two or more substances that are NOT chemically combined. The substances keep their own properties and can be separated by physical methods. Methods of separating mixtures: filtration (separates insoluble solids from liquids), evaporation (removes solvent to leave dissolved solid), distillation (separates liquids with different boiling points), chromatography (separates dissolved substances by how far they move in a solvent), and magnetic separation (separates magnetic materials).`,

  // Physics — Forces and Motion
  `A force is a push or pull that can change an object's speed, direction, or shape. Forces are measured in newtons (N). Contact forces require objects to touch: friction, tension, normal reaction force, air resistance. Non-contact forces act at a distance: gravity (attractive force between masses), magnetism, electrostatic force. Newton's First Law: an object remains at rest or moves in a straight line at constant speed unless acted on by a resultant (unbalanced) force.`,

  `Speed = distance ÷ time. The unit of speed is metres per second (m/s) or kilometres per hour (km/h). Average speed is calculated over the whole journey. Instantaneous speed is the speed at a particular moment. A distance-time graph shows how an object moves: a horizontal line means stationary; a straight diagonal line means constant speed; a steeper line means greater speed; a curved line means changing speed (acceleration or deceleration). The gradient (slope) of a distance-time graph equals the speed.`,

  `Newton's Second Law: Force = mass × acceleration (F = ma). When a resultant force acts on an object, it accelerates (changes speed or direction). A larger force causes greater acceleration. A larger mass requires more force to produce the same acceleration. Newton's Third Law: every action has an equal and opposite reaction. If you push down on the ground, the ground pushes up on you with an equal force. These action-reaction pairs always act on different objects.`,

  // Physics — Energy
  `Energy is the ability to do work. Energy cannot be created or destroyed — it can only be transferred from one store to another. This is the Law of Conservation of Energy. Energy stores: kinetic (moving objects), gravitational potential (objects above the ground), elastic potential (stretched or compressed objects), thermal (hot objects), chemical (food, fuel, batteries), nuclear (atomic nuclei), electrostatic (charged objects), magnetic (magnetic fields).`,

  `Energy transfer pathways: mechanical work (forces), electrical work (charge moving through components), heating (temperature difference), and radiation (light, sound, infrared). In a bouncing ball: gravitational potential → kinetic → elastic potential (at contact) → kinetic → gravitational potential. Energy is dissipated (spread out, usually as heat) with each transfer. Efficiency = (useful energy output ÷ total energy input) × 100%. A less efficient device wastes more energy as heat.`,

  // Physics — Space
  `The Solar System consists of the Sun (a star) and everything that orbits it: 8 planets (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune), dwarf planets (including Pluto), moons, asteroids, comets, and other objects. Planets orbit the Sun in ellipses (slightly flattened circles). The time for one complete orbit is a planet's year. Earth's year = 365.25 days. The planets closer to the Sun (inner planets: Mercury, Venus, Earth, Mars) are rocky; the outer planets (Jupiter, Saturn, Uranus, Neptune) are gas giants.`,

  `The Sun is a star at the centre of our Solar System. It is approximately 150 million kilometres from Earth. Light from the Sun takes about 8 minutes to reach Earth. The Sun produces energy through nuclear fusion in its core — hydrogen atoms fuse to form helium, releasing enormous amounts of energy as light and heat. The Moon orbits Earth approximately every 28 days. We see the Moon because it reflects sunlight. The phases of the Moon (new moon, crescent, quarter, gibbous, full moon) are caused by the changing angle between the Sun, Moon, and Earth as the Moon orbits us.`,
]

async function main() {
  console.log('Seeding Year 7 Science curriculum chunks...\n')

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
        data: {
          subject: SUBJECT,
          year_group: YEAR_GROUP,
          source_name: SOURCE,
          chunk_text,
          // embedding is null — will be computed by embed_chunks.py on the droplet
        },
      })
      inserted++
    } catch (err) {
      console.error(`  ❌ Failed to insert chunk: ${err}`)
    }
  }

  console.log(`  Inserted: ${inserted}, Skipped (already exists): ${skipped}`)
  console.log(`  Total chunks: ${inserted + skipped}`)
  console.log('\n  ⚠  Embeddings are NULL — run embed_chunks.py on the DO droplet to compute them.\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
