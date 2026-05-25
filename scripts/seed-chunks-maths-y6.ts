/**
 * Seed curriculum_chunks for Year 6 Maths (KS2).
 *
 * These chunks form the RAG knowledge base for Stage 1 of the content pipeline.
 * Text is derived from NC 2014 Maths KS2 Year 6 statutory programme of study.
 *
 * Idempotent: skips existing chunks.
 * NOTE: After seeding, run embed_chunks.py on the DO droplet.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-chunks-maths-y6.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUBJECT = 'Maths'
const YEAR_GROUP = 'year-6'
const SOURCE = 'NC 2014 Maths KS2 Year 6 Programme of Study'

const CHUNKS: string[] = [
  // Place value and rounding
  `Year 6 pupils read, write, order, and compare numbers up to 10,000,000 (ten million) and determine the value of each digit. In the number 4,305,712: 4 is 4 millions, 3 is 3 hundred-thousands, 0 is 0 ten-thousands, 5 is 5 thousands, 7 is 7 hundreds, 1 is 1 ten, 2 is 2 ones. Pupils round any whole number to a required degree of accuracy: rounding 3,847,261 to the nearest million gives 4,000,000; to the nearest hundred thousand gives 3,800,000. They also work with negative numbers in context — e.g. temperatures below zero, sea levels — and calculate intervals across zero (e.g. from −8°C to 5°C is a rise of 13°C).`,

  `Rounding decimals in Year 6: Pupils round decimals with up to 3 decimal places to the nearest whole number, 1 decimal place, or 2 decimal places. The rule: look at the digit immediately to the right of the rounding position. If it is 5 or more, round up; if it is 4 or less, round down. Examples: 4.736 rounded to 1 d.p. = 4.7 (look at the 3 in the hundredths place); 4.736 rounded to 2 d.p. = 4.74 (look at the 6 in the thousandths place). Pupils also order and compare numbers including decimals to 3 d.p. and use negative numbers in context.`,

  // Fractions
  `Simplifying fractions: A fraction is in its simplest form (lowest terms) when the numerator and denominator share no common factor other than 1. To simplify, divide both numerator and denominator by their highest common factor (HCF). Example: 18/24 — HCF of 18 and 24 is 6 — so 18÷6 = 3, 24÷6 = 4, giving 3/4. To find the HCF, list factors of each number and pick the largest shared one. Equivalent fractions represent the same value: 1/2 = 2/4 = 3/6 = 50/100. Pupils also compare and order fractions by finding a common denominator.`,

  `Adding and subtracting fractions with different denominators: Find the lowest common multiple (LCM) of the two denominators to create a common denominator. Then convert each fraction and add or subtract the numerators. Example: 3/4 + 1/6. LCM of 4 and 6 is 12. Convert: 3/4 = 9/12; 1/6 = 2/12. So 9/12 + 2/12 = 11/12. For mixed numbers, add the whole-number parts and fraction parts separately, then simplify. Example: 2¾ + 1⅓ = (2+1) + (3/4+1/3) = 3 + (9/12+4/12) = 3 + 13/12 = 3 + 1 1/12 = 4 1/12.`,

  `Multiplying fractions in Year 6: To multiply two fractions, multiply numerators together and denominators together. Example: 2/3 × 3/4 = (2×3)/(3×4) = 6/12 = 1/2. Simplify before multiplying if possible (cross-cancelling): 2/3 × 3/4 — the 3 in the numerator of the second fraction cancels with the 3 in the denominator of the first, giving 2/1 × 1/4 = 2/4 = 1/2. Multiplying a fraction by a whole number: 3/5 × 4 = 12/5 = 2 2/5. Multiplying fractions always gives a product smaller than either factor (when both are proper fractions).`,

  `Dividing fractions in Year 6: To divide by a fraction, multiply by its reciprocal (flip the fraction). The reciprocal of a/b is b/a. Example: 3/4 ÷ 1/2 = 3/4 × 2/1 = 6/4 = 3/2 = 1½. Example: 5 ÷ 1/3 = 5 × 3/1 = 15. Fractions, decimals and percentages are equivalent representations of the same value. Key equivalents: 1/2 = 0.5 = 50%; 1/4 = 0.25 = 25%; 3/4 = 0.75 = 75%; 1/5 = 0.2 = 20%; 1/10 = 0.1 = 10%; 1/100 = 0.01 = 1%. To convert a fraction to a decimal, divide the numerator by the denominator. To convert a decimal to a percentage, multiply by 100.`,

  `Percentages in Year 6: A percentage is a fraction out of 100. To find a percentage of an amount: method 1 — convert to a decimal and multiply (35% of 240 = 0.35 × 240 = 84). Method 2 — use 10% as a building block (10% of 240 = 24; 30% = 72; 5% = 12; so 35% = 72+12 = 84). To find the percentage that one number is of another: (part ÷ whole) × 100 = percentage. Example: 36 out of 90 as a percentage = (36/90) × 100 = 40%. Percentage increase/decrease problems: if a price of £80 increases by 15%, the increase is £12, new price = £92.`,

  // Algebra
  `Algebra in Year 6: Letters (called variables or unknowns) are used to represent unknown numbers. An expression is a mathematical phrase containing numbers, variables, and operations, but no equals sign: 3n + 4, 2a − 7, x². An equation has an equals sign and can be solved: 3n + 4 = 19. To solve: 3n = 19 − 4 = 15, so n = 5. Pupils use inverse operations to solve one-step and two-step linear equations. They also learn to substitute values into expressions: if a = 3 and b = 5, then 2a + b = 2(3) + 5 = 6 + 5 = 11.`,

  `Sequences and patterns in Year 6 algebra: A sequence is a list of numbers that follow a rule. An arithmetic sequence increases or decreases by the same amount each time (the common difference). Example: 4, 9, 14, 19, 24 — common difference is 5. The nth term formula: the nth term = first term + (n−1) × common difference = 4 + (n−1)×5 = 5n − 1. Pupils generate sequences from formulae and describe the rule. They also work with linear functions: if y = 2x + 3, substituting x = 1 gives y = 5; x = 2 gives y = 7; x = 3 gives y = 9. Pupils express missing number problems algebraically.`,

  // Ratio and proportion
  `Ratio in Year 6: A ratio compares two or more quantities. The ratio 3:5 means for every 3 of one quantity there are 5 of another. Ratios can be simplified like fractions — divide both parts by their HCF: 12:18 simplifies to 2:3 (÷6). Unequal sharing: to share £40 in the ratio 3:5, the total number of parts is 8; each part = £40 ÷ 8 = £5; so the shares are £15 and £25. Scale: a map at 1:50,000 means 1 cm on the map = 50,000 cm (500 m) in real life. To find a real distance: multiply the map distance by the scale factor.`,

  `Proportion and percentage problems in Year 6: A proportion compares a part to a whole. If 3 out of every 8 students walk to school, the proportion walking is 3/8. Pupils solve problems such as: "A recipe for 4 people uses 300 g of flour. How much for 6 people?" Scale the amount: 300 ÷ 4 × 6 = 450 g. Direct proportion: as one quantity increases, the other increases at the same rate. If 5 pencils cost £1.25, then 1 pencil costs 25p, so 8 pencils cost £2.00. Percentages are a form of proportion: expressing a fraction as a number of parts per hundred.`,

  // Geometry
  `Angles at Year 6: Angles on a straight line add up to 180°. Angles at a point (around a full turn) add up to 360°. Angles in a triangle always add up to 180°. Angles in a quadrilateral always add up to 360°. Vertically opposite angles (formed when two straight lines cross) are equal. An acute angle is less than 90°. A right angle is exactly 90°. An obtuse angle is between 90° and 180°. A reflex angle is more than 180°. Pupils calculate missing angles using these rules, including in multi-step problems combining several properties.`,

  `Properties of 2D shapes at Year 6: Regular polygons have all sides equal and all angles equal. A regular hexagon has 6 equal sides and 6 angles of 120° each. Types of triangle: equilateral (3 equal sides, 3 angles of 60°), isosceles (2 equal sides, 2 equal base angles), scalene (no equal sides or angles), right-angled (one 90° angle). Circles: radius is the distance from the centre to the circumference; diameter passes through the centre and equals 2 × radius; circumference is the perimeter of a circle (= π × diameter). Pupils also recognise and use properties of parallelograms, rhombuses, and trapezoids.`,

  `Coordinates and transformations at Year 6: Coordinates are written as (x, y) — the x value comes first (horizontal), then y (vertical). In all four quadrants: top-right (+,+), top-left (−,+), bottom-left (−,−), bottom-right (+,−). Example: (−3, 4) is 3 left and 4 up from the origin. Reflection: a shape reflected in the y-axis has its x coordinates negated; reflected in the x-axis has its y coordinates negated. Translation: a shape is moved without rotating — describe as "3 right and 2 down" or as a vector (3, −2). Pupils draw and describe reflections and translations using coordinates.`,

  // Statistics
  `Mean, median, mode, and range in Year 6: Mean (average) = sum of all values ÷ number of values. Example: scores 4, 7, 7, 9, 13 → sum = 40 → mean = 40 ÷ 5 = 8. Median = the middle value when data is ordered; if there is an even number of values, the median is the mean of the two middle values. Mode = the value that appears most often (there can be more than one mode, or none). Range = largest value − smallest value (a measure of spread, not average). For 4, 7, 7, 9, 13: range = 13 − 4 = 9; mode = 7; median = 7; mean = 8.`,

  `Pie charts in Year 6: A pie chart shows data as proportional slices of a circle. The full circle = 360°. Each sector's angle = (frequency ÷ total) × 360°. Example: if 15 out of 60 students prefer football, the sector angle = (15/60) × 360° = 90°. To read a pie chart: identify the angle of the sector, then calculate the frequency as (angle/360) × total. Pupils also construct and interpret line graphs showing continuous change over time (e.g. temperature throughout the day), reading values between plotted points and describing trends (increasing, decreasing, stable).`,

  `Timetables, tables, and two-way tables in Year 6: Pupils read and interpret data presented in tables, timetables, and two-way tables. A two-way table records two variables simultaneously — e.g. gender vs. preferred sport. To read: identify the row and column that intersect at the required value. Pupils calculate totals for rows and columns, find missing values, and draw conclusions. They also solve problems involving conversion graphs (e.g. miles to kilometres), recognising direct proportion (a straight line through the origin). Distance-time graphs: steeper gradient = faster speed; horizontal section = stationary.`,
]

async function main() {
  console.log('Seeding Year 6 Maths curriculum chunks...\n')

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
