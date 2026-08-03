# Content engine — diagnosis and redesign

**Date:** 2026-08-03
**Companion to:** `CONTENT_QUALITY_AUDIT_2026_08_03.md` (the measurements)
**Status:** design, not yet built

---

## 1. The one-sentence diagnosis

**60% of our published questions were awarded the pipeline's 60-point "code verification"
score for a check that never looked at the answer** — and for the largest slice of those, the
only remaining correctness signal is a single small-model yes/no call with no source material,
which publishes at exactly the threshold.

That is not a tuning problem. The scoring model launders "we didn't check" into "verified".

---

## 2. Where the 7,672 published questions actually stand

Measured by routing each `question_type` through the Stage-2 dispatcher in `pipeline.py:1380`:

| Class | Count | % | What Stage 2 actually does |
|---|---:|---:|---|
| **A** Computable | 3,161 | 40.0% | Real check. SymPy / safe-eval / Pint / ChemPy recompute the answer. |
| **B** Passthrough | 2,656 | 33.6% | `return True, "passes Stage 2"` — **unconditional**. No check of any kind. |
| **C** Comprehension / literary | 587 | 7.4% | LanguageTool. Checks the *prose reads cleanly*. Never looks at the answer key. |
| **D** Grammar / spelling / phonics | 1,233 | 15.6% | LanguageTool. Genuine for "spot the error" items; cannot confirm a key like *"which word is the determiner?"* |
| **E** Oak direct-insert | 270 | 3.4% | Bypasses all six stages. Inserted straight at `status='published'`, `confidence_score=100`. |

So **4,476 questions (58%) have never had their answer verified by anything.**

### 2.1 The arithmetic that makes this publish

`services/content-pipeline/pipeline.py:1749`:

```
verified        +60
consensus       +25
RAG bonus        +5
violations      −10 each
```

For every `history_factual`, `geography_factual`, `biology_factual`, `science_factual`
question — 2,648 of them — Stage 2 is a passthrough, so `verified` is **always True**.
The sum is therefore always `60 + 25 + 5 = 90`, and the threshold for those types is
**exactly 90**.

**One `deepseek-4-flash` call decides whether a third of our catalogue publishes.**
Zero violations and a "yes" → published. That is the entire correctness gate.

And that call is told, in the prompt at `pipeline.py:867`:

> *"No source material is provided. Evaluate based purely on correctness and age-appropriateness."*

So the check is a small model's parametric memory, unaided, grading a larger model from the
same family. That is not consensus — it is the same prior asked twice.

The measured 10% hard-defect rate is exactly what this architecture predicts.

### 2.2 Four more faults found while reading

**Fault 1 — "grounded" doesn't mean grounded.** The Stage-6 RAG gate (`pipeline.py:1701`)
checks that each cited chunk exists, has a matching *subject*, and sits in the same *key stage*.
It never checks that the chunk **says the thing the answer claims**. A question can cite a
perfectly valid Year 8 history chunk and assert something the chunk never mentions, and score 90.

**Fault 2 — the constitutional critique fails open.** `pipeline.py:1510`:

```python
except Exception as exc:
    result.log_stage(f"  constitutional error: {exc}")
    return []          # ← no violations
```

A timeout or a malformed JSON response is indistinguishable from a clean bill of health. Stage 3
correctly fails closed; Stage 4 does the opposite, and Stage 4 is the safety check.

**Fault 3 — the score scale has no headroom, so it was patched twice.** For
`english_literary_analysis` and `science_physics_calculation` the maximum achievable score
equals the publish threshold, so *any* single violation is fatal. Rather than fix the scale,
two hand-written `+5` buffers were added (`pipeline.py:1786`, `pipeline.py:1804`). Those buffers
are a symptom: the scale is wrong, not the thresholds.

**Fault 4 — distractors are never checked for being false.** Nothing in six stages asks
"is each wrong answer actually wrong?". This is the direct cause of the highest-severity defect
class. From the audit sample:

> *"At which type of plate boundary do earthquakes occur, but volcanic eruptions do not?"*
> Keyed answer: **Conservative**. Distractor: **Collision**.
> Collision boundaries also produce earthquakes without volcanism. Two correct answers.

A child who knows more geography than the generator gets marked wrong.

### 2.3 Why the 40 slavery/war maths questions got through

The constitution (`pipeline.py:~880`) does contain a subject-bleed rule — but it only runs in
one direction:

> *"In a **non-Maths** subject, a question whose answer is found purely by arithmetic … is a
> clear violation"*

The 40 defects are the mirror image: **Maths questions wearing history costume.** No rule covers
that direction. The only thing that could have caught them is the generic *"No culturally
insensitive, biased, or upsetting content"* line, evaluated by a flash model that also fails open.

Age-appropriateness must not be a model judgement call. It needs to be deterministic.

---

## 3. The redesign

### 3.1 Principle

> **A question may publish only when it carries a positive, recorded proof of correctness
> of the right kind for its class.**

Score stops being the gate. It becomes a way to rank work. "We ran a check and it passed"
must be storable, auditable, and re-runnable — not compressed into a number that cannot
distinguish a SymPy proof from a passthrough.

### 3.2 Proof obligations by class

| Class | Proof required to publish | Mechanism | Cost |
|---|---|---|---|
| **A** Computable | Deterministic recomputation agrees with the key | SymPy / Pint / ChemPy — **already exists** | free |
| **B** Closed-world fact | ≥1 external source states the answer, no source contradicts it, **and every distractor is checked false** | Web search + quoted-evidence judge | ~$0.02/question |
| **C** Source-dependent | The cited chunk **textually entails** the answer | Entailment judge, chunk text as only input | ~$0.001 |
| **D** Convention | Deterministic linguistic analysis where possible; otherwise 2-of-3 judges from **different model families** | spaCy POS/dependency parse; else multi-judge | free / ~$0.003 |
| **E** Oak-imported | Human-authored — key is ground truth; still must clear structural + sensitivity gates | deterministic only | free |

Three things make this different from what we have:

**The distractor check.** For Class B, each distractor must be positively established as false.
This is the cheapest high-severity win available and nothing currently does it.

**Entailment instead of metadata matching.** Asking *"does this passage state this answer?"* is a
far easier and more reliable judgement than *"is this true?"*, and it is checkable — the judge
must quote the supporting span or fail.

**spaCy converts guesswork into computation.** A dependency parse answers *"which word is the
determiner?"* definitively. A meaningful share of the 1,233 Class-D questions become Class A —
genuinely verified, at zero marginal cost.

### 3.3 Deterministic gates that run before any model

These are free, cannot fail open, and remove most of the mechanical defect population:

1. **Sensitivity gate.** Year-group-keyed blocklist (slavery, genocide, war casualties, death
   tolls, executions, abuse). Sensitive context is permitted **only** when the topic's own
   subject and title are about that theme — so a Year 6 History topic on the slave trade may
   discuss it; a Year 3 Maths fractions question may not. Pure data, no model judgement.
2. **Structural gate.** 3 distractors, no answer-in-distractors, hints present and distinct,
   explanation over N chars.
3. **Renderability gate.** Exists; extend to `{{ }}` cloze, stray `**`, duplicated inline A–D blocks.
4. **Self-containment gate.** Reject stems referencing "the source", "these parts", "shown below"
   when no stimulus is attached.

### 3.4 Fix the scale, delete the buffers

```
proof of correctness   60   (only when a real proof was produced)
independent check      20
grounding              10
structure              10
                      ---
max                   100      threshold 85
```

One violation (−10) still clears at 90. Two does not. Both `+5` buffers get deleted; they exist
only to paper over `max == threshold`.

### 3.5 Oak as a free answer key

We import Oak questions but never use them to **check** ours. Build a normalised
stem → answer index from Oak's catalogue; where one of our questions matches an Oak stem and the
answers disagree, flag it. Zero API cost, human-authored ground truth, and it grows every time we
import more Oak.

---

## 4. Re-verifying the 7,672 we already have

Ordered so the free work shrinks the population before the paid work starts.

| Step | Population | Method | Cost | Expected removal |
|---|---:|---|---|---|
| 1 | all 7,672 | Deterministic gates (§3.3) | free | ~1,000 rows flagged |
| 2 | 3,161 Class A | Re-run SymPy/Pint/ChemPy over the stored key | free | unknown — never been done |
| 3 | 1,233 Class D | spaCy parse where the question type allows | free | — |
| 4 | 587 Class C | Chunk entailment | ~$1 | — |
| 5 | ~2,656 Class B | Web search + distractor falsification | ~$50–80 one-off | the 10% hard-defect tail |
| 6 | remainder | Oak answer-key cross-check | free | — |

Steps 1–3 and 6 are free and cover 5,664 questions. Only step 5 costs real money, and it is a
one-off for the existing backlog; going forward it runs on new questions only.

---

## 5. Open questions for Amit

Two decisions change what gets built, so they are not mine to make:

1. **Search provider.** Anthropic's server-side web search tool needs no new vendor and no new
   env var (we already hold `ANTHROPIC_API_KEY`) and returns citations, at roughly $10/1,000
   searches. A dedicated search API (Serper/Tavily) is cheaper per call but adds a secret, which
   CLAUDE.md §6 says requires sign-off. Given we just moved off Sonnet to cut spend, this is a
   deliberate re-spend — small and one-off, but real.

2. **What happens to the 4,476 unverified questions while re-verification runs.** Leaving them
   published means known-defective content stays live. Unpublishing them pending re-check guts
   the catalogue — but with 99 lifetime quiz attempts, right now that costs almost nothing, and
   it will never be cheaper than today.
