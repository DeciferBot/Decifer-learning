# Phase 11A — Year 3 English and Science Pipeline

## Purpose

Extend the Decifer Learning content pipeline from Maths-only to include Year 3 English and
Science. This phase delivers the **infrastructure and safety layer** only — no live batch
generation runs until the gate described in §Batch Generation Rules is cleared.

---

## Scope

| Deliverable | Status |
|---|---|
| Phase 11A documentation (this file) | ✅ |
| Schema migration: provenance fields, pipeline_runs, generation_errors | ✅ |
| `scripts/verify-content-safety.mjs` | ✅ |
| English verifier (`verifiers/english.py`) | ✅ |
| Physics verifier (`verifiers/physics.py`) — AST-only, no raw eval | ✅ |
| Chemistry verifier (`verifiers/chemistry.py`) | ✅ |
| Verifier routing in Stage 2 | ✅ |
| Per-type confidence thresholds in `config.py` | ✅ |
| Stage 6 RAG grounding enforcement for RAG-only types | ✅ |
| Subject-aware prompt builders | ✅ |
| Provenance write-back on question and learn_content rows | ✅ |
| Pipeline run and generation error tracking in DB | ✅ |
| New pipeline API endpoints (POST /generate/batch, GET /pipeline/runs, etc.) | ✅ |
| Seed scripts: outcomes, topics, chunks for English and Science Y3 | ✅ |
| Admin coverage dashboard (`app/(admin)/coverage/page.tsx`) | ✅ |

---

## Non-Goals (Phase 11A)

- **No batch generation.** The `/generate/batch` endpoint exists but no generation run is
  triggered in this phase.
- **No Year 7 English/Science.** Year 7 content pipeline is Phase 11B.
- **No child-facing routes for English or Science topics.** Topics remain `is_published=false`.
- **No changes to Vercel configuration.**
- **No weakening of Phase 10C (brand system) or Phase 10D (adaptive content freshness).**
- **No removal of `verify-content-freshness-safety` script.**

---

## Safety Principles

1. **Child-facing content = `status='published'` only.** Every child-facing query on
   `quiz_questions`, `learn_content`, and `practice_games` must include `WHERE status = 'published'`.
2. **AI generates, code verifies.** LLMs produce candidate questions. Verifiers (SymPy, Pint,
   ChemPy, LanguageTool) determine correctness. LLMs never produce the canonical answer.
3. **RAG grounding enforced for open factual types.** `english_comprehension`,
   `english_vocabulary`, `english_literary_analysis`, `biology_factual`, and `science_factual`
   cannot publish without non-empty `source_chunk_ids` that match topic subject and year group.
4. **No `NEXT_PUBLIC_` service role key.** `SUPABASE_SERVICE_ROLE_KEY` must never be exposed
   to browser bundles.
5. **No live AI in child-facing routes.** AI generation happens only in the pipeline service
   (`services/content-pipeline/`).
6. **Physics verifier: AST-only.** No raw `eval()`. Only whitelisted names and operators.
7. **English intentional-error questions use `question_metadata`.** The structured field
   separates the question instruction from the stimulus (which may contain the intentional
   error). LanguageTool is only expected to flag errors inside `intentional_error_span`;
   errors outside that span fail verification.

---

## Statutory Curriculum Spine

Seed scripts embed verbatim statutory outcome text from:

- **English KS2 (Year 3/4 programme of study):** DfE National Curriculum 2014, English,
  Key Stage 2. Grammar and punctuation, reading comprehension, spelling, vocabulary.
- **Science KS2 (Year 3 programme of study):** DfE National Curriculum 2014, Science,
  Lower Key Stage 2. Plants, Animals including humans, Rocks, Light, Forces and magnets.

**AI must not generate statutory outcomes.** Outcome text is embedded verbatim in seed scripts
only. No LLM call is made during outcome seeding.

---

## Verifier Model

| Question type | Verifier | Stage 2 action |
|---|---|---|
| `maths_arithmetic` | `verifiers/maths.py` | AST safe-eval |
| `maths_algebra` | `verifiers/maths.py` | SymPy solver |
| `maths_geometry` | `verifiers/maths.py` | safe-eval + pi |
| `english_grammar` | `verifiers/english.py` | LanguageTool structural check |
| `english_spelling` | `verifiers/english.py` | LanguageTool structural check |
| `english_comprehension` | `verifiers/english.py` | Grammar sanity on all prose fields |
| `english_vocabulary` | `verifiers/english.py` | Grammar sanity on all prose fields |
| `english_literary_analysis` | `verifiers/english.py` | Grammar sanity on all prose fields |
| `science_physics_calculation` | `verifiers/physics.py` | AST safe-eval with unit check |
| `science_chemistry_equation` | `verifiers/chemistry.py` | ChemPy balance check |
| `chemistry_element_fact` | `verifiers/chemistry.py` | Periodic table lookup |
| `biology_factual` | `verifiers/chemistry.py` | RAG-only pass-through |
| `science_factual` | `verifiers/chemistry.py` | RAG-only pass-through |
| Unknown | — | Fail closed (verified=False) |

---

## Provenance Model

Every question written to `quiz_questions` carries:
- `generator_version`: pipeline version that produced this question.
- `verifier_version`: verifier module version used.
- `published_at`: set only when `status='published'`, NULL otherwise.
- `question_metadata`: JSONB with English intentional-error structure when present.

Every `learn_content` row written by the pipeline carries:
- `confidence_score`, `source_chunk_ids`, `generator_version`, `published_at`.

---

## Pipeline Run Model

Every call to `/generate/batch` creates a `pipeline_runs` row before generation starts.
The row is updated atomically at completion with `items_attempted`, `items_published`,
`items_staged`, `items_failed`, `completed_at`, and `status` (`completed` or `failed`).

Generation failures write a `generation_errors` row with the stage number, error message,
and raw LLM output (if available). The circuit breaker (5 cycles) still applies per question.

---

## Batch Generation Rules

**Batch generation must not run until all of the following are green:**

1. Schema migration applied and `prisma validate` passes.
2. `npx tsc --noEmit` clean.
3. `npm run lint` clean.
4. `npm run build` clean.
5. `npm run verify-content-freshness-safety` all pass.
6. `npm run verify-content-safety` all pass.
7. All verifier unit tests pass.
8. Year 3 English and Science topics seeded with `is_published=false`.
9. At least one curriculum chunk exists per subject for Year 3.

---

## Rollback Plan

1. Set `is_published=false` on all Year 3 English and Science topics.
2. Delete `quiz_questions`, `learn_content`, `practice_games` rows with `status != 'published'`
   generated in this phase.
3. The Prisma migration adds nullable columns only — it is backwards-compatible and does not
   require a rollback of the migration itself.
4. Hide English and Science zones from the world map (already handled by `is_published=false`
   on topics).

---

## Acceptance Checks

- [ ] No live AI in child-facing routes.
- [ ] Child-facing content remains `published`-only.
- [ ] English intentional-error questions use `question_metadata` and pass/fail correctly.
- [ ] Physics verifier uses AST-only evaluation; no `eval()`.
- [ ] RAG-only question types cannot reach `published` without `source_chunk_ids`.
- [ ] `practice_games` now carries `status`; child-facing queries check `published`.
- [ ] Pipeline runs tracked in `pipeline_runs`; failures in `generation_errors`.
- [ ] Provenance fields written on question and learn_content rows.
- [ ] Coverage dashboard is server-component only, admin-protected, uses service role.
- [ ] All non-DB verification checks pass.
- [ ] No batch generation has been run.
