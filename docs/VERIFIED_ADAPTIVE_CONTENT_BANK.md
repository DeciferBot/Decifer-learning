# Verified Adaptive Content Bank

> Phase 10D — Content Freshness and Adaptive Selection Architecture  
> Status: Implemented

---

## 1. Problem Statement

Decifer Learning must feel fresh to a child who returns day after day, but must remain safe enough that a parent never worries a hallucinated answer slipped through.

Without a deliberate architecture, the app faces two failure modes:

1. **Stale repetition**: a small question pool means children see the same questions every quiz, destroying engagement.
2. **Live AI generation**: generating questions at request time risks hallucinations, factual errors, age-inappropriate content, and safeguarding failures reaching children directly.

Both failure modes are unacceptable. This document defines the architecture that avoids both.

---

## 2. Why Static Content Fails

| Problem | Impact |
|---|---|
| Same 10 questions every quiz | Child memorises answers; learning signal collapses |
| Same fill-blank items every practice | Session feels like rote repetition, not genuine practice |
| No difficulty adaptation | Strong children are bored; struggling children lose hearts on overly hard items |
| No mistake review | Errors are forgotten; spaced repetition cannot surface weak spots |
| Pool too small to rotate | Once a child completes a topic, every revisit is identical |

A topic needs 50–300 published questions before random selection alone provides adequate freshness. Until pools reach that size, selection must be adaptive to get maximum value from what exists.

---

## 3. Why Live AI Generation Is Risky

Generating content at runtime in front of children is not an option at Decifer for these reasons:

| Risk | Why It Matters |
|---|---|
| **Hallucination** | LLMs can produce plausible-sounding incorrect answers, especially for maths and science |
| **Factual error** | Without code verification (SymPy, Pint, ChemPy), wrong answers may look correct |
| **Safeguarding** | Unfiltered LLM output may produce age-inappropriate content |
| **Inconsistency** | Same question may get different answers on retries; children see contradictions |
| **No audit trail** | A live-generated question that caused harm cannot be traced to a source |
| **Pipeline bypass** | Live generation skips the 6-stage quality pipeline that protects children |
| **Latency** | LLM calls add 1–5 seconds of generation delay to every quiz question |

**Conclusion**: AI generates draft content only inside the offline pipeline. Children only ever see `status='published'` content that has passed all quality gates.

---

## 4. The Decifer Solution

```
OFFLINE (admin / pipeline)          RUNTIME (child journey)
─────────────────────────────────   ──────────────────────────────────────
                                    
  AI generates draft               
      │                            
      ▼                            
  Code verifier                   
  (SymPy / Pint / LanguageTool)   
      │                            
      ▼                            
  Consensus check                 
      │                            
      ▼                            
  Constitutional critique         
      │                            
      ▼                            
  Semantic dedup                  
      │                            
      ▼                            
  Confidence gate ──────► status='published' ──────► Adaptive selector
                                                          │
                                                          ▼
                                                    Attempt history query
                                                          │
                                                          ▼
                                                    Fresh pool filter
                                                          │
                                                          ▼
                                                    Tier balance
                                                          │
                                                          ▼
                                                    Mistake review mix
                                                          │
                                                          ▼
                                                    Final question set ──► Child
```

Freshness is delivered by:
1. Growing the verified pool over time (more content = more variety)
2. Adaptive selection that avoids recently-seen questions
3. Including mistake review for personalised relevance
4. Tier balancing for appropriate difficulty mix

---

## 5. Verified Content Bank Architecture

### Content Pool

All child-facing content lives in the database as versioned rows:

| Table | Purpose |
|---|---|
| `quiz_questions` | Individual Q&A questions with tiers, hints, distractors |
| `practice_games` | Practice game configurations (fill_blank, etc.) |
| `learn_content` | HTML lesson bodies with examples |
| `card_catalog` | Discovery Cards with facts and rarity |

Every row carries a `status` field:

| Status | Child-facing? |
|---|---|
| `staged` | No — awaiting review or below confidence threshold |
| `published` | Yes — passed all quality gates |
| `flagged` | No — anomaly detection raised an issue |
| `regenerating` | No — in pipeline regeneration loop |

**Hard rule**: Every query that serves content to children MUST include `WHERE status = 'published'`. This is enforced at both the application layer and the Supabase RLS layer (defence-in-depth).

### Content Generation Flow

1. Curriculum team or admin triggers generation for a topic.
2. Pipeline fetches top-5 curriculum chunks from `curriculum_chunks` (RAG).
3. Claude generates a candidate question in strict JSON format.
4. Code verifier checks the answer deterministically.
5. Consensus check (second Claude call at temperature=0).
6. Constitutional critique (third Claude call, structured rubric).
7. Semantic deduplication against existing published pool.
8. Confidence gate — sets `status='published'`, `status='staged'`, or queues `status='regenerating'`.
9. Published item enters the pool. Adaptive selector can now use it.

---

## 6. Runtime Selection Rules

### Shared Rules (Quiz and Practice)

1. **Only `status='published'` content is ever selected.** No exceptions.
2. **No AI calls at runtime.** Selection is pure database queries + in-memory sorting.
3. **No duplicate questions in one session.** Deduplication is applied before returning.
4. **Attempt history is consulted.** The selector queries `quiz_answers` + `quiz_attempts` to build a recently-seen set.
5. **Graceful fallback on small pools.** If fewer questions exist than the desired count, use the full pool with a log entry explaining why. Never show children an error caused by pool size.
6. **Logging.** Every selection logs a structured audit record (see §12).

---

## 7. Quiz Selection Rules

Quiz selection is more controlled than practice because quiz scores drive progress, SM-2 scheduling, and badge awards.

### Algorithm

1. Fetch all published questions for the topic.
2. Query the child's last 2 quiz attempts for this topic.
3. Collect all `question_id` values from `quiz_answers` in those attempts → "recently-seen set".
4. Also collect incorrect `question_id` values from last 3 attempts → "mistake set".
5. Split pool into `fresh` (not recently seen) and `seen`.
6. Apply tier-balanced selection from the fresh pool.
7. If `fresh.length < count`, supplement with shuffled recently-seen questions (log a fallback reason).
8. If `pool.length < count`, use full pool (log a fallback reason).
9. Deduplicate.
10. Return final question set.

### Tier Balance (Quiz)

| Tier | Target share | Rationale |
|---|---|---|
| `sprout` | ~40% | Confidence building; review of foundational content |
| `explorer` | ~40% | Current-skill practice at expected level |
| `lightning` | ~20% | Stretch / challenge questions |

### Parameters

| Parameter | Default | Notes |
|---|---|---|
| `count` | 10 | Questions per quiz |
| `lookbackAttempts` | 2 | Quiz attempts to treat as "recently seen" |
| `mistakeLookback` | 3 | Attempts to search for mistakes |

---

## 8. Practice Selection Rules

Practice is lower-stakes than quiz — no pass/fail, no score written to progress. Its job is reinforcement and exploration.

### Practice Mix

| Bucket | Share | Source |
|---|---|---|
| Current skill | 50% | `explorer`-tier fresh questions |
| Confidence review | 20% | `sprout`-tier fresh questions |
| Mistake review | 20% | Questions the child got wrong in last 3 quizzes |
| Challenge | 10% | `lightning`-tier fresh questions |

### Fill-Blank Practice Games

The `practice_games` table stores game configurations with `config_json.questions[]`. For fill-blank games:

- Questions are shuffled each visit.
- A random subset is shown (rather than the full list always).
- This provides session-level rotation without DB history for practice.
- For richer rotation, add more items to `config_json.questions` and keep the shown subset smaller.

### Parameters

| Parameter | Default | Notes |
|---|---|---|
| `maxItems` | 12 | Max questions per practice session |
| `lookbackAttempts` | 2 | Attempts to treat as recently seen |

---

## 9. Attempt History Model

### Tables Used

| Table | Field | Role in Selection |
|---|---|---|
| `quiz_attempts` | `profile_id`, `topic_id`, `created_at` | Identify the child's recent attempts for a topic |
| `quiz_answers` | `attempt_id`, `question_id`, `was_correct` | Find which questions were seen and which were missed |
| `session_answers` | `profile_id`, `question_id`, `was_correct`, `tier` | Rolling window for within-session adaptive difficulty |

### No Schema Changes Required

The existing schema already contains everything needed:
- `quiz_attempts` and `quiz_answers` give a complete per-question history per child.
- `session_answers` provides the rolling 10-answer window for in-session adaptation.
- All tables have `created_at` for recency queries.

---

## 10. Repetition Avoidance

### Quiz

- Questions seen in the last 2 quizzes are deprioritised.
- They are only included if the fresh pool cannot fill the desired count.
- This means a child who completes 2 quizzes before the pool grows will see some repetition, but the selector logs why and new content immediately expands the fresh pool.

### Practice

- Session-level shuffle ensures different item ordering each visit.
- Mistake-review questions are intentionally included (repetition for learning, not accident).
- As the quiz_questions pool grows, the practice selector draws from a larger fresh set.

### SM-2 Spaced Repetition (topic level)

`topic_progress.sr_next_review` determines when a completed topic re-appears on the dashboard. This is a separate mechanism from question-level freshness — it controls how often the child revisits a topic, while the adaptive selector controls which questions they see within a visit.

---

## 11. Difficulty Balancing

Difficulty is encoded in the `tier` field on `quiz_questions`:

| Tier | Description | Typical use |
|---|---|---|
| `sprout` | Foundation level — core concept, low cognitive load | Confidence building, early practice |
| `explorer` | Expected attainment — standard UK NC question | Main quiz content |
| `lightning` | Stretch — above-expected challenge | Top of quiz/practice; challenge bucket |

The tier balance in §7 and §8 operationalises difficulty balancing. Children always see a mix rather than an accidental run of very hard or very easy questions.

---

## 12. Skill Coverage Balancing

Within a topic, questions are tagged to `tier` but not to sub-skill. As the pipeline matures, subject-specific sub-skill tagging (e.g. `multiplication:commutativity`, `fractions:equivalent`) can be added to `quiz_questions` config and factored into selection. This is not in scope for Phase 10D but the adaptive selector is designed to accept additional filter criteria.

---

## 13. Mistake Review Logic

Mistakes are sourced from `quiz_answers.was_correct = false` in the child's last 3 quiz attempts for the topic.

In practice selection, 20% of items are drawn from the mistake set. This means:
- If a child struggled with fraction questions last week, today's practice will include fraction questions.
- If no mistakes exist (child aced everything), the mistake bucket is empty and the remaining percentage is filled from other buckets.

In quiz selection, mistakes are not explicitly targeted (to avoid a demoralising experience). However, the mistake set informs the implicit review since missed questions return to the "fresh" pool more quickly.

---

## 14. Template-Based Generation Model

For code-verifiable subjects (Tier 1), question generation should prefer templates over free-form AI authoring. Templates guarantee:
- The answer is always deterministically calculable.
- Distractors can be computed as plausible wrong answers (off-by-one, factor confusion, etc.).
- No hallucination risk on the answer itself.
- Variants are nearly infinite with small parameter ranges.

### Example Templates (Year 3 Maths — Multiplication)

```
What is {{a}} × {{b}}?
  answer: a * b
  distractors: [a*b+1, a*b-1, a*(b+1)]

Fill in the missing number: {{a}} × __ = {{answer}}
  bound: answer = a * b, display b as blank
  distractors: [b+1, b-1, b+2]

{{a}} groups of {{b}} apples. How many apples are there?
  answer: a * b
  distractors: [a+b, a*b+a, a*b-b]

If {{a}} × {{b}} = {{answer}}, what is {{answer}} ÷ {{a}}?
  answer: b
  distractors: [b+1, b-1, a]
```

Allowed parameter ranges for Year 3:
- Multiplication tables 2–12 (NC requirement)
- `a` ∈ {2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12}
- `b` ∈ {1..12}

Template generation produces variants that:
1. Pass SymPy / safe-eval verification automatically.
2. Have plausible distractors (not random large numbers).
3. Map cleanly to all three tiers (sprout: ×2, ×5, ×10; explorer: ×3, ×4, ×6; lightning: ×7, ×8, ×9, ×11, ×12).

Template variants are generated by the pipeline, stored as ordinary `quiz_questions` rows, and published through the same 6-stage gates. The template itself is never exposed to children.

---

## 15. AI-Generated Draft Content Rules

When AI drafts content (Stage 1 of the pipeline):

1. Only `claude-sonnet` (latest) is used for generation.
2. Only `text-embedding-ada-002` or `sentence-transformers` is used for embeddings.
3. The prompt constrains the AI to use only the injected curriculum chunks as facts.
4. The AI must return strict JSON (question, correct_answer, distractors, hint_1..3, explanation, source_chunk_ids).
5. If `source_chunk_ids` is empty for content types that require grounding, the item is rejected immediately.
6. The AI never computes the canonical answer. The answer comes from the code verifier.
7. Temperature is `0.0` for consensus calls.
8. Max 5 regeneration cycles per item before the circuit breaker fires and logs.

---

## 16. Published-Only Child-Facing Rule

Every function, API route, and SQL query that returns content to children must include a `status = 'published'` filter. This is checked at two layers:

| Layer | Mechanism |
|---|---|
| Application | `.eq('status', 'published')` in Supabase queries / `where: { status: 'published' }` in Prisma queries |
| Database | Supabase RLS policy `quiz_questions_select_published` — child role cannot read non-published rows even if the app filter is accidentally omitted |

The verification script (`scripts/verify-content-freshness-safety.mjs`) checks that the adaptive selector code contains these filters and that no AI provider is called at runtime.

---

## 17. Content Risk Tiers

See `lib/contentRiskTiers.ts` for the canonical machine-readable definitions.

### Tier 1 — Code-Verifiable Content (Lowest Risk)

**Examples**: arithmetic, algebra, geometry, physics calculations, unit conversions

**Allowed approach**:
- Template-based generation preferred.
- SymPy / safe-eval / Pint for answer verification.
- Automated validation sufficient.
- Confidence threshold ≥ 85.
- AI generates distractors and hints; verifier produces the canonical answer.

**Why lowest risk**: The correct answer can be computed independently of AI. If the AI hallucinates an incorrect answer, the verifier rejects it. The pipeline never auto-publishes a wrong maths answer.

### Tier 2 — Rule-Verifiable Content

**Examples**: grammar, spelling, punctuation, basic language mechanics

**Allowed approach**:
- Template generation preferred for pattern questions.
- LanguageTool (`en-GB`) for grammar/spelling rule validation.
- Controlled AI assistance if templates don't cover the concept.
- Confidence threshold ≥ 85 + LanguageTool clean.

**Why moderate risk**: Grammar rules have correct answers, but edge cases (acceptable alternatives, style vs. rule) create ambiguity. LanguageTool catches obvious errors but is not infallible on nuanced grammar.

### Tier 3 — Source-Backed Factual Content

**Examples**: science facts, geography, history, civics

**Allowed approach**:
- AI may draft, but only from injected curriculum chunks (no free-form generation).
- `source_chunk_ids` must be non-empty — every fact must trace to a chunk.
- Higher confidence threshold ≥ 90.
- No unsupported claims.
- Semantic deduplication against existing pool.

**Why higher risk**: Facts can be correct-sounding but subtly wrong. Grounding in approved curriculum source material limits the blast radius. Threshold is higher to compensate for the absence of a code verifier.

### Tier 4 — Open Explanation Content (Highest Risk)

**Examples**: long-form explanations, reading comprehension, interpretive questions

**Allowed approach**:
- Clear rubric-based marking criteria in `explanation` field.
- Higher confidence threshold ≥ 90.
- Prefer smaller controlled item sets at first.
- Reading comprehension passages must be from pre-approved texts (sourced from `curriculum_chunks`).
- Interpretive questions must have a single defensible answer (constitutional critique checks this).

**Why highest risk**: Subjectivity means two reviewers may disagree. The constitutional critique pipeline enforces that every question has a single defensible answer and that the explanation fully justifies it.

---

## 18. Content Pool Size Targets

| Stage | Questions per topic | Notes |
|---|---|---|
| **Pilot seed** | 15–30 | Minimum viable for basic rotation |
| **Family pilot** | 50–100 | Adaptive selection has meaningful fresh pool across 5+ attempts |
| **Strong product** | 150–300 | Near-infinite freshness for typical learner cadence |
| **Reading/Science** | Scales by passage/concept set | A single comprehension passage can generate 5–10 questions |

Current status (Phase 10D launch): Most topics have 15–30 questions. The adaptive selector is designed to work correctly at this scale and improve automatically as pools grow.

---

## 19. Acceptance Criteria

This architecture is correctly implemented when all of the following are true:

| Criterion | How Verified |
|---|---|
| No live child-facing AI generation | Adaptive selector source contains no AI provider imports; verify script checks this |
| Only `status='published'` content selected | Selector code has `.eq('status', 'published')` for all content queries |
| Attempt history used for quiz freshness | `quiz_answers` + `quiz_attempts` queried per child per topic before selection |
| Repetition reduced per child | Recently-seen IDs deprioritised; fresh pool preferred |
| Practice and quiz have separate logic | `selectQuizQuestions` and `selectPracticeItems` are distinct functions |
| Small pools fail gracefully | `fallbackReason` logged; no error thrown; full available pool used |
| Content risk tiers documented | This document + `lib/contentRiskTiers.ts` |
| Template-based generation documented | §14 of this document |
| Verification script proves safety | `scripts/verify-content-freshness-safety.mjs` passes |
| Existing safety gates continue to pass | `npm run verify-phase8`, `verify-phase8a`, `verify-lesson-store-safety`, `verify-parent-dashboard-safety` all pass |

---

*Phase 10D — Verified Adaptive Content Bank and Freshness Engine*
