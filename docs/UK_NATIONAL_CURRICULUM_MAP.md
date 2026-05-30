# UK National Curriculum Map — Decifer Learning North Star

> **Source of truth for all content generation.** Every topic, lesson, and quiz question produced by
> the pipeline MUST map back to a row in this document. If a topic isn't here, it doesn't get built.
>
> **Scope:** Years 1–9 (KS1, KS2, KS3) — the full range Decifer targets before GCSE.
> **Authority:** England statutory programmes of study, gov.uk (2014 curriculum, current as of May 2026).
> **Status:** A government curriculum review reported November 2025; no revised statutory version
> adopted yet. This document reflects the live statutory requirement.

---

## How to use this document

1. **Content pipeline** — `services/content-pipeline/` reads this map (or the seed data derived from
   it) to know which topics exist, their canonical names, and the key stage they belong to.
2. **Seed scripts** — `scripts/seed-topics-*.ts` files are generated from this document. The markdown
   is the source; the seed scripts are the derived artefact.
3. **Gap analysis** — run `scripts/report-content-coverage.py` to compare live `topics` rows against
   this map and surface anything missing or misnamed.
4. **Naming convention** — use the exact topic titles in this document as the `title` field in
   `topics`. Do not paraphrase or abbreviate.

---

## Statutory subjects by key stage

| Subject | KS1 (Y1–2) | KS2 (Y3–6) | KS3 (Y7–9) |
|---|---|---|---|
| English | ✅ Statutory | ✅ Statutory | ✅ Statutory |
| Mathematics | ✅ Statutory | ✅ Statutory | ✅ Statutory |
| Science | ✅ Statutory | ✅ Statutory | ✅ Statutory |
| Art and Design | ✅ Statutory | ✅ Statutory | ✅ Statutory |
| Computing | ✅ Statutory | ✅ Statutory | ✅ Statutory |
| Design and Technology | ✅ Statutory | ✅ Statutory | ✅ Statutory |
| Geography | ✅ Statutory | ✅ Statutory | ✅ Statutory |
| History | ✅ Statutory | ✅ Statutory | ✅ Statutory |
| Music | ✅ Statutory | ✅ Statutory | ✅ Statutory |
| Physical Education | ✅ Statutory | ✅ Statutory | ✅ Statutory |
| Languages (MFL) | ❌ Non-statutory | ✅ Statutory (Y3+) | ✅ Statutory |
| Citizenship | ❌ Not applicable | ❌ Not applicable | ✅ Statutory (Y7+) |

---

---

# MATHEMATICS

*gov.uk reference: [Mathematics programmes of study](https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study/national-curriculum-in-england-mathematics-programmes-of-study)*

## Year 1

| # | Topic |
|---|---|
| 1 | Number and Place Value |
| 2 | Addition and Subtraction |
| 3 | Multiplication and Division |
| 4 | Fractions |
| 5 | Measurement |
| 6 | Geometry: Properties of Shapes |
| 7 | Geometry: Position and Direction |

## Year 2

| # | Topic |
|---|---|
| 1 | Number and Place Value |
| 2 | Addition and Subtraction |
| 3 | Multiplication and Division |
| 4 | Fractions |
| 5 | Measurement |
| 6 | Geometry: Properties of Shapes |
| 7 | Geometry: Position and Direction |
| 8 | Statistics |

## Year 3

| # | Topic |
|---|---|
| 1 | Number and Place Value |
| 2 | Addition and Subtraction |
| 3 | Multiplication and Division |
| 4 | Fractions |
| 5 | Measurement |
| 6 | Geometry: Properties of Shapes |
| 7 | Statistics |

## Year 4

| # | Topic |
|---|---|
| 1 | Number and Place Value |
| 2 | Addition and Subtraction |
| 3 | Multiplication and Division |
| 4 | Fractions and Decimals |
| 5 | Measurement |
| 6 | Geometry: Properties of Shapes |
| 7 | Geometry: Position and Direction |
| 8 | Statistics |

## Year 5

| # | Topic |
|---|---|
| 1 | Number and Place Value |
| 2 | Addition and Subtraction |
| 3 | Multiplication and Division |
| 4 | Fractions, Decimals and Percentages |
| 5 | Measurement |
| 6 | Geometry: Properties of Shapes |
| 7 | Geometry: Position and Direction |
| 8 | Statistics |

## Year 6

| # | Topic |
|---|---|
| 1 | Number and Place Value |
| 2 | Addition, Subtraction, Multiplication and Division |
| 3 | Fractions, Decimals and Percentages |
| 4 | Ratio and Proportion |
| 5 | Algebra |
| 6 | Measurement |
| 7 | Geometry: Properties of Shapes |
| 8 | Geometry: Position and Direction |
| 9 | Statistics |

## Year 7–9 (KS3)

| # | Topic |
|---|---|
| 1 | Number |
| 2 | Algebra |
| 3 | Ratio, Proportion and Rates of Change |
| 4 | Geometry and Measures |
| 5 | Probability |
| 6 | Statistics |

---

---

# ENGLISH

*gov.uk reference: [English programmes of study](https://www.gov.uk/government/publications/national-curriculum-in-england-english-programmes-of-study/national-curriculum-in-england-english-programmes-of-study)*

> English topics are taught as integrated strands (Reading, Writing, Grammar/VGP, Spoken Language)
> rather than discrete weekly units. The topics below represent the statutory content areas that
> map cleanly to lessons and quiz questions.

## Year 1

| # | Topic | Strand |
|---|---|---|
| 1 | Phonics: Grapheme–Phoneme Correspondences | Reading |
| 2 | Word Reading: Decoding and Blending | Reading |
| 3 | Reading Comprehension: Stories and Poetry | Reading |
| 4 | Spelling: Phoneme Segmentation | Writing |
| 5 | Handwriting: Letter Formation | Writing |
| 6 | Writing Composition: Sentences and Narratives | Writing |
| 7 | Grammar: Punctuation — Capitals, Full Stops, Question Marks | VGP |

## Year 2

| # | Topic | Strand |
|---|---|---|
| 1 | Word Reading: Fluency and Automaticity | Reading |
| 2 | Reading Comprehension: Inference and Prediction | Reading |
| 3 | Reading Comprehension: Poetry and Non-Fiction | Reading |
| 4 | Spelling: Common Exception Words and Homophones | Writing |
| 5 | Spelling: Suffixes (-ment, -ness, -ful, -less, -ly) | Writing |
| 6 | Handwriting: Joining Strokes | Writing |
| 7 | Writing Composition: Narratives and Real Events | Writing |
| 8 | Grammar: Sentence Forms (Statement, Question, Exclamation, Command) | VGP |
| 9 | Grammar: Tense (Present and Past Progressive) | VGP |
| 10 | Grammar: Coordination and Subordination | VGP |
| 11 | Grammar: Apostrophes for Contraction and Possession | VGP |

## Year 3

| # | Topic | Strand |
|---|---|---|
| 1 | Reading: Themes and Conventions Across Texts | Reading |
| 2 | Reading: Inference — Character Feelings and Motives | Reading |
| 3 | Reading: Identifying Main Ideas Across Paragraphs | Reading |
| 4 | Spelling: Prefixes and Suffixes | Writing |
| 5 | Spelling: Homophones and Near-Homophones | Writing |
| 6 | Writing Composition: Paragraphs and Non-Narrative Structures | Writing |
| 7 | Grammar: Conjunctions for Time, Place and Cause | VGP |
| 8 | Grammar: Fronted Adverbials | VGP |
| 9 | Grammar: Inverted Commas for Direct Speech | VGP |
| 10 | Grammar: Present Perfect Tense | VGP |

## Year 4

| # | Topic | Strand |
|---|---|---|
| 1 | Reading: Comparisons Within and Across Texts | Reading |
| 2 | Reading: Language, Structure and Presentation | Reading |
| 3 | Reading: Preparing Poems and Scripts for Performance | Reading |
| 4 | Spelling: Further Prefixes and Suffixes | Writing |
| 5 | Spelling: Possessive Apostrophes (Plural) | Writing |
| 6 | Writing Composition: Settings, Characters and Plot | Writing |
| 7 | Grammar: Noun Phrases and Determiners | VGP |
| 8 | Grammar: Standard and Non-Standard English | VGP |
| 9 | Grammar: Pronoun Choice for Cohesion | VGP |

## Year 5

| # | Topic | Strand |
|---|---|---|
| 1 | Reading: Recommending and Comparing Books | Reading |
| 2 | Reading: Figurative Language and Authorial Choices | Reading |
| 3 | Reading: Summarising and Retrieving Information | Reading |
| 4 | Spelling: Silent Letters and Etymology | Writing |
| 5 | Spelling: Homophones and Commonly Confused Words | Writing |
| 6 | Writing Composition: Cohesion Within and Across Paragraphs | Writing |
| 7 | Grammar: Relative Clauses | VGP |
| 8 | Grammar: Modal Verbs and Adverbs for Possibility | VGP |
| 9 | Grammar: Parenthesis — Brackets, Dashes, Commas | VGP |
| 10 | Grammar: Colons, Semi-Colons and Dashes | VGP |

## Year 6

| # | Topic | Strand |
|---|---|---|
| 1 | Reading: Critical Analysis and Authorial Intent | Reading |
| 2 | Reading: Evaluating Fact vs Opinion | Reading |
| 3 | Reading: Poetry Analysis and Memorisation | Reading |
| 4 | Spelling: Morphology and Etymology | Writing |
| 5 | Writing Composition: Audience, Purpose and Form | Writing |
| 6 | Writing Composition: Narrative with Dialogue | Writing |
| 7 | Grammar: Passive Voice | VGP |
| 8 | Grammar: Subjunctive Form | VGP |
| 9 | Grammar: Hyphenation for Clarity | VGP |
| 10 | Grammar: Bullet Point Punctuation | VGP |

## Year 7–9 (KS3)

| # | Topic | Strand |
|---|---|---|
| 1 | Reading: Shakespeare — Play Study | Reading |
| 2 | Reading: 19th-Century Fiction and Poetry | Reading |
| 3 | Reading: Seminal World Literature | Reading |
| 4 | Reading: Language and Structural Analysis | Reading |
| 5 | Reading: Comparing Texts and Authors | Reading |
| 6 | Writing: Formal Expository Essays | Writing |
| 7 | Writing: Narrative and Imaginative Writing | Writing |
| 8 | Writing: Persuasive Arguments and Speeches | Writing |
| 9 | Writing: Planning, Drafting and Editing | Writing |
| 10 | Grammar: Register — Formal vs Informal | VGP |
| 11 | Grammar: Standard English and Language Variation | VGP |
| 12 | Spoken English: Presentations and Debates | Spoken |
| 13 | Spoken English: Performance and Role Play | Spoken |

---

---

# SCIENCE

*gov.uk reference: [Science programmes of study](https://www.gov.uk/government/publications/national-curriculum-in-england-science-programmes-of-study/national-curriculum-in-england-science-programmes-of-study)*

## Year 1

| # | Topic |
|---|---|
| 1 | Plants |
| 2 | Animals Including Humans |
| 3 | Everyday Materials |
| 4 | Seasonal Changes |

## Year 2

| # | Topic |
|---|---|
| 1 | Living Things and Their Habitats |
| 2 | Plants |
| 3 | Animals Including Humans |
| 4 | Uses of Everyday Materials |

## Year 3

| # | Topic |
|---|---|
| 1 | Plants |
| 2 | Animals Including Humans |
| 3 | Rocks |
| 4 | Light |
| 5 | Forces and Magnets |

## Year 4

| # | Topic |
|---|---|
| 1 | Living Things and Their Habitats |
| 2 | Animals Including Humans |
| 3 | States of Matter |
| 4 | Sound |
| 5 | Electricity |

## Year 5

| # | Topic |
|---|---|
| 1 | Living Things and Their Habitats |
| 2 | Animals Including Humans |
| 3 | Properties and Changes of Materials |
| 4 | Earth and Space |
| 5 | Forces |

## Year 6

| # | Topic |
|---|---|
| 1 | Living Things and Their Habitats |
| 2 | Animals Including Humans |
| 3 | Evolution and Inheritance |
| 4 | Light |
| 5 | Electricity |

## Year 7–9 (KS3) — Biology

| # | Topic |
|---|---|
| 1 | Cells and Organisation |
| 2 | The Skeletal and Muscular Systems |
| 3 | Nutrition and Digestion |
| 4 | Gas Exchange Systems |
| 5 | Reproduction |
| 6 | Health |
| 7 | Photosynthesis |
| 8 | Cellular Respiration |
| 9 | Relationships in an Ecosystem |
| 10 | Inheritance, Chromosomes, DNA and Genes |

## Year 7–9 (KS3) — Chemistry

| # | Topic |
|---|---|
| 1 | The Particulate Nature of Matter |
| 2 | Atoms, Elements and Compounds |
| 3 | Pure and Impure Substances |
| 4 | Chemical Reactions |
| 5 | Energetics |
| 6 | The Periodic Table |
| 7 | Materials |
| 8 | Earth and Atmosphere |

## Year 7–9 (KS3) — Physics

| # | Topic |
|---|---|
| 1 | Energy: Calculation and Transfers |
| 2 | Energy: Changes in Systems |
| 3 | Motion: Describing Motion |
| 4 | Forces |
| 5 | Pressure in Fluids |
| 6 | Balanced Forces |
| 7 | Forces and Motion |
| 8 | Waves: Observed Waves |
| 9 | Waves: Sound |
| 10 | Waves: Light |
| 11 | Electricity: Current Electricity |
| 12 | Electricity: Static Electricity |
| 13 | Magnetism |
| 14 | Space Physics |

---

---

# HISTORY

*gov.uk reference: [History programmes of study](https://www.gov.uk/government/publications/national-curriculum-in-england-history-programmes-of-study)*

## Year 1–2 (KS1)

| # | Topic |
|---|---|
| 1 | Changes Within Living Memory |
| 2 | Events Beyond Living Memory: National and Global Significance |
| 3 | Significant Individuals in the Past |
| 4 | Local History: Significant Events, People and Places |

## Year 3–6 (KS2)

| # | Topic |
|---|---|
| 1 | Stone Age to Iron Age Britain |
| 2 | The Roman Empire and Its Impact on Britain |
| 3 | Anglo-Saxon Settlement and the Kingdoms of England |
| 4 | Viking and Anglo-Saxon Struggle for England |
| 5 | Ancient Civilisations: Sumer, Indus Valley, Egypt, Shang Dynasty |
| 6 | Ancient Greece: Life and Achievements |
| 7 | Non-European Societies: Early Islamic Baghdad, Maya, Benin |
| 8 | Local History Study |
| 9 | A British History Theme Beyond 1066 |

## Year 7–9 (KS3)

| # | Topic |
|---|---|
| 1 | Medieval Britain 1066–1509: Church, State and Society |
| 2 | Early Modern Britain 1509–1745: Reformation and Revolution |
| 3 | Britain 1745–1901: Industry, Empire and Reform |
| 4 | Britain and the World 1901 to Present Day |
| 5 | Local History Study |
| 6 | Thematic Study in British History |
| 7 | World History: A Significant Society or Issue |

---

---

# GEOGRAPHY

*gov.uk reference: [Geography programmes of study](https://www.gov.uk/government/publications/national-curriculum-in-england-geography-programmes-of-study)*

## Year 1–2 (KS1)

| # | Topic |
|---|---|
| 1 | Locational Knowledge: Continents and Oceans |
| 2 | Locational Knowledge: UK Countries, Capital Cities and Surrounding Seas |
| 3 | Place Knowledge: UK Locality vs Contrasting Non-European Area |
| 4 | Physical Geography: Seasonal and Daily Weather Patterns |
| 5 | Physical Geography: Hot and Cold Areas of the World |
| 6 | Human and Physical Features |
| 7 | Geographical Skills: Maps, Atlases and Aerial Photographs |

## Year 3–6 (KS2)

| # | Topic |
|---|---|
| 1 | Locational Knowledge: Europe, Americas and Russia |
| 2 | Locational Knowledge: UK Regions, Counties and Cities |
| 3 | Locational Knowledge: Latitude, Longitude and Time Zones |
| 4 | Place Knowledge: UK, European and North/South American Regions |
| 5 | Physical Geography: Climate Zones, Biomes and Vegetation Belts |
| 6 | Physical Geography: Rivers, Mountains, Volcanoes and Earthquakes |
| 7 | Physical Geography: The Water Cycle |
| 8 | Human Geography: Settlement, Land Use and Economic Activity |
| 9 | Human Geography: Trade Links and Natural Resources |
| 10 | Geographical Skills: OS Maps, Grid References and Fieldwork |

## Year 7–9 (KS3)

| # | Topic |
|---|---|
| 1 | Locational Knowledge: Africa, Asia and Polar Regions |
| 2 | Place Knowledge: African and Asian Regional Study |
| 3 | Physical Geography: Plate Tectonics, Rocks and Weathering |
| 4 | Physical Geography: Climate Change and Glaciation |
| 5 | Physical Geography: Hydrology and Coasts |
| 6 | Human Geography: Population and Urbanisation |
| 7 | Human Geography: International Development |
| 8 | Human Geography: Economic Sectors and Natural Resources |
| 9 | Geographical Skills: GIS, Satellite Data and Complex Fieldwork |

---

---

# COMPUTING

*gov.uk reference: [Computing programmes of study](https://www.gov.uk/government/publications/national-curriculum-in-england-computing-programmes-of-study/national-curriculum-in-england-computing-programmes-of-study)*

## Year 1–2 (KS1)

| # | Topic |
|---|---|
| 1 | Algorithms: What They Are and How to Write Them |
| 2 | Programming: Creating and Debugging Simple Programs |
| 3 | Logical Reasoning: Predicting Program Behaviour |
| 4 | Digital Literacy: Creating, Organising and Retrieving Content |
| 5 | Digital Literacy: Uses of Technology Beyond School |
| 6 | Online Safety: Safe and Respectful Technology Use |

## Year 3–6 (KS2)

| # | Topic |
|---|---|
| 1 | Programming: Sequence, Selection and Repetition |
| 2 | Programming: Variables and Debugging |
| 3 | Logical Reasoning: Explaining and Detecting Errors |
| 4 | Networks: Computer Networks and the Internet |
| 5 | Networks: Communication Services and How They Work |
| 6 | Information Technology: Search Technologies and Evaluating Digital Content |
| 7 | Information Technology: Combining Software for Programs and Data Analysis |
| 8 | Online Safety: Safe, Respectful and Responsible Use |

## Year 7–9 (KS3)

| # | Topic |
|---|---|
| 1 | Computer Science: Abstraction and Computational Thinking |
| 2 | Computer Science: Algorithms — Sorting and Searching |
| 3 | Computer Science: Programming in Multiple Languages (inc. Textual) |
| 4 | Computer Science: Data Structures — Lists, Tables and Arrays |
| 5 | Computer Science: Boolean Logic and Logic Gates |
| 6 | Computer Science: Binary Representation and Number Systems |
| 7 | Computer Science: Hardware and Software Components |
| 8 | Computer Science: Instruction Execution and Digital Data Representation |
| 9 | Information Technology: Creative Multi-Application Projects |
| 10 | Online Safety: Privacy, Security and Responsible Use |

---

---

# DESIGN AND TECHNOLOGY

*gov.uk reference: [D&T programmes of study](https://www.gov.uk/government/publications/national-curriculum-in-england-design-and-technology-programmes-of-study)*

## Year 1–2 (KS1)

| # | Topic |
|---|---|
| 1 | Design: Creating Products for a Purpose |
| 2 | Make: Using Tools, Materials and Components |
| 3 | Evaluate: Exploring and Assessing Existing Products |
| 4 | Technical Knowledge: Structures — Strength, Stiffness and Stability |
| 5 | Technical Knowledge: Mechanisms — Levers, Sliders, Wheels and Axles |
| 6 | Cooking and Nutrition: Healthy Diet and Food Origins |

## Year 3–6 (KS2)

| # | Topic |
|---|---|
| 1 | Design: Research-Informed Design with Sketches and Diagrams |
| 2 | Make: Precision with Tools and Material Selection |
| 3 | Evaluate: Product Analysis and Historical Design Context |
| 4 | Technical Knowledge: Complex Structural Reinforcement |
| 5 | Technical Knowledge: Mechanical Systems — Gears, Pulleys, Cams, Levers |
| 6 | Technical Knowledge: Electrical Systems — Series Circuits |
| 7 | Technical Knowledge: Computing for Control and Programming |
| 8 | Cooking and Nutrition: Healthy Varied Diet and Savoury Dishes |

## Year 7–9 (KS3)

| # | Topic |
|---|---|
| 1 | Design: User-Centred Design and Biomimicry |
| 2 | Design: Specifications and Multi-Format Communication |
| 3 | Make: Specialist Tools and Computer-Aided Manufacture |
| 4 | Evaluate: Professional Work Analysis and Emerging Technologies |
| 5 | Technical Knowledge: Advanced Mechanical Systems |
| 6 | Technical Knowledge: Advanced Electrical and Electronic Systems |
| 7 | Technical Knowledge: Embedded Intelligence with Computing |
| 8 | Cooking and Nutrition: Advanced Techniques and Ingredient Sourcing |

---

---

# ART AND DESIGN

*gov.uk reference: [Art and Design programmes of study](https://www.gov.uk/government/publications/national-curriculum-in-england-art-and-design-programmes-of-study)*

## Year 1–2 (KS1)

| # | Topic |
|---|---|
| 1 | Drawing and Painting: Colour, Pattern, Texture, Line, Shape, Form and Space |
| 2 | Sculpture: Developing and Sharing Ideas |
| 3 | Art Appreciation: Analysing Work of Artists, Craft Makers and Designers |

## Year 3–6 (KS2)

| # | Topic |
|---|---|
| 1 | Sketchbooks: Recording Observations and Revisiting Ideas |
| 2 | Drawing and Painting: Pencil and Charcoal Techniques |
| 3 | Sculpture and 3D: Clay and Mixed Materials |
| 4 | Art History: Great Artists, Architects and Designers |

## Year 7–9 (KS3)

| # | Topic |
|---|---|
| 1 | Sketchbooks and Journals: Extended Observation and Exploration |
| 2 | Painting and Mixed Media: Range of Techniques |
| 3 | Material Proficiency: Handling Diverse Media |
| 4 | Critical Analysis: Evaluating Own and Others' Work |
| 5 | Art History: Periods, Styles and Major Movements (Ancient to Present) |

---

---

# MUSIC

*gov.uk reference: [Music programmes of study](https://www.gov.uk/government/publications/national-curriculum-in-england-music-programmes-of-study)*

## Year 1–2 (KS1)

| # | Topic |
|---|---|
| 1 | Singing: Songs, Chants and Rhymes |
| 2 | Playing Instruments: Tuned and Untuned |
| 3 | Listening: High-Quality Live and Recorded Music |
| 4 | Creating: Experimenting with and Combining Sounds |

## Year 3–6 (KS2)

| # | Topic |
|---|---|
| 1 | Performance: Solo and Ensemble — Voice and Instruments |
| 2 | Composition: Improvising and Composing for Varied Purposes |
| 3 | Listening: Aural Memory and Identifying Musical Traditions |
| 4 | Notation: Reading and Writing Staff Notation |
| 5 | Music History: Composers and Diverse Musical Traditions |

## Year 7–9 (KS3)

| # | Topic |
|---|---|
| 1 | Performance: Confident Solo and Ensemble Contexts |
| 2 | Composition: Drawing from Multiple Musical Traditions |
| 3 | Notation: Across Genres and Styles |
| 4 | Listening: Dimensions of Music — Pitch, Duration, Dynamics, Tempo, Timbre, Texture, Structure |
| 5 | Music History: Works by Great Composers Across Periods |

---

---

# PHYSICAL EDUCATION

*gov.uk reference: [PE programmes of study](https://www.gov.uk/government/publications/national-curriculum-in-england-physical-education-programmes-of-study)*

## Year 1–2 (KS1)

| # | Topic |
|---|---|
| 1 | Fundamental Movement Skills: Running, Jumping, Throwing, Catching |
| 2 | Team Games |
| 3 | Dance: Simple Movement Patterns |

## Year 3–6 (KS2)

| # | Topic |
|---|---|
| 1 | Athletics: Running, Jumping, Throwing and Catching in Combination |
| 2 | Competitive Games (Badminton, Basketball, Cricket, Football, Hockey, Netball, Rounders, Tennis) |
| 3 | Gymnastics: Flexibility, Strength, Technique, Control and Balance |
| 4 | Dance: Range of Movement Patterns |
| 5 | Outdoor and Adventurous Activities |
| 6 | Swimming and Water Safety |

## Year 7–9 (KS3)

| # | Topic |
|---|---|
| 1 | Team and Individual Games |
| 2 | Athletics and Gymnastics: Technique and Performance |
| 3 | Dance: Advanced Techniques and Styles |
| 4 | Outdoor and Adventurous Activities |
| 5 | Performance Analysis and Self-Improvement |

---

---

# LANGUAGES (MFL)

> Non-statutory at KS1. Statutory from Year 3. Any modern or ancient foreign language may be chosen.

*gov.uk reference: [Languages programmes of study](https://www.gov.uk/government/publications/national-curriculum-in-england-languages-progammes-of-study/national-curriculum-in-england-languages-progammes-of-study)*

## Year 3–6 (KS2)

| # | Topic |
|---|---|
| 1 | Listening: Attentive Listening and Showing Understanding |
| 2 | Phonology: Patterns, Sounds and Spelling-Sound Links |
| 3 | Speaking: Conversations, Questions, Answers and Opinions |
| 4 | Speaking: Pronunciation and Intonation |
| 5 | Reading: Understanding Words, Phrases and Simple Texts |
| 6 | Writing: Phrases from Memory and Adapted Sentences |
| 7 | Grammar: Noun Gender, Verb Conjugation and Key Patterns |

## Year 7–9 (KS3)

| # | Topic |
|---|---|
| 1 | Grammar: Tenses — Present, Past and Future Structures |
| 2 | Grammar: Voices, Moods and Complex Structures |
| 3 | Vocabulary: Wide-Ranging Beyond Immediate Needs |
| 4 | Listening: Obtaining and Responding to Information |
| 5 | Speaking: Initiating and Developing Conversations |
| 6 | Reading: Original and Adapted Materials; Literary Texts |
| 7 | Writing: Creative Prose and Translation into Target Language |

---

---

# CITIZENSHIP

> Non-statutory at KS1/KS2. Statutory from Year 7.

## Year 7–9 (KS3)

| # | Topic |
|---|---|
| 1 | Democracy and Parliament |
| 2 | The Rule of Law and the Justice System |
| 3 | Human Rights |
| 4 | Financial Literacy and Personal Finance |
| 5 | The Economy and Government |
| 6 | Diversity and Identity in the UK |

---

---

## Coverage summary

| Subject | Y1 | Y2 | Y3 | Y4 | Y5 | Y6 | Y7–9 | Total topics |
|---|---|---|---|---|---|---|---|---|
| Mathematics | 7 | 8 | 7 | 8 | 8 | 9 | 6 | **53** |
| English | 7 | 11 | 10 | 9 | 10 | 10 | 13 | **70** |
| Science | 4 | 4 | 5 | 5 | 5 | 5 | 32 | **60** |
| History | — | — | KS2 (9) | — | — | — | KS3 (7) | **16** |
| Geography | KS1 (7) | — | — | KS2 (10) | — | — | KS3 (9) | **26** |
| Computing | KS1 (6) | — | — | KS2 (8) | — | — | KS3 (10) | **24** |
| D&T | KS1 (6) | — | — | KS2 (8) | — | — | KS3 (8) | **22** |
| Art and Design | KS1 (3) | — | — | KS2 (4) | — | — | KS3 (5) | **12** |
| Music | KS1 (4) | — | — | KS2 (5) | — | — | KS3 (5) | **14** |
| PE | KS1 (3) | — | — | KS2 (6) | — | — | KS3 (5) | **14** |
| Languages | — | — | — | KS2 (7) | — | — | KS3 (7) | **14** |
| Citizenship | — | — | — | — | — | — | KS3 (6) | **6** |
| **Total** | | | | | | | | **~331** |

---

## MVP prioritisation for Decifer

Per `CLAUDE.md` §3, the MVP focuses on Y3 and Y7. The table below shows which topics are already
live (`✅`), seeded but not yet generated (`⚡`), or not yet started (`❌`).

> Run `npm run report:coverage` to get the live version of this table from the database.

| Subject | Y3 status | Y7 status |
|---|---|---|
| Mathematics | ✅ Live | ✅ Live |
| English | ✅ Live | ✅ Live |
| Science | ✅ Live | ✅ Live |
| History | ❌ Not started | ❌ Not started |
| Geography | ❌ Not started | ❌ Not started |
| Computing | ❌ Not started | ❌ Not started |
| D&T | ❌ Not started | ❌ Not started |
| Art and Design | ❌ Not started | ❌ Not started |
| Music | ❌ Not started | ❌ Not started |
| PE | ❌ Not started | ❌ Not started |
| Languages | ❌ Not started | ❌ Not started |
| Citizenship | N/A | ❌ Not started |

**Phase 2 expansion order** (recommended, based on quiz-ability):
1. History — high narrative content, clear knowledge tests
2. Geography — strong factual base, map/data skills
3. Computing — algorithm/logic topics are highly quizzable
4. Citizenship — Y7+ only, factual and opinionated
5. Languages — requires per-language variant, highest content complexity
6. Music, PE, Art — heavily skills-based; lesson content is viable but quiz questions need careful design

---

*Last updated: 2026-05-30 — sourced from gov.uk statutory programmes of study (2014 curriculum).*
*Next review: when revised statutory curriculum is formally published (review reported Nov 2025).*
