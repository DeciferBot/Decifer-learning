# EduPlatform — Benchmark, Gap Analysis & Recommendations

**Version:** 1.0 — May 2026
**Purpose:** Honest assessment of the platform against world-class game design; Year 1–12 adaptability; LLM reliability risk; gaps and fixes.

---

## 1. Benchmark: How Does the Platform Compare to the World's Best Games?

The games below are the reference class. Each has cracked a specific engagement problem. The question is: which of these mechanisms does our platform have, which does it lack, and which should we borrow?

---

### The Reference Games & Their Core Hook

| Game | Core Hook | DAU Rate | Why People Can't Stop |
|---|---|---|---|
| **Duolingo** | Streak + habit loop + loss aversion | 35M+ DAU | Breaking a 300-day streak feels like losing money |
| **Fortnite Battle Pass** | Seasonal journey + FOMO + cosmetic status | 110M active | 100-tier journey with a deadline; you can *see* how far you've come |
| **Pokémon** | Collection + evolution + rarity surprise | Franchise: 1.3B units | Variable reward (will this one be shiny?); evolution animations are pure dopamine |
| **Minecraft** | Open-ended progression + no failure state | 140M monthly | You can always do *something*; no forced stopping points |
| **Prodigy Math** | Pet collecting RPG (maths as combat) | 50M+ users | Kids play for the pets, do maths to unlock them |
| **Kahoot** | Live social competition + leaderboard status | 300M users | Leaderboard in front of your class; social stakes = instant engagement |
| **Zelda: BOTW** | Organic exploration + multiple goals + flow state | n/a (console) | Never stuck; always something to do; difficulty scales to you |
| **Candy Crush** | Variable reward cascade + near-win psychology | 200M+ DAU | Almost won → try again loop; unpredictable cascade = slot machine dopamine |

---

### Platform Score vs. Best-in-Class

Scoring each mechanic 1–5 (5 = world-class implementation):

| Engagement Mechanic | What the Best Do | Our Platform (Current) | Gap |
|---|---|---|---|
| **Streak / daily habit loop** | Duolingo: loss aversion, freeze days, 300+ day streaks | ✅ Streak system planned | Minor — add streak freeze mechanic |
| **Visible journey / map** | Fortnite: 100-tier visual progress bar with deadline | ⚠️ Topic list exists, no world map or journey narrative | **Major** |
| **Variable reward / surprise** | Pokémon: shiny at 1/4096; random pet rarity in Prodigy | ❌ All rewards are predictable | **Major** |
| **Dopamine hit on correct answer** | Kahoot: sound + animation + rank jump | ⚠️ Visual feedback planned but no audio, no rank jump in real time | Moderate |
| **Boss battle / milestone moment** | Zelda: dungeon bosses; Pokémon: gym leaders | ❌ No end-of-unit challenge or "boss quiz" | **Major** |
| **Collection mechanic** | Pokémon: 1000+ creatures; Prodigy: 100+ pets | ⚠️ Badges only — not a collection system with rarity | Moderate |
| **Social competition** | Kahoot: real-time; Duolingo: weekly leagues | ⚠️ Leaderboard exists but static, no live play | Moderate |
| **Narrative / world story** | Zelda, Pokémon: rich world and characters | ❌ No story, no world, no reason to care about the journey | **Major** |
| **Customisation / identity** | Fortnite, Minecraft: skins, builds, expression | ✅ Avatar, themes, buddy — well designed | Strong |
| **Adaptive difficulty (flow state)** | Zelda BOTW: always challenging, never frustrating | ⚠️ Three tiers exist but no real-time adaptive difficulty | Moderate |
| **Loss mechanic / stakes** | Duolingo hearts; lives in Candy Crush | ❌ No loss mechanic — failing a quiz has no cost or tension | Moderate |
| **Open-ended / player-led goals** | Minecraft: set your own goals | ❌ Linear: complete topics in order | Moderate |
| **Appointment mechanic** | Daily quests in Fortnite, Duolingo daily reward | ⚠️ Streak drives this but no daily surprise reward | Minor |

**Summary verdict:** The platform has solid bones — streaks, points, badges, customisation. But it is missing the four things that make games genuinely unforgettable: a **narrative world**, **variable rewards**, **boss battles**, and **real social stakes**. Without these, it will feel like a good homework app, not a game children choose to open.

---

## 2. The Dopamine Gap — What the Platform Must Feel Like

The most important insight from game research: **dopamine fires on anticipation and surprise, not on guaranteed rewards.**

A child answering a question correctly and getting "+10 pts" every single time will feel that reward within two sessions and stop feeling it at all. This is why Prodigy's *random pet encounter* mechanic — "will I catch a new pet this battle?" — produces far longer sessions than a simple points system.

### The dopamine moments our platform currently guarantees (weak)
- Correct answer → +10 pts (predictable, plateaus fast)
- Complete topic → badge (predictable, infrequent)
- Streak milestone → bonus points (predictable, infrequent)

### The dopamine moments it needs (variable, surprising, narrative)
- Complete a quiz → 5% chance of finding a rare "knowledge artefact" (a collectible object tied to the subject)
- Score 100% with no hints → unlock a secret "challenge room" not on the normal map
- Random "Daily Discovery" — a short mystery challenge at login that has nothing to do with the current topic; solving it awards a one-of-a-kind badge
- A "boss battle" at the end of every unit with animated fanfare and a unique reward
- "Streak Shield" items that can be spent to protect your streak — giving items real value

---

## 3. Year 1 to Year 12 — How Adaptable Is the Platform?

### The Architecture Holds Well

The core structure (Year Group → Subject → Topic → Sprout/Explorer/Lightning → Learn/Practise/Quiz) is actually very scalable architecturally. The database schema doesn't change. What changes is the *type* of content and the *type of assessment* needed at each end of the range.

### Year 1 (Age 5–6) — What Changes

| Dimension | Year 7 version | Year 1 version |
|---|---|---|
| Reading level | Full paragraphs fine | Most text must be replaced with audio voiceover or images |
| Quiz format | Multiple choice text | Picture-based answers (tap the right image) |
| Input method | Typing OK | Tapping only; no keyboard input |
| Game complexity | Multi-step drag & drop | Single-tap, large target matching games |
| Attention span | 15–20 min sessions | 5–8 min sessions max |
| Feedback | Text + animation | Audio-heavy ("Well done!" voice), large character reactions |
| Content depth | Abstract concepts | Concrete, visual, tactile concepts only |

Year 1 is buildable but requires a significantly different front-end layer — essentially a different child UI skin over the same data structure. The backend and content schema are fine; the presentation layer needs a "Foundation Mode" that strips complexity and adds audio.

**Estimated effort to add Year 1:** Medium — content is simpler, but the UI must be rebuilt for very young users. Worth doing in Phase 2.

### Year 12 (Age 16–18, A-Level) — Where It Gets Difficult

| Dimension | Year 7 version | Year 12 version |
|---|---|---|
| Assessment type | Multiple choice, short answer | Long-form written arguments; mathematical proofs; essay marking |
| Content depth | 200-word concept explanations | University-adjacent concepts (e.g. integration by parts, organic chemistry mechanisms, literary theory) |
| Marking | Right/wrong binary | Structured mark schemes with partial credit |
| Subject breadth | 3 subjects | 3–4 A-level subjects each with 10–15 modules |
| Practice format | Drag & drop games | Past paper questions, exam technique, timed essay practice |
| LLM risk | Moderate | High — A-level facts must be exact and examiner-aligned |

Multiple choice quizzes break down at A-level. A student writing an essay on *Hamlet* or solving a mechanics problem cannot be assessed with a tap. This is the ceiling of the current design and it is real.

**Recommended approach for Year 12:** Build Years 1–11 first. For Year 12, introduce a "long answer" module with a structured rubric that the system checks against bullet-point mark scheme criteria — not free-form AI marking. Use past paper questions verbatim (they are public domain). This avoids hallucination and maintains examiner alignment.

### Adaptability Summary by Key Stage

| Key Stage | Year Group | Adaptability | Main Change Needed |
|---|---|---|---|
| Early Years / KS1 | Y1–Y2 | ⚠️ Medium effort | Audio-first UI, picture-based quizzes, Foundation Mode |
| KS2 | Y3–Y6 | ✅ Strong fit | Core design fits perfectly |
| KS3 | Y7–Y9 | ✅ Strong fit | Core design fits perfectly |
| KS4 (GCSE) | Y10–Y11 | ✅ Good fit | Add past paper questions; timed exam mode |
| KS5 (A-Level) | Y12–Y13 | ⚠️ Harder | Long-answer format needed; multiple choice not enough |

**The sweet spot** is Years 3–11 (KS2, KS3, KS4). That covers 9 year groups, the vast majority of the UK school age market, and is the strongest product fit. Year 1–2 and Year 12–13 are extensions that require meaningful additional work.

---

## 4. How Deep Can the Knowledge Go?

### KS2 (Years 3–6) — Depth is Comfortable
Topics at this level are well-defined by the National Curriculum. The content required — place value, fractions, grammar, forces, life cycles — is stable, verifiable, and unambiguous. Deep knowledge is achievable and the LLM risk is low because the facts are simple and easily cross-checked.

### KS3 (Years 7–9) — Depth is Good with Care
Concepts become more abstract (algebra, atomic structure, Shakespearean analysis) but are still well-documented and verifiable. The risk of incorrect content is manageable with a human review step. Going to three tiers (Sprout/Explorer/Lightning) at this level can genuinely teach deep understanding — Lightning-tier Year 9 Science covering electron configuration is rigorous university-prep level material.

### KS4 / GCSE (Years 10–11) — Depth is High, Risk Rises
GCSE content is examiner-specific. The mark scheme for a question can differ between AQA, Edexcel, and OCR exam boards. Deep content is achievable but must be board-specific. This is where the knowledge must be authored by humans or cross-referenced to the actual specification document — not generated freely.

### A-Level (Years 12–13) — Very Deep, High Risk
A-level content can go extremely deep (university-level calculus, biochemistry, literary theory). The platform *can* handle this structurally, but the content reliability requirement becomes very high. At this level, a wrong answer in a quiz could actively harm a student's revision.

**Bottom line on depth:** The platform can go as deep as the content entered into it. The architecture imposes no ceiling. The ceiling is content quality — which is a human problem, not a technology problem.

---

## 5. LLM Hallucination Risk — Honest Assessment

This is one of the most important questions for an educational platform. Here is the honest picture.

### What the risk actually is

LLMs (including the current Claude models) can generate confident, plausible-sounding content that is factually wrong. For an adult reading a business document, this is a nuisance. For a child learning from a quiz, a wrong answer presented as correct can create a misconception that is difficult to unlearn — research shows that correcting a learned wrong answer takes 2–5 times more reinforcement than learning the right answer first.

### Where the risk is highest in this platform

| Content Type | Hallucination Risk | Why |
|---|---|---|
| Maths calculations and worked examples | **High** | LLMs make arithmetic and algebraic errors, especially multi-step |
| Science facts (specific values, formulas) | **High** | E.g. wrong atomic numbers, incorrect chemical equations, wrong SI units |
| History / Geography facts | **High** | Dates, names, places can be confidently wrong |
| English grammar rules | **Medium** | Rules are stable but edge cases can be wrong |
| English literary analysis (open questions) | **Low** | Interpretation is subjective; less risk of "wrong" |
| Quiz question options (distractors) | **Medium** | A plausible wrong answer might accidentally be correct |
| Hint text ("try thinking about X") | **Low** | Hints guide thinking; less factually risky |
| Encouragement messages | **Very low** | No factual content |

### The solution: a strict content architecture

**Rule 1: Never use LLM-generated content directly in quizzes without human review.**
All quiz questions, correct answers, and worked examples must be reviewed by a subject-knowledgeable human before publishing. Think of the LLM as a first draft, not a final answer.

**Rule 2: Use the LLM only where the risk is low.**
LLMs are excellent at generating: encouragement messages, hint phrasing, alternative explanations, game flavour text, and onboarding copy. None of these are high-risk.

**Rule 3: Ground all factual content in authoritative sources.**
For each topic, define the source of truth before writing content:
- Maths: BBC Bitesize, CGP revision guides, official National Curriculum documentation
- Science: AQA/Edexcel specification documents, Collins/Hodder textbooks
- English: Official curriculum guidance, CGP grammar guides
Cross-reference LLM-generated content against these before publishing.

**Rule 4: Build a content review workflow from day one.**
Every piece of content should have a status: Draft (LLM-generated) → Reviewed (human-checked) → Published. Only Published content appears to children. This is a 10-minute build but prevents significant problems.

**Rule 5: Use a verification layer for maths.**
For any Maths content involving calculation, run the answer through a symbolic maths library (such as SymPy in Python or Wolfram Alpha's API) to verify correctness before the human review step. This catches arithmetic errors automatically.

### What this means practically

Building content for the pilot (Year 3 and Year 7 across 3 subjects) with proper review is approximately 40–60 hours of work — mostly content writing and verification, not coding. This is not a large task for a pilot, but it must not be skipped. The alternative — trusting raw LLM output — will produce errors in your children's learning material within the first week.

---

## 6. Gap Analysis — What Is Missing and How to Fix It

The gaps below are prioritised. Each includes a "complexity cost" — an honest assessment of how hard it is to add without overcomplicating the MVP.

---

### GAP 1: No Narrative World or Story
**Impact:** Critical. This is the single biggest difference between the platform and the games children actually love. Pokémon has the Pokémon world. Zelda has Hyrule. Prodigy has the Prodigy world. Our platform currently has a list of topics.

**The fix:** Create a simple adventure world with five or six named "Zones", one per subject area or topic cluster. The child is an explorer travelling through these zones. Completing a topic unlocks passage to the next area. Completing a whole subject (e.g. all Year 7 Maths) unlocks a "World Boss" challenge. The zones do not need to be built as a 3D game — they can be a beautifully illustrated static map that simply highlights which zones are unlocked.

**Complexity cost:** Low–Medium. This is mostly a design and illustration task. The underlying unlock logic (topic complete = zone unlocked) already exists in the data model. You need: one illustrated world map per year group, zone names tied to subject themes, and a "you have entered the Science Realm" transition screen.

**Example zone names for Year 7:**
- Maths → The Crystal Labyrinth
- English → The Library of Echoes
- Science → The Elemental Forge
- The Final Zone (cross-subject challenge) → The Summit

---

### GAP 2: No Variable / Surprise Rewards
**Impact:** High. Predictable rewards plateau within two sessions. Without surprise, the points system becomes wallpaper.

**The fix:** Add three surprise mechanics, none of which require major engineering:

**a) Knowledge Collectibles (low effort):** After each completed quiz, there is a 1-in-5 chance of finding a "Discovery Card" — a beautiful illustrated card about a fascinating real fact related to the topic (e.g., "Did you know? The word 'algebra' comes from the Arabic al-jabr, written in 820 AD"). These cards go into the child's "Collection" tab. Rarer cards drop less frequently. Children collect and compare them. This costs almost nothing to build and creates a Pokémon-style collection loop with zero gambling mechanics.

**b) Daily Mystery Challenge (low effort):** Each day, one short bonus challenge unlocks at login — unrelated to the child's current topic, drawn from across the whole curriculum. Completing it gives a surprise reward (a rare card or a streak shield). This drives daily logins and introduces breadth of knowledge.

**c) Perfect Score Secret Room (medium effort):** Achieving 100% on a quiz with no hints unlocks a hidden "Bonus Room" — a short, playful extra challenge (a riddle, a harder question, a "did you know?" exploration) that is not on the main map. This rewards excellence without penalising those who needed hints.

**Complexity cost:** Low. Discovery Cards are just database entries with images. The Daily Challenge is just a randomly selected question flagged as "daily". The Bonus Room is a hidden topic record triggered by a quiz score condition.

---

### GAP 3: No Boss Battle / Milestone Moments
**Impact:** High. Without boss battles, every completed topic feels identical. There is no climax, no crescendo, no moment a child will remember and talk about.

**The fix:** Add a "Zone Guardian" challenge at the end of each subject unit (e.g., completing all five Year 7 Maths topics unlocks "The Crystal Guardian"). This is a special quiz of 15 questions drawn randomly from across all five topics, presented with special visual treatment (darker background, dramatic music, countdown timer, health bar for the guardian). Beating it awards a unique badge and a rare Discovery Card that cannot be obtained any other way.

The Zone Guardian is not harder than the normal quizzes — it is the *presentation* that makes it feel like a boss battle. The same question types, but with theatrical framing.

**Complexity cost:** Low. Same quiz engine, different visual wrapper. One unique badge per unit. One dedicated page with the boss illustration.

---

### GAP 4: No Consequence for Failure (No Stakes)
**Impact:** Medium. When there is no cost to failing, quizzes feel like low-stakes practice. Children who are capable of better will underperform.

**The fix:** Introduce a simple "Lives" system on quizzes — not punishing, but creating light tension. Each quiz starts with 3 lives (shown as small hearts). Getting 3 wrong answers in a row costs one life. Running out of lives ends the quiz attempt (child can retry immediately, no penalty beyond the attempt itself). Children who pass with all 3 lives intact earn a small bonus. This creates just enough tension to make correct answers feel meaningful without causing anxiety.

Critically: never lock a child out of a topic. Failed attempts cost nothing beyond having to retry. The lives are per-attempt, not a persistent resource.

**Complexity cost:** Very Low. Add a lives counter to the quiz state. Trigger quiz-end on 0 lives. Add the retry screen.

---

### GAP 5: No Real-Time Social Play
**Impact:** Medium. Kahoot's explosive classroom engagement comes from the fact that everyone competes *simultaneously*. Our leaderboard is static by comparison.

**The fix for Phase 1 (family):** Not needed — with two kids, you cannot run a live quiz. The leaderboard between two siblings is already meaningful.

**The fix for Phase 2 (community):** Add a "Challenge a Friend" mode. When viewing the leaderboard, a child can tap any other player and challenge them to a 10-question head-to-head quiz on the same topic. Both answer the same questions at the same time, see each other's progress live, and the winner gets a challenge trophy. This is the Kahoot dopamine hit in an asynchronous-capable format.

**Complexity cost:** Medium-High. Requires real-time or near-real-time infrastructure (WebSockets or polling). Worth building as a Phase 2 feature, not Phase 1.

---

### GAP 6: Content Reliability — No Review Workflow Built
**Impact:** Critical for trust. If a parent sees a wrong answer in their child's learning material, they will leave and tell other parents.

**The fix:** Add a simple content status field (Draft / In Review / Published) to every piece of content in the database. Build a minimal admin interface (even just a spreadsheet-style page) where you can review and approve content before it goes live. Never show Draft content to children.

Additionally, add a "Report an Error" button on every Learn section and every quiz question. When a child or parent taps it, it flags that content item for your review. This is a safety net for errors that slip through.

**Complexity cost:** Very Low. One extra database column. One admin filter. One flag button.

---

### GAP 7: No Spaced Repetition (Topics Learned Are Never Revisited)
**Impact:** Medium. This is the biggest pedagogical gap. Learning research consistently shows that without revisiting material at spaced intervals (after 1 day, 1 week, 1 month), 70–80% of new knowledge is forgotten within a week (the Ebbinghaus Forgetting Curve).

**The fix:** After a child completes a topic, schedule it for a "Quick Recall" review — 5 questions, 2 minutes, surfaced automatically after 7 days, then 30 days, then 90 days. These are not new questions; they are drawn from the existing quiz pool. The Daily Mystery Challenge can incorporate these reviews naturally.

**Complexity cost:** Low. Add a `next_review_date` field to `topic_progress`. A background job queries upcoming reviews and surfaces them on the dashboard as "Time to revisit!" cards.

---

### GAP 8: No Parent Insight Into *What* Was Learned (Only That It Was)
**Impact:** Medium. Parents currently see "topic completed" and "quiz score". What they actually want to know is: what did my child get wrong, what were the hints used on, and what should they work on next?

**The fix:** Upgrade the parent dashboard with a "Weak Areas" view — a simple list of the specific questions where hints were used or wrong answers were given, grouped by topic, with a suggested next action ("This week, try revising: Alternate Angles — Layla used 3 hints here").

**Complexity cost:** Low. This data already exists in `quiz_attempts`. It is a read query and a UI component.

---

## 7. Summary: What to Add, in Order, Without Overcomplicating

The goal is to address the biggest gaps with the smallest effort. Here is the recommended order:

| Priority | Fix | Effort | Impact |
|---|---|---|---|
| 1 | Content review workflow (Draft/Published status + Report button) | 1 day | Prevents trust-destroying errors |
| 2 | Variable reward: Discovery Cards (collectibles after quizzes) | 2 days | Transforms points system into a collection game |
| 3 | Boss Battle: Zone Guardian challenge per unit | 2 days | Creates climax moments; memorable milestones |
| 4 | Narrative World Map (illustrated zones, illustrated per subject) | 3 days (design-heavy) | The biggest single engagement upgrade |
| 5 | Lives system on quizzes (3 hearts per attempt) | 1 day | Creates stakes without punishment |
| 6 | Daily Mystery Challenge | 1 day | Drives daily logins; broadens knowledge |
| 7 | Spaced repetition (7/30/90 day review scheduling) | 1 day | Critical for actual learning retention |
| 8 | Parent Weak Areas dashboard | 1 day | Parent trust and retention |
| 9 | Secret Bonus Room on 100% scores | 1 day | Rewards excellence |
| 10 | Year 1–2 Foundation Mode (audio-first UI) | 2 weeks | Phase 2 market expansion |
| 11 | GCSE / Year 10–11 Past Paper mode | 1 week | Phase 2 market expansion |
| 12 | Head-to-Head Challenge Mode | 2 weeks | Phase 2 social feature |

**Items 1–9 should all be in the MVP.** Together they add roughly 2 weeks of build time but elevate the platform from "good homework app" to something that can genuinely compete with the games children already love. None of them change the core architecture — they are additions to the existing design.

**Items 10–12 are Phase 2** — they expand the market but are not needed for the family pilot to succeed.

---

## 8. The One Design Principle That Unifies Everything

The best games are good at one thing our platform does not yet do: **they make the child feel like the hero of a story, not a student completing an exercise.**

Every fix in this document is in service of that principle. The world map makes the child an explorer. The Zone Guardian makes them a champion. The Discovery Cards make them a collector. The streak makes them a dedicated adventurer. The boss battle gives them a moment of triumph they can tell their friends about.

The curriculum content is the same. The learning is the same. The child's relationship to it is completely different.

---

*Analysis prepared May 2026. Revisit after Phase 1 pilot with real engagement data.*
