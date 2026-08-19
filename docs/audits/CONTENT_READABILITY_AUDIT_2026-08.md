# Content Pipeline Reading-Level Audit — 2026-08-18

> How the content pipeline controls (or fails to control) the reading level and
> length of content children see. Scope: `services/content-pipeline/` (pipeline.py,
> config.py, main.py, verifiers/), generation/seed scripts under `scripts/`, golden
> fixtures, and the Explore TTS surface. Read-only audit; no files modified.
> Feeds `docs/PRODUCT_ROADMAP_2026.md`. File:line references as of commit a67fbf3.

**Headline finding:** the pipeline differentiates year groups only by *telling the LLM the year label* and asking downstream LLM judges whether the result is "age-appropriate". There is no explicit vocabulary, sentence-length, or reading-age instruction anywhere in the prompts, no automated readability scoring anywhere in the repo, and no length limits on the fields a child reads. A Year 2 question and a Year 10 question are produced by byte-identical prompt templates that differ only in the interpolated strings "Year 2 (KS1…)" vs "Year 10 (KS4…)".

## 1. Year-group awareness in generation

All four subject prompt builders live in `services/content-pipeline/pipeline.py` (`_build_maths_prompt` :156, `_build_english_prompt` :461, `_build_science_prompt` :636, `_build_humanities_prompt` :767). What changes between Year 2 and Year 10 is exactly three interpolations:

- The persona line, e.g. maths at pipeline.py:361: `"You are an expert UK mathematics curriculum writer generating quiz questions for {year_label} pupils ({key_stage}, UK National Curriculum)."`
- The header block (:365): `Year group: {year_label}`
- One appropriateness sentence (:377): `QUESTION: Clear, unambiguous, appropriate for {year_label}. One correct answer.`

`year_label`/`key_stage` come from `_YEAR_GROUP_DISPLAY` (pipeline.py:149-152) via `config.YEAR_KEY_STAGE` (config.py:124-129). "Appropriate for Year 2" is asserted, never defined. **No instruction anywhere about vocabulary lists, sentence length, phonics-decodable words, or reading age per year group or key stage — for any subject.**

Tier-specific language guidance is limited to `_TIER_DESCRIPTIONS` (pipeline.py:140-144): `"sprout": "…Simple language for the year group."`, `"explorer": "…Moderate vocabulary."` — one undefined clause each, identical whether the year is 2 or 11. Multipart prompts add a bare `Language appropriate for {year_label}` (true/false grid :1291; ordered list :1416).

The Y2 batch runner (`scripts/generate-batch-y2.py`) adds nothing — it feeds Year 2 topic slugs into the same pipeline. The only *implicit* KS1 differentiation is retrieval: RAG chunks are filtered to the topic's key stage (pipeline.py:1809-1817, config.py:137-146), which nudges content difficulty, not prose difficulty, since the model rewrites freely around the fact.

## 2. Length constraints

**Prompts.** The only length rules constrain non-child-read or exam-format fields: `ordered_list` items "under 12 words" (:1416); `source_analysis` excerpt "(50–120 words)" (:1322); `structured_answer` model answer "3–6 sentences" (:1249, a KS3/KS4 type); learn content "Length: 300–500 words total" (`scripts/generate-learn-content.py:301`) — the same target for every year group. **No min/max on `question_text`, `hint_1..3`, or `explanation` in any prompt.**

**Validation.** Deterministic gates check only minimums, as anti-stub guards: `verifiers/gates.py:229-232` rejects an explanation under 25 characters or one starting "The correct answer is:"; `_verify_multipart` requires ≥30 words for a structured_answer model answer (pipeline.py:1196). Nothing caps length. `scripts/fix-explanations.py:76` rejects regenerated explanations under 20 chars — again a floor.

**DB.** All child-facing text columns are unbounded Postgres TEXT (`prisma/schema.prisma:329-336`, :294). No `@db.VarChar` on content fields.

**Implicit ceilings** only via LLM output budgets: Stage-1 `max_tokens=1024` (pipeline.py:1070; ≥2048 on the DeepSeek path :76), learn HTML `max_tokens=1024`, explanation repair `max_tokens=300`. These bound the whole JSON payload, not any child-visible field.

**Golden-item stats.** `tests/golden/golden_items.json` is a Stage-2 verifier regression bank (`_meta.purpose`, line 3), not production content. For what it is worth: 11 of 34 items have a `question_text`; avg 5.9 words. 18 hints avg 5.6 words; 6 explanations avg 7.8 words. These are short because the fixtures are minimal, not because anything enforces shortness — the prompt's own exemplars run much longer (fraction archetype G at pipeline.py:245; the Y8 33-word stem style in gates.py test fixtures :464-467).

## 3. Hints and explanations

Hints are generated in the same single Stage-1 call, constrained by *progression and answer-leak* rules only. Maths is strict (pipeline.py:381-396): hint_1 "Conceptual nudge only… Do NOT use the question's specific numbers", hint_2 "Method step only", hint_3 "Final strategy or check only… WITHOUT stating the final number", plus five "ABSOLUTE RULES" about not leaking the answer. English/science get one line (:559, :727). Explanations: "Full step-by-step working" (:398) or "Clear explanation of why the correct answer is right" (:561). **Nothing says what reading level the hint or explanation must be written at.** Only the repair scripts state the audience: `scripts/improve-questions.py:210-213` "hints must be written FOR THE CHILD (age-appropriate for the year group)…" and `scripts/fix-explanations.py:58-70` — fix-up paths, not the main pipeline.

They are intended to be read by the child (the constitutional stage's `technique_hint` is "shown to the child when they answer incorrectly", pipeline.py:983-985) and the UI renders them (QuizShell). Real examples with reading-level judgment:

1. **Y3 sprout maths seed** (`scripts/seed-phase4.1-quiz.mjs:30-37`): Q "What is 2 × 4?", hint_1 "Think of 2 groups of 4.", explanation "2 × 4 means 2 groups of 4. 4 + 4 = 8." — genuinely decodable at 6–7. This is the hand-written floor, not pipeline output.
2. **Phonics golden item** (golden_items.json:387-395): hint_3 "The sh digraph makes a sound like hushing someone." — a Year 2 child still *learning* the /sh/ grapheme cannot independently read a sentence containing "digraph". The question ("What sound does the digraph 'sh' make?") assumes the reading skill it is teaching.
3. **Gates fixture, Y3 register** (`verifiers/gates.py:420-424`): hint_2 "Seven eights is close to seven tens minus seven twos." — decodable at 7–8, conceptually opaque younger.
4. **Comprehension golden item** (golden_items.json:426-433): explanation "The passage states that the character journeyed to the forest." — mark-scheme register, not speech to a 6-year-old; the humanities prompts ("cite the relevant fact from the sources", pipeline.py:872) actively encourage this.

Written *at* the child, at an uncontrolled register that drifts adult/teacherly for anything non-maths, with no check catching it.

## 4. Learn content (`learn_content.body_html`)

Generated by `scripts/generate-learn-content.py`, not by the six-stage pipeline. `SYSTEM_PROMPT` (:291-304): "expert UK primary and secondary school teacher writing engaging, age-appropriate lesson content… Length: 300–500 words total." The user prompt supplies only `Year group: {year_label} ({key_stage})` (:322-323). **The same 300–500-word, same-structure lesson is demanded for Year 2 and Year 11** — a substantial independent-reading load for a 6-year-old regardless of vocabulary. Readability control: none. Verification: none — rows are inserted **directly as `status='published'`** (:7 "pilot fast-path — no staged review"; INSERT at :180-186), bypassing every gate the quiz pipeline has, including the constitution's age-appropriate-language line. `foundation_audio_url`: defined in `prisma/schema.prisma:296` and its migration, **written by nothing** — a repo-wide grep finds no other reference. The audio-first affordance for young readers is a dead column.

## 5. Constitutional critique (Stage 4)

The constitution (`pipeline.py:934-944`) opens with the only reading-level control in the whole system: **"Age-appropriate language for the stated year group."** Three weaknesses make it near-inert: (a) one undefined clause judged by `deepseek-4-flash` (config.py:48), which sees the year label but no definition of what Year 2 language is; (b) the closing instruction (:944) — "Only flag violations that are clear and significant. Do not flag minor wording imperfections." — tells the judge to wave through register drift; (c) a violation costs only −10 (pipeline.py:1834), and the judge is instructed not to flag borderline language. The gates module's own docstring concedes the model-judge problem for the sibling criterion: "Age-appropriateness must not be a model judgement call. It is data." (gates.py:21-22) — but the deterministic replacement (`check_sensitivity`, :130) covers only sensitive *subject matter*, never language complexity. Stage 3 consensus (:918-931) asks "Is the tier appropriate for {year_label}…?" — a difficulty check, not a readability check.

## 6. Verification gap — automated readability scoring

Confirmed absent. A case-insensitive repo-wide grep for `flesch|readab|reading_age|grade_level|spache|syllab|dale-chall|smog|lexile` returns **zero readability-scoring code** (hits are UI copy, docs, the parent SyllabusHeatmap, and one english-verifier hint string). No `textstat` (or similar) in `services/content-pipeline/requirements.txt` or `package.json`. The verifiers check correctness only: SymPy/safe-eval, Pint, ChemPy/periodic table, LanguageTool en-GB (grammar of the prose, indifferent to whether the vocabulary suits a 6-year-old), and the entailment verifier. The one *planned* control — `readingAgeMax: 6 // Enforced via constitutional check` (`EduPlatform_Upgrade_Plan.md:1071-1072`) — belongs to deferred Foundation Mode in a superseded doc and appears in no code file. Note also `scripts/generate-content.ts` (named in CLAUDE.md §12) does not exist; generation runs through the Python batch scripts.

## 7. KS1 / Year 2 specifics

**`quiz_questions.foundation_images` is populated by nothing.** `db.write_question` (services/content-pipeline/db.py:388-428) writes 25 columns; `foundation_images` is not among them, and no script writes it (`scripts/apply-content-gates.py:104,134` only reads it; `scripts/seed-diagram-widgets.ts` writes the *learn_content* column, guarded "only set when the column is empty" :12). In golden data: 0 of 34 items carry it. The system treats it as an always-empty read: `QuizShell.tsx:1148` renders it if present; the containment gate accepts it as attached stimulus (gates.py:310); anomaly rule 3 flags visual-referencing questions *lacking* it (`app/api/cron/anomaly-detect/route.ts:8`); the staged-promotion migration (`supabase/migrations/20260611120000_promote_qualified_staged.sql:21-22`) only auto-promotes questions where it is empty. **There is no picture-answer format at all — Year 2 gets the same text-MCQ UI as Year 10.**

**Audio.** No TTS or audio generation exists in the question pipeline or Learn page. The one working TTS stack is Explore-only: `main.py:123-150` exposes `POST /tts` running Piper offline (`en_GB-jenny_dioco-medium`); `lib/explore/tts.ts` caches WAVs in the `explore-tts` Supabase bucket keyed by sha256(voice+format+text), ≤2000 chars per utterance; `scripts/warm-explore-tts.mjs` pre-warms only `explorer_nodes` narration; playback via `components/explore/NarrationButton.tsx`, used solely by the six Explore modules. **Reuse is straightforward**: the endpoint takes arbitrary text, is free/offline/CPU-only, and the cache is content-addressed — pointing it at `question_text`/hints (and finally populating `foundation_audio_url`) would need no new infrastructure, only a warm-walk over published KS1 questions and a play button in QuizShell/Learn.

## Sample content readability (real items)

| Source | Text | Verdict for age 6–7 |
|---|---|---|
| seed-phase4.1-quiz.mjs:30-37 (Y3 sprout) | "What is 2 × 4?" / "Think of 2 groups of 4." | Readable alone. Hand-written seed, not pipeline output. |
| golden_items.json:389-395 (phonics) | "What sound does the digraph 'sh' make?" | Not readable alone — "digraph" defeats the very reader it targets. |
| golden_items.json:428-429 (comprehension) | "The passage states that the character journeyed to the forest." | Teacher-note register; not independent-readable at 6–7. |
| gates.py:421 (Y3 fixture) | "Seven eights is close to seven tens minus seven twos." | Decodable at 7–8, conceptually opaque younger. |
| generate-learn-content.py:301 (all years) | 300–500-word HTML lesson | Volume alone exceeds independent-reading stamina at Y2. |

## Reading-level control gaps, ranked by severity for a Year 2–3 child

1. **No readability scoring anywhere** — no Flesch/reading-age/syllable metric, no textstat dependency; nothing can even *detect* a KS4-register Year 2 question.
2. **Prompts carry zero language specification per year** — the entire Y2-vs-Y10 difference is the interpolated label plus the word "appropriate" (pipeline.py:361/377).
3. **The one language criterion is a single vague constitution line judged by a small model told not to flag minor wording issues** (pipeline.py:934, :944) — the system's own docs concede model-judged age-appropriateness failed for subject matter (gates.py:12-22), yet language got no deterministic replacement.
4. **Learn content is one-size-fits-all and unvetted** — same 300–500-word prose target for Y2 and Y11, inserted straight to `published` with no gate (generate-learn-content.py:7, :180-186).
5. **KS1 scaffolds are dead columns** — `foundation_audio_url` and `quiz_questions.foundation_images` written by nothing; no picture-answer mode; working Piper TTS exists but serves only Explore.
6. **No length ceilings on child-read fields** — a 60-word stem for a Year 2 reader passes every gate.
7. **Hints/explanations have no audience-register control in the main pipeline** — "written FOR THE CHILD" appears only in the repair scripts, so first-pass content lawfully ships in mark-scheme register.
