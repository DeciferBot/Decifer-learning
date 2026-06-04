/**
 * Seed curriculum_chunks for Year 10 and Year 11 Maths (KS4/GCSE).
 *
 * Covers all 22 topics seeded for Y10/Y11.
 * Text derived from AQA/Edexcel GCSE Maths specification and NC KS4 programme of study.
 *
 * Idempotent: skips existing chunks (matched on subject + year_group + first 120 chars).
 * After seeding, run embed_chunks.py on the DO droplet.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-chunks-maths-y10-y11.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SOURCE = 'AQA/Edexcel GCSE Maths Specification + NC KS4'

const CHUNKS: Array<{ subject: string; year_group: string; chunk_text: string }> = [
  // ── Year 10 ──────────────────────────────────────────────────────────────

  // Indices and Standard Form
  { subject: 'Maths', year_group: 'year-10', chunk_text: `Indices (powers): aⁿ means a multiplied by itself n times. Index laws: aᵐ × aⁿ = aᵐ⁺ⁿ; aᵐ ÷ aⁿ = aᵐ⁻ⁿ; (aᵐ)ⁿ = aᵐⁿ. Zero index: a⁰ = 1 for any non-zero a. Negative indices: a⁻ⁿ = 1/aⁿ. Fractional indices: a^(1/n) = ⁿ√a (nth root); a^(m/n) = (ⁿ√a)ᵐ. Examples: 2³ = 8; 4^(1/2) = 2; 8^(2/3) = (∛8)² = 4; 3⁻² = 1/9.` },
  { subject: 'Maths', year_group: 'year-10', chunk_text: `Standard form (scientific notation): A number written as A × 10ⁿ where 1 ≤ A < 10 and n is an integer. Converting: 4 700 000 = 4.7 × 10⁶; 0.000 032 = 3.2 × 10⁻⁵. Multiplying in standard form: (A × 10ᵐ) × (B × 10ⁿ) = (A × B) × 10ᵐ⁺ⁿ. Dividing: (A × 10ᵐ) ÷ (B × 10ⁿ) = (A/B) × 10ᵐ⁻ⁿ. Adding/subtracting: convert to same power of 10 first. Example: (3 × 10⁴) + (2 × 10³) = 30000 + 2000 = 32000 = 3.2 × 10⁴.` },

  // Fractions, Decimals and Percentages
  { subject: 'Maths', year_group: 'year-10', chunk_text: `Fractions, decimals and percentages (FDP): Convert fraction to decimal by dividing numerator by denominator. Convert decimal to percentage by multiplying by 100. Convert percentage to fraction by dividing by 100 and simplifying. Examples: 3/8 = 0.375 = 37.5%; 0.64 = 64% = 16/25. Recurring decimals: 1/3 = 0.333... = 0.3̄; 1/7 = 0.142857142857... Converting recurring decimal to fraction: let x = 0.36363...; 100x = 36.363...; 99x = 36; x = 36/99 = 4/11.` },
  { subject: 'Maths', year_group: 'year-10', chunk_text: `Percentage calculations at GCSE: Percentage of an amount: 35% of 240 = 0.35 × 240 = 84. Percentage change = (change ÷ original) × 100. Reverse percentage: if a price after 20% increase is £60, original = 60 ÷ 1.20 = £50. Compound interest: A = P(1 + r/100)ⁿ where P = principal, r = rate, n = years. Depreciation uses (1 − r/100)ⁿ. Example: £2000 at 5% compound interest for 3 years = 2000 × 1.05³ = £2315.25.` },

  // Ratio and Proportion
  { subject: 'Maths', year_group: 'year-10', chunk_text: `Ratio and proportion: A ratio compares quantities of the same type. Simplify by dividing by the HCF. To share in a ratio: find total parts, then multiply each share. Example: share £120 in ratio 3:5: total parts = 8; each part = £15; shares are £45 and £75. Direct proportion: y = kx (y doubles when x doubles). Inverse proportion: y = k/x (y halves when x doubles). Unitary method: find value of one unit first. Scale factor between similar shapes: if SF = k, areas scale by k², volumes by k³.` },

  // Expanding and Factorising
  { subject: 'Maths', year_group: 'year-10', chunk_text: `Expanding brackets: a(b + c) = ab + ac. Double brackets: (x + 3)(x − 5) = x² − 5x + 3x − 15 = x² − 2x − 15 (FOIL: First, Outer, Inner, Last). Perfect square: (x + a)² = x² + 2ax + a². Difference of two squares: (x + a)(x − a) = x² − a². Factorising: identify HCF, then factor it out: 6x² + 9x = 3x(2x + 3). Factorising quadratics x² + bx + c: find two numbers that multiply to c and add to b. Example: x² + 5x + 6 = (x + 2)(x + 3).` },
  { subject: 'Maths', year_group: 'year-10', chunk_text: `Factorising harder quadratics ax² + bx + c: use 'ac method'. Example: 6x² + 11x + 3: ac = 18; find factors of 18 that add to 11 → 9 and 2; split: 6x² + 9x + 2x + 3 = 3x(2x + 3) + 1(2x + 3) = (3x + 1)(2x + 3). Difference of two squares: x² − 16 = (x + 4)(x − 4); 9x² − 25 = (3x + 5)(3x − 5). Completing the square: x² + bx = (x + b/2)² − (b/2)². Example: x² + 6x + 2 = (x + 3)² − 7.` },

  // Solving Equations and Inequalities
  { subject: 'Maths', year_group: 'year-10', chunk_text: `Solving linear equations: use inverse operations to isolate x. Example: 3x − 7 = 14 → 3x = 21 → x = 7. Equations with fractions: multiply through by LCM. Equations with brackets: expand first. Forming equations from context. Inequalities: x > 3 (open circle on number line), x ≤ 5 (closed circle). Solving: same as equations but flip inequality sign when multiplying/dividing by a negative. Represent solution on number line or as set notation. Integer solutions: if −2 < x ≤ 5 then integers are −1, 0, 1, 2, 3, 4, 5.` },

  // Sequences and nth Term
  { subject: 'Maths', year_group: 'year-10', chunk_text: `Sequences: arithmetic (linear) sequence has a constant difference. nth term formula: nth term = a + (n − 1)d where a = first term, d = common difference. Example: 3, 7, 11, 15... → d = 4, a = 3 → nth term = 4n − 1. Geometric sequence: each term is multiplied by a constant ratio r. Example: 2, 6, 18, 54... → r = 3. Quadratic sequences: second differences are constant. Finding nth term for quadratic: start with n² and adjust. Fibonacci-type: each term = sum of two preceding terms.` },

  // Straight Line Graphs
  { subject: 'Maths', year_group: 'year-10', chunk_text: `Straight line graphs: equation y = mx + c where m = gradient, c = y-intercept. Gradient = rise ÷ run = (y₂ − y₁) ÷ (x₂ − x₁). Positive gradient slopes up left-to-right; negative slopes down. Parallel lines have equal gradients. Perpendicular lines: product of gradients = −1 (i.e. m₂ = −1/m₁). Finding equation from two points: find gradient first, then substitute one point. Midpoint of (x₁, y₁) and (x₂, y₂) = ((x₁+x₂)/2, (y₁+y₂)/2). Distance = √[(x₂−x₁)² + (y₂−y₁)²].` },

  // Angles and Polygons
  { subject: 'Maths', year_group: 'year-10', chunk_text: `Angles in polygons: sum of interior angles of an n-sided polygon = (n − 2) × 180°. For a regular polygon, each interior angle = (n − 2) × 180° ÷ n. Each exterior angle of a regular polygon = 360° ÷ n. Interior + exterior angle = 180°. Sum of exterior angles of any polygon = 360°. Examples: equilateral triangle (n=3): each interior = 60°; square (n=4): 90°; regular hexagon (n=6): each interior = 120°. Angles on a straight line sum to 180°; around a point sum to 360°.` },

  // Pythagoras and Trigonometry
  { subject: 'Maths', year_group: 'year-10', chunk_text: `Pythagoras' theorem: in a right-angled triangle, a² + b² = c² where c is the hypotenuse (longest side, opposite the right angle). To find hypotenuse: c = √(a² + b²). To find a shorter side: a = √(c² − b²). GCSE trigonometry (SOH-CAH-TOA): sin θ = opposite/hypotenuse; cos θ = adjacent/hypotenuse; tan θ = opposite/adjacent. Finding a side: rearrange the ratio. Finding an angle: use inverse trig (sin⁻¹, cos⁻¹, tan⁻¹). Example: in a right triangle with hypotenuse 13 and one leg 5, the other leg = √(169 − 25) = 12.` },

  // Area, Perimeter and Volume
  { subject: 'Maths', year_group: 'year-10', chunk_text: `Area formulae: rectangle = l × w; triangle = ½bh; parallelogram = bh; trapezium = ½(a+b)h; circle = πr². Circumference = 2πr = πd. Sector area = (θ/360) × πr²; arc length = (θ/360) × 2πr. Volume formulae: cuboid = l × w × h; prism = cross-section area × length; cylinder = πr²h; cone = ⅓πr²h; sphere = ⁴⁄₃πr³; pyramid = ⅓ × base area × h. Surface area of cylinder = 2πr² + 2πrh; sphere = 4πr². Units: area in cm², m²; volume in cm³, m³.` },

  // Data, Averages and Spread
  { subject: 'Maths', year_group: 'year-10', chunk_text: `Averages and measures of spread: Mean = sum of values ÷ number of values. Median = middle value when ordered (or average of middle two). Mode = most frequent value. Range = max − min. Mean from frequency table: Σ(fx) ÷ Σf. Estimated mean from grouped data: use midpoints. Interquartile range (IQR) = upper quartile (Q3) − lower quartile (Q1). IQR measures spread of the middle 50% and is not affected by outliers. Comparing data sets: compare both average (mean/median) AND spread (range/IQR).` },

  // Basic Probability
  { subject: 'Maths', year_group: 'year-10', chunk_text: `Basic probability: P(event) = number of favourable outcomes ÷ total outcomes. Probability scale: 0 (impossible) to 1 (certain). P(A not happening) = 1 − P(A). Mutually exclusive events: P(A or B) = P(A) + P(B). Independent events: P(A and B) = P(A) × P(B). Relative frequency (experimental probability) = number of times event occurs ÷ total trials. Expected frequency = P(event) × number of trials. Tree diagrams: multiply along branches, add across branches. Sample space diagrams for combined events.` },

  // ── Year 11 ──────────────────────────────────────────────────────────────

  // Quadratic Equations
  { subject: 'Maths', year_group: 'year-11', chunk_text: `Solving quadratic equations: Method 1 — Factorising: if x² + 5x + 6 = 0 then (x + 2)(x + 3) = 0 so x = −2 or x = −3. Method 2 — Quadratic formula: x = [−b ± √(b² − 4ac)] ÷ 2a for ax² + bx + c = 0. The discriminant b² − 4ac: if > 0 → two real roots; = 0 → one repeated root; < 0 → no real roots. Method 3 — Completing the square: x² + 6x + 2 = 0 → (x + 3)² − 7 = 0 → x = −3 ± √7. Quadratic graphs are parabolas; roots are where the graph crosses the x-axis.` },

  // Simultaneous Equations
  { subject: 'Maths', year_group: 'year-11', chunk_text: `Simultaneous equations — two equations with two unknowns. Elimination method: make coefficients of one variable equal, then add/subtract. Substitution method: rearrange one equation and substitute into the other. Example by elimination: 2x + 3y = 12 and 4x − y = 5; multiply second by 3: 12x − 3y = 15; add: 14x = 27 → x = 27/14... Non-linear simultaneous equations: substitute the linear into the quadratic. Graphically: the solution is the point(s) of intersection.` },

  // Functions and Graph Transformations
  { subject: 'Maths', year_group: 'year-11', chunk_text: `Graph transformations: f(x) + a = translate up by a; f(x) − a = translate down; f(x + a) = translate left by a; f(x − a) = translate right; −f(x) = reflect in x-axis; f(−x) = reflect in y-axis; af(x) = stretch vertically by factor a; f(ax) = stretch horizontally by factor 1/a. Key graphs to know: y = x², y = x³, y = 1/x (reciprocal), y = √x, y = kˣ (exponential). Functions notation: f(x) = expression; composite f(g(x)) means apply g first then f; inverse f⁻¹(x) reverses the function.` },

  // Circle Theorems
  { subject: 'Maths', year_group: 'year-11', chunk_text: `Circle theorems: (1) Angle at centre = twice angle at circumference (same arc). (2) Angles in the same segment are equal. (3) Angle in a semicircle = 90° (angle in a semicircle is a right angle). (4) Opposite angles in a cyclic quadrilateral sum to 180°. (5) Tangent to a circle is perpendicular to the radius at the point of contact. (6) Tangents from an external point are equal in length. (7) Alternate segment theorem: angle between tangent and chord equals inscribed angle in the alternate segment. Always state the theorem used in proofs.` },

  // Vectors
  { subject: 'Maths', year_group: 'year-11', chunk_text: `Vectors: a vector has magnitude (size) and direction. Written as column vectors (x over y) or bold letters. Adding vectors: add components. AB⃗ = b − a where a and b are position vectors. Multiplying by scalar: 3a means same direction, three times as long. Parallel vectors: if b = ka then a and b are parallel. Magnitude of vector (x, y) = √(x² + y²). In geometry proofs: show a path using combinations of known vectors. Midpoint M of AB has position vector ½(a + b). Proving points are collinear: show vectors are scalar multiples.` },

  // Congruence and Similarity
  { subject: 'Maths', year_group: 'year-11', chunk_text: `Congruent shapes: identical size and shape. Congruence conditions for triangles: SSS (three sides), SAS (two sides and included angle), ASA or AAS (two angles and a side), RHS (right angle, hypotenuse, side). Similar shapes: same shape, different size; corresponding angles equal, corresponding sides in the same ratio. If scale factor is k: lengths scale by k, areas by k², volumes by k³. In similar triangles, identify corresponding vertices. To prove similarity, show equal angles or proportional sides.` },

  // Surds and Exact Values
  { subject: 'Maths', year_group: 'year-11', chunk_text: `Surds: a surd is an irrational root, e.g. √2, √3, √5. Simplifying: √12 = √(4×3) = 2√3. Adding/subtracting like surds: 3√2 + 5√2 = 8√2. Multiplying: √a × √b = √(ab); (√a)² = a. Expanding: (2 + √3)(4 − √3) = 8 − 2√3 + 4√3 − 3 = 5 + 2√3. Rationalising the denominator: multiply numerator and denominator by the surd. Example: 1/√2 = √2/2. For (a + √b) in denominator, multiply by (a − √b) — the conjugate. Exact values: sin 30° = ½, cos 60° = ½, tan 45° = 1, sin 45° = cos 45° = 1/√2, sin 60° = cos 30° = √3/2.` },

  // Sine and Cosine Rule
  { subject: 'Maths', year_group: 'year-11', chunk_text: `Sine rule: a/sin A = b/sin B = c/sin C (use when you have a side and its opposite angle, plus one other element). Cosine rule (finding side): a² = b² + c² − 2bc cos A (use when you have two sides and the included angle). Cosine rule (finding angle): cos A = (b² + c² − a²) ÷ 2bc. Area of any triangle = ½ab sin C. The ambiguous case: when using sine rule to find an angle, there may be two solutions (both θ and 180° − θ). Bearings: measured clockwise from north (0°–360°). Combine sine/cosine rule with bearings in navigation problems.` },

  // Cumulative Frequency and Box Plots
  { subject: 'Maths', year_group: 'year-11', chunk_text: `Cumulative frequency: running total of frequencies. Plot upper class boundary against cumulative frequency. From CF graph: estimate median (at 50% of total), lower quartile Q1 (at 25%), upper quartile Q3 (at 75%), IQR = Q3 − Q1. Box plots (box-and-whisker diagrams): show minimum, Q1, median, Q3, maximum. Outliers are plotted as separate points. Comparing box plots: compare medians (average) and IQRs (spread/consistency). Histograms: frequency density = frequency ÷ class width; area of bar = frequency.` },

  // Conditional Probability
  { subject: 'Maths', year_group: 'year-11', chunk_text: `Conditional probability: P(A|B) means probability of A given B has occurred = P(A ∩ B) ÷ P(B). Venn diagrams: use to organise events with overlapping possibilities; ∩ means intersection (both), ∪ means union (either or both). Two-way tables: organise data by two categories; conditional probability reads off from one row or column. Tree diagrams for dependent events: probabilities on second branch depend on what happened on first. Example: drawing two balls without replacement — second draw probability depends on first. P(A and B) = P(A) × P(B|A) for dependent events.` },
]

async function main() {
  console.log(`Seeding Year 10 & 11 Maths curriculum chunks (${CHUNKS.length} chunks)...\n`)

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
