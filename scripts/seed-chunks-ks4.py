#!/usr/bin/env python3
"""
Seed curriculum_chunks for Year 10 and Year 11 (KS4/GCSE).
Covers Maths (22 topics), English (14 topics), Science (18 topics).

Uses psycopg2 directly with DIRECT_URL from .env.local.
Idempotent: skips chunks whose first 120 chars already exist for that subject+year_group.

Run on DO droplet:
  cd /root/decifer-learning
  python3 scripts/seed-chunks-ks4.py
"""

import os
import sys
import uuid
import re

import psycopg2
import psycopg2.extras

# ── Load DIRECT_URL from .env.local ──────────────────────────────────────────

def load_env(path='.env.local'):
    env = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                m = re.match(r'^([A-Z_]+)\s*=\s*"?(.+?)"?\s*$', line)
                if m:
                    env[m.group(1)] = m.group(2)
    except FileNotFoundError:
        pass
    return env

env = load_env()
DATABASE_URL = os.environ.get('DATABASE_URL') or env.get('DIRECT_URL') or env.get('DATABASE_URL')

if not DATABASE_URL:
    print('ERROR: No DATABASE_URL or DIRECT_URL found in environment or .env.local', file=sys.stderr)
    sys.exit(1)

SOURCE_MATHS   = 'AQA/Edexcel GCSE Maths Specification + NC KS4'
SOURCE_ENGLISH = 'AQA GCSE English Language and Literature Specification'
SOURCE_SCIENCE = 'AQA GCSE Science Specification (Biology, Chemistry, Physics)'

CHUNKS = [
    # ── MATHS Y10 ──────────────────────────────────────────────────────────
    ('Maths', 'year-10', SOURCE_MATHS,
     'Indices (powers): aⁿ means a multiplied by itself n times. Index laws: aᵐ × aⁿ = aᵐ⁺ⁿ; aᵐ ÷ aⁿ = aᵐ⁻ⁿ; (aᵐ)ⁿ = aᵐⁿ. Zero index: a⁰ = 1 for any non-zero a. Negative indices: a⁻ⁿ = 1/aⁿ. Fractional indices: a^(1/n) = ⁿ√a (nth root); a^(m/n) = (ⁿ√a)ᵐ. Examples: 2³ = 8; 4^(1/2) = 2; 8^(2/3) = (∛8)² = 4; 3⁻² = 1/9.'),

    ('Maths', 'year-10', SOURCE_MATHS,
     'Standard form (scientific notation): A number written as A × 10ⁿ where 1 ≤ A < 10 and n is an integer. Converting: 4 700 000 = 4.7 × 10⁶; 0.000 032 = 3.2 × 10⁻⁵. Multiplying in standard form: (A × 10ᵐ) × (B × 10ⁿ) = (A × B) × 10ᵐ⁺ⁿ. Dividing: (A × 10ᵐ) ÷ (B × 10ⁿ) = (A/B) × 10ᵐ⁻ⁿ. Adding/subtracting: convert to same power of 10 first. Example: (3 × 10⁴) + (2 × 10³) = 3.2 × 10⁴.'),

    ('Maths', 'year-10', SOURCE_MATHS,
     'Fractions, decimals and percentages (FDP): Convert fraction to decimal by dividing numerator by denominator. Convert decimal to percentage by multiplying by 100. Convert percentage to fraction by dividing by 100 and simplifying. Examples: 3/8 = 0.375 = 37.5%; 0.64 = 64% = 16/25. Recurring decimals: 1/3 = 0.333... = 0.3̄; 1/7 = 0.142857... Converting recurring decimal to fraction: let x = 0.363636...; 100x = 36.363636...; 99x = 36; x = 36/99 = 4/11.'),

    ('Maths', 'year-10', SOURCE_MATHS,
     'Percentage calculations at GCSE: Percentage of an amount: 35% of 240 = 0.35 × 240 = 84. Percentage change = (change ÷ original) × 100. Reverse percentage: if a price after 20% increase is £60, original = 60 ÷ 1.20 = £50. Compound interest: A = P(1 + r/100)ⁿ where P = principal, r = rate, n = years. Depreciation uses (1 − r/100)ⁿ. Example: £2000 at 5% compound interest for 3 years = 2000 × 1.05³ = £2315.25.'),

    ('Maths', 'year-10', SOURCE_MATHS,
     'Ratio and proportion: A ratio compares quantities of the same type. Simplify by dividing by the HCF. To share in a ratio: find total parts, then multiply each share. Example: share £120 in ratio 3:5: total parts = 8; each part = £15; shares are £45 and £75. Direct proportion: y = kx (y doubles when x doubles). Inverse proportion: y = k/x (y halves when x doubles). Unitary method: find value of one unit first. Scale factor between similar shapes: if SF = k, areas scale by k², volumes by k³.'),

    ('Maths', 'year-10', SOURCE_MATHS,
     'Expanding brackets: a(b + c) = ab + ac. Double brackets: (x + 3)(x − 5) = x² − 5x + 3x − 15 = x² − 2x − 15 (FOIL). Perfect square: (x + a)² = x² + 2ax + a². Difference of two squares: (x + a)(x − a) = x² − a². Factorising: identify HCF, then factor it out: 6x² + 9x = 3x(2x + 3). Factorising quadratics x² + bx + c: find two numbers that multiply to c and add to b. Example: x² + 5x + 6 = (x + 2)(x + 3).'),

    ('Maths', 'year-10', SOURCE_MATHS,
     'Factorising harder quadratics ax² + bx + c: use ac method. Example: 6x² + 11x + 3: ac = 18; factors of 18 summing to 11 are 9 and 2; split middle: 6x² + 9x + 2x + 3 = 3x(2x + 3) + 1(2x + 3) = (3x + 1)(2x + 3). Difference of two squares: x² − 16 = (x + 4)(x − 4); 9x² − 25 = (3x + 5)(3x − 5). Completing the square: x² + bx = (x + b/2)² − (b/2)². Example: x² + 6x + 2 = (x + 3)² − 7.'),

    ('Maths', 'year-10', SOURCE_MATHS,
     'Solving linear equations: use inverse operations to isolate x. Example: 3x − 7 = 14 → 3x = 21 → x = 7. Equations with fractions: multiply through by LCM. Inequalities: x > 3 (open circle on number line), x ≤ 5 (closed circle). Solving inequalities: same as equations but flip the inequality sign when multiplying or dividing by a negative number. Represent solution on number line or as a set. Integer solutions: if −2 < x ≤ 5, integers are −1, 0, 1, 2, 3, 4, 5.'),

    ('Maths', 'year-10', SOURCE_MATHS,
     'Sequences: arithmetic (linear) sequence has a constant difference. nth term formula: nth term = a + (n − 1)d where a = first term, d = common difference. Example: 3, 7, 11, 15... → d = 4, a = 3 → nth term = 4n − 1. Geometric sequence: each term is multiplied by a constant ratio r. Example: 2, 6, 18, 54... → r = 3. Quadratic sequences: second differences are constant. Fibonacci-type: each term equals the sum of the two preceding terms.'),

    ('Maths', 'year-10', SOURCE_MATHS,
     'Straight line graphs: equation y = mx + c where m = gradient, c = y-intercept. Gradient = rise ÷ run = (y₂ − y₁) ÷ (x₂ − x₁). Positive gradient slopes up left-to-right; negative slopes down. Parallel lines have equal gradients. Perpendicular lines: product of gradients = −1, so m₂ = −1/m₁. Finding equation from two points: find gradient first, then substitute a point. Midpoint of (x₁,y₁) and (x₂,y₂) = ((x₁+x₂)/2, (y₁+y₂)/2). Distance = √[(x₂−x₁)² + (y₂−y₁)²].'),

    ('Maths', 'year-10', SOURCE_MATHS,
     'Angles in polygons: sum of interior angles of an n-sided polygon = (n − 2) × 180°. For a regular polygon, each interior angle = (n − 2) × 180° ÷ n. Each exterior angle of a regular polygon = 360° ÷ n. Interior + exterior = 180°. Sum of exterior angles of any polygon = 360°. Examples: equilateral triangle interior = 60°; square = 90°; regular hexagon = 120°. Angles on a straight line sum to 180°; angles around a point sum to 360°.'),

    ('Maths', 'year-10', SOURCE_MATHS,
     "Pythagoras' theorem: in a right-angled triangle, a² + b² = c² where c is the hypotenuse. To find hypotenuse: c = √(a² + b²). To find a shorter side: a = √(c² − b²). GCSE trigonometry SOH-CAH-TOA: sin θ = opposite/hypotenuse; cos θ = adjacent/hypotenuse; tan θ = opposite/adjacent. Finding a side: rearrange the ratio. Finding an angle: use inverse trig (sin⁻¹, cos⁻¹, tan⁻¹). Example: right triangle with hypotenuse 13 and one leg 5; other leg = √(169 − 25) = 12."),

    ('Maths', 'year-10', SOURCE_MATHS,
     'Area formulae: rectangle = l × w; triangle = ½bh; parallelogram = bh; trapezium = ½(a+b)h; circle = πr². Circumference = 2πr = πd. Sector area = (θ/360) × πr²; arc length = (θ/360) × 2πr. Volume formulae: cuboid = l × w × h; prism = cross-section area × length; cylinder = πr²h; cone = ⅓πr²h; sphere = (4/3)πr³; pyramid = ⅓ × base area × h. Surface area of cylinder = 2πr² + 2πrh; sphere = 4πr². Units: area in cm² or m²; volume in cm³ or m³.'),

    ('Maths', 'year-10', SOURCE_MATHS,
     'Averages and measures of spread: Mean = sum of values ÷ number of values. Median = middle value when ordered. Mode = most frequent value. Range = max − min. Mean from frequency table: sum(fx) ÷ sum(f). Estimated mean from grouped data: use midpoints. Interquartile range (IQR) = upper quartile (Q3) − lower quartile (Q1). IQR measures spread of middle 50% and is not affected by outliers. Comparing data sets: compare average (mean/median) AND spread (range/IQR).'),

    ('Maths', 'year-10', SOURCE_MATHS,
     'Basic probability: P(event) = number of favourable outcomes ÷ total outcomes. Probability scale: 0 (impossible) to 1 (certain). P(A not happening) = 1 − P(A). Mutually exclusive events: P(A or B) = P(A) + P(B). Independent events: P(A and B) = P(A) × P(B). Relative frequency (experimental probability) = number of times event occurs ÷ total trials. Expected frequency = P(event) × number of trials. Tree diagrams: multiply along branches, add across branches. Sample space diagrams for combined events.'),

    # ── MATHS Y11 ──────────────────────────────────────────────────────────
    ('Maths', 'year-11', SOURCE_MATHS,
     'Solving quadratic equations: Method 1 — Factorising: x² + 5x + 6 = 0 → (x + 2)(x + 3) = 0 → x = −2 or −3. Method 2 — Quadratic formula: x = [−b ± √(b² − 4ac)] ÷ 2a. Discriminant b² − 4ac: >0 means two real roots; =0 means one repeated root; <0 means no real roots. Method 3 — Completing the square: x² + 6x + 2 = 0 → (x + 3)² − 7 = 0 → x = −3 ± √7. Quadratic graphs are parabolas; roots are where the graph crosses the x-axis.'),

    ('Maths', 'year-11', SOURCE_MATHS,
     'Simultaneous equations: two equations, two unknowns. Elimination: make coefficients equal, then add/subtract. Substitution: rearrange one equation and substitute into the other. Example: 2x + 3y = 12 and 4x − y = 5; multiply second by 3: 12x − 3y = 15; add: 14x = 27. Non-linear simultaneous equations: substitute the linear equation into the quadratic. Graphically: solution is the point(s) of intersection.'),

    ('Maths', 'year-11', SOURCE_MATHS,
     'Graph transformations: f(x) + a = translate up by a; f(x + a) = translate left by a; f(x − a) = translate right; −f(x) = reflect in x-axis; f(−x) = reflect in y-axis; af(x) = stretch vertically by scale factor a; f(ax) = stretch horizontally by scale factor 1/a. Key graphs: y = x², y = x³, y = 1/x (reciprocal), y = √x, y = kˣ (exponential). Composite functions: f(g(x)) means apply g first then f. Inverse functions: f⁻¹(x) reverses the function.'),

    ('Maths', 'year-11', SOURCE_MATHS,
     'Circle theorems: (1) Angle at centre = twice angle at circumference (same arc). (2) Angles in the same segment are equal. (3) Angle in a semicircle = 90°. (4) Opposite angles in a cyclic quadrilateral sum to 180°. (5) Tangent is perpendicular to radius at the point of contact. (6) Tangents from an external point are equal in length. (7) Alternate segment theorem: angle between tangent and chord equals the inscribed angle in the alternate segment. Always state the circle theorem used in proofs.'),

    ('Maths', 'year-11', SOURCE_MATHS,
     'Vectors: a vector has magnitude and direction. AB = b − a (position vectors). Adding vectors: add components. Multiplying by scalar changes magnitude not direction. Parallel vectors: b = ka means a and b are parallel. Magnitude of (x, y) = √(x² + y²). Midpoint M of AB has position vector ½(a + b). Proving collinearity: show vectors are scalar multiples of each other. In geometry proofs, express any path as a combination of known vectors.'),

    ('Maths', 'year-11', SOURCE_MATHS,
     'Congruent shapes: identical size and shape. Congruence conditions for triangles: SSS, SAS, ASA/AAS, RHS. Similar shapes: same shape, proportional sizes; corresponding angles equal, corresponding sides in the same ratio. Scale factor k: lengths scale by k, areas by k², volumes by k³. In similar triangles, identify corresponding vertices carefully. To prove similarity: show equal angles or proportional sides.'),

    ('Maths', 'year-11', SOURCE_MATHS,
     'Surds: irrational roots such as √2, √3, √5. Simplifying: √12 = 2√3. Adding like surds: 3√2 + 5√2 = 8√2. Multiplying: √a × √b = √(ab); (√a)² = a. Rationalising the denominator: multiply numerator and denominator by the surd. Example: 1/√2 = √2/2. For conjugate denominator (a + √b), multiply by (a − √b). Exact trig values: sin 30° = ½; cos 60° = ½; tan 45° = 1; sin 45° = cos 45° = 1/√2; sin 60° = cos 30° = √3/2.'),

    ('Maths', 'year-11', SOURCE_MATHS,
     'Sine rule: a/sin A = b/sin B = c/sin C. Use when you have a side and its opposite angle. Cosine rule (finding side): a² = b² + c² − 2bc cos A. Use with two sides and the included angle. Cosine rule (finding angle): cos A = (b² + c² − a²) ÷ 2bc. Area of any triangle = ½ab sin C. Ambiguous case: when using sine rule to find an angle, both θ and 180° − θ may be valid. Bearings: measured clockwise from north, three digits (e.g. 045°).'),

    ('Maths', 'year-11', SOURCE_MATHS,
     'Cumulative frequency: running total of frequencies. Plot upper class boundary against cumulative frequency. From the graph: read off median (at n/2), Q1 (at n/4), Q3 (at 3n/4), IQR = Q3 − Q1. Box plots show: minimum, Q1, median, Q3, maximum. Outliers plotted separately. Histograms: frequency density = frequency ÷ class width; area of bar = frequency. Comparing distributions: compare medians and IQRs, commenting on average and consistency.'),

    ('Maths', 'year-11', SOURCE_MATHS,
     'Conditional probability: P(A|B) = P(A ∩ B) ÷ P(B). Venn diagrams: ∩ means both events; ∪ means at least one event. Two-way tables allow reading off conditional probabilities by restricting to one row or column. Tree diagrams for dependent events: second branch probabilities depend on the first outcome. P(A and B) = P(A) × P(B|A) for dependent events. Compare with independent events: P(A and B) = P(A) × P(B).'),

    # ── ENGLISH Y10 ────────────────────────────────────────────────────────
    ('English', 'year-10', SOURCE_ENGLISH,
     "Analysing language at GCSE: identify specific techniques and explain their effect. Key language techniques: metaphor (saying something IS something else), simile (comparison using 'like' or 'as'), personification (giving non-human things human qualities), alliteration (repetition of initial consonant sounds), sibilance (repeated 's' sounds), onomatopoeia, hyperbole (extreme exaggeration). Always embed quotations and analyse word-level choices. The word '[word]' suggests/implies/conveys [effect] because [reason]."),

    ('English', 'year-10', SOURCE_ENGLISH,
     "Analysing structure: how a text is organised and how the writer controls the reader's journey. Techniques: non-linear narrative, in medias res (starting in the middle of action), flashback/flashforward, first vs third person narration, shift in focus (zooming in or out), cyclical structure (ending echoes beginning), cliffhangers, tense shifts. Describe what the writer does, then explain the effect on the reader."),

    ('English', 'year-10', SOURCE_ENGLISH,
     "Comparing texts (AQA Paper 2 Q4): compare writers' attitudes in two non-fiction texts. Key comparison words: similarly, in contrast, whereas, however, on the other hand, both writers, unlike, equally, conversely. Structure: point → evidence (quote from each) → analysis (technique and effect) → link (comparison word). Compare attitudes, methods, tone, purpose (to persuade/inform/entertain), audience, context."),

    ('English', 'year-10', SOURCE_ENGLISH,
     'Descriptive writing (AQA Paper 1 Q5): create a vivid picture in the reader\'s mind. Use all five senses. Vary sentence structure: short for impact, long for flow. Structural techniques: zoom from wide to close-up, use a turning point, build atmosphere. Avoid clichés. Powerful verbs and precise adjectives beat piling up adverbs. Include original figurative language (metaphors, similes, personification).'),

    ('English', 'year-10', SOURCE_ENGLISH,
     'Narrative writing: a story with characters, setting, conflict, resolution. Techniques: establish character voice (first or close third person), build tension through pacing (shorter sentences = faster pace), use dialogue to reveal character and move plot, foreshadow later events. Structure: exposition → rising action → climax → falling action → resolution. GCSE marking rewards: compelling characters, convincing dialogue, varied vocabulary, structural choices, accurate grammar and punctuation.'),

    ('English', 'year-10', SOURCE_ENGLISH,
     "Persuasive and argumentative writing (AQA Paper 2 Q5): AFOREST techniques: Anecdote, Facts, Opinions, Rhetorical questions, Emotive language, Statistics, Triples (rule of three). Also: direct address ('you'), inclusive language ('we'), counter-argument with rebuttal, expert opinion, hyperbole, repetition. Structure: clear introduction with a stance, developed paragraphs each with one argument, address the counter-argument, powerful conclusion."),

    ('English', 'year-10', SOURCE_ENGLISH,
     "A Christmas Carol by Charles Dickens (1843): set in Victorian London. Key themes: redemption (Scrooge's transformation), poverty and social responsibility (Dickens criticising Victorian neglect of the poor), Christmas spirit, the supernatural, family. Key characters: Ebenezer Scrooge (miserly then redeemed), Bob Cratchit (poor but kind), Tiny Tim (symbol of innocence and vulnerability), Three Ghosts (Past/Present/Yet to Come). Circular structure. Context: Dickens highlighted plight of the Victorian poor."),

    ('English', 'year-10', SOURCE_ENGLISH,
     'A Christmas Carol — key quotations: "Bah, humbug!" — dismisses Christmas and generosity. "Are there no prisons?" — callous dismissal of the poor. "As solitary as an oyster" — simile showing self-chosen isolation. "God bless us, every one!" — Tiny Tim\'s universal benediction. The Ghost of Christmas Present has more than eighteen hundred brothers — generosity is everywhere. Ghost of Christmas Yet to Come never speaks — symbolises the unknown future and death. Scrooge sends a prize turkey to the Cratchits.'),

    ('English', 'year-10', SOURCE_ENGLISH,
     "Strange Case of Dr Jekyll and Mr Hyde by Robert Louis Stevenson (1886): Gothic and mystery novella. Key themes: duality of human nature (good vs evil in the same person), reputation and respectability, science and morality, secrecy and repression. Key characters: Dr Jekyll (respected scientist), Mr Hyde (Jekyll's alter-ego, described as deformed), Mr Utterson (lawyer-narrator), Dr Lanyon (foil to Jekyll). London fog represents concealment and moral ambiguity. Context: written during period of scientific excitement (evolution) and social anxiety about respectability."),

    ('English', 'year-10', SOURCE_ENGLISH,
     'Jekyll and Hyde — key quotations: "Man is not truly one, but truly two" — acknowledges duality of human nature. Hyde described as having a kind of black sneering coolness and giving an impression of deformity without any nameable malformation. "The large handsome face of Dr Jekyll grew pale to the very lips" — physical horror mirroring moral crisis. Epistolary structure (letters from Lanyon and Jekyll) reveals the truth only at the end. Stevenson wrote during a period of anxiety about the boundaries of science.'),

    ('English', 'year-10', SOURCE_ENGLISH,
     'AQA Power and Conflict Poetry cluster (15 poems): Ozymandias (Shelley — power crumbles), London (Blake — oppressive society), The Prelude: Stealing the Boat (Wordsworth — nature\'s power), My Last Duchess (Browning — male control), Charge of the Light Brigade (Tennyson — military glory/futility), Exposure (Owen — futility and nature), Storm on the Island (Heaney), Bayonet Charge (Hughes — chaos of war), Remains (Armitage — trauma), Poppies (Weir — personal loss), War Photographer (Duffy), Tissue (Dharker), The Emigrée (Rumens), Kamikaze (Garland), Checking Out Me History (Agard).'),

    ('English', 'year-10', SOURCE_ENGLISH,
     "Comparing Power and Conflict poems: focus on theme, form, structure, language. Ozymandias vs London: both explore abuses of power; Shelley uses a ruined statue metaphor; Blake uses 'charter'd' (controlled) to show oppression. Contrast Tennyson's romanticised view of war with Owen's brutal realism. For unseen poetry use SMILE: Structure, Meaning, Imagery, Language, Effect. Annotate: rhyme scheme, rhythm, enjambment (lack of control), caesura (shock), volta (turning point)."),

    ('English', 'year-10', SOURCE_ENGLISH,
     'GCSE English grammar: sentence types: simple (one main clause), compound (two main clauses joined by FANBOYS coordinating conjunctions), complex (main clause + subordinate clause joined by subordinating conjunction: because, although, when, if, unless). Punctuation: comma, semi-colon (join closely related independent clauses), colon (introduce list or explanation), apostrophe (possession or contraction), dash (emphasis), ellipsis (trailing off). Active vs passive: "The dog bit the boy" (active) vs "The boy was bitten" (passive — removes agency).'),

    # ── ENGLISH Y11 ────────────────────────────────────────────────────────
    ('English', 'year-11', SOURCE_ENGLISH,
     "Macbeth by William Shakespeare (c.1606): a tragedy. Key themes: ambition and its consequences, appearance vs reality ('Fair is foul and foul is fair'), corrupting influence of power, guilt and psychological disintegration (Lady Macbeth's sleepwalking), fate vs free will. Key characters: Macbeth (tragic hero), Lady Macbeth (manipulative, then guilt-ridden), Three Witches (agents of fate or temptation?), Banquo (moral foil), Macduff (nemesis). Context: written for James I, who believed in divine right of kings and was fascinated by witchcraft."),

    ('English', 'year-11', SOURCE_ENGLISH,
     'Macbeth — key quotations: "Stars, hide your fires; / Let not light see my black and deep desires" — ambition and concealment. "Come, you spirits / That tend on mortal thoughts, unsex me here" — Lady Macbeth challenges gender norms. "Is this a dagger which I see before me?" — hallucination signals guilt. "Out, damned spot! Out, I say!" — sleepwalking reveals repressed guilt. "Tomorrow, and tomorrow, and tomorrow" — nihilistic despair; repetition creates relentlessness. Blood imagery throughout represents guilt that cannot be washed away.'),

    ('English', 'year-11', SOURCE_ENGLISH,
     "Romeo and Juliet by Shakespeare (c.1597): a tragedy of young love. Key themes: love and hate (the feud vs the love), fate and free will (lovers are 'star-cross'd'), youth vs age, impulsive vs prudent action. Key characters: Romeo (impulsive), Juliet (more practical), Friar Lawrence, The Nurse (comic relief), Mercutio (catalyst for tragedy), Tybalt (represents the feud). Structure builds from comedic love to tragedy across five acts. Oxymorons ('loving hate', 'cold fire') mirror the play's contradictions. Prologue reveals the ending — fate is established from the outset."),

    ('English', 'year-11', SOURCE_ENGLISH,
     "An Inspector Calls by J.B. Priestley (written 1945, set 1912): a play with a social message. Key themes: social responsibility ('We are all members of one body'), class and inequality, age and morality, collective vs individual guilt. Characters: Inspector Goole (moral voice; name echoes 'ghoul'), Arthur Birling (capitalist, pompous), Sybil (snobbish, unrepentant), Sheila (learns and changes — symbol of hope), Eric (flawed but accepts responsibility), Gerald Croft. Time paradox: written post-WWII, set pre-WWI — dramatic irony throughout (Birling's optimistic predictions are all wrong)."),

    ('English', 'year-11', SOURCE_ENGLISH,
     'An Inspector Calls — key quotations: "We are responsible for each other" — Inspector\'s central socialist message. "If we were all responsible for everything that happened to everybody we\'d had anything to do with, it would be very awkward" — Birling dismisses collective responsibility. "Fire and blood and anguish" — prophecy of World Wars; dramatic irony as play was written after them. Priestley uses the inspector device to force the Birlings to confront how their selfish actions contributed to Eva Smith\'s death.'),

    ('English', 'year-11', SOURCE_ENGLISH,
     'Approaching unseen poetry (AQA Paper 2): use SMILE — Structure (regular stanzas = control; irregular = chaos), Meaning (literal and deeper), Imagery (metaphors/similes/personification), Language techniques (alliteration/sibilance/repetition/word choice), Effect on reader. For comparing two unseen poems: identify the shared theme, compare how each poet uses form and language differently. Key terms: volta (turn in argument), enjambment (line runs on — relentless feeling), caesura (mid-line pause — shock), tone (angry/melancholic/hopeful/ironic).'),

    ('English', 'year-11', SOURCE_ENGLISH,
     'AQA Paper 1 — Explorations in Creative Reading and Writing: Section A Reading: Q1 list 4 things (4 marks); Q2 language analysis (8 marks); Q3 structural analysis (8 marks); Q4 evaluation — agree/disagree with a statement (20 marks). Section B Writing Q5 (40 marks): descriptive or narrative writing. Mark scheme: Content and Organisation (24 marks) and Technical Accuracy (16 marks). Spend ~45 minutes on reading, ~45 minutes on writing. In Q4, give a clear personal stance: "I agree/disagree that..."'),

    ('English', 'year-11', SOURCE_ENGLISH,
     'AQA Paper 2 — Writers\' Viewpoints and Perspectives: two non-fiction texts (one 19th century, one modern). Section A: Q1 true/false (4 marks); Q2 summary of differences (8 marks); Q3 language analysis of one text (12 marks); Q4 comparison of attitudes in both texts (16 marks). Section B Q5 (40 marks): persuasive or argumentative writing. For Q4, use comparison connectives throughout. Non-fiction features: headline, sub-heading, rhetorical questions, statistics, anecdotes, direct address, expert quotes, lists.'),

    # ── SCIENCE Y10 ────────────────────────────────────────────────────────
    ('Science', 'year-10', SOURCE_SCIENCE,
     'Cell biology: Eukaryotic cells have a nucleus. Animal cells: nucleus, cell membrane, cytoplasm, mitochondria, ribosomes. Plant cells also have: cell wall (cellulose), chloroplasts, vacuole. Prokaryotic cells (bacteria): no nucleus — DNA is a loop in cytoplasm; may have plasmids; cell wall (not cellulose). Cell size measured in micrometres (μm); 1 mm = 1000 μm. Magnification = image size ÷ actual size. Specialised cells: red blood cells (no nucleus, biconcave), nerve cells (long axon, myelin sheath), sperm cells (mitochondria, acrosome), root hair cells (large surface area).'),

    ('Science', 'year-10', SOURCE_SCIENCE,
     'Cell division — mitosis and the cell cycle: G1 (cell grows), S (DNA replication), G2 (preparation), M (mitosis). Mitosis produces two genetically identical daughter cells for growth, repair, and asexual reproduction. Stages: prophase, metaphase, anaphase, telophase, cytokinesis. Cancer is uncontrolled cell division caused by mutations. Stem cells: undifferentiated cells that can become specialised; found in embryos and bone marrow. Therapeutic potential: treatment of diabetes, Parkinson\'s, etc.'),

    ('Science', 'year-10', SOURCE_SCIENCE,
     'Organisation levels: cells → tissues → organs → organ systems → organism. The digestive system breaks down food into small soluble molecules. Main organs: mouth (amylase), oesophagus (peristalsis), stomach (protease, HCl, pH 2), small intestine (lipase, bile, absorption), large intestine (water absorption). Enzymes: amylase (carbohydrates → glucose), protease (proteins → amino acids), lipase (fats → fatty acids + glycerol). Bile: produced by liver, stored in gall bladder, emulsifies fats. Villi: increase surface area for absorption.'),

    ('Science', 'year-10', SOURCE_SCIENCE,
     'Infection and response: Pathogens cause disease. Types: bacteria (produce toxins; treated with antibiotics), viruses (replicate inside cells; antibiotics do not work), fungi (e.g. athlete\'s foot), protists (e.g. malaria from Plasmodium, spread by mosquito). Body defences: skin, mucus/cilia, stomach acid. Specific immune response: lymphocytes produce antibodies specific to antigens. Memory cells remain for faster future response. Vaccination: introduces dead/weakened pathogen or antigen; stimulates antibody production without causing disease.'),

    ('Science', 'year-10', SOURCE_SCIENCE,
     'Atomic structure: nucleus contains protons (positive, mass 1) and neutrons (neutral, mass 1); surrounded by electrons (negative, mass ≈ 0) in energy levels. Atomic number = number of protons. Mass number = protons + neutrons. Neutral atom: protons = electrons. Ions: atoms that gained or lost electrons. Isotopes: same element (same proton number), different neutron number; same chemical properties, different mass. Relative atomic mass (Ar) = weighted average. Periodic Table arranged by increasing atomic number; periods = energy levels; groups = same outer electrons → similar properties.'),

    ('Science', 'year-10', SOURCE_SCIENCE,
     'Periodic Table groups and trends: Group 1 (alkali metals): one outer electron; react vigorously with water forming metal hydroxide + hydrogen; reactivity increases down the group. Group 7 (halogens): seven outer electrons; reactivity decreases down the group; can displace less reactive halogens. Group 0 (noble gases): full outer shells; unreactive. Transition metals: harder, higher melting points, coloured compounds, can act as catalysts, form multiple ions (e.g. Fe²⁺ and Fe³⁺). Electronic configuration: first shell max 2; second and third shells max 8.'),

    ('Science', 'year-10', SOURCE_SCIENCE,
     'Chemical bonding: Ionic — metal transfers electrons to non-metal; forms ions; giant ionic lattice; high melting/boiling points; conducts when molten or dissolved. Covalent — non-metals share electrons; simple molecular (low melting point, non-conducting) or giant covalent (diamond, graphite, SiO₂ — very high melting points). Metallic — positive ions in a sea of delocalised electrons; good conductors; malleable and ductile. Graphite has one delocalised electron per carbon — conducts electricity. Diamond has four covalent bonds per carbon — hardest natural substance.'),

    ('Science', 'year-10', SOURCE_SCIENCE,
     'Quantitative chemistry: relative formula mass (Mr) = sum of relative atomic masses. Mole: 1 mole contains 6.02 × 10²³ particles (Avogadro\'s number). Moles = mass ÷ Mr. Concentration (mol/dm³) = moles ÷ volume (dm³). Balanced equation: mole ratio gives amounts reacting. Percentage yield = (actual yield ÷ theoretical yield) × 100. Atom economy = (Mr desired products ÷ Mr all products) × 100. Conservation of mass: total mass of products = total mass of reactants.'),

    ('Science', 'year-10', SOURCE_SCIENCE,
     'Forces: measured in Newtons (N). Scalar quantities have magnitude only (speed, mass, temperature). Vector quantities have magnitude AND direction (velocity, force, acceleration). Resultant force: vector sum of all forces. Newton\'s First Law: object remains stationary or at constant velocity unless a resultant force acts. Newton\'s Second Law: F = ma. Newton\'s Third Law: every action has an equal and opposite reaction on a different object. Weight = mass × g (g = 9.8 N/kg on Earth). Friction and air resistance oppose motion; air resistance increases with speed.'),

    ('Science', 'year-10', SOURCE_SCIENCE,
     'Forces — motion graphs: Distance-time graph: gradient = speed. Velocity-time graph: gradient = acceleration; area under graph = distance. Acceleration = change in velocity ÷ time. Stopping distance = thinking distance + braking distance. Thinking distance depends on reaction time; braking distance depends on speed squared (double speed → four times braking distance). Momentum = mass × velocity (kg m/s). Conservation of momentum: total momentum before = total momentum after in a closed system. Impulse = force × time = change in momentum.'),

    ('Science', 'year-10', SOURCE_SCIENCE,
     'Energy stores and transfers: energy stores: kinetic, gravitational PE, elastic PE, chemical, thermal, nuclear. Transfers: mechanical work, heating, radiation, electrical work. Conservation of energy: cannot be created or destroyed; only transferred. Kinetic energy Ek = ½mv². Gravitational PE Ep = mgh. Elastic PE Ee = ½ke². Work done W = Fd. Power = work done ÷ time (watts). Efficiency = useful energy output ÷ total energy input (× 100 for %). Wasted energy dissipates as heat. Reducing waste: insulation, double glazing, draught-proofing.'),

    ('Science', 'year-10', SOURCE_SCIENCE,
     'Waves: transverse — oscillation perpendicular to travel direction (light, water). Longitudinal — oscillation parallel to travel (sound). Amplitude (max displacement), wavelength (crest to crest), frequency (waves per second, Hz), period (time for one wave = 1/f). Wave speed = frequency × wavelength (v = fλ). EM spectrum (increasing frequency): radio, microwave, infrared, visible light, ultraviolet, X-rays, gamma rays. All EM waves travel at 3 × 10⁸ m/s in vacuum. Refraction: waves change speed at boundary → change direction. Total internal reflection: when angle of incidence > critical angle.'),

    # ── SCIENCE Y11 ────────────────────────────────────────────────────────
    ('Science', 'year-11', SOURCE_SCIENCE,
     'Photosynthesis: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ (requires light energy); takes place in chloroplasts. Limiting factors: light intensity, CO₂ concentration, temperature. Aerobic respiration: C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + energy; takes place in mitochondria. Anaerobic respiration (animals): glucose → lactic acid; occurs when oxygen is insufficient; creates oxygen debt. Anaerobic in yeast (fermentation): glucose → ethanol + CO₂. Anaerobic produces less ATP than aerobic respiration.'),

    ('Science', 'year-11', SOURCE_SCIENCE,
     "Homeostasis: maintaining a stable internal environment. Conditions regulated: blood glucose, body temperature (37°C), water and ion content. Negative feedback: change triggers a response that reverses the change. Blood glucose: after eating, glucose rises → insulin secreted → cells take up glucose. If glucose falls → glucagon released → glycogenolysis. Type 1 diabetes: pancreas cannot produce insulin; treated with insulin injections. Type 2 diabetes: cells don't respond to insulin; treated with diet, exercise, medication. Thermoregulation: too hot → vasodilation, sweating; too cold → vasoconstriction, shivering."),

    ('Science', 'year-11', SOURCE_SCIENCE,
     'Inheritance: DNA is in chromosomes. Humans have 23 pairs (46 total). A gene is a section of DNA coding for a protein. Alleles are different versions of the same gene. Dominant allele expressed if one copy present. Recessive allele only expressed if two copies present. Genotype = genetic make-up (e.g. Bb). Phenotype = physical characteristic. Homozygous (BB or bb). Heterozygous (Bb). Punnett square predicts offspring ratios. Sex: females XX, males XY. Cystic fibrosis: recessive mutation in CFTR gene. Polydactyly: caused by a dominant allele.'),

    ('Science', 'year-11', SOURCE_SCIENCE,
     "Evolution: Darwin's theory of natural selection: (1) variation exists; (2) some variations are heritable; (3) more offspring produced than survive; (4) individuals with favourable variations more likely to reproduce; (5) favourable alleles increase in frequency. Evidence: fossil record, comparative anatomy, DNA sequencing. Antibiotic resistance: mutation creates resistant bacteria; antibiotics kill non-resistant; resistant reproduce — natural selection in action. Speciation: populations become so different they cannot interbreed. Extinction when no individuals of a species survive."),

    ('Science', 'year-11', SOURCE_SCIENCE,
     'Ecology: habitat = where organisms live; population = all organisms of same species in an area; community = all populations in a habitat; ecosystem = biotic + abiotic factors. Food chains: producer → primary consumer → secondary consumer → tertiary consumer. Only ~10% biomass transferred at each trophic level. Decomposers (bacteria, fungi) break down dead matter and recycle nutrients. Carbon cycle: fixed by photosynthesis, returned by respiration, combustion, decomposition. Biodiversity threatened by habitat destruction, pollution, invasive species.'),

    ('Science', 'year-11', SOURCE_SCIENCE,
     'Chemical changes: acid + base → salt + water. Acid + metal → salt + hydrogen. Acid + carbonate → salt + water + CO₂. pH scale 0–14. Strong acids fully ionise (HCl, H₂SO₄, HNO₃); weak acids partially ionise. OIL RIG: Oxidation Is Loss of electrons; Reduction Is Gain. Reactivity series: K > Na > Li > Ca > Mg > Al > Zn > Fe > Pb > Cu > Ag > Au. More reactive metals displace less reactive ones from solution. Electrolysis: passing current through molten/dissolved ionic compound. Cathode (−): cations gain electrons (reduction). Anode (+): anions lose electrons (oxidation).'),

    ('Science', 'year-11', SOURCE_SCIENCE,
     'Energy changes in reactions: exothermic — releases energy to surroundings, temperature increases, products have less energy (combustion, neutralisation, oxidation). Endothermic — absorbs energy from surroundings, temperature decreases (thermal decomposition, photosynthesis). Bond breaking is endothermic; bond forming is exothermic. Overall energy = (bonds broken) − (bonds formed). Activation energy: minimum energy to start a reaction. Catalysts lower activation energy — increase rate without being consumed.'),

    ('Science', 'year-11', SOURCE_SCIENCE,
     'Electricity: current I = Q/t (amperes). Voltage V = energy/charge (volts). Resistance R (ohms). Ohm\'s Law: V = IR (ohmic conductors). Series circuits: same current; voltages add; total R = R₁ + R₂. Parallel circuits: current splits; same voltage each branch; 1/R_total = 1/R₁ + 1/R₂. Power P = IV = I²R = V²/R (watts). Energy = VIt. Mains electricity: 230 V AC, 50 Hz. Three-core cable: live (brown), neutral (blue), earth (green/yellow). Fuse and earth protect against surges. Static electricity: charge build-up on insulators; opposite charges attract.'),

    ('Science', 'year-11', SOURCE_SCIENCE,
     'Magnetism and electromagnetism: like poles repel, unlike attract. Permanent magnets produce their own field; induced magnets are only magnetic within a field. Current-carrying wire creates a circular magnetic field. Solenoid (coil) behaves like a bar magnet. Increasing current or adding iron core strengthens electromagnet. Fleming\'s Left-Hand Rule: thumb = force, index = field, middle = current. Electric motors use this. Generator effect: conductor moving through magnetic field (or changing field) induces EMF. Transformer: step-up (more secondary turns = higher V, lower I); step-down (fewer secondary turns). V_p/V_s = n_p/n_s.'),

    ('Science', 'year-11', SOURCE_SCIENCE,
     'Space physics: solar system = Sun, 8 planets, dwarf planets, moons, asteroids, comets. Planets orbit due to gravity. Light year ≈ 9.46 × 10¹⁵ m. Sun is a main sequence star powered by nuclear fusion (H → He). Star life cycle: nebula → protostar → main sequence → (small star: red giant → white dwarf → black dwarf; large star: red supergiant → supernova → neutron star or black hole). Universe contains billions of galaxies. Red-shift: light from distant galaxies shifted towards red — evidence universe is expanding. Big Bang theory: universe originated from a single point of extremely high density.'),
]


def main():
    print(f'Seeding KS4 curriculum chunks ({len(CHUNKS)} chunks)...\n')

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    inserted = 0
    skipped = 0

    for subject, year_group, source_name, chunk_text in CHUNKS:
        key = chunk_text[:120]
        cur.execute(
            'SELECT id FROM curriculum_chunks WHERE subject = %s AND year_group = %s AND chunk_text LIKE %s LIMIT 1',
            (subject, year_group, key + '%')
        )
        if cur.fetchone():
            skipped += 1
            continue

        cur.execute(
            '''INSERT INTO curriculum_chunks (id, subject, year_group, source_name, chunk_text)
               VALUES (%s, %s, %s, %s, %s)''',
            (str(uuid.uuid4()), subject, year_group, source_name, chunk_text)
        )
        inserted += 1

    conn.commit()
    cur.close()
    conn.close()

    print(f'Done. Inserted: {inserted}, Skipped (already exist): {skipped}')


if __name__ == '__main__':
    main()
