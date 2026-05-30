# Curriculum Expansion Plan — Decifer Learning

> **Status:** ⚠ ON HOLD — see blocker below  
> **Created:** 2026-05-30  
> **North star reference:** `docs/UK_NATIONAL_CURRICULUM_MAP.md`  
> **Goal:** Expand from the current 3-subject MVP (Maths, English, Science) to the full Y1–Y9
> statutory curriculum across all 12 subjects, in a phased order that maximises child engagement
> and pipeline reuse.

---

## ⚠ Blocker (2026-05-30)

A parallel session is investigating **scraping/crawling official sources** (gov.uk, BBC Bitesize,
Oak National Academy etc.) as an alternative route to produce curriculum chunks and topic outlines.

**Do not start Phase A seed scripts or batch generation until that session reports back.**

The scraping approach could affect:
- Whether hand-written `seed-topics-*.ts` scripts are needed at all
- The format and richness of `curriculum_chunks` (scraping gives real explanatory text vs.
  hand-authored summaries)
- Whether the pipeline's RAG stage gets significantly better source material

Once the other session decides on an approach, update this section and unblock Phase A.

---

## Current state (as of 2026-05-30)

| Subject | Y1–Y2 | Y3 | Y4–Y6 | Y7–Y9 |
|---|---|---|---|---|
| Mathematics | ✅ Y2 seeded | ✅ Live | ✅ Y6 seeded | ✅ Y7 live |
| English | ✅ Y2 seeded | ✅ Live | ✅ Y6 seeded | ✅ Y7 live |
| Science | ✅ Y2 seeded | ✅ Live | ✅ Y6 seeded | ✅ Y7 live |
| History | ❌ | ❌ | ❌ | ❌ |
| Geography | ❌ | ❌ | ❌ | ❌ |
| Computing | ❌ | ❌ | ❌ | ❌ |
| D&T | ❌ | ❌ | ❌ | ❌ |
| Art and Design | ❌ | ❌ | ❌ | ❌ |
| Music | ❌ | ❌ | ❌ | ❌ |
| PE | ❌ | ❌ | ❌ | ❌ |
| Languages (MFL) | N/A | ❌ | ❌ | ❌ |
| Citizenship | N/A | N/A | N/A | ❌ |

**Total topics live:** ~62 / ~331 (~19%)

---

## Expansion phases

### Phase A — Fill missing year groups for live subjects
*Prerequisite: none. Pipeline already handles Maths/English/Science.*

Complete the year groups that are seeded but not yet generated, and add the missing years entirely.

| Step | Work | Topics |
|---|---|---|
| A1 | Generate content for all Y2 Maths, English, Science topics (seeded, not generated) | ~13 |
| A2 | Seed and generate Y1 Maths, English, Science | ~15 |
| A3 | Seed and generate Y4 and Y5 Maths, English, Science | ~48 |
| A4 | Verify Y6 content is fully generated (seeded, check gaps) | ~14 |
| A5 | Seed and generate Y8 and Y9 Maths, English, Science | ~36 |

**Deliverable:** All Y1–Y9 Maths, English, Science topics live. ~126 topics total in these 3 subjects.

**Gate:** `npm run report:coverage` shows 0 gaps for Maths/English/Science Y1–Y9.

---

### Phase B — History and Geography (KS1–KS3)
*Most quiz-friendly of the remaining subjects. Clear factual knowledge base.*

| Step | Work | Topics |
|---|---|---|
| B1 | Seed History topics (KS1, KS2, KS3) from curriculum map | 16 |
| B2 | Ingest History curriculum chunks (gov.uk + BBC Bitesize-style source material) | — |
| B3 | Generate History questions through existing pipeline (open factual, ≥90% threshold) | 16 |
| B4 | Seed Geography topics (KS1, KS2, KS3) from curriculum map | 26 |
| B5 | Ingest Geography curriculum chunks | — |
| B6 | Generate Geography questions through pipeline | 26 |
| B7 | Add History and Geography zones to world map for relevant year groups | — |

**New verifier needed:** None — History and Geography are open factual, handled by the existing
constitutional critique + RAG grounding path (≥90 threshold, `source_chunk_ids` non-empty).

**Gate:** ≥10 published questions per topic; both subjects appear on the world map for Y3 and Y7.

---

### Phase C — Computing (KS1–KS3)
*Highly quizzable. Algorithm and logic topics suit multiple-choice well.*

| Step | Work | Topics |
|---|---|---|
| C1 | Seed Computing topics (KS1, KS2, KS3) from curriculum map | 24 |
| C2 | Ingest Computing curriculum chunks (algorithms, networks, binary, Boolean logic) | — |
| C3 | Add `computing_logic` question type to pipeline router | — |
| C4 | Build a code-trace verifier for algorithm questions (simple Python safe-eval) | — |
| C5 | Generate Computing questions through updated pipeline | 24 |

**New verifier needed:** `verifiers/computing.py` — safe-eval for algorithm trace questions
(e.g. "what does this pseudocode output?"). Existing SymPy verifier is a good template.

**Gate:** Algorithm trace questions verified by code, not LLM. ≥10 published questions per topic.

---

### Phase D — Citizenship (KS3 only)
*Y7–Y9 only. Factual and opinionated — requires careful constitutional critique.*

| Step | Work | Topics |
|---|---|---|
| D1 | Seed Citizenship topics (KS3) from curriculum map | 6 |
| D2 | Ingest Citizenship curriculum chunks (Parliament, law, finance) | — |
| D3 | Add `citizenship_factual` question type — factual only, no opinion questions auto-published | — |
| D4 | Generate Citizenship questions; opinion/analysis questions stay `staged` for manual review | 6 |

**Note:** Questions about democracy, rights, and political systems require extra constitutional
critique scrutiny. The pipeline should flag any question that could be read as politically biased
for manual review even if it passes automated gates. Build this as a `citizenship_review_flag` in
the constitutional critique step.

**Gate:** Only factual, non-partisan questions auto-publish. ≥8 published questions per topic.

---

### Phase E — Languages / MFL (KS2–KS3)
*Highest complexity. Language-specific content variants required.*

| Step | Work | Topics |
|---|---|---|
| E1 | Decide initial language offering (recommend: French for KS2, French + Spanish for KS3) | — |
| E2 | Seed Languages topics (KS2 and KS3) per chosen language | 14 × n_languages |
| E3 | Ingest MFL curriculum chunks per language | — |
| E4 | Add `mfl_translation` and `mfl_grammar` question types to pipeline router | — |
| E5 | Build MFL verifier: dictionary/conjugation lookup for translation correctness | — |
| E6 | Generate MFL questions — translation, vocab, grammar | per language |

**New verifier needed:** `verifiers/mfl.py` — uses a dictionary/conjugation API or local data
(e.g. Wiktionary dumps or a language-specific library) to verify translation correctness.
LLM cannot produce the canonical answer for translations — code verifier required per §4 of CLAUDE.md.

**Gate:** Translation questions verified by code lookup, not LLM. At least one language live for
both KS2 and KS3.

---

### Phase F — Creative/Skills subjects (Music, PE, Art, D&T)
*Lowest quiz-friendliness. Knowledge content (history, theory, terminology) is quizzable;
practical skills are not. Focus on the knowledge strand only.*

| Step | Work | Topics |
|---|---|---|
| F1 | Define quizzable sub-strands for each subject (e.g. Music: notation, history; PE: rules, anatomy) | — |
| F2 | Seed topics for Music, PE, Art, D&T (knowledge strands only) | ~30 |
| F3 | Ingest curriculum chunks for knowledge strands | — |
| F4 | Generate questions — factual/knowledge only, ≥90 threshold | ~30 |
| F5 | Add non-quizzable practical topics to world map as "Learn only" nodes (no quiz) | — |

**Note:** Practical topics (e.g. "Gymnastics: Flexibility and Balance") get a Learn page with
technique guidance but no quiz. The world map node shows a book icon instead of a trophy.
This requires a `quiz_optional` flag on `topics` — add a migration for this.

**Gate:** Knowledge-strand topics have ≥8 published questions. Practical topics render as
Learn-only nodes with no quiz path.

---

## Infrastructure work required across all phases

| Item | Description | Phase |
|---|---|---|
| **`quiz_optional` field** | Add `quiz_optional BOOL DEFAULT false` to `topics` table. Practical topics set `true`. Quiz button hidden in UI. | Before F |
| **Coverage report update** | Update `scripts/report-content-coverage.py` to diff against `UK_NATIONAL_CURRICULUM_MAP.md` rather than hardcoded lists | Before A |
| **World map zone expansion** | Add new zones for History, Geography, Computing etc. for Y3 and Y7 in `zones` seed data | Before B7 |
| **Computing verifier** | `verifiers/computing.py` — safe-eval for algorithm trace questions | Before C5 |
| **MFL verifier** | `verifiers/mfl.py` — dictionary/conjugation lookup | Before E6 |
| **Citizenship review flag** | Constitutional critique extension: flag politically sensitive questions for manual review | Before D4 |

---

## Recommended execution order

```
Phase A (fill Maths/English/Science gaps)
  → Phase B (History + Geography)
    → Phase C (Computing)
      → Phase D (Citizenship)
        → Phase E (Languages)
          → Phase F (Creative subjects)
```

Phases B and C can run in parallel once Phase A is complete.
Phases D, E, F can run in parallel once B and C are stable.

---

## Success criteria for full expansion

- `npm run report:coverage` shows 0 gaps across all 12 subjects for Y1–Y9
- Every topic has ≥10 published questions
- World map shows zones for all subjects on the Y3 and Y7 maps
- No LLM-computed canonical answers anywhere in the pipeline (§4 of CLAUDE.md)
- All practical/skills topics render as Learn-only nodes where quiz is not appropriate

---

*This plan derives from `docs/UK_NATIONAL_CURRICULUM_MAP.md`. Update that document first if the
curriculum changes; then update this plan to reflect any new topics or removed topics.*
