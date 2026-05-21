# UK Curriculum Coverage Report
## Decifer Learning — Sprint: Curriculum Coverage Spine

**Date:** 2026-05-21
**Author:** Automated (Claude Code)
**Status:** PARTIAL PASS — model proven; gaps documented

---

## 1. Scope

| Field | Value |
|---|---|
| Framework | England National Curriculum 2014 |
| Document | Mathematics Programmes of Study: Key Stages 1 and 2 (DFE-00178-2013) |
| Key stages covered | KS1 (Years 1–2) and KS2 (Years 3–6) |
| Subject | Mathematics |
| Domain seeded this sprint | Number – multiplication and division |
| Countries explicitly excluded | Scotland, Wales, Northern Ireland |
| Secondary (KS3+) scope | Excluded — Year 7 Algebra topic is not in KS1/KS2 scope |

> **Claim:** Decifer Learning does **not** claim full UK curriculum coverage. This report documents the coverage model for England NC Maths only, proven with one topic.

---

## 2. Outcomes mapped

### 2a. Total outcomes seeded

| Year group | Key stage | Outcomes |
|---|---|---|
| Year 1 | KS1 | 2 |
| Year 2 | KS1 | 4 |
| Year 3 | KS2 | 3 |
| Year 4 | KS2 | 5 |
| Year 5 | KS2 | 11 |
| Year 6 | KS2 | 8 |
| **Total** | **KS1+KS2** | **33** |

### 2b. Outcomes mapped to app topics

| Outcome code | Year group | Statutory outcome (summary) | App topic | Coverage | Verified |
|---|---|---|---|---|---|
| KS2 Y3 MD-001 | Year 3 | Recall and use multiplication facts for 3, 4 and 8 tables | Multiplication Tables | ✅ Full | ✅ Yes |
| KS2 Y3 MD-002 | Year 3 | Write and calculate statements for multiplication and division | Multiplication Tables | ✅ Full | ✅ Yes |
| KS2 Y3 MD-003 | Year 3 | Solve problems including missing number problems | Multiplication Tables | ✅ Full | ✅ Yes |

**Mapped:** 3 / 33 outcomes (9.1%)

---

## 3. Gaps remaining

The following outcome groups have no app topic mapped yet. These are expected gaps at this stage of the pilot.

| Year group | Key stage | Unmapped outcomes | Priority |
|---|---|---|---|
| Year 1 | KS1 | 2 | Low (out of MVP year groups) |
| Year 2 | KS1 | 4 | Low (out of MVP year groups) |
| Year 4 | KS2 | 5 | Medium (next after Y3 pilot proves) |
| Year 5 | KS2 | 11 | Medium |
| Year 6 | KS2 | 8 | Medium |

**Total unmapped:** 30 / 33 outcomes (90.9%)

> KS1 (Years 1–2) is excluded from the MVP child audience (Year 3 + Year 7 only). KS1 outcomes are seeded to document the full scope but are not expected to have app content in the current pilot.

> Year 7 is KS3, not KS2. The existing "Algebra: Solving Linear Equations" topic is outside this coverage scope.

---

## 4. Content created

The following content assets exist for the 3 mapped Year 3 outcomes (all `status = 'published'`):

| Content type | Count | Status |
|---|---|---|
| Learn content blocks | 5 | published |
| Practice games (fill-in-the-blank) | 10 | published |
| Quiz questions — sprout tier | 5 | published |
| Quiz questions — explorer tier | 5 | published |
| Quiz questions — lightning tier | 5 | published |

**Total quiz questions:** 15 published across 3 tiers.

All maths content was code-verified (arithmetic check) before publishing. No LLM-produced canonical answers.

---

## 5. Verification results

### 5a. Content verification method

| Content type | Verification method |
|---|---|
| Arithmetic answers | Safe-eval whitelist (code, not LLM) |
| Learn content | Editorial review at seed time |
| Hints | Manually ordered (hint_1 → hint_3 progressively closer to answer) |
| Distractors | Plausible wrong answers at appropriate tier |

### 5b. Schema verification

| Check | Result |
|---|---|
| `curriculum_outcomes` table created | ✅ |
| FK to `subjects` (nullable) | ✅ |
| FK to `topics` (nullable) | ✅ |
| `required_content_types TEXT[]` field | ✅ |
| `coverage_status` + `verification_status` fields | ✅ |
| Indexes on `(key_stage, year_group)` and `app_topic_id` | ✅ |
| Prisma model: `CurriculumOutcome` | ✅ |
| Back-relations on `Topic` and `Subject` | ✅ |
| Migration file created | ✅ |

### 5c. App rule verification

> **Rule:** A topic must not be displayed as "curriculum-complete" unless every required outcome is mapped, published, and verified.

| Topic | Outcomes mapped | All published | All verified | Curriculum-complete? |
|---|---|---|---|---|
| Multiplication Tables (Year 3) | 3 | ✅ Yes | ✅ Yes | ✅ YES |
| All other topics | 0 | — | — | ❌ NO |

`lib/curriculum.ts` exports `isTopicCurriculumComplete(topicId)` — a server-side check that queries `curriculum_outcomes` and verifies all required content types are present and published. Components must call this before rendering a curriculum-complete indicator.

---

## 6. Verdict

| Verdict | Detail |
|---|---|
| **PASS** | Coverage model proven with Year 3 Multiplication topic |
| **PASS** | 33 official England NC outcomes seeded (KS1+KS2, multiplication domain) |
| **PASS** | 3 Year 3 outcomes fully mapped, content published, verified |
| **PASS** | `isTopicCurriculumComplete()` enforces the display gate |
| **PASS** | Gaps clearly documented — not hidden |
| **INFO** | Overall coverage 9.1% — expected; this sprint proves the structure only |
| **EXCLUDED** | Scotland, Wales, Northern Ireland — not claimed |
| **EXCLUDED** | KS3+ (Year 7+) — not in KS1/KS2 scope |

---

## 7. Next steps

To expand coverage in subsequent sprints:

1. **Year 4 Multiplication** — seed app topic + content + map 5 outcomes
2. **Year 5 Multiplication** — seed app topic + content + map 11 outcomes
3. **Year 6 Multiplication** — seed app topic + content + map 8 outcomes
4. **Add remaining KS2 domains** — Number (place value, fractions), Measurement, Geometry, Statistics
5. **Run `seed-curriculum-ks2-maths.mjs`** for each new domain as content is created
6. **Run `verify-curriculum-coverage.mjs`** after each sprint to get an updated coverage report

---

## Appendix: Data model

```
curriculum_outcomes
  id                      UUID PK
  framework_country       TEXT    "England"
  framework_name          TEXT    "National Curriculum 2014"
  key_stage               TEXT    "KS1" | "KS2"
  year_group              TEXT    "Year 1" … "Year 6"
  subject                 TEXT    "Mathematics"
  domain                  TEXT    "Number – multiplication and division"
  statutory_outcome       TEXT    (verbatim from NC document)
  non_statutory_notes     TEXT?
  source_reference        TEXT    "NC 2014 Maths KS2 Y3 MD-001 | DFE-00178-2013 p.24"
  app_subject_id          UUID?   → subjects.id
  app_topic_id            UUID?   → topics.id
  app_skill_id            TEXT?   "times_tables_recall_3_4_8"
  required_content_types  TEXT[]  ["learn","practice","quiz_sprout","quiz_explorer","quiz_lightning"]
  coverage_status         TEXT    "mapped" | "partial" | "unmapped"
  verification_status     TEXT    "verified" | "unverified" | "failed"
  created_at              TIMESTAMP
```

**Indexes:** `(key_stage, year_group)`, `app_topic_id`, `coverage_status`
