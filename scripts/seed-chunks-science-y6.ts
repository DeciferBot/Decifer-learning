/**
 * Seed curriculum_chunks for Year 6 Science (KS2).
 *
 * These chunks form the RAG knowledge base for Stage 1 of the content pipeline.
 * Text is derived from NC 2014 Science KS2 Year 6 statutory programme of study.
 *
 * Idempotent: skips existing chunks.
 * NOTE: After seeding, run embed_chunks.py on the DO droplet.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-chunks-science-y6.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUBJECT = 'Science'
const YEAR_GROUP = 'year-6'
const SOURCE = 'NC 2014 Science KS2 Year 6 Programme of Study'

const CHUNKS: string[] = [
  // Evolution and inheritance
  `Charles Darwin and the theory of evolution by natural selection: Charles Darwin (1809–1882) developed the theory of evolution after his voyage on HMS Beagle (1831–1836), during which he observed how species on the Galápagos Islands differed from each other and from mainland South American species. His 1859 book "On the Origin of Species" set out four key ideas: (1) Variation — individuals within a species are not identical; they show heritable variation. (2) Overproduction — organisms produce more offspring than can survive. (3) Struggle for survival — limited resources mean many offspring die before reproducing. (4) Natural selection (survival of the fittest) — individuals with advantageous traits are more likely to survive and reproduce, passing those traits to offspring. Over many generations, this changes the characteristics of a population.`,

  `Adaptation and natural selection in Year 6: An adaptation is a feature of an organism that makes it well-suited to its environment. Structural adaptations (body features): a polar bear has a thick layer of fat (blubber) for insulation, white fur for camouflage in snow, and large paws for walking on ice. A cactus has a thick waxy stem to store water, spines instead of leaves (reduces water loss), and deep roots. Behavioural adaptations: some animals migrate in winter (swallows fly to Africa), others hibernate (dormice lower their body temperature). Natural selection explains why populations become better adapted over time: better-adapted individuals survive longer, breed more, and pass on their genes. Less well-adapted individuals are less likely to reproduce.`,

  `Inherited variation vs. environmental variation in Year 6: Variation is difference between individuals of the same species. Inherited variation is caused by genes passed from parents to offspring: blood group, eye colour, ear lobe shape (attached or unattached), tongue rolling. Environmental variation is caused by conditions during an organism's life: a scar from an injury, a suntan, language spoken, body weight (influenced by diet). Some characteristics are influenced by both: height is partly genetic (tall parents tend to have tall children) but also affected by diet and health. Variation within a species is important for evolution — without variation, natural selection cannot act. Selective breeding (artificial selection) is the human-directed process of breeding individuals with desirable traits to produce offspring with those traits: dairy cows bred for high milk yield, dog breeds selected for specific characteristics.`,

  `Fossils as evidence for evolution in Year 6: A fossil is the preserved remains or impression of an organism from the past, typically found in sedimentary rock. Fossils form when: (1) an organism dies and is covered by sediment, (2) the soft parts decay, (3) hard parts (bone, shell) are slowly replaced by minerals, (4) over millions of years the sediment becomes rock and the fossil is preserved. The fossil record shows how species have changed over time. Mary Anning (1799–1847) discovered important fossils including the first ichthyosaur. The fossil record is incomplete (many organisms had soft bodies and did not fossilise) but provides strong evidence for evolution — species alive today are related to ancient forms, and transitional fossils show intermediate stages between ancestor and descendant species.`,

  // Classification
  `Linnaeus and the classification system: Carl Linnaeus (1707–1778) devised the system of biological classification still used today. Organisms are grouped into a hierarchy (nested groups): Kingdom → Phylum → Class → Order → Family → Genus → Species. Mnemonic: "King Philip Came Over For Good Soup." Each organism has a two-part Latin scientific name (binomial nomenclature) — the genus name (capitalised) followed by the species name (lowercase), both italicised: Homo sapiens (humans), Panthera leo (lion), Canis lupus (wolf). The species is the most specific level — members of the same species can interbreed to produce fertile offspring. Closely related species share the same genus: Panthera leo (lion) and Panthera tigris (tiger) are both big cats in the genus Panthera.`,

  `Vertebrates and invertebrates in Year 6: Animals are divided into vertebrates (with a backbone) and invertebrates (without). The five vertebrate classes: (1) Fish — cold-blooded, breathe through gills, scales, lay eggs in water (e.g. salmon, shark). (2) Amphibians — cold-blooded, moist skin, lay eggs in water, adults can live on land (e.g. frog, newt, toad). (3) Reptiles — cold-blooded, dry scaly skin, lay leathery eggs on land (e.g. snake, lizard, crocodile, tortoise). (4) Birds — warm-blooded, feathers, lay hard-shelled eggs, beaks (e.g. robin, eagle, penguin). (5) Mammals — warm-blooded, fur or hair, give birth to live young (except platypus and echidna), feed young on milk (e.g. dog, dolphin, bat, human). Invertebrates include insects (6 legs, 3 body parts), arachnids (8 legs), crustaceans, molluscs, and worms.`,

  `Dichotomous keys and microorganisms in Year 6: A dichotomous key is a tool for identifying organisms. It consists of a series of paired statements or questions, each with a yes/no answer that leads to the next pair until the organism is identified. Example: "Does it have legs? → Yes → Does it have 6 legs? → Yes → It is an insect." Pupils construct and use dichotomous keys for sets of organisms. Microorganisms are living things too small to see with the naked eye; they include: bacteria (single-celled prokaryotes — can be beneficial, e.g. gut bacteria, or harmful, e.g. Salmonella), viruses (not cells — require a host to reproduce; cause diseases including flu, colds, COVID-19), fungi (including mould and yeast — can cause decay or disease, but yeast is used in baking and brewing). Carl Woese's three-domain system (proposed 1990) divides life into Bacteria, Archaea, and Eukarya.`,

  // Circulatory system
  `The heart and how it works in Year 6: The heart is a muscular pump about the size of a fist, located slightly left of centre in the chest. It has four chambers: two atria (upper, receiving chambers) and two ventricles (lower, pumping chambers). The right side of the heart pumps deoxygenated blood to the lungs to pick up oxygen (pulmonary circulation). The left side pumps oxygenated blood to the rest of the body (systemic circulation). Valves prevent blood flowing backwards: the bicuspid/mitral valve (between left atrium and ventricle), tricuspid valve (between right atrium and ventricle), and semi-lunar valves in the aorta and pulmonary artery. Each heartbeat = one contraction of the ventricles. A resting heart rate for a child is typically 70–100 beats per minute (bpm).`,

  `Blood vessels in Year 6: There are three types of blood vessel. Arteries carry blood away from the heart. They have thick, elastic, muscular walls to withstand the high pressure from each heartbeat. The aorta is the largest artery, carrying oxygenated blood from the left ventricle. Veins carry blood towards the heart. They have thinner walls and lower pressure; they contain valves to prevent backflow. The vena cava returns deoxygenated blood to the right atrium. Capillaries are the smallest blood vessels, forming networks in tissues. Their walls are one cell thick, allowing oxygen and glucose to diffuse into cells and carbon dioxide and waste to diffuse out. The arterial system → capillaries → venous system forms a complete circuit.`,

  `Blood components and function in Year 6: Blood is a liquid tissue made of four components. (1) Red blood cells — biconcave disc shape (no nucleus, maximises surface area); contain haemoglobin, a protein that carries oxygen; produced in bone marrow. (2) White blood cells — part of the immune system; engulf pathogens (phagocytes) or produce antibodies (lymphocytes); larger than red blood cells and have a nucleus. (3) Platelets — small cell fragments that help blood clot when a vessel is damaged, preventing excessive blood loss and infection. (4) Plasma — pale yellow liquid that makes up about 55% of blood; transports dissolved nutrients (glucose, amino acids), hormones, carbon dioxide, and waste products. Pulse = the rhythmic pressure wave felt in arteries each time the heart contracts; measured at the wrist (radial artery) or neck (carotid artery).`,

  `Diet, exercise, and the circulatory system in Year 6: Regular aerobic exercise (cycling, swimming, running) strengthens the heart muscle so it pumps more blood per beat (increased stroke volume), leading to a lower resting heart rate over time in fit individuals. Exercise increases breathing rate and heart rate to deliver more oxygen to muscles and remove carbon dioxide faster. Diet affects cardiovascular health: excess saturated fat can cause fatty deposits (plaques) to build up inside arteries, narrowing them and increasing the risk of heart attack and stroke. A balanced diet rich in fruits, vegetables, whole grains, and unsaturated fats supports heart health. Smoking damages blood vessel walls and reduces the oxygen-carrying capacity of blood. Pupils measure their own resting and active pulse rates and draw conclusions about the effects of exercise.`,

  // Light
  `How we see objects in Year 6: Light travels in straight lines (rectilinear propagation) at approximately 300,000 km per second. We see objects because light either comes from them (luminous sources: the sun, a candle, a torch) or bounces off them into our eyes (non-luminous objects: a book, the moon). Light enters the eye through the cornea (which refracts it), then the pupil (the dark hole in the iris), then the lens (which focuses the image), and hits the retina at the back of the eye. The retina contains photoreceptor cells (rods for low light/black and white; cones for colour) that convert light into nerve signals sent to the brain via the optic nerve. The image on the retina is upside-down and reversed; the brain corrects this.`,

  `Reflection in Year 6: Reflection occurs when light bounces off a surface. The law of reflection states: the angle of incidence equals the angle of reflection. Both angles are measured from the normal (an imaginary line perpendicular to the surface at the point where light strikes). A smooth, shiny surface (e.g. a mirror) causes specular (regular) reflection — parallel light rays remain parallel after reflection, forming a clear image. A rough surface (e.g. paper) causes diffuse (irregular) reflection — light scatters in many directions, so no clear image is formed (but we can still see the object). Periscopes use two parallel mirrors angled at 45° to redirect light, allowing the user to see around corners or over obstacles. Pupils draw ray diagrams showing the path of light from a source, to a mirror, to the observer's eye.`,

  `Refraction in Year 6: Refraction is the bending of light when it passes from one transparent material (medium) to another with a different optical density. When light passes from a less dense medium (e.g. air) to a more dense medium (e.g. glass or water), it slows down and bends towards the normal. When it passes from more dense to less dense, it speeds up and bends away from the normal. This is why: (1) a straw in a glass of water appears bent or broken at the surface; (2) a swimming pool looks shallower than it is; (3) lenses can focus light. Convex (converging) lenses are thicker in the middle — they bend light inward to a focal point; used in magnifying glasses and cameras. Concave (diverging) lenses are thinner in the middle — they bend light outward; used in spectacles for short-sightedness.`,

  `The visible spectrum, white light, and shadows in Year 6: White light is a mixture of all the colours of the visible spectrum. When white light passes through a triangular glass prism, refraction separates it into its component colours because each colour has a slightly different wavelength and refracts by a slightly different amount. The order of colours (Roy G Biv): Red, Orange, Yellow, Green, Blue, Indigo, Violet. Red is refracted least (longest wavelength); violet is refracted most (shortest wavelength). A rainbow is formed when sunlight refracts and reflects inside raindrops, splitting into the spectrum. Shadows are formed when an opaque object blocks light. The umbra is the darkest part of the shadow (no direct light); the penumbra is the partial shadow at the edges. Shadow length and direction depend on the position of the light source: a low light source creates a long shadow; as the source moves overhead, the shadow shortens.`,
]

async function main() {
  console.log('Seeding Year 6 Science curriculum chunks...\n')

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
