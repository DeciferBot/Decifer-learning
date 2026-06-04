/**
 * Seed curriculum_chunks for Year 10 and Year 11 Science (KS4/GCSE).
 *
 * Covers all 18 topics seeded for Y10/Y11 Science (Biology, Chemistry, Physics).
 * Aligned to AQA GCSE Combined Science and Triple Science specifications.
 *
 * Idempotent: skips existing chunks.
 * After seeding, run embed_chunks.py on the DO droplet.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-chunks-science-y10-y11.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SOURCE = 'AQA GCSE Science Specification (Biology, Chemistry, Physics)'

const CHUNKS: Array<{ subject: string; year_group: string; chunk_text: string }> = [
  // ── Year 10 ──────────────────────────────────────────────────────────────

  // Cell Biology
  { subject: 'Science', year_group: 'year-10', chunk_text: `Cell biology — prokaryotic vs eukaryotic cells: Eukaryotic cells have a nucleus containing DNA. Animal cells contain: nucleus, cell membrane, cytoplasm, mitochondria, ribosomes. Plant cells also contain: cell wall (cellulose), chloroplasts, vacuole. Prokaryotic cells (bacteria) have no nucleus — DNA is a loop in the cytoplasm; may have plasmids; cell wall (not cellulose), flagella. Cell size scale: cells are measured in micrometres (μm); 1 mm = 1000 μm. Magnification = image size ÷ actual size. Specialised cells: red blood cells (no nucleus, biconcave for surface area), nerve cells (long axon, myelin sheath), sperm cells (mitochondria, acrosome), root hair cells (large surface area).` },
  { subject: 'Science', year_group: 'year-10', chunk_text: `Cell division — mitosis and the cell cycle: The cell cycle: G1 (cell grows, produces organelles), S (DNA replication — each chromosome copied), G2 (preparation for division), M (mitosis). Mitosis produces two genetically identical daughter cells. Used for growth, repair, and asexual reproduction. Stages of mitosis: prophase (chromosomes condense), metaphase (align at equator), anaphase (chromatids pulled apart), telophase (two nuclei form), cytokinesis (cytoplasm divides). Cancer is uncontrolled cell division caused by mutations. Stem cells: undifferentiated cells that can develop into specialised cells; found in embryos and some adult tissues (bone marrow). Therapeutic potential: treatment of conditions like diabetes, Parkinson's.` },

  // Organisation and the Digestive System
  { subject: 'Science', year_group: 'year-10', chunk_text: `Organisation levels: cells → tissues → organs → organ systems → organism. The digestive system breaks down food into small soluble molecules that can be absorbed into the blood. Main organs: mouth (saliva, amylase), oesophagus (peristalsis), stomach (protease, hydrochloric acid, pH 2), small intestine (lipase, bile, most absorption), large intestine (water absorption). Enzymes: amylase (carbohydrates → glucose), protease (proteins → amino acids), lipase (fats → fatty acids + glycerol). Bile: produced by liver, stored in gall bladder, emulsifies fats (breaks into droplets to increase surface area for lipase). Villi in small intestine: increase surface area; have microvilli, thin walls, good blood supply.` },

  // Infection and Response
  { subject: 'Science', year_group: 'year-10', chunk_text: `Infection and response: Pathogens are microorganisms that cause disease. Types: bacteria (produce toxins; treated with antibiotics), viruses (replicate inside host cells; cannot be treated with antibiotics), fungi (e.g. athlete's foot, rose black spot), protists (e.g. malaria caused by Plasmodium, spread by mosquito vectors). Body defences: skin (barrier), mucus/cilia in respiratory tract, stomach acid (kills bacteria). Specific immune response: white blood cells (lymphocytes) produce antibodies specific to antigens on the pathogen. Memory cells remain after infection — faster response if same pathogen encountered again. Vaccination: introduces dead/weakened pathogen or antigen; stimulates antibody production without causing disease.` },

  // Atomic Structure and the Periodic Table
  { subject: 'Science', year_group: 'year-10', chunk_text: `Atomic structure: atom has a central nucleus containing protons (positive charge, mass 1) and neutrons (no charge, mass 1), surrounded by electrons (negative charge, mass ≈ 0) in energy levels (shells). Atomic number (proton number) = number of protons. Mass number = protons + neutrons. Neutrons = mass number − atomic number. Neutral atom: protons = electrons. Ions: atoms that have gained or lost electrons. Isotopes: same element (same proton number), different number of neutrons; same chemical properties, different mass. Relative atomic mass (Ar) = weighted average of all isotopes. The Periodic Table arranges elements by increasing atomic number; periods = energy levels; groups = same number of outer electrons → similar chemical properties.` },
  { subject: 'Science', year_group: 'year-10', chunk_text: `The Periodic Table — groups and trends: Group 1 (alkali metals): one outer electron; react vigorously with water to form metal hydroxide + hydrogen gas; reactivity increases down the group (outer electron further from nucleus, more easily lost). Group 7 (halogens): seven outer electrons; reactivity decreases down the group; displace less reactive halogens from solutions. Group 0 (noble gases): full outer shells; unreactive (inert). Transition metals (block between Groups 2 and 3): harder, higher melting points, can form coloured compounds, can act as catalysts, can form multiple ions (e.g. Fe²⁺ and Fe³⁺). Electronic configuration: first shell holds max 2 electrons; second and third shells hold max 8.` },

  // Bonding, Structure and Properties
  { subject: 'Science', year_group: 'year-10', chunk_text: `Chemical bonding: Ionic bonding — metal transfers electrons to non-metal; forms ions (positive metal cation, negative non-metal anion); giant ionic lattice structure; high melting/boiling points; conducts electricity when molten or dissolved. Covalent bonding — non-metals share electrons; can form simple molecular structures (low melting point, do not conduct electricity) or giant covalent structures (diamond, graphite, silicon dioxide — very high melting points). Metallic bonding — positive metal ions in a sea of delocalised electrons; good conductors of electricity and heat; malleable and ductile. Graphite: each carbon has 3 covalent bonds + one delocalised electron → conducts electricity. Diamond: each carbon has 4 covalent bonds → hardest natural substance, does not conduct electricity.` },

  // Quantitative Chemistry
  { subject: 'Science', year_group: 'year-10', chunk_text: `Quantitative chemistry: relative formula mass (Mr) = sum of relative atomic masses of all atoms. Mole: amount of substance; 1 mole of any substance contains 6.02 × 10²³ particles (Avogadro's number). Moles = mass ÷ Mr. Concentration (mol/dm³) = moles ÷ volume (dm³). Balanced equation: mole ratio gives ratio of amounts reacting. Percentage yield = (actual yield ÷ theoretical yield) × 100. Atom economy = (Mr of desired products ÷ Mr of all products) × 100 — measures efficiency. Conservation of mass: total mass of products = total mass of reactants (atoms are not created or destroyed in a chemical reaction).` },

  // Forces
  { subject: 'Science', year_group: 'year-10', chunk_text: `Forces: a force is a push or pull measured in Newtons (N). Scalar quantities have magnitude only (speed, mass, distance, temperature). Vector quantities have magnitude AND direction (velocity, force, acceleration, displacement). Resultant force: sum of all forces acting on an object (consider direction). Newton's First Law: an object remains stationary or at constant velocity unless acted on by a resultant force. Newton's Second Law: F = ma (force = mass × acceleration). Newton's Third Law: every action has an equal and opposite reaction (forces act on different objects). Weight = mass × gravitational field strength (W = mg; g = 9.8 N/kg on Earth). Friction is a force opposing motion; air resistance increases with speed.` },
  { subject: 'Science', year_group: 'year-10', chunk_text: `Forces — motion graphs and momentum: Distance-time graphs: gradient = speed. Speed-time (velocity-time) graphs: gradient = acceleration; area under graph = distance. Acceleration = change in velocity ÷ time. Stopping distance = thinking distance + braking distance. Thinking distance depends on reaction time; braking distance depends on speed (doubles the speed = four times the braking distance due to kinetic energy). Momentum = mass × velocity (kg m/s). Conservation of momentum: total momentum before = total momentum after a collision (in a closed system). Impulse = force × time = change in momentum.` },

  // Energy
  { subject: 'Science', year_group: 'year-10', chunk_text: `Energy stores and transfers: energy stores: kinetic, gravitational potential, elastic potential, chemical, thermal, nuclear, magnetic, electrostatic. Energy can be transferred by: mechanical work, heating, radiation (light/sound), electrical work. Conservation of energy: energy cannot be created or destroyed; only transferred or stored. Kinetic energy: Ek = ½mv². Gravitational PE: Ep = mgh. Elastic PE: Ee = ½ke². Work done: W = Fd (work = force × distance). Power = work done ÷ time = energy transferred ÷ time (watts, W). Efficiency = useful energy output ÷ total energy input (× 100 for %). Wasted energy is usually dissipated as heat. Reducing energy waste: insulation (cavity wall, loft), double glazing, draught-proofing.` },

  // Waves
  { subject: 'Science', year_group: 'year-10', chunk_text: `Waves: transverse waves — oscillation is perpendicular to direction of travel (light, water waves). Longitudinal waves — oscillation is parallel to direction of travel (sound). Key quantities: amplitude (maximum displacement from equilibrium), wavelength (distance between successive crests/troughs), frequency (waves per second, Hz), period (time for one complete wave = 1/f). Wave speed = frequency × wavelength (v = fλ). Electromagnetic spectrum (in order of increasing frequency): radio, microwave, infrared, visible light, ultraviolet, X-rays, gamma rays. All EM waves travel at 3 × 10⁸ m/s in a vacuum. Refraction: waves change speed at a boundary → change direction. Total internal reflection: when angle of incidence > critical angle inside a denser medium.` },

  // ── Year 11 ──────────────────────────────────────────────────────────────

  // Bioenergetics
  { subject: 'Science', year_group: 'year-11', chunk_text: `Photosynthesis: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ (requires light energy). Takes place in chloroplasts. Factors limiting photosynthesis: light intensity, CO₂ concentration, temperature. Increasing any limiting factor increases rate until another factor becomes limiting. Aerobic respiration: C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + energy; releases energy for life processes; takes place in mitochondria. Anaerobic respiration (in animals): glucose → lactic acid; occurs during vigorous exercise when oxygen is insufficient; creates oxygen debt. Anaerobic in yeast (fermentation): glucose → ethanol + CO₂. Anaerobic produces less ATP than aerobic respiration.` },

  // Homeostasis and Response
  { subject: 'Science', year_group: 'year-11', chunk_text: `Homeostasis: maintaining a stable internal environment. Conditions regulated: blood glucose concentration, body temperature (37°C), water and ion content. Negative feedback: when a change from the set point triggers a response that reverses the change. Blood glucose control: after eating, glucose rises → pancreas secretes insulin → cells take up glucose → blood glucose falls. If blood glucose falls too low → glucagon released → glycogen converted back to glucose (glycogenolysis). Type 1 diabetes: pancreas cannot produce insulin; treated with insulin injections. Type 2 diabetes: cells don't respond to insulin; treated with diet, exercise, medication. Thermoregulation: if too hot → vasodilation, sweating; if too cold → vasoconstriction, shivering.` },

  // Inheritance, Variation and Evolution
  { subject: 'Science', year_group: 'year-11', chunk_text: `Inheritance: DNA is found in the nucleus in chromosomes. Humans have 23 pairs of chromosomes (46 total). A gene is a section of DNA that codes for a protein. Alleles are different versions of the same gene. Dominant allele: expressed if one copy present. Recessive allele: only expressed if two copies present. Genotype: genetic make-up (e.g. Bb). Phenotype: physical characteristic. Homozygous: both alleles identical (BB or bb). Heterozygous: different alleles (Bb). Punnett square: used to predict offspring ratios. Sex determination: females XX, males XY. Cystic fibrosis: recessive; caused by mutation in CFTR gene. Polydactyly: dominant allele. Genetic testing can identify alleles in embryos.` },
  { subject: 'Science', year_group: 'year-11', chunk_text: `Evolution: Darwin's theory of natural selection: (1) variation exists in a population; (2) some variations are heritable; (3) more offspring are produced than can survive (competition for resources); (4) individuals with favourable variations are more likely to survive and reproduce ('survival of the fittest'); (5) favourable alleles increase in frequency over generations. Evidence for evolution: fossil record, comparative anatomy, DNA sequencing. Antibiotic resistance: mutation in bacteria creates resistant individuals; antibiotics kill non-resistant bacteria; resistant bacteria survive and reproduce — illustration of natural selection. Speciation: when populations become so different they can no longer interbreed. Extinction occurs when no individuals survive.` },

  // Ecology
  { subject: 'Science', year_group: 'year-11', chunk_text: `Ecology: a habitat is where an organism lives; a population is all organisms of the same species in an area; a community is all the populations in a habitat; an ecosystem includes all biotic (living) and abiotic (non-living) factors. Food chains show feeding relationships: producer → primary consumer → secondary consumer → tertiary consumer. Biomass is lost at each trophic level (only ~10% is transferred). Decomposers (bacteria, fungi) break down dead matter and recycle nutrients. The carbon cycle: carbon is fixed by photosynthesis, returned by respiration, combustion, and decomposition. The water cycle: evaporation, condensation, precipitation, transpiration. Biodiversity: variety of species; threatened by habitat destruction, pollution, invasive species.` },

  // Chemical Changes and Electrolysis
  { subject: 'Science', year_group: 'year-11', chunk_text: `Chemical changes: acid + base → salt + water (neutralisation). Acid + metal → salt + hydrogen. Acid + carbonate → salt + water + carbon dioxide. pH scale 0–14: below 7 = acidic; 7 = neutral; above 7 = alkaline. Strong acids fully ionise (HCl, H₂SO₄, HNO₃); weak acids partially ionise (ethanoic acid). Oxidation is loss of electrons (OIL); reduction is gain of electrons (RIG) — OIL RIG. Reactivity series: potassium > sodium > lithium > calcium > magnesium > aluminium > zinc > iron > lead > copper > silver > gold. More reactive metals displace less reactive metals from solutions. Electrolysis: passing electric current through a molten or dissolved ionic compound to decompose it. At cathode (negative): cations gain electrons (reduced). At anode (positive): anions lose electrons (oxidised).` },

  // Energy Changes in Chemistry
  { subject: 'Science', year_group: 'year-11', chunk_text: `Energy changes in chemical reactions: exothermic reactions release energy to surroundings — temperature increases — products have less energy than reactants. Examples: combustion, neutralisation, oxidation. Endothermic reactions absorb energy from surroundings — temperature decreases. Examples: thermal decomposition, photosynthesis. Bond breaking is endothermic (requires energy). Bond forming is exothermic (releases energy). Overall reaction is exothermic if more energy released forming bonds than breaking bonds, endothermic if the reverse. Energy = (bonds broken) − (bonds formed) using bond energies. Activation energy: minimum energy needed to start a reaction. Catalysts lower activation energy — increase reaction rate without being consumed.` },

  // Electricity
  { subject: 'Science', year_group: 'year-11', chunk_text: `Electricity: current (I) = charge (Q) ÷ time (t); unit = amperes (A). Voltage/potential difference (V) = energy (J) ÷ charge (C); unit = volts (V). Resistance (R) in ohms (Ω). Ohm's Law: V = IR (for ohmic conductors). Series circuits: same current throughout; voltages add up; total resistance = R₁ + R₂. Parallel circuits: current splits; voltage same across each branch; 1/R_total = 1/R₁ + 1/R₂. Power: P = IV = I²R = V²/R (watts, W). Energy = power × time = VIt. Mains electricity: 230 V AC at 50 Hz. Three-core cable: live (brown), neutral (blue), earth (green/yellow). Fuse and earth protect against surges. Static electricity: build-up of charge on insulating surfaces; opposite charges attract.` },

  // Magnetism and Electromagnetism
  { subject: 'Science', year_group: 'year-11', chunk_text: `Magnetism: like poles repel, unlike poles attract. Permanent magnets produce their own magnetic field; induced magnets are only magnetic when in a magnetic field. Magnetic field lines go from north to south; closer together = stronger field. Electromagnetism: a current-carrying wire creates a circular magnetic field around it. A solenoid (coil of wire) behaves like a bar magnet when current flows. Increasing current or adding an iron core strengthens the magnet (electromagnet). Fleming's Left-Hand Rule: thumb = force (thrust/motion), index = field (north to south), middle = conventional current. Electric motors use this principle. Generators: when a conductor moves through a magnetic field (or field changes), an EMF is induced — the generator effect. Transformers: step-up (more turns in secondary coil = higher voltage, lower current); step-down (fewer turns = lower voltage, higher current). V_p/V_s = n_p/n_s.` },

  // Space Physics
  { subject: 'Science', year_group: 'year-11', chunk_text: `Space physics: our solar system consists of the Sun, eight planets, dwarf planets, moons, asteroids, and comets. Planets orbit the Sun due to gravitational attraction. Light year = distance light travels in one year ≈ 9.46 × 10¹⁵ m. The Sun is a main sequence star powered by nuclear fusion (hydrogen → helium). Life cycle of a star: nebula → protostar → main sequence star → (small star: red giant → white dwarf → black dwarf; large star: red supergiant → supernova → neutron star or black hole). Our galaxy is the Milky Way. The universe contains billions of galaxies. Red-shift: light from distant galaxies is shifted towards the red end of the spectrum — indicates the universe is expanding. The Big Bang theory explains the origin of the universe from a single point of extremely high density.` },
]

async function main() {
  console.log(`Seeding Year 10 & 11 Science curriculum chunks (${CHUNKS.length} chunks)...\n`)

  let inserted = 0
  let skipped = 0

  for (const chunk of CHUNKS) {
    const key = chunk.chunk_text.slice(0, 120)
    const existing = await prisma.curriculumChunk.findFirst({
      where: {
        subject: chunk.subject,
        year_group: chunk.year_group,
        chunk_text: { startsWith: key },
      },
      select: { id: true },
    })

    if (existing) {
      skipped++
      continue
    }

    await prisma.curriculumChunk.create({
      data: {
        subject: chunk.subject,
        year_group: chunk.year_group,
        source_name: SOURCE,
        chunk_text: chunk.chunk_text,
      },
    })
    inserted++
  }

  console.log(`Done. Inserted: ${inserted}, Skipped (already exist): ${skipped}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
