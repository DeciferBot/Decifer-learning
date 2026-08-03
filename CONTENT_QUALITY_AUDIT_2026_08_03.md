# Content quality audit — curriculum map vs Oak, and a plan to fix it

**Date:** 2026-08-03
**Method:** Oak National Academy OpenAPI pulled live (20 catalogue calls + 18 probe calls,
1.5s apart, no writes); full-corpus SQL over `quiz_questions WHERE status='published'`;
hand-review of a 100-question stratified sample (80 LLM-generated, 20 Oak-imported).

---

## 1. Headline

Our content is **structurally sound and factually mostly right, but only a third of the
curriculum has ever been touched by Oak**, and there is one issue that is a genuine
publish-stopper rather than a quality nit.

| Measure | Value |
|---|---|
| Published questions | 7,672 |
| Sourced from Oak (authoritative, human-authored) | 498 (**6.5%**) |
| Sourced from our LLM pipeline | 7,174 (93.5%) |
| Topics in our spine | 329 |
| Oak units available across the same subjects/years | 838 |
| Our topics with **zero** Oak-sourced questions | **224 of 329 (68%)** |
| Quiz attempts ever recorded | 99 (1 in the last 30 days) |

That last row matters: the nightly anomaly detector keys off ≥15–20 first-attempt answers
per question. At 99 lifetime attempts it has never had enough signal to flag anything.
**Content quality is currently unmonitored in production.** Every number below comes from
inspection, not from live pupil data.

---

## 2. Quality score

### 2.1 Sampled defect rate (100 questions, hand-reviewed)

| Defect class | LLM (n=80) | Oak (n=20) |
|---|---|---|
| **Hard** — wrong, ambiguous, or unanswerable | **8 (10.0%)** | 2 (10.0%)* |
| Misfiled — content correct, wrong topic | 6 (7.5%) | 2 (10.0%) |
| Tier mismatch — far too easy/hard for the year | 5 (6.3%) | 0 |
| Cosmetic — typo, stray markdown | 3 (3.8%) | 2 (10.0%) |
| **Clean** | **58 (72.5%)** | **14 (70%)** |

\* Both Oak "hard" defects are the same **import bug**, not an Oak content problem — see 2.3.
Excluding it, Oak's own content was clean on every factual check in the sample.

The 10.0% LLM hard-defect rate independently reproduces the ~10.3% measured on the June
batch. It has not improved.

**Overall published-corpus quality score: roughly 72% clean, ~10% carrying a hard defect.**
Treat that as ±6pp at n=100.

### 2.2 The publish-stopper: age-inappropriate maths word problems

**40 published primary-maths questions (Years 1–6) dress arithmetic in war casualties and
the transatlantic slave trade.** Nine of them are about enslaved people. Real examples,
all currently live to 7–8 year olds:

- Year 3 Fractions — *"Historians estimate that around 450 enslaved people were held on a
  sugar plantation in the Caribbean. Three-fifths of them worked in the fields. How many
  people worked in the fields?"*
- Year 3 Multiplication — *"…around 720 enslaved people were transported on a particular
  ship over 6 voyages… How many enslaved people per voyage?"*
- Year 3 Addition — *"…the Soviet Union lost about 27 million people in total. Of these,
  approximately 8 million were soldiers. How many were civilians?"*

The arithmetic is correct in every case. That is not the problem. The problem is that this
turns mass atrocity into a counting exercise for young children, with no teaching context
and no adult present. It fails the pipeline's own constitutional critique gate
(age-appropriateness, cultural sensitivity) and it is the kind of thing a parent screenshots.

Root cause: these came from a batch that injected cross-curricular "real world" context into
maths stems without an age gate on the context. The constitutional critique stage scored
them as passing because it evaluates the *question*, not the *pairing of context to year group*.

**This should be unpublished today, before anything else on this list.**

### 2.3 Systematic, cheaply-fixable defects (measured across all 7,672)

| Issue | Count | Note |
|---|---|---|
| Unconverted `{{ }}` cloze placeholder renders as literal braces | 33 (11 Oak) | Import bug: `_clean()` in `scripts/ingest-oak-questions.py` replaces `{{}}` but not `{{ }}` with a space |
| Stem references "the source"/"the passage" the child never sees | 37 | Orphan reference — unanswerable |
| Stem references "these parts"/"this shape" with no image | 26 | Orphan visual reference |
| Stray markdown `**bold**` in stem | 60 | Renders as literal asterisks |
| Options listed inline in the stem *and* as choices | 20 | Duplicated A–D block |
| Fewer than 3 distractors | 105 | 11 Oak, 94 LLM |
| Missing hint_1 or hint_3 | 132 | All LLM |
| Explanation under 25 characters | 132 | All LLM |
| Correct answer appears in its own distractor list | 16 | Guaranteed-confusing |
| Oak imports left with generic placeholder hints | **475 of 498 (95%)** | `hints_generated: false` — the import never came back to enrich them |
| Duplicate question+answer pairs across topics | 319 redundant rows in 284 groups | 316 of them cross-topic |

Total distinct rows carrying at least one of the above: on the order of 1,000, i.e. **~13% of
the published corpus has a mechanically detectable defect** — before any judgement about
correctness.

### 2.4 Duplicate topics in the spine

11 topic titles appear more than once within the same subject. Two are outright bugs:

- **`Macbeth` exists twice in Year 11 English** (15 and 19 questions) — same year, same
  subject, two topic rows.
- **`Addition and Subtraction` exists at Year 1, Year 4 and Year 5 Maths** (70/62/45 questions).

The rest are the KS1 history/geography strands taught at both Y1 and Y2, and
`Stone Age to Iron Age Britain` at both Y3 and Y6. This duplication is the direct cause of the
316 cross-topic duplicate questions: the pipeline generates the same fact twice because we
asked it to stock the same strand twice.

---

## 3. Curriculum map vs Oak

### 3.1 Coverage table

Oak has **838 units** across the subjects and years we teach. Our spine has **329 topics**.
Our topics are broader than Oak units by design (roughly 2.5 Oak units per one of our topics),
so the counts are not meant to match. What matters is how much Oak content we actually pulled.

| Key stage | Our topics | Oak units | Topics with ≥1 Oak question |
|---|---|---|---|
| KS1 (Y1–Y2) | 47 | 139 | 23 (49%) |
| KS2 (Y3–Y6) | 113 | 325 | 52 (46%) |
| KS3 (Y7–Y9) | 115 | 158 | 30 (26%) |
| **KS4 (Y10–Y11)** | **54** | **216** | **0 (0%)** |

(KS4's 216 includes 61 History and Geography units in years we do not teach — see Gap 3.
In the three subjects we do teach at KS4 there are 155 units: 36 maths, 64 english, 55 science.)

### 3.2 The three real gaps

**Gap 1 — KS4 has never been touched by Oak.** All 1,031 published Year 10–11 questions are
LLM-generated. Oak has 36 maths, 64 english and 55 science units at KS4 that we have never
imported. A live probe of Oak's KS4 quizzes shows the yield is real but uneven:

| Subject | Quiz items probed | Importable under our current filter |
|---|---|---|
| English | 35 | **31 (89%)** |
| Maths | 72 | 25 (35%) — the other 47 are short-answer, not multiple-choice |
| Science | — | **not verified**; the probe returned no lessons for the first two KS4 science units and I did not spend more calls chasing it |

So KS4 English is the single richest untapped seam, and it maps onto our thinnest, most
LLM-dependent content.

**Gap 2 — the year filter blinds the importer.** `ingest-oak-questions.py` only accepts Oak
units whose `yearSlug` equals our year label. Oak files content by *its* year, and the National
Curriculum specifies History and Geography by **key stage, not year** (verified on gov.uk).
So Oak's Ancient Greece unit sits at `year-4` and our topic sits at Year 6 — the importer
never sees it. This is why History and Geography are our thinnest subjects
(Y5 History: 4 of 4 topics under 15 questions, 0 Oak content, despite 6 Oak units available).

**Gap 3 — KS4 History and Geography do not exist in our spine at all.** Oak has 20 history and
41 geography units at KS4. We have zero Year 10–11 topics in either subject. That is a product
scope decision, not a defect — but it is a decision, and it is currently implicit.

### 3.3 Where Oak is and is not authoritative

Using Oak as the authoritative source is right, with two caveats found in the sample:

- **Oak's year placement is not statutory** for History and Geography. Trust Oak's *content*;
  do not trust Oak's *year* as a curriculum constraint. Map by key stage.
- **Oak's own quizzes assume the lesson.** Two sampled Oak questions were unanswerable
  standalone (*"When did the Ancient Romans travel back from Wales?"*). The existing
  `is_self_contained()` filter catches most of these; it does not catch questions that are
  grammatically self-contained but contextually dependent.

---

## 4. Plan

Ordered by value per unit of effort. Steps 1–3 need no Oak calls at all.

### Step 1 — DONE (2026-08-03). Two things this document got wrong.

**"Move them to `flagged`" would have been undone within a day.** `flagged` is the input queue
for `/api/cron/regenerate-flagged`, which parks the original in `staged`, which is the input
queue for `/api/cron/fix-staged-all`, which republishes anything scoring ≥ 80. Three of the
four non-published states walk back to `published` — there was no quarantine. A terminal
`retired` value was added to the `ContentStatus` enum; no cron consumes it. See CLAUDE.md §8.

**"40 questions" came from my first regex, and it was loose.** A precise gate finds **16**,
every one verified by hand as a maths question whose numbers are counts of enslaved people,
Holocaust victims, or war dead — including a Year 5 question computing a slave trader's profit
per person sold. The other ~24 were Roman soldiers marching and WWI shell production: ordinary
historical word problems. A first draft of the gate also fired on the UK's 2025 population and
on Justine's execution in *Frankenstein*; that version was discarded rather than shipped.

Shipped: `services/content-pipeline/verifiers/gates.py` (30 self-tests), wired into `run_one`
as **Stage 1b** — before any paid verification call, so a bad candidate is discarded rather
than written anywhere. `stage4_constitutional` now fails closed. Deployed to the live pipeline
container and health-checked.

**Verified:** 16 sensitivity + 61 containment rows retired, 345 markup defects repaired in
place, 13 pipe-table rows deliberately left alone (string surgery cannot fix them — they need
regeneration). The published corpus now returns zero for `according to the sources`, stray
`**` emphasis, and suffering-as-arithmetic.

### Step 2 — Mechanical clean-up sweep (~1 day)

One script, one pass, all measured in §2.3:

- Fix `_clean()` to handle `{{ }}` (whitespace-tolerant) and re-run it over the 33 affected rows.
- Strip stray `**` markdown from 60 stems; strip the duplicated inline A–D block from 20.
- Flag the 37 orphan source-references and 26 orphan visual-references for regeneration —
  these are unanswerable and cannot be repaired by string surgery.
- Flag the 16 answer-in-distractor rows.
- Demote to `staged` anything with fewer than 3 distractors (105) until topped up.

**Done when:** the §2.3 table reads zero on every mechanical row.

### Step 3 — Fix the spine before adding more content (~half a day)

Adding questions to a duplicated topic just duplicates questions. Do this before Step 4.

- Merge the two Year 11 `Macbeth` topics into one.
- Decide, per duplicated strand, which year owns it; retire the other topic and re-point its
  questions. **Do not use "keep the lowest year" as the rule** — it produces wrong results
  (it would file *Expand 8(x+3)* under Solving Linear Equations).
- Re-run the cross-topic duplicate detector; expect the 316 redundant rows to collapse.

**Done when:** no topic title repeats within a subject except where deliberately retained,
and cross-topic duplicates are under 20.

### Step 4 — Import Oak at KS4, English first (~1 day, ~400 Oak calls)

Highest-yield seam: 89% importable, 54 topics currently at 0% Oak coverage.

Budget the run: 64 units × up to 6 lessons × 1 quiz call ≈ 400 calls at 1.5s = ~10 minutes of
wall clock. Run it from the droplet with `setsid nohup`, not an interactive SSH pipe. Dry-run
first and eyeball 20 matches before writing.

Then KS4 maths (35% yield, still ~150 usable questions), and verify whether KS4 science has
lessons at all before budgeting for it.

**Done when:** every Y10–Y11 topic has ≥5 Oak-sourced questions, or a written note saying why
Oak has nothing usable for it.

### Step 5 — Unblind the importer to Oak's year filing (~half a day + a re-run)

Change unit selection from "Oak year == our year" to "Oak key stage == our key stage", then let
the existing LLM topic map (`scripts/oak-topic-map.json`) decide placement. That map already
reasons about content rather than year labels; the year filter is what is starving it.

Re-run for History and Geography across KS1–KS3. Target the 21 topics currently under 12
published questions.

**Done when:** no History or Geography topic sits under 12 published questions.

### Step 6 — Enrich the 475 Oak questions stuck on placeholder hints (~1 day of pipeline time)

These are our *highest-quality* questions carrying our *lowest-quality* hints. Oak already
gives us lesson keywords; the import only ever used the first one for `hint_1`. Run a
hint-generation pass over rows where `question_metadata->>'hints_generated' = 'false'`,
grounded in the Oak lesson summary. Cheap on DeepSeek.

**Done when:** generic-hint count is under 50.

### Step 7 — Restore the quality feedback loop (~half a day)

The anomaly detector is architecturally fine and practically dead — 99 lifetime attempts
cannot trigger a 15-attempt threshold. Until usage exists, quality must be sampled, not
observed. Add a nightly job that hand-audits 25 random published questions through the
consensus + constitutional gates and reports a rolling defect rate to the admin dashboard.
That gives a quality number that moves without needing pupils.

**Done when:** the admin dashboard shows a rolling 7-day sampled defect rate.

---

## 5. What I did not verify

- **Oak KS4 science yield.** The probe returned no lessons for the first two KS4 science units.
  Could be unit selection, could be that Oak files KS4 science under `biology`/`chemistry`/
  `physics` (those slugs returned HTTP 400 at every key stage). Needs ~10 more calls to settle.
- **The 100-question sample is n=100.** The ±6pp band is wide. The *systematic* counts in §2.3
  are full-corpus and exact; the *defect rate* in §2.1 is a sample.
- **Nothing was written to the database in this audit.** All findings are read-only.
