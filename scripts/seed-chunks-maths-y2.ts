/**
 * Seed curriculum_chunks for Year 2 Maths (KS1).
 *
 * These chunks form the RAG knowledge base for Stage 1 of the content pipeline.
 * Text is derived from NC 2014 Maths KS1 Year 2 statutory programme of study.
 *
 * Idempotent: skips existing chunks.
 * NOTE: After seeding, run embed_chunks.py on the DO droplet.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-chunks-maths-y2.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUBJECT = 'Maths'
const YEAR_GROUP = 'year-2'
const SOURCE = 'NC 2014 Maths KS1 Year 2 Programme of Study'

const CHUNKS: string[] = [
  // Place value
  `Year 2 pupils learn to count to 100 and understand place value of two-digit numbers. A two-digit number has a tens digit and a ones (units) digit. For example, 47 has 4 tens (= 40) and 7 ones (= 7). So 47 = 40 + 7. Pupils use tens and ones blocks (Dienes blocks) to represent numbers. They learn to compare numbers using < (less than), > (greater than), and = (equal to). For example: 53 > 49 because 53 has more tens.`,

  `Ordering and estimating numbers to 100: Pupils learn to order a set of numbers from smallest to largest (ascending) or from largest to smallest (descending). A number line from 0 to 100 helps pupils see where numbers are positioned. Rounding to the nearest 10: a number ending in 1–4 rounds down; 5–9 rounds up. For example, 43 rounds down to 40; 47 rounds up to 50.`,

  // Addition and subtraction
  `Year 2 addition strategies: Pupils can add two-digit numbers using: (1) Number bonds — pairs that add to 10 or 20 (e.g. 7+3=10, 14+6=20). (2) Counting on — start at the larger number and count on. (3) Partitioning — split numbers into tens and ones, add each part, then combine: 34 + 25 = (30+20) + (4+5) = 50 + 9 = 59. (4) Column addition — write numbers in columns, adding ones first then tens. Pupils also learn that addition is commutative: 6 + 9 = 9 + 6.`,

  `Year 2 subtraction strategies: Pupils can subtract using: (1) Counting back on a number line. (2) Finding the difference — counting up from the smaller number to the larger. (3) Inverse operations — if 15 + 8 = 23, then 23 − 8 = 15. Subtraction is the inverse (opposite) of addition. (4) Partitioning — 76 − 34: subtract tens first (70−30=40), then ones (6−4=2), total = 42. Pupils solve word problems involving addition and subtraction.`,

  `Number bonds to 20 and 100: Pupils must know all number bonds to 20 by heart: pairs that add to make 20 (e.g. 3+17, 8+12, 15+5). They also learn complements to 100 — pairs of multiples of 10 that add to 100: 10+90, 20+80, 30+70, 40+60, 50+50. Knowing number bonds helps with mental arithmetic and checking answers. If 7+3=10, then 17+3=20, and 70+30=100.`,

  // Multiplication and division
  `The 2 times table: 1×2=2, 2×2=4, 3×2=6, 4×2=8, 5×2=10, 6×2=12, 7×2=14, 8×2=16, 9×2=18, 10×2=20, 11×2=22, 12×2=24. Multiples of 2 are always even numbers. To count in 2s: 2, 4, 6, 8, 10, 12... Multiplication by 2 is the same as doubling. Division by 2 is the same as halving. Year 2 pupils also need to know the 5 and 10 times tables.`,

  `The 5 times table: 1×5=5, 2×5=10, 3×5=15, 4×5=20, 5×5=25, 6×5=30, 7×5=35, 8×5=40, 9×5=45, 10×5=50, 11×5=55, 12×5=60. Multiples of 5 always end in 0 or 5. To count in 5s: 5, 10, 15, 20, 25, 30... The 10 times table: multiples of 10 always end in 0. 1×10=10, 2×10=20, 3×10=30... Multiplication is repeated addition: 3×5 = 5+5+5 = 15.`,

  `Division and sharing: Division means splitting a number into equal groups. 12 ÷ 3 = 4 means 12 shared equally between 3 groups = 4 in each group. Division is the inverse of multiplication: if 4 × 5 = 20, then 20 ÷ 5 = 4 and 20 ÷ 4 = 5. Division by 2 = halving. Division by 10 moves the digit one place to the right. Year 2 pupils solve division problems using objects, arrays, and number lines.`,

  // Fractions
  `Fractions in Year 2: A fraction is part of a whole. The denominator (bottom number) shows how many equal parts the whole is divided into. The numerator (top number) shows how many parts are being described. One half (1/2): split into 2 equal parts, one part taken. One quarter (1/4): split into 4 equal parts, one part taken. Three quarters (3/4): split into 4 equal parts, three parts taken. One third (1/3): split into 3 equal parts, one part taken.`,

  `Finding fractions of amounts: To find 1/2 of an amount, divide by 2. To find 1/4 of an amount, divide by 4. To find 3/4 of an amount, find 1/4 first then multiply by 3. Examples: 1/2 of 20 = 10; 1/4 of 20 = 5; 3/4 of 20 = 15. Pupils also recognise fractions on a number line: 1/2 is halfway between 0 and 1. Equivalent fractions: 2/4 = 1/2 (same size piece, just cut into more sections).`,

  // Measurement
  `Measuring length in Year 2: Length can be measured in centimetres (cm) and metres (m). 100 centimetres = 1 metre (100 cm = 1 m). A ruler measures in centimetres. Measure from 0, not the end of the ruler. Compare lengths using < and >. Pupils measure objects and order them by length. Perimeter = the total distance around the outside of a shape; add all sides together.`,

  `Measuring mass (weight) and capacity in Year 2: Mass is measured in grams (g) and kilograms (kg). 1000 grams = 1 kilogram. Capacity (how much a container holds) is measured in millilitres (ml) and litres (l). 1000 millilitres = 1 litre. Temperature is measured in degrees Celsius (°C) using a thermometer. Water freezes at 0°C and boils at 100°C. Body temperature is about 37°C.`,

  // Geometry
  `2D shapes (flat shapes) in Year 2: Triangle — 3 sides, 3 corners (vertices). Quadrilateral — 4 sides, 4 corners. Types of quadrilateral: square (4 equal sides, 4 right angles), rectangle (2 pairs of equal sides, 4 right angles), rhombus (4 equal sides), parallelogram, trapezium. Pentagon — 5 sides. Hexagon — 6 sides. Octagon — 8 sides. Circle — no sides, no corners, all points the same distance from the centre.`,

  `3D shapes (solid shapes) in Year 2: Cube — 6 square faces, 8 vertices, 12 edges. Cuboid — 6 rectangular faces (at least one pair), 8 vertices, 12 edges. Sphere — 1 curved surface, no flat faces, no edges, no vertices. Cylinder — 2 circular flat faces, 1 curved surface, 2 edges. Cone — 1 circular flat face, 1 curved surface, 1 vertex. Pyramid — a base shape with triangular faces meeting at a point.`,
]

async function main() {
  console.log('Seeding Year 2 Maths curriculum chunks...\n')

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
