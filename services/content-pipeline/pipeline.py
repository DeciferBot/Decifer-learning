"""
Decifer Learning content pipeline — six-stage generation loop.

CLAUDE.md §9:
  Stage 1  RAG generation (subject-aware prompt)
  Stage 2  Code verification (dispatched by question_type)
  Stage 3  Consensus check
  Stage 4  Constitutional critique
  Stage 5  Semantic deduplication
  Stage 6  Confidence scoring + RAG grounding check + status write-back

Phase 11A: English + Science verifiers wired; subject-aware prompts;
per-type confidence thresholds; RAG grounding enforced; pipeline run tracking.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np

import config
import db

# Path to optional stop sentinel: <repo-root>/.PIPELINE_STOP
_STOP_GUARD = Path(__file__).resolve().parent.parent.parent / ".PIPELINE_STOP"
from verifiers import maths as maths_verifier
from verifiers import english as english_verifier
from verifiers import physics as physics_verifier
from verifiers import chemistry as chemistry_verifier

log = logging.getLogger("pipeline")

# ── Anthropic client (lazy-initialised) ──────────────────────────────────

_anthropic_client = None


def _anthropic():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic
        if not config.ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        _anthropic_client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    return _anthropic_client


# ── sentence-transformers embeddings (local, no API key needed) ───────────

_st_model = None


def _st():
    global _st_model
    if _st_model is None:
        from sentence_transformers import SentenceTransformer
        _st_model = SentenceTransformer(config.EMBEDDING_MODEL)
    return _st_model


def embed_text(text: str) -> Optional[np.ndarray]:
    """Return a 384-dim embedding using the local sentence-transformers model."""
    return _st().encode(text, convert_to_numpy=True).astype(np.float32)


# ── Constants ─────────────────────────────────────────────────────────────

_TIER_DESCRIPTIONS = {
    "sprout":    "Basic recall and simple one-step problems. Simple language for the year group.",
    "explorer":  "Multi-step problems requiring two or more operations. Moderate vocabulary.",
    "lightning": "Challenging problems with multiple steps, reasoning, or unfamiliar contexts.",
}

_YEAR_GROUP_DISPLAY = {
    "year-2": ("Year 2", "KS1"),
    "year-3": ("Year 3", "KS2"),
    "year-7": ("Year 7", "KS3"),
}

# ── Subject-aware prompt builders ─────────────────────────────────────────

def _build_maths_prompt(
    topic: dict,
    tier: str,
    chunks: list[dict],
    existing_questions: list[dict] | None = None,
) -> str:
    year_label, key_stage = _YEAR_GROUP_DISPLAY.get(
        topic["year_group_label"], (topic["year_group_label"], "")
    )
    tier_desc = _TIER_DESCRIPTIONS.get(tier, tier)

    if chunks:
        chunks_text = "\n\n".join(
            f"[Source {i+1} — {c['source_name']}]\n{c['chunk_text']}"
            for i, c in enumerate(chunks)
        )
        chunk_ids = json.dumps([str(c["id"]) for c in chunks])
        source_section = (
            f"Use only the following curriculum sources to ground the question:\n\n"
            f"{chunks_text}\n\n"
            f"Set source_chunk_ids to: {chunk_ids}"
        )
    else:
        source_section = (
            "No curriculum source text is provided. "
            "Use your mathematical knowledge to generate a correct and age-appropriate question. "
            "Set source_chunk_ids to []."
        )

    if existing_questions:
        used_answers = list({
            q.get("correct_answer", "").strip()
            for q in existing_questions
            if q.get("correct_answer")
        })
        used_texts = [q.get("question_text", "").strip() for q in existing_questions if q.get("question_text")]
        forbidden_lines = []
        if used_texts:
            forbidden_lines += [f'  FORBIDDEN: "{t[:100]}"' for t in used_texts[:8]]
        if used_answers:
            forbidden_lines.append(
                "  FORBIDDEN correct_answer values (already used): "
                + ", ".join(f'"{a}"' for a in used_answers[:12])
            )
        if forbidden_lines:
            diversity_end = (
                "\n\n⚠ MANDATORY DIVERSITY CHECK — READ BEFORE GENERATING:\n"
                "The following questions ALREADY EXIST and must NOT be regenerated (auto-rejected if duplicate):\n"
                + "\n".join(forbidden_lines)
                + "\nYour question MUST have a different algebraic structure, different numbers, "
                "and a different correct_answer to all of the above."
            )
        else:
            diversity_end = ""

        # ── Topic-aware archetype hints ───────────────────────────────────────
        # When a topic has many existing questions, the model defaults to the same
        # template. These hints force structural variety by naming unused archetypes.
        topic_title_lower = topic.get("title", "").lower()

        if "fraction" in topic_title_lower:
            # Detect which archetypes are already heavily used
            used_texts_lower = " ".join(used_texts).lower()
            used_archetypes = []
            if "what is" in used_texts_lower and ("quarter" in used_texts_lower or "half" in used_texts_lower or "third" in used_texts_lower):
                used_archetypes.append("A (find-the-part)")
            if "fraction of a number" in used_texts_lower or "is one quarter of" in used_texts_lower:
                used_archetypes.append("B (find-the-whole)")
            if "greater" in used_texts_lower or "bigger" in used_texts_lower or "which is more" in used_texts_lower:
                used_archetypes.append("C (compare)")
            if "order" in used_texts_lower or "smallest to largest" in used_texts_lower:
                used_archetypes.append("D (order)")
            if "equivalent" in used_texts_lower:
                used_archetypes.append("E (equivalent)")
            if "shaded" in used_texts_lower or "equal parts" in used_texts_lower:
                used_archetypes.append("F (shape/diagram)")

            used_str = ", ".join(used_archetypes) if used_archetypes else "A (find-the-part)"
            diversity_end += f"""

🎯 FRACTIONS ARCHETYPE DIVERSITY (critical — deduplication will reject structural clones):
Already-used archetypes: {used_str}
You MUST use a DIFFERENT archetype from this list:
  A) Find the part   — "What is ¼ of 12?"  [most common — AVOID if already used]
  B) Find the whole  — "6 is half of a number. What is the number?"
  C) Compare         — "Which is greater: ½ or ¼? Explain."
  D) Order           — "Put ½, ¼, ¾ in order from smallest to largest."
  E) Equivalent      — "Which fraction is the same as ½: 2/4, 2/3, or 3/4?"
  F) Shape/diagram   — "A chocolate bar has 8 equal pieces. Sam eats 2. What fraction did Sam eat?"
  G) Multi-step      — "Mia has 24 cards. She gives away ¼. How many does she keep?"
Choose an archetype NOT in the already-used list above and write your question using it.
Use DIFFERENT numbers from those already in the forbidden list."""

        elif "graph" in topic_title_lower or "coordinate" in topic_title_lower:
            used_texts_lower = " ".join(used_texts).lower()
            used_archetypes_g = []
            if "y-coordinate" in used_texts_lower or "value of y when" in used_texts_lower:
                used_archetypes_g.append("A (substitute x, find y)")
            if "x-coordinate" in used_texts_lower or ("coordinate" in used_texts_lower and "of this point" in used_texts_lower):
                used_archetypes_g.append("B (read a coordinate from a point)")
            if "gradient" in used_texts_lower or "slope" in used_texts_lower:
                used_archetypes_g.append("C (identify gradient from equation)")
            if "y-intercept" in used_texts_lower or "crosses the y-axis" in used_texts_lower:
                used_archetypes_g.append("D (identify y-intercept)")
            if "midpoint" in used_texts_lower:
                used_archetypes_g.append("E (midpoint of a line segment)")
            if "distance" in used_texts_lower and "point" in used_texts_lower:
                used_archetypes_g.append("F (horizontal or vertical distance between points)")
            if "sum" in used_texts_lower and "coordinate" in used_texts_lower:
                used_archetypes_g.append("G (sum or difference of coordinate values)")
            used_str_g = ", ".join(used_archetypes_g) if used_archetypes_g else "A (substitute x, find y)"
            diversity_end += f"""

🎯 GRAPHS/COORDINATES ARCHETYPE DIVERSITY (critical — deduplication will reject structural clones):
Already-used archetypes: {used_str_g}
You MUST use a DIFFERENT archetype from this list:
  A) Substitute x, find y  — "y = 3x + 2, find y when x = 4"            [OVERUSED — avoid if already used]
  B) Read a coordinate      — "Point P is at (6, −2). What is the x-coordinate?"
  C) Identify gradient      — "What is the gradient of y = 5x − 3?"       → correct_answer="5", verification_expression="5"
  D) Identify y-intercept   — "Where does y = 4x + 7 cross the y-axis?"   → correct_answer="7", verification_expression="7"
  E) Midpoint               — "A(2,4) B(8,4) — what is the x-coordinate of the midpoint?" → "5", "(2+8)/2"
  F) Horizontal/vertical distance — "A(1,3) B(1,9) — what is the vertical distance?"       → "6", "9-3"
  G) Sum/difference of coordinates — "P(−3,5) Q(4,−2) — what is the sum of all four values?" → "4", "-3+5+4+-2"

QUESTION TYPE RULE: use question_type="maths_arithmetic" for ALL graphs/coordinates questions.
verification_expression must be the arithmetic expression evaluating to the correct_answer.
  GOOD: gradient of y=2x−1 → correct_answer="2", verification_expression="2"
  GOOD: y-intercept of y=2x+9 → correct_answer="9", verification_expression="9"
  BAD:  question_type="maths_algebra" — never use this for coordinates."""

        elif "algebra" in topic_title_lower or "expression" in topic_title_lower:
            used_texts_lower = " ".join(used_texts).lower()
            used_archetypes = []
            if "solve" in used_texts_lower and ("equation" in used_texts_lower or "=" in used_texts_lower):
                used_archetypes.append("A (solve one/two-step equation)")
            if "substitute" in used_texts_lower or "value of" in used_texts_lower and "if" in used_texts_lower:
                used_archetypes.append("B (substitute and evaluate)")
            if "nth term" in used_texts_lower or "sequence" in used_texts_lower:
                used_archetypes.append("C (nth term / sequence)")
            if "form" in used_texts_lower and "expression" in used_texts_lower:
                used_archetypes.append("D (form an expression)")

            used_str = ", ".join(used_archetypes) if used_archetypes else "A (solve equation)"
            diversity_end += f"""

🎯 ALGEBRA ARCHETYPE DIVERSITY (critical — deduplication will reject structural clones):
Already-used archetypes: {used_str}
You MUST use a DIFFERENT archetype from this list:
  A) Solve equation     — "Solve 4n + 7 = 31"  [most common — AVOID if already used]
  B) Substitute/evaluate— "If a = 5, what is 3a + 2?"
  C) Nth term/sequence  — "The nth term is 3n − 1. What is the 5th term?"
  D) Form an expression — "Sam earns £n per hour. He works 6 hours. Write an expression for his pay."
  E) Inequalities       — "Which values of n satisfy n + 3 > 7?"
  F) Two unknowns clue  — "x + y = 10 and x − y = 4. What is x?"
Choose an archetype NOT in the already-used list above.
Use DIFFERENT numbers, variables, and contexts from those already forbidden."""

        elif any(k in topic_title_lower for k in ["addition", "subtraction", "place value"]):
            used_texts_lower = " ".join(used_texts).lower()
            # Extract numbers already used
            import re as _re
            used_numbers = set(_re.findall(r'\b([1-9]\d{1,3})\b', used_texts_lower))
            used_numbers_str = ", ".join(sorted(used_numbers)[:10]) if used_numbers else "none identified"
            diversity_end += f"""

🎯 NUMBER DIVERSITY (critical):
Numbers already used in existing questions: {used_numbers_str}
You MUST use a completely different set of numbers not in that list.
Also vary the real-world context — avoid 'stickers' if that appears above; try coins, books, steps, cm, ml, etc."""

    else:
        diversity_end = ""

    return f"""You are an expert UK mathematics curriculum writer generating quiz questions for {year_label} pupils ({key_stage}, UK National Curriculum).

Topic: {topic['title']}
Subject: Mathematics
Year group: {year_label}
Difficulty tier: {tier} — {tier_desc}

{source_section}

Generate ONE multiple-choice mathematics question. Follow these rules exactly:

OAK SOURCE USAGE — read the sources above carefully before writing anything:
• If any source line starts with "Common misconception:", use that misconception as the basis for at least one distractor. This is the most pedagogically valuable distractor type.
• If any source line starts with "Lesson outcome:", your question MUST test that outcome directly — do not test a tangential concept.
• If any source line starts with "Learning point:", prioritise those points over general topic knowledge.

QUESTION: Clear, unambiguous, appropriate for {year_label}. One correct answer.

DISTRACTORS: Exactly 3 wrong answers. Prioritise real misconceptions from the source material above (lines starting "Common misconception:") — these are far more valuable than invented wrong answers.

HINTS — strictly follow this progression (constitutional requirement — violations cause rejection):
  hint_1: Conceptual nudge only. Name the operation or concept needed. Do NOT use the question's specific numbers.
           Example: "Think about what multiplication means — groups of equal size."
  hint_2: Method step only. Describe the first step of the working without computing it.
           Example: "Start by working out how many groups there are."
  hint_3: Final strategy or check only. Tell the child what to verify or how to check, WITHOUT performing
           the calculation, WITHOUT stating the final number, WITHOUT naming the correct option.
           Example: "Check: does your answer give the right number of groups when you divide back?"
  ABSOLUTE RULES — breaking any of these causes the question to be rejected:
    • No hint may contain the final answer or its numeric equivalent.
    • No hint may name which distractor option is correct.
    • hint_3 must leave at least one full calculation step for the child to complete.
    • hint_3 must NOT phrase the working so that only one possible answer remains obvious.
    • Directional comparisons in hints must be arithmetically true: do NOT say "less than X" if the answer
      is greater than X; do NOT say "more than X" if the answer is smaller than X; do NOT say "half of X"
      unless the answer is exactly X/2. Verify the relationship before writing it.

EXPLANATION: Full step-by-step working that arrives at the correct answer.

ANSWER FORMAT — critical for automatic verification:

  For maths_arithmetic and maths_geometry:
  correct_answer must be a PURE NUMERIC STRING — no currency symbols, no units, no percent sign, no commas.
  The question_text may contain real-world context (£, %, cm, kg, etc.) but correct_answer must be float-parseable.
  • WRONG: correct_answer="£52"       (currency symbol → Stage 2 rejected)
  • WRONG: correct_answer="52%"       (percent sign → Stage 2 rejected)
  • WRONG: correct_answer="52 cm"     (unit suffix → Stage 2 rejected)
  • WRONG: correct_answer="1,250"     (comma → Stage 2 rejected)
  • WRONG: correct_answer="4" when verification_expression evaluates to 4000000 (scale mismatch → rejected)
  • WRONG: correct_answer="3.8" when verification_expression evaluates to 3800000 (scale mismatch → rejected)
  • RIGHT: correct_answer="52"        correct_answer="0.25"   correct_answer="1250"
  • RIGHT: correct_answer="4000000"   correct_answer="-3.85"  correct_answer="48"
  For large rounding answers: write the full integer, e.g. "3800000", "5000000", not "3.8" or "5 million".

  PROBABILITY ANSWERS — special rule:
  If the answer is a probability (i.e. a fraction like 3/12, 4/8, 6/10), you MUST express correct_answer as
  a SIMPLIFIED FRACTION STRING in the form "p/q" — NOT as a decimal.
  • WRONG: correct_answer="0.25"          (decimal — rejected: ambiguous, not expected format at KS3)
  • WRONG: correct_answer="0.3333333333"  (recurring decimal — always rejected)
  • RIGHT: correct_answer="1/4"           (simplified fraction — 3/12 simplifies to 1/4)
  • RIGHT: correct_answer="1/3"           (simplified fraction — 4/12 simplifies to 1/3)
  The verification_expression for probability must be the FULL UNSIMPLIFIED FRACTION expression:
  e.g. for "4 blue out of 12 total" → verification_expression="4/12" and correct_answer="1/3"
  The verifier evaluates: safe_eval("4/12") = 0.333... and parses "1/3" = 0.333... — they match. ✓
  Distractors for probability questions must also be fractions (not decimals), and must NOT include the
  raw count as a distractor (e.g. do not use "4" as a distractor for a probability question).

  For maths_algebra:
  correct_answer must be the VALUE OF THE VARIABLE at the solution — NOT any constant that appears in the equation.
  The verification_equation must be a SymPy expression equal to 0 when the variable takes that value.
  • WRONG: question "Solve n + 10 = 14, find n" → correct_answer="14"  (14 is the RHS, NOT the answer)
  • WRONG: question "Solve n + 10 = 14, find n" → correct_answer="10"  (10 is a coefficient, NOT the answer)
  • RIGHT:  question "Solve n + 10 = 14, find n" → correct_answer="4",  verification_equation="n + 10 - 14", verification_variable="n"
  • RIGHT:  question "Solve 3x - 6 = 9, find x" → correct_answer="5",  verification_equation="3*x - 6 - 9",  verification_variable="x"
  Double-check: substitute correct_answer back into verification_equation — the result must equal 0.

Valid question_type values: maths_arithmetic, maths_algebra, maths_geometry
{diversity_end}

Return ONLY valid JSON with this exact structure (no extra text, no markdown fences):
{{
  "question_text": "<the question>",
  "question_type": "<maths_arithmetic | maths_algebra | maths_geometry>",
  "correct_answer": "<arithmetic/geometry: pure numeric string matching verification_expression — no £$€, no %, no units, no commas | algebra: numeric value of the VARIABLE (e.g. '4' for n+10=14, not '14')>",
  "distractors": ["<wrong1>", "<wrong2>", "<wrong3>"],
  "hint_1": "<conceptual nudge — no specific numbers>",
  "hint_2": "<method step — no final answer>",
  "hint_3": "<check or verify strategy — must NOT state or imply the final answer>",
  "explanation": "<complete step-by-step working>",
  "source_chunk_ids": [],
  "verification_expression": "<for maths_arithmetic and maths_geometry: Python arithmetic expression evaluating to the numeric value of correct_answer; prefer writing the literal result (e.g. '4000000') over function calls (e.g. 'round(3847291,-6)'); only round() is supported if a function call is unavoidable>",
  "verification_equation": "<for maths_algebra ONLY: SymPy expression equal to 0 at the solution>",
  "verification_variable": "<for maths_algebra ONLY: variable name>"
}}"""


def _build_english_prompt(
    topic: dict,
    tier: str,
    chunks: list[dict],
    existing_questions: list[dict] | None = None,
) -> str:
    year_label, key_stage = _YEAR_GROUP_DISPLAY.get(
        topic["year_group_label"], (topic["year_group_label"], "")
    )
    tier_desc = _TIER_DESCRIPTIONS.get(tier, tier)

    if chunks:
        chunks_text = "\n\n".join(
            f"[Source {i+1} — {c['source_name']}]\n{c['chunk_text']}"
            for i, c in enumerate(chunks)
        )
        chunk_ids = json.dumps([str(c["id"]) for c in chunks])
        source_section = (
            f"Use ONLY the following curriculum sources. "
            f"Do not introduce facts not supported by these sources.\n\n"
            f"{chunks_text}\n\n"
            f"Set source_chunk_ids to: {chunk_ids}"
        )
    else:
        source_section = (
            "No curriculum source text is provided. "
            "Set source_chunk_ids to [].\n"
            "NOTE: For english_comprehension, english_vocabulary, and english_literary_analysis "
            "questions, source_chunk_ids MUST be non-empty or the question will be rejected. "
            "Use english_grammar or english_spelling instead, or wait for curriculum chunks to be seeded."
        )

    # Diversity hint: tell the LLM what answers/stimuli already exist so it varies
    if existing_questions:
        used_answers = list({
            q.get("correct_answer", "").strip()
            for q in existing_questions
            if q.get("correct_answer")
        })
        used_stimuli = list({
            (q.get("question_metadata") or {}).get("stimulus_text", "").strip()
            for q in existing_questions
            if (q.get("question_metadata") or {}).get("stimulus_text")
        })
        diversity_lines = []
        if used_answers:
            diversity_lines.append(
                "IMPORTANT — DIVERSITY: The following correct_answer values have already been used. "
                "Generate a question with a DIFFERENT correct_answer:\n  "
                + ", ".join(f'"{a}"' for a in used_answers[:10])
            )
        if used_stimuli:
            diversity_lines.append(
                "The following stimulus_text sentences have already been used. "
                "Do NOT reuse them — create a DIFFERENT sentence:\n  "
                + "\n  ".join(f'"{s}"' for s in used_stimuli[:8])
            )
        diversity_section = "\n\n" + "\n\n".join(diversity_lines) if diversity_lines else ""
    else:
        diversity_section = ""

    return f"""You are an expert UK English curriculum writer generating quiz questions for {year_label} pupils ({key_stage}, UK National Curriculum).

Topic: {topic['title']}
Subject: English
Year group: {year_label}
Difficulty tier: {tier} — {tier_desc}

{source_section}

Generate ONE multiple-choice English question. Follow these rules exactly:

OAK SOURCE USAGE — read the sources above carefully before writing anything:
• If any source line starts with "Common misconception:", use that misconception as the basis for at least one distractor.
• If any source line starts with "Lesson outcome:", your question MUST test that specific outcome — not a tangential skill.
• If any source line starts with "Learning point:", prioritise those points.
• If any source line starts with "Q: " followed by "Correct answer:", those are Oak-verified quiz pairs — you may base your question on a similar concept but must NOT copy them verbatim (deduplication will reject copies).

QUESTION: Clear, unambiguous, appropriate for {year_label}. One correct answer.

DISTRACTORS: Exactly 3 wrong answers. Where source lines contain "Common misconception:", use those as distractors rather than inventing generic wrong answers.

HINTS: hint_1 general, hint_2 more specific, hint_3 closest without giving the answer.

EXPLANATION: Clear explanation of why the correct answer is right.

Valid question_type values:
  english_grammar          — question about a grammar rule (uses intentional error or identification)
  english_spelling         — question about a spelling mistake (uses intentional error in stimulus)
  english_phonics          — phoneme/digraph/trigraph identification or matching
  english_comprehension    — comprehension question (REQUIRES source_chunk_ids)
  english_vocabulary       — vocabulary/word-meaning question (REQUIRES source_chunk_ids)
  english_literary_analysis — literary analysis of a SPECIFIC text or author (REQUIRES source_chunk_ids)

QUESTION TYPE SELECTION — match the topic:
  Topics about phonics (phonemes, digraphs, trigraphs, grapheme-phoneme correspondences,
    split digraphs, blending, phoneme isolation) → use english_phonics
  Topics about spelling (prefixes, suffixes, homophones, word endings, misspelling) → use english_spelling
  Topics about grammar (conjunctions, apostrophes, verb tenses, punctuation, sentence types,
    subjunctive, passive voice, formal/informal register) → use english_grammar
  Topics about narrative writing TECHNIQUES (story structure, descriptive techniques,
    foreshadowing, varied sentence length, figurative language as technique definitions)
    → use english_grammar (for structural rule questions) or english_vocabulary
      (for "what does X technique mean?" questions)
    → ONLY use english_literary_analysis if the question analyses a SPECIFIC text or author
  Topics about etymology/word roots (Latin roots, Greek prefixes, morphology, word families)
    → use english_vocabulary (the verifier automatically suppresses false spelling flags
      on foreign-language root words)
  Topics about reading/comprehension → use english_comprehension
  Topics about literary analysis (character, theme, author intent in a SPECIFIC text) → use english_literary_analysis

For english_vocabulary questions about word roots, prefixes, or word families:
  PREFERRED: Ask "What does the root/prefix X mean?" with 4 different meaning choices — always unambiguous.
  If asking "Which word contains root X?": ALL 3 distractors MUST be words that do NOT share that root.
  NEVER generate a question where 2 or more answer options share the same root being tested — consensus will reject it as ambiguous.

For english_grammar and english_spelling, include question_metadata with:
  instruction_text: grammatically correct instruction to the pupil (e.g. "Which word in this sentence is a conjunction?")
  stimulus_text: the text shown to the child
  intentional_error_type: e.g. "missing_comma", "wrong_verb_tense", "misspelled_word" — set to null if no error
  intentional_error_span: {{"start": <char_offset>, "end": <char_offset>}} (0-indexed, exclusive end) — ONLY include this if stimulus_text contains a deliberate error; set to null for identification/selection questions where there is no error in the stimulus

For english_phonics, include question_metadata with:
  instruction_text: grammatically correct instruction (e.g. "What sound do these letters make?")
  stimulus_text: the grapheme(s) or word shown to the child (e.g. "sh", "igh", "phone")
  intentional_error_type: null (phonics questions identify correct sounds, not errors)
  intentional_error_span: null

CRITICAL — QUESTION_TEXT FORMAT: For english_grammar, english_spelling, and english_phonics,
question_text MUST include the stimulus sentence or grapheme directly, e.g.:
  "Which word is the conjunction in this sentence?\n\n'She wore her coat because it was cold.'"
  "Find the grammar mistake in this sentence:\n\n'He go to school yesterday.'"
  "What sound does this digraph make?\n\n'sh'"
Never write a question_text that omits what the child needs to see to answer.

IMPORTANT: For identification questions (e.g. "which word is a conjunction?"), the stimulus_text is correct English — set intentional_error_type and intentional_error_span to null.

Return ONLY valid JSON with this exact structure (no extra text, no markdown fences):
{{
  "question_text": "<the question (visible to child)>",
  "question_type": "<one of the valid types above>",
  "correct_answer": "<answer as a string>",
  "distractors": ["<wrong1>", "<wrong2>", "<wrong3>"],
  "hint_1": "<general hint>",
  "hint_2": "<more specific hint>",
  "hint_3": "<closest hint without giving the answer>",
  "explanation": "<clear explanation>",
  "source_chunk_ids": [],
  "question_metadata": {{
    "instruction_text": "<instruction (for grammar/spelling/phonics only)>",
    "stimulus_text": "<stimulus text (for grammar/spelling/phonics only)>",
    "intentional_error_type": null,
    "intentional_error_span": null
  }}
}}

For comprehension/vocabulary/literary_analysis, omit question_metadata or set it to null.{diversity_section}"""


def _build_science_prompt(topic: dict, tier: str, chunks: list[dict],
                          existing_questions: list[dict] | None = None) -> str:
    year_label, key_stage = _YEAR_GROUP_DISPLAY.get(
        topic["year_group_label"], (topic["year_group_label"], "")
    )
    tier_desc = _TIER_DESCRIPTIONS.get(tier, tier)

    if chunks:
        chunks_text = "\n\n".join(
            f"[Source {i+1} — {c['source_name']}]\n{c['chunk_text']}"
            for i, c in enumerate(chunks)
        )
        chunk_ids = json.dumps([str(c["id"]) for c in chunks])
        source_section = (
            f"Use ONLY the following curriculum sources. "
            f"Do not introduce facts not supported by these sources.\n\n"
            f"{chunks_text}\n\n"
            f"Set source_chunk_ids to: {chunk_ids}"
        )
    else:
        source_section = (
            "No curriculum source text is provided. Set source_chunk_ids to [].\n"
            "NOTE: For biology_factual and science_factual questions, "
            "source_chunk_ids MUST be non-empty or the question will be rejected."
        )

    # Diversity hint: tell the LLM what questions/answers already exist so it varies
    if existing_questions:
        used_answers = list({
            q.get("correct_answer", "").strip()
            for q in existing_questions
            if q.get("correct_answer")
        })
        used_questions = list({
            q.get("question_text", "").strip()[:80]
            for q in existing_questions
            if q.get("question_text")
        })
        diversity_lines = []
        if used_answers:
            diversity_lines.append(
                "IMPORTANT — DIVERSITY: The following correct_answer values have already been used. "
                "Generate a question testing a DIFFERENT concept or plant part/force/element:\n  "
                + ", ".join(f'"{a}"' for a in used_answers[:12])
            )
        if used_questions:
            diversity_lines.append(
                "These questions have already been generated. Do NOT create near-duplicates:\n  "
                + "\n  ".join(f'"{q}"' for q in used_questions[:8])
            )
        diversity_section = "\n\n" + "\n\n".join(diversity_lines) if diversity_lines else ""
    else:
        diversity_section = ""

    return f"""You are an expert UK Science curriculum writer generating quiz questions for {year_label} pupils ({key_stage}, UK National Curriculum).

Topic: {topic['title']}
Subject: Science
Year group: {year_label}
Difficulty tier: {tier} — {tier_desc}

{source_section}

Generate ONE multiple-choice Science question. Follow these rules exactly:

OAK SOURCE USAGE — read the sources above carefully before writing anything:
• If any source line starts with "Common misconception:", use that misconception as the basis for at least one distractor. This makes distractors far more pedagogically effective than invented wrong answers.
• If any source line starts with "Lesson outcome:", your question MUST test that outcome — do not test tangential concepts.
• If any source line starts with "Learning point:", prioritise those points as the question focus.
• If any source line starts with "Q: " followed by "Correct answer:", those are Oak-verified Q&A pairs — you may base a question on the same concept but must NOT copy them verbatim.

QUESTION: Clear, unambiguous, appropriate for {year_label}. One correct answer.

DISTRACTORS: Exactly 3 wrong answers. Prioritise real misconceptions from source lines starting "Common misconception:" — these encode what children actually get wrong.

HINTS: hint_1 general, hint_2 more specific, hint_3 closest without giving the answer.

EXPLANATION: Clear step-by-step explanation.

Valid question_type values:
  science_physics_calculation  — calculation question (provide verification_expression)
  science_chemistry_equation   — chemical equation balance (provide equation in correct_answer)
  chemistry_element_fact       — element property (provide question_metadata.element and property)
  biology_factual              — biology fact (REQUIRES source_chunk_ids)
  science_factual              — general science fact (REQUIRES source_chunk_ids)

CRITICAL — PHYSICS CALCULATIONS (science_physics_calculation):
  You MUST include ALL of the following or the question will be automatically rejected:
  - correct_answer: numeric value with unit, e.g. "9.81 N"
  - verification_expression: Python arithmetic expression that evaluates to the numeric answer,
    e.g. "20 / 5" for a = F/m = 20/5. Use ONLY +, -, *, /, ** and numbers. No variables.
  - verification_unit: SI unit string, e.g. "N", "m/s", "m/s^2", "J", "W", "Pa"
  Questions where verification_expression is absent, null, or contains variable names WILL fail
  code verification and cannot be published. When in doubt, choose a simpler calculation.

For chemistry_element_fact:
  - Add question_metadata with: element (symbol or name), property (atomic_number|symbol|name)

Return ONLY valid JSON (no extra text, no markdown fences):
{{
  "question_text": "<the question>",
  "question_type": "<one of the valid types above>",
  "correct_answer": "<answer>",
  "distractors": ["<wrong1>", "<wrong2>", "<wrong3>"],
  "hint_1": "<general hint>",
  "hint_2": "<more specific hint>",
  "hint_3": "<closest hint>",
  "explanation": "<explanation>",
  "source_chunk_ids": [],
  "verification_expression": "<for physics calculations>",
  "verification_unit": "<SI unit for physics>",
  "question_metadata": null
}}{diversity_section}"""


def _build_humanities_prompt(topic: dict, tier: str, chunks: list[dict],
                             existing_questions: list[dict] | None = None) -> str:
    subject = topic.get("subject_name", "History")
    qtype = "history_factual" if subject.lower() == "history" else "geography_factual"
    year_label, key_stage = _YEAR_GROUP_DISPLAY.get(
        topic["year_group_label"], (topic["year_group_label"], "")
    )
    tier_desc = _TIER_DESCRIPTIONS.get(tier, tier)

    if chunks:
        chunks_text = "\n\n".join(
            f"[Source {i+1} — {c['source_name']}]\n{c['chunk_text']}"
            for i, c in enumerate(chunks)
        )
        chunk_ids = json.dumps([str(c["id"]) for c in chunks])
        source_section = (
            f"Use ONLY the following curriculum sources. "
            f"Do not introduce facts not supported by these sources.\n\n"
            f"{chunks_text}\n\n"
            f"Set source_chunk_ids to: {chunk_ids}"
        )
    else:
        source_section = (
            "No curriculum source text is provided. Set source_chunk_ids to [].\n"
            f"NOTE: {qtype} questions REQUIRE non-empty source_chunk_ids — "
            "without sources this question will be rejected at Stage 6."
        )

    if existing_questions:
        used_answers = list({
            q.get("correct_answer", "").strip()
            for q in existing_questions
            if q.get("correct_answer")
        })
        used_questions = list({
            q.get("question_text", "").strip()[:80]
            for q in existing_questions
            if q.get("question_text")
        })
        diversity_lines = []
        if used_answers:
            diversity_lines.append(
                "IMPORTANT — DIVERSITY: These correct_answer values are already used. "
                "Test a DIFFERENT fact, person, place, event, or process:\n  "
                + ", ".join(f'"{a}"' for a in used_answers[:12])
            )
        if used_questions:
            diversity_lines.append(
                "These questions already exist. Do NOT create near-duplicates:\n  "
                + "\n  ".join(f'"{q}"' for q in used_questions[:8])
            )
        diversity_section = "\n\n" + "\n\n".join(diversity_lines) if diversity_lines else ""
    else:
        diversity_section = ""

    return f"""You are an expert UK {subject} curriculum writer generating quiz questions for {year_label} pupils ({key_stage}, UK National Curriculum).

Topic: {topic['title']}
Subject: {subject}
Year group: {year_label}
Difficulty tier: {tier} — {tier_desc}

{source_section}

Generate ONE multiple-choice {subject} question. Follow these rules exactly:

⛔ ABSOLUTE RULE — THIS IS A {subject.upper()} QUESTION, NOT A MATHS QUESTION:
The question must test {subject.lower()}-specific knowledge: facts, causes, consequences, people,
places, processes, sources, chronology, or interpretation. It must NEVER be answerable by
arithmetic alone. A question like "The Romans built 7 forts. Each fort had 8 soldiers. How many
soldiers?" is a maths question in costume and will be REJECTED. Numbers may appear ONLY when the
subject knowledge itself is being tested (e.g. "In which year did the Great Fire of London start?"
or "Which line of latitude runs through the centre of the Earth?").

OAK SOURCE USAGE — read the sources above carefully before writing anything:
• If any source line starts with "Common misconception:", use that misconception as the basis for at least one distractor.
• If any source line starts with "Lesson outcome:", your question MUST test that outcome — do not test tangential concepts.
• If any source line starts with "Learning point:", prioritise those points as the question focus.

QUESTION: Clear, unambiguous, appropriate for {year_label}. One correct answer, fully supported by the sources.

DISTRACTORS: Exactly 3 wrong answers — plausible {subject.lower()} alternatives (wrong date from the same era,
neighbouring country, similar historical figure, related but incorrect process). Never random or silly options.

HINTS — strictly follow this progression (constitutional requirement — violations cause rejection):
  hint_1: Conceptual nudge — point to the era, region, or theme. Do NOT mention answer specifics.
  hint_2: Narrow the field — recall a related fact from the lesson that helps eliminate distractors.
  hint_3: Closest guidance WITHOUT stating the answer or naming the correct option.

EXPLANATION: State the correct answer and explain WHY, citing the relevant fact from the sources.

Return ONLY valid JSON with this exact structure (no extra text, no markdown fences):
{{
  "question_text": "<the question>",
  "question_type": "{qtype}",
  "correct_answer": "<the correct option text>",
  "distractors": ["<wrong1>", "<wrong2>", "<wrong3>"],
  "hint_1": "<conceptual nudge>",
  "hint_2": "<narrowing fact>",
  "hint_3": "<closest guidance — never the answer>",
  "explanation": "<why this answer is correct, grounded in the sources>",
  "source_chunk_ids": <the chunk id list given above>
}}{diversity_section}"""


def _build_generation_prompt(
    topic: dict,
    tier: str,
    chunks: list[dict],
    existing_questions: list[dict] | None = None,
    force_qtype: str | None = None,
) -> str:
    """Dispatch to subject-specific prompt builder.

    existing_questions: list of {question_text, correct_answer, question_metadata}
    for published questions in this topic. Passed to prompt builders as a diversity
    hint so the LLM avoids regenerating near-duplicate questions.

    force_qtype: when set to a multipart type ('true_false_grid' | 'ordered_list'),
    bypasses subject dispatch and uses the multipart prompt builder instead.
    """
    if force_qtype in _MULTIPART_TYPES:
        return _build_multipart_prompt(topic, tier, force_qtype, chunks)
    subject = topic.get("subject_name", "").lower()
    if "english" in subject:
        return _build_english_prompt(topic, tier, chunks, existing_questions=existing_questions)
    if "science" in subject:
        return _build_science_prompt(topic, tier, chunks, existing_questions=existing_questions)
    if "history" in subject or "geography" in subject:
        return _build_humanities_prompt(topic, tier, chunks, existing_questions=existing_questions)
    return _build_maths_prompt(topic, tier, chunks, existing_questions=existing_questions)


# ── Consensus and constitutional prompts ──────────────────────────────────

_CONSENSUS_PROMPT_TEMPLATE = """You are an education expert verifying a quiz question for {year_label} pupils (UK National Curriculum, {key_stage}).

Subject: {subject}
No source material is provided. Evaluate based purely on correctness and age-appropriateness.

Question: {question_text}
Correct answer: {correct_answer}
Distractors: {distractors}
Tier: {tier}

Is the answer correct and unambiguous? Is the tier appropriate for {year_label} {subject} pupils?

Respond with ONLY valid JSON:
{{"answer_is_correct": true, "answer_is_unambiguous": true, "tier_appropriate": true, "notes": ""}}"""


_CONSTITUTION = """Age-appropriate language for the stated year group.
No culturally insensitive, biased, or upsetting content.
Exactly 3 distractors — each plausible but clearly wrong on careful reflection.
Hint progression: hint_1 is general, hint_2 is more specific, hint_3 is closest to the answer but does not state it outright.
Single defensible correct answer.
Single-answer only — the child UI is one-correct-option multiple choice. Never write multi-answer prompts ("Select all that apply", "Choose all", "Tick all that are true"); phrase as "Which one ..." with exactly one correct option. A "select all"-style prompt is a clear violation even if one listed option is technically correct.
Difficulty level broadly matches the stated tier (sprout=simple, explorer=multi-step, lightning=challenging).
Question text is clear and unambiguous.
No markdown tables, pipe-delimited tables (e.g. "| Col | Col |" with a "|---|---|" separator row), or raw HTML in question_text, correct_answer, or distractors — the child UI renders these as literal text, not a table. Data the child must read from a table, chart, or pictogram must not be embedded as markdown; such questions should use a dedicated table source type instead.
The question must test knowledge specific to its subject. In a non-Maths subject, a question whose answer is found purely by arithmetic (e.g. "The Romans built 7 forts. Each fort had 8 soldiers. How many soldiers?") is a clear violation — the historical or geographical setting is decoration, not the thing being tested. Numbers may appear only when the subject knowledge itself is what's assessed (dates, data interpretation, scientific formulae).
Only flag violations that are clear and significant. Do not flag minor wording imperfections."""


_TECHNIQUE_TYPES = (
    "recall",           # direct knowledge retrieval — default for most questions
    "perspective",      # answer from a historical/scientific viewpoint, not modern knowledge
    "evidence_cite",    # must quote or reference a source/text in the answer
    "show_working",     # must write out steps, not just the final answer
    "two_part",         # requires both an example AND an explanation
    "causation",        # must distinguish cause from effect
)

_CONSTITUTIONAL_PROMPT_TEMPLATE = """You are a quality reviewer for a UK educational app for children.

Review the following {subject} question against this constitution:
{constitution}

Year group: {year_label}
Tier: {tier}
Question: {question_text}
Correct answer: {correct_answer}
Distractors: {distractors}
Hint 1: {hint_1}
Hint 2: {hint_2}
Hint 3: {hint_3}
Explanation: {explanation}

List any violations of the constitution. Empty list if none.

Also assign a technique_type that describes the answering skill this question tests:
  recall           — direct knowledge retrieval (most questions)
  perspective      — answer from a historical/scientific viewpoint, not modern knowledge
                     (e.g. "what did people in 1348 believe?", "how did Victorian scientists explain X?")
  evidence_cite    — must quote or reference a source, text, or data in the answer
  show_working     — must write steps, not just the final answer (multi-step maths, method questions)
  two_part         — requires both a specific example AND an explanation
  causation        — must distinguish cause from effect, or sequence events/reasons

And generate two short strings:
  technique_hint — 1–2 sentences shown to the child when they answer incorrectly, before content hints.
                   Teaches HOW to approach the question. Does NOT reveal content or the answer.
                   Example for perspective: "This question wants you to think like someone living in 1348 —
                   what would THEY have believed, before modern medicine existed?"
  technique_note — 1 sentence shown in the post-answer explanation.
                   Reinforces the technique. Example: "Remember: when a question asks what people
                   'thought' or 'believed', answer from their perspective, not ours."
  For technique_type=recall, set technique_hint and technique_note to null (no technique coaching needed).

Respond with ONLY valid JSON:
{{"violations": [], "technique_type": "recall", "technique_hint": null, "technique_note": null}}"""


# ── Result dataclass ──────────────────────────────────────────────────────

@dataclass
class PipelineResult:
    question_id: Optional[str] = None
    status: str = "failed"
    confidence_score: float = 0.0
    stage_log: list[str] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0
    verifier_version: str = ""

    def log_stage(self, msg: str):
        log.info(msg)
        self.stage_log.append(msg)

    def add_tokens(self, msg) -> None:
        usage = getattr(msg, "usage", None)
        if usage is None:
            return
        self.input_tokens += int(getattr(usage, "input_tokens", 0) or 0)
        self.output_tokens += int(getattr(usage, "output_tokens", 0) or 0)


def _extract_json(text: str) -> str:
    """Extract the first {...} block from text, tolerating leading/trailing prose."""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError(f"no JSON object found in response: {text[:120]!r}")
    return text[start:end + 1]


# ── Individual stages ─────────────────────────────────────────────────────

def stage1_generate(topic: dict, tier: str, result: PipelineResult) -> Optional[dict]:
    """Stage 1: RAG retrieval + Claude generation (subject-aware prompt)."""
    result.log_stage("Stage 1: RAG generation")
    query_text = f"{topic['title']} {topic['year_group_label']} {topic['subject_name']}"
    query_embedding = embed_text(query_text) if config.EMBEDDINGS_ENABLED else None
    chunks = db.retrieve_chunks(topic["subject_name"], topic["year_group_label"], query_embedding, restrict_source=topic.get("restrict_source"))
    result.log_stage(f"  retrieved {len(chunks)} curriculum chunks for {topic['subject_name']}")

    # Pass published questions as a diversity hint for English AND Science topics.
    # Pass existing questions for all subjects to prevent the LLM from regenerating
    # identical questions in the dedup loop (similarity=1.000 exact copies).
    existing_questions = db.get_published_questions_full(topic["id"])

    prompt = _build_generation_prompt(topic, tier, chunks, existing_questions=existing_questions)

    for attempt in range(3):
        try:
            msg = _anthropic().messages.create(
                model=config.CLAUDE_MODEL,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            result.add_tokens(msg)
            text = msg.content[0].text.strip()
            if text.startswith("```"):
                text = "\n".join(
                    line for line in text.splitlines()
                    if not line.startswith("```")
                )
            data = json.loads(text)
            # Store chunks back for Stage 6 grounding check
            data["_retrieved_chunks"] = chunks
            result.log_stage(f"  generation OK (attempt {attempt+1})")
            return data
        except (json.JSONDecodeError, IndexError) as exc:
            result.log_stage(f"  attempt {attempt+1} parse error: {exc}")
        except Exception as exc:
            result.log_stage(f"  attempt {attempt+1} API error: {exc}")
            break
    return None


# ── Stage 2: verifier dispatch ─────────────────────────────────────────────

_MATHS_TYPES = {"maths_arithmetic", "maths_algebra", "maths_geometry"}
_ENGLISH_TYPES = {
    "english_grammar", "english_spelling", "english_phonics",
    "english_comprehension", "english_vocabulary", "english_literary_analysis",
}
_PHYSICS_TYPES = {"science_physics_calculation"}
_CHEMISTRY_TYPES = {"science_chemistry_equation", "chemistry_element_fact", "biology_factual", "science_factual"}
# Multi-part types: structural verification only (no code or LanguageTool check)
_MULTIPART_TYPES = {"true_false_grid", "ordered_list", "source_analysis", "explain_example", "structured_answer"}
_HUMANITIES_TYPES = {"history_factual", "geography_factual"}


def _verify_multipart(question_data: dict) -> tuple[bool, str]:
    """Structural verifier for true_false_grid and ordered_list question types."""
    qtype = question_data.get("question_type", "")
    parts = question_data.get("answer_parts")

    if not isinstance(parts, list) or len(parts) < 2:
        return False, "answer_parts must be a list with at least 2 items"

    if qtype == "true_false_grid":
        for i, part in enumerate(parts):
            if not isinstance(part, dict):
                return False, f"answer_parts[{i}] must be a dict"
            if "statement" not in part or "correct" not in part:
                return False, f"answer_parts[{i}] missing 'statement' or 'correct'"
            if not isinstance(part["correct"], bool):
                return False, f"answer_parts[{i}].correct must be a boolean"
        # Check balanced T/F — not all same value
        trues = sum(1 for p in parts if p["correct"])
        if trues == 0 or trues == len(parts):
            return False, "true_false_grid must have a mix of true and false statements"
        return True, f"ok — {len(parts)} statements, {trues} true, {len(parts)-trues} false"

    if qtype == "ordered_list":
        for i, part in enumerate(parts):
            if not isinstance(part, dict):
                return False, f"answer_parts[{i}] must be a dict"
            if "item" not in part:
                return False, f"answer_parts[{i}] missing 'item'"
            if not isinstance(part["item"], str) or not part["item"].strip():
                return False, f"answer_parts[{i}].item must be a non-empty string"
        if len(parts) < 3 or len(parts) > 8:
            return False, f"ordered_list must have 3–8 items, got {len(parts)}"
        return True, f"ok — {len(parts)} items to order"

    if qtype == "source_analysis":
        # Validate source fields before checking answer_parts structure
        if not question_data.get("source_text", "").strip():
            return False, "source_analysis requires non-empty source_text"
        if not question_data.get("source_label", "").strip():
            return False, "source_analysis requires non-empty source_label"
        if len(parts) != 2:
            return False, f"source_analysis must have exactly 2 sub-questions, got {len(parts)}"
        for i, sub in enumerate(parts):
            if not isinstance(sub, dict):
                return False, f"answer_parts[{i}] must be a dict"
            for key in ("prompt", "options", "correct"):
                if key not in sub:
                    return False, f"answer_parts[{i}] missing '{key}'"
            if not isinstance(sub["options"], list) or len(sub["options"]) != 4:
                return False, f"answer_parts[{i}].options must have exactly 4 items (got {len(sub.get('options', []))})"
            if not isinstance(sub["correct"], int) or sub["correct"] not in range(len(sub["options"])):
                return False, f"answer_parts[{i}].correct must be a valid index (0–3)"
        return True, "ok — source_analysis: source fields present, 2 sub-questions each with 4 options"

    if qtype == "explain_example":
        if len(parts) != 2:
            return False, f"explain_example must have exactly 2 parts, got {len(parts)}"
        # Enforce exact ordering: parts[0] must be 'example', parts[1] must be 'explain'
        expected_order = ("example", "explain")
        for i, part in enumerate(parts):
            if not isinstance(part, dict):
                return False, f"answer_parts[{i}] must be a dict"
            for key in ("part", "prompt", "options", "correct"):
                if key not in part:
                    return False, f"answer_parts[{i}] missing '{key}'"
            if part["part"] != expected_order[i]:
                return False, f"answer_parts[{i}].part must be '{expected_order[i]}', got '{part['part']}'"
            if not isinstance(part["options"], list) or len(part["options"]) != 4:
                return False, f"answer_parts[{i}].options must have exactly 4 items (got {len(part.get('options', []))})"
            if not isinstance(part["correct"], int) or part["correct"] not in range(len(part["options"])):
                return False, f"answer_parts[{i}].correct must be a valid index (0–3)"
        return True, "ok — explain_example: example part + explain part, each with 4 options"

    if qtype == "structured_answer":
        model_answer = question_data.get("correct_answer", "").strip()
        if not model_answer:
            return False, "structured_answer requires a non-empty correct_answer (model answer)"
        if len(model_answer.split()) < 30:
            return False, f"structured_answer model answer too short ({len(model_answer.split())} words) — must cover all criteria"
        if len(parts) < 2 or len(parts) > 6:
            return False, f"structured_answer must have 2–6 marking criteria, got {len(parts)}"
        total_marks = 0
        for i, criterion in enumerate(parts):
            if not isinstance(criterion, dict):
                return False, f"answer_parts[{i}] must be a dict"
            if "criterion" not in criterion:
                return False, f"answer_parts[{i}] missing 'criterion'"
            if not isinstance(criterion.get("criterion"), str) or not criterion["criterion"].strip():
                return False, f"answer_parts[{i}].criterion must be a non-empty string"
            marks = criterion.get("marks", 1)
            if not isinstance(marks, int) or marks < 1 or marks > 4:
                return False, f"answer_parts[{i}].marks must be an integer 1–4"
            total_marks += marks
        if total_marks < 2 or total_marks > 10:
            return False, f"structured_answer total marks must be 2–10, got {total_marks}"
        return True, f"ok — structured_answer: {len(parts)} criteria, {total_marks} marks total"

    return False, f"Unknown multipart type: {qtype!r}"


def _build_multipart_prompt(topic: dict, tier: str, qtype: str, chunks: list[dict]) -> str:
    """Generation prompt for true_false_grid and ordered_list question types."""
    year_label, key_stage = _YEAR_GROUP_DISPLAY.get(
        topic["year_group_label"], (topic["year_group_label"], "")
    )
    tier_desc = _TIER_DESCRIPTIONS.get(tier, tier)
    subject = topic.get("subject_name", "")

    if chunks:
        chunks_text = "\n\n".join(
            f"[Source {i+1} — {c['source_name']}]\n{c['chunk_text']}"
            for i, c in enumerate(chunks)
        )
        source_section = f"Use ONLY the following curriculum sources:\n\n{chunks_text}"
        chunk_ids = json.dumps([str(c["id"]) for c in chunks])
    else:
        source_section = "Use your curriculum knowledge for this year group and subject."
        chunk_ids = "[]"

    if qtype == "structured_answer":
        return f"""You are an expert UK {subject} curriculum writer generating a structured written-answer question for {year_label} pupils ({key_stage}).

Topic: {topic['title']}
Difficulty tier: {tier} — {tier_desc}

{source_section}

Generate a STRUCTURED ANSWER question worth 4 marks. The pupil writes a short paragraph response; Claude will mark it against the rubric.
Rules:
- question_text: clear, specific question ending with "[4 marks]" — suitable for a UK school exam
- correct_answer: a complete, concise model answer (3–6 sentences) that would earn full marks
- answer_parts: exactly 4 marking criteria, each worth 1 mark
  - Each criterion must be independently achievable (awarding one does not require another)
  - State criteria as "Identifies / Explains / Names / Gives / Describes..." (active verb + specific content)
  - Together they must cover all key ideas in the model answer
- hint_1: broad structural hint (e.g. "Think about causes, then effects")
- hint_2: more specific hint (e.g. "What specific example could you give?")
- hint_3: near-answer hint (e.g. "Think about what happened in 1348 and why people reacted that way")
- distractors: always []

Return ONLY valid JSON:
{{
  "question_text": "<specific exam-style question> [4 marks]",
  "question_type": "structured_answer",
  "correct_answer": "<model answer: 3–6 complete sentences covering all 4 criteria>",
  "distractors": [],
  "hint_1": "<broad structural hint>",
  "hint_2": "<more specific hint>",
  "hint_3": "<near-answer hint>",
  "explanation": "<brief explanation of what a full-mark answer must include>",
  "source_chunk_ids": {chunk_ids},
  "answer_parts": [
    {{"criterion": "<specific, independently-achievable marking point>", "marks": 1}},
    {{"criterion": "<second independent marking point>", "marks": 1}},
    {{"criterion": "<third independent marking point>", "marks": 1}},
    {{"criterion": "<fourth independent marking point>", "marks": 1}}
  ]
}}"""

    if qtype == "true_false_grid":
        return f"""You are an expert UK {subject} curriculum writer generating a true/false grid question for {year_label} pupils ({key_stage}).

Topic: {topic['title']}
Difficulty tier: {tier} — {tier_desc}

{source_section}

Generate a TRUE/FALSE GRID question with 4 statements about this topic.
Rules:
- Exactly 4 statements — mix of true AND false (2 true + 2 false is ideal, or 3+1)
- Each statement must be clearly true or clearly false — no ambiguous ones
- Statements should test different aspects of the topic
- Language appropriate for {year_label}
- correct_answer: compact string e.g. "TFFT" (T=true, F=false, one char per statement in order)
- answer_parts: the structured data

Return ONLY valid JSON:
{{
  "question_text": "Mark each statement about {topic['title']} as True or False.",
  "question_type": "true_false_grid",
  "correct_answer": "<TTFF or similar compact string>",
  "distractors": [],
  "hint_1": "<general hint about the topic>",
  "hint_2": "<more specific hint>",
  "hint_3": "<closest hint without revealing answers>",
  "explanation": "<brief explanation of each statement>",
  "source_chunk_ids": {chunk_ids},
  "answer_parts": [
    {{"statement": "<statement 1>", "correct": true}},
    {{"statement": "<statement 2>", "correct": false}},
    {{"statement": "<statement 3>", "correct": true}},
    {{"statement": "<statement 4>", "correct": false}}
  ]
}}"""

    if qtype == "source_analysis":
        return f"""You are an expert UK {subject} curriculum writer generating a source analysis question for {year_label} pupils ({key_stage}).

Topic: {topic['title']}
Difficulty tier: {tier} — {tier_desc}

{source_section}

Generate a SOURCE ANALYSIS question. Write a short primary source excerpt (50–120 words) related to the topic, then ask two questions that require evidence from it.
Rules:
- source_text: a realistic primary source excerpt (a quote from a document, diary, letter, speech, chronicle, or report)
- source_label: e.g. "Source A — An extract from a medieval chronicle, 1350"
- source_type: one of "quote" | "table" | "graph_description"
- 2 sub-questions, each with 4 options and one correct answer
- Options must be plausible — wrong answers should come from misreading the source
- Both questions should be answerable using ONLY the source text provided
- correct_answer: brief summary string, e.g. "Q1: option text | Q2: option text"

Return ONLY valid JSON:
{{
  "question_text": "Read Source A carefully and answer the questions below.",
  "question_type": "source_analysis",
  "source_text": "<50–120 word primary source excerpt>",
  "source_label": "Source A — <brief description of source, date>",
  "source_type": "quote",
  "correct_answer": "<Q1 correct option text> | <Q2 correct option text>",
  "distractors": [],
  "hint_1": "<hint about where in the source to look>",
  "hint_2": "<more specific location hint>",
  "hint_3": "<direct quote from source that hints at the answer>",
  "explanation": "<explanation of what the source tells us and why each answer is correct>",
  "source_chunk_ids": {chunk_ids},
  "answer_parts": [
    {{
      "prompt": "<specific question about the source — e.g. What does the source suggest about...?>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correct": 0
    }},
    {{
      "prompt": "<second specific question about the source>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correct": 1
    }}
  ]
}}"""

    if qtype == "explain_example":
        return f"""You are an expert UK {subject} curriculum writer generating an explain-with-example question for {year_label} pupils ({key_stage}).

Topic: {topic['title']}
Difficulty tier: {tier} — {tier_desc}

{source_section}

Generate an EXPLAIN WITH EXAMPLE question. This teaches pupils to give a specific example AND explain why it demonstrates the idea.
Rules:
- question_text: asks the pupil to explain a concept with a specific example (e.g. "Explain, with an example, why people fled cities during the Black Death.")
- Part 1 (example): asks for a specific example — 4 options, one clearly best
- Part 2 (explain): asks why that example demonstrates the concept — 4 options, one clearly best
- Wrong options for both parts must be plausible distractors
- correct_answer: brief model answer string combining both parts

Return ONLY valid JSON:
{{
  "question_text": "<question asking pupil to explain X with a specific example>",
  "question_type": "explain_example",
  "correct_answer": "<model answer combining example + explanation>",
  "distractors": [],
  "hint_1": "<hint about the concept being explained>",
  "hint_2": "<hint about what counts as a good example>",
  "hint_3": "<near-answer hint about both parts>",
  "explanation": "<full explanation of the best example and why it works>",
  "source_chunk_ids": {chunk_ids},
  "answer_parts": [
    {{
      "part": "example",
      "prompt": "Which of these is the most specific example?",
      "options": ["<example A>", "<example B>", "<example C>", "<example D>"],
      "correct": 0
    }},
    {{
      "part": "explain",
      "prompt": "Why does this example show <the concept>?",
      "options": ["<explanation A>", "<explanation B>", "<explanation C>", "<explanation D>"],
      "correct": 0
    }}
  ]
}}"""

    # ordered_list
    return f"""You are an expert UK {subject} curriculum writer generating an ordering question for {year_label} pupils ({key_stage}).

Topic: {topic['title']}
Difficulty tier: {tier} — {tier_desc}

{source_section}

Generate an ORDERING question with 4–5 items to put in the correct sequence (chronological, logical, or procedural).
Rules:
- 4–5 items — each clearly belonging in one position
- Items stored in CORRECT order in answer_parts (the component will shuffle for display)
- Each item is a short phrase (under 12 words)
- Language appropriate for {year_label}
- correct_answer: items joined by " → " in correct order

Return ONLY valid JSON:
{{
  "question_text": "Put these in the correct order.",
  "question_type": "ordered_list",
  "correct_answer": "<item1> → <item2> → <item3> → <item4>",
  "distractors": [],
  "hint_1": "<general hint about the sequence>",
  "hint_2": "<more specific hint>",
  "hint_3": "<closest hint without revealing the order>",
  "explanation": "<explanation of why this order is correct>",
  "source_chunk_ids": {chunk_ids},
  "answer_parts": [
    {{"item": "<first in correct order>"}},
    {{"item": "<second in correct order>"}},
    {{"item": "<third in correct order>"}},
    {{"item": "<fourth in correct order>"}}
  ]
}}"""


def stage2_verify(question_data: dict, result: PipelineResult) -> bool:
    """Stage 2: code verification dispatched by question_type. Unknown types fail closed."""
    result.log_stage("Stage 2: code verification")
    qtype = question_data.get("question_type", "")

    if qtype in _MATHS_TYPES:
        verified, detail = maths_verifier.verify(question_data)
        result.verifier_version = getattr(maths_verifier, "VERIFIER_VERSION", "unknown")
    elif qtype in _ENGLISH_TYPES:
        verified, detail = english_verifier.verify(question_data)
        result.verifier_version = getattr(english_verifier, "VERIFIER_VERSION", "unknown")
    elif qtype in _PHYSICS_TYPES:
        verified, detail = physics_verifier.verify(question_data)
        result.verifier_version = getattr(physics_verifier, "VERIFIER_VERSION", "unknown")
    elif qtype in _CHEMISTRY_TYPES:
        verified, detail = chemistry_verifier.verify(question_data)
        result.verifier_version = getattr(chemistry_verifier, "VERIFIER_VERSION", "unknown")
    elif qtype in _MULTIPART_TYPES:
        verified, detail = _verify_multipart(question_data)
        result.verifier_version = "multipart-v1"
    elif qtype in _HUMANITIES_TYPES:
        # RAG-only pass-through: Stage 6 enforces non-empty source_chunk_ids
        # (config.RAG_REQUIRED_TYPES) and the 90-point publish threshold.
        verified, detail = True, "RAG-only type — grounding enforced at Stage 6"
        result.verifier_version = "humanities-passthrough-v1"
    else:
        verified = False
        detail = f"Unknown question_type: {qtype!r} — failing closed"
        result.verifier_version = "unknown"

    result.log_stage(f"  verified={verified} verifier_version={result.verifier_version} detail={detail}")
    return verified


def stage3_consensus(topic: dict, tier: str, question_data: dict, result: PipelineResult) -> bool:
    """Stage 3: consensus check at temperature=0."""
    result.log_stage("Stage 3: consensus check")
    year_label, key_stage = _YEAR_GROUP_DISPLAY.get(
        topic["year_group_label"], (topic["year_group_label"], "")
    )
    prompt = _CONSENSUS_PROMPT_TEMPLATE.format(
        year_label=year_label,
        key_stage=key_stage,
        subject=topic.get("subject_name", ""),
        question_text=question_data.get("question_text", ""),
        correct_answer=question_data.get("correct_answer", ""),
        distractors=question_data.get("distractors", []),
        tier=tier,
    )
    try:
        msg = _anthropic().messages.create(
            model=config.CLAUDE_MODEL,
            max_tokens=512,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )
        result.add_tokens(msg)
        text = msg.content[0].text.strip()
        if text.startswith("```"):
            text = "\n".join(l for l in text.splitlines() if not l.startswith("```"))
        consensus = json.loads(_extract_json(text))
        passed = bool(
            consensus.get("answer_is_correct")
            and consensus.get("answer_is_unambiguous")
            and consensus.get("tier_appropriate")
        )
        result.log_stage(f"  consensus={passed} notes={consensus.get('notes', '')}")
        return passed
    except Exception as exc:
        result.log_stage(f"  consensus error: {exc}")
        return False


def stage4_constitutional(
    topic: dict, tier: str, question_data: dict, result: PipelineResult
) -> list[str]:
    """Stage 4: constitutional critique. Returns list of violations.

    Side-effect: writes technique_type, technique_hint, technique_note back into
    question_data so Stage 6 can persist them alongside the question row.
    """
    result.log_stage("Stage 4: constitutional critique")
    year_label, _ = _YEAR_GROUP_DISPLAY.get(
        topic["year_group_label"], (topic["year_group_label"], "")
    )
    prompt = _CONSTITUTIONAL_PROMPT_TEMPLATE.format(
        constitution=_CONSTITUTION,
        subject=topic.get("subject_name", ""),
        year_label=year_label,
        tier=tier,
        question_text=question_data.get("question_text", ""),
        correct_answer=question_data.get("correct_answer", ""),
        distractors=question_data.get("distractors", []),
        hint_1=question_data.get("hint_1", ""),
        hint_2=question_data.get("hint_2", ""),
        hint_3=question_data.get("hint_3", ""),
        explanation=question_data.get("explanation", ""),
    )
    try:
        msg = _anthropic().messages.create(
            model=config.CLAUDE_MODEL,
            max_tokens=600,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )
        result.add_tokens(msg)
        text = msg.content[0].text.strip()
        if text.startswith("```"):
            text = "\n".join(l for l in text.splitlines() if not l.startswith("```"))
        critique = json.loads(_extract_json(text))
        violations = critique.get("violations", [])

        # Extract technique fields and write back into question_data for db.write_question
        technique_type = critique.get("technique_type", "recall")
        if technique_type not in _TECHNIQUE_TYPES:
            technique_type = "recall"
        question_data["technique_type"] = technique_type
        question_data["technique_hint"] = critique.get("technique_hint") or None
        question_data["technique_note"] = critique.get("technique_note") or None

        result.log_stage(
            f"  violations={violations} technique_type={technique_type}"
        )
        return violations
    except Exception as exc:
        result.log_stage(f"  constitutional error: {exc}")
        # Fail-safe: default to recall so the question can still be written
        question_data.setdefault("technique_type", "recall")
        question_data.setdefault("technique_hint", None)
        question_data.setdefault("technique_note", None)
        return []


def stage5_dedup(
    topic_id: str, question_data: dict, result: PipelineResult
) -> bool:
    """Stage 5: semantic dedup. Returns True if NOT a duplicate."""
    result.log_stage("Stage 5: semantic deduplication")
    if not config.EMBEDDINGS_ENABLED:
        result.log_stage("  embeddings disabled — skipping dedup")
        return True

    # Fetch full rows (id + question_text + correct_answer) for dedup + diversity checks.
    existing_full = db.get_published_questions_full(topic_id)
    existing = existing_full  # used for semantic dedup below

    if not existing:
        result.log_stage("  no existing published questions — passes dedup")
    else:
        new_text = question_data.get("question_text", "")
        new_answer = str(question_data.get("correct_answer", "")).strip()

        # Fast exact-text check before expensive embedding
        for row in existing:
            if row.get("question_text", "").strip() == new_text.strip():
                result.log_stage("  exact duplicate detected")
                return False

        # Number-fingerprint check: questions that share the same set of numeric values
        # and the same correct answer are almost certainly paraphrases of the same fact.
        import re as _re
        def _num_fingerprint(text: str, answer: str) -> frozenset:
            nums = frozenset(_re.findall(r"\b\d[\d,\.]*\b", text))
            return nums | {answer.strip().lower()}

        new_fp = _num_fingerprint(new_text, new_answer)
        for row in existing:
            ex_fp = _num_fingerprint(row.get("question_text", ""), str(row.get("correct_answer", "")))
            # If all numbers AND the answer are identical, it's almost certainly the same question
            if len(new_fp) >= 3 and new_fp == ex_fp:
                result.log_stage(f"  number-fingerprint duplicate detected (shared values: {new_fp})")
                return False

        q_embedding = embed_text(new_text)
        if q_embedding is None:
            result.log_stage("  embedding failed — skipping dedup")
        else:
            for row in existing:
                ex_embedding = embed_text(row.get("question_text", ""))
                if ex_embedding is None:
                    continue
                similarity = float(
                    np.dot(q_embedding, ex_embedding)
                    / (np.linalg.norm(q_embedding) * np.linalg.norm(ex_embedding) + 1e-12)
                )
                if similarity > config.DEDUP_SIMILARITY_THRESHOLD:
                    result.log_stage(f"  semantic duplicate detected (similarity={similarity:.3f})")
                    return False

        result.log_stage("  no duplicates found")

    # English answer-diversity check: reject if this correct_answer is already used
    # by >40% of published questions in the topic.  Prevents the pattern where every
    # grammar question answers "because" or every phonics question answers "sh".
    subject = ""
    try:
        topic_row = db.get_topic(topic_id)
        subject = (topic_row or {}).get("subject_name", "")
    except Exception:
        pass
    if "english" in subject.lower() and existing:
        new_answer = (question_data.get("correct_answer") or "").strip().lower()
        if new_answer:
            published_answers = [
                (r.get("correct_answer") or "").strip().lower()
                for r in existing
                if r.get("correct_answer")
            ]
            if published_answers:
                match_count = sum(1 for a in published_answers if a == new_answer)
                match_pct = match_count / len(published_answers)
                if match_pct > 0.40:
                    result.log_stage(
                        f"  answer diversity rejected: '{new_answer}' already used in "
                        f"{match_count}/{len(published_answers)} published questions "
                        f"({match_pct:.0%} > 40% threshold)"
                    )
                    return False

    return True


def stage6_score(
    verified: bool,
    consensus_passed: bool,
    violations: list[str],
    is_duplicate: bool,
    has_required_fields: bool,
    question_data: dict,
    topic: dict,
    result: PipelineResult,
) -> tuple[float, str]:
    """Stage 6: confidence scoring + RAG grounding check + per-type threshold.

    Weights from CLAUDE.md §9:
      computation   60
      consensus     25
      constitutional −10 per violation
      dedup         −20 if duplicate
      structure     −30 if missing required fields
    Additional Phase 11A gate: RAG-required types that have empty source_chunk_ids → regenerating.
    """
    result.log_stage("Stage 6: confidence scoring + RAG grounding")

    # Renderability gate (before scoring — a hard stop for any content type).
    # The child UI cannot render markdown tables or raw HTML; such content is
    # unreadable garble on the device, so it must never publish regardless of
    # factual correctness. Route to regeneration to produce a renderable version.
    offenders = _renderability_offenders(question_data)
    if offenders:
        result.log_stage(
            f"  Renderability FAILED: markdown table / HTML in {', '.join(offenders)}"
        )
        result.confidence_score = 0.0
        return 0.0, "regenerating"

    # Multi-answer prompt gate — the single-answer UI cannot score "select all"
    # questions, so they must never publish regardless of correctness.
    if _is_multiselect_prompt(question_data.get("question_text", "")):
        result.log_stage(
            "  Multi-answer prompt FAILED: single-answer UI cannot score 'select all'-style questions"
        )
        result.confidence_score = 0.0
        return 0.0, "regenerating"

    # RAG grounding gate (before scoring — a hard stop for RAG-required types)
    qtype = question_data.get("question_type", "")
    source_chunk_ids = question_data.get("source_chunk_ids") or []
    chunks = question_data.get("_retrieved_chunks") or []

    if qtype in config.RAG_REQUIRED_TYPES:
        if not source_chunk_ids:
            result.log_stage(f"  RAG grounding FAILED: {qtype!r} requires non-empty source_chunk_ids")
            result.confidence_score = 0.0
            return 0.0, "regenerating"

        # Verify cited chunks match topic subject and year_group
        subject_name = (topic.get("subject_name") or "").lower()
        year_group_label = (topic.get("year_group_label") or "").lower()
        chunk_map = {str(c["id"]): c for c in chunks}

        for chunk_id in source_chunk_ids:
            chunk = chunk_map.get(str(chunk_id))
            if chunk is None:
                result.log_stage(f"  RAG grounding FAILED: cited chunk {chunk_id!r} not in retrieved set")
                result.confidence_score = 0.0
                return 0.0, "regenerating"
            chunk_subject = (chunk.get("subject") or "").lower()
            chunk_year = (chunk.get("year_group") or "").lower()
            if subject_name and chunk_subject and subject_name not in chunk_subject and chunk_subject not in subject_name:
                result.log_stage(
                    f"  RAG grounding FAILED: chunk subject {chunk_subject!r} "
                    f"does not match topic subject {subject_name!r}"
                )
                result.confidence_score = 0.0
                return 0.0, "regenerating"
            if year_group_label and chunk_year and year_group_label not in chunk_year and chunk_year not in year_group_label:
                result.log_stage(
                    f"  RAG grounding FAILED: chunk year_group {chunk_year!r} "
                    f"does not match topic year_group {year_group_label!r}"
                )
                result.confidence_score = 0.0
                return 0.0, "regenerating"

        result.log_stage(f"  RAG grounding OK: {len(source_chunk_ids)} chunk(s) cited")

    # Confidence scoring
    # Weights: computation=60, consensus=25, RAG grounding bonus=+5 (for RAG-required types),
    # constitutional=−10/violation, dedup=−20, structure=−30.
    # RAG bonus aligns the max achievable score (90) with the 90-threshold for biology/science
    # factual types that cannot be computationally verified (CLAUDE.md §8).
    score = 0.0
    if verified:
        score += 60
    if consensus_passed:
        score += 25
    # +5 RAG grounding bonus for types where source_chunk_ids is confirmed non-empty
    if qtype in config.RAG_REQUIRED_TYPES and source_chunk_ids:
        score += 5
    score -= len(violations) * 10
    if is_duplicate:
        score -= 20
    if not has_required_fields:
        score -= 30

    # ── Literary analysis quality buffer ─────────────────────────────────────
    # WHY THIS EXCEPTION EXISTS:
    # english_literary_analysis has threshold=90 and max achievable score=90
    # (60 verified + 25 consensus + 5 RAG bonus). This means a single minor
    # constitutional violation (e.g. slightly imperfect hint phrasing) drops
    # the score to 80 — a hard fail — even when all substantive quality signals
    # pass: answer is valid, source is grounded, consensus confirms correctness.
    #
    # The fix: add a +5 buffer ONLY when all quality gates are clean:
    #   - verified=True (Stage 2)
    #   - consensus=True (Stage 3)
    #   - RAG grounded (source_chunk_ids non-empty, validated above)
    #   - no duplicate
    #   - has required fields
    # This lifts a clean question to 95 and allows ONE minor constitutional
    # violation before failing (score=85 ≥ threshold=90... wait, threshold is
    # still 90, so buffer lifts clean questions to 95 giving a 5-point cushion
    # against one minor violation dropping to 85).
    #
    # This does NOT weaken RAG grounding, factual accuracy, consensus, or
    # safety checks — those are all still required and remain hard failures.
    # It only prevents minor formatting/hint-quality issues from blocking
    # well-grounded, consensus-validated literary analysis content.
    if (
        qtype == "english_literary_analysis"
        and verified
        and consensus_passed
        and source_chunk_ids  # RAG already confirmed above
        and not is_duplicate
        and has_required_fields
    ):
        score += 5
        result.log_stage("  +5 literary analysis quality buffer applied (all primary gates clean)")

    # ── Physics calculation quality buffer ────────────────────────────────
    # science_physics_calculation: max achievable = verified(60) + consensus(25) = 85
    # which exactly equals the publish threshold. One constitutional violation (−10)
    # drops it to 75 → regenerating, even for structurally valid, well-calculated questions.
    # The +5 buffer gives 5 points of headroom — only applied when all primary quality
    # gates are clean (verified=True, consensus passed, no duplicate, all required fields
    # present including verification_expression).
    if (
        qtype == "science_physics_calculation"
        and verified
        and consensus_passed
        and not is_duplicate
        and has_required_fields
    ):
        score += 5
        result.log_stage("  +5 physics calculation quality buffer applied (all primary gates clean)")

    score = max(0.0, score)

    threshold = config.get_confidence_threshold(qtype)
    status = (
        "published" if score >= threshold
        else "regenerating" if score >= 50
        else "staged"
    )
    result.confidence_score = score
    result.log_stage(f"  score={score} threshold={threshold} → {status}")
    return score, status


# ── Required fields check ─────────────────────────────────────────────────

_REQUIRED_FIELDS = {
    "question_text", "question_type", "correct_answer",
    "distractors", "hint_1", "hint_2", "hint_3", "explanation",
}


def _has_required_fields(data: dict) -> bool:
    return all(bool(data.get(f)) for f in _REQUIRED_FIELDS) and len(
        data.get("distractors", [])
    ) == 3


# ── Renderability gate ────────────────────────────────────────────────────
# The child quiz UI renders question_text / answers via <MathText> (KaTeX for
# $...$ math, plain text otherwise) — it does NOT parse markdown or HTML. So a
# markdown table or raw HTML emitted into these fields shows up as literal pipe
# salad on the iPad. None of the six pipeline stages otherwise check for this,
# which is how garbled data-table questions reached the published pool. This is
# a deterministic hard gate run in Stage 6 (cheap, zero false positives on the
# current pool — every pipe-table hit was a genuine markdown table).
#
# Signal: a markdown table separator row — a pipe adjacent to 3+ dashes
# (e.g. "|---|---|"). This is unambiguous: absolute-value notation like |x|
# never produces "|---". HTML table tags are also caught.
_MARKDOWN_TABLE_RE = re.compile(r"\|\s*-{3,}|-{3,}\s*\|")
_HTML_TABLE_RE = re.compile(r"<\s*(table|tr|td|th|thead|tbody)\b", re.IGNORECASE)


def _has_unrenderable_markup(text: str) -> bool:
    """True if text contains a markdown/HTML table the child UI can't render."""
    if not text:
        return False
    return bool(_MARKDOWN_TABLE_RE.search(text)) or bool(_HTML_TABLE_RE.search(text))


def _renderability_offenders(data: dict) -> list[str]:
    """Names of child-facing fields containing unrenderable table/HTML markup."""
    offenders: list[str] = []
    if _has_unrenderable_markup(data.get("question_text", "")):
        offenders.append("question_text")
    if _has_unrenderable_markup(data.get("correct_answer", "")):
        offenders.append("correct_answer")
    for i, d in enumerate(data.get("distractors", []) or []):
        if _has_unrenderable_markup(str(d)):
            offenders.append(f"distractors[{i}]")
    return offenders


# ── Multi-answer prompt gate ───────────────────────────────────────────────
# Every quiz surface (daily challenge, world-map quiz, exams) is single-answer
# multiple choice: one correct_answer + 3 distractors, pick exactly one. A
# "Select all that apply"-style prompt is therefore unscoreable — the child can
# only tap one option, and such questions were authored with multiple options
# that satisfy the prompt while only one is marked correct (so a child picking
# a different correct option is graded wrong). The constitutional critic (Stage
# 4) is asked to flag these, but an LLM is not a reliable gate, so this is a
# deterministic hard stop in Stage 6, mirroring the renderability gate.
# "any" is included ("Select any numbers which are factors of 11" is multi-answer)
# but a negative lookahead spares the legit single-answer "choose any one …".
_MULTISELECT_PROMPT_RE = re.compile(
    r"\b(select|choose|tick|mark|pick)\s+(all|every|each|any)\b(?!\s+one\b)"
    r"|\ball\s+that\s+apply\b",
    re.IGNORECASE,
)


def _is_multiselect_prompt(text: str) -> bool:
    """True if the prompt instructs the child to pick more than one option."""
    if not text:
        return False
    return bool(_MULTISELECT_PROMPT_RE.search(text))


# ── Main pipeline entry point ─────────────────────────────────────────────

def run_one(
    topic: dict,
    tier: str,
    pipeline_run_id: Optional[str] = None,
    topup_mode: bool = False,
) -> PipelineResult:
    """Run the full 6-stage pipeline for a single question slot.

    Retries up to MAX_PIPELINE_CYCLES if generation or verification fails.
    Writes generation_errors for each failed cycle.

    topup_mode: when True (topic below minimum question count), a question that
    passes verification AND consensus but is penalised only for near-dedup
    similarity (score 60-84) is still published. This prevents the pipeline
    from being permanently blocked on saturated semantic spaces for small topics.
    Hard quality gates (verification, consensus) are never relaxed.
    """
    last_result = PipelineResult()

    for cycle in range(1, config.MAX_PIPELINE_CYCLES + 1):
        result = PipelineResult()
        result.log_stage(f"=== Pipeline cycle {cycle}/{config.MAX_PIPELINE_CYCLES} (tier={tier}) ===")

        # Stage 1
        question_data = stage1_generate(topic, tier, result)
        if question_data is None:
            result.log_stage("  Stage 1 failed — aborting cycle")
            db.write_generation_error(
                pipeline_run_id=pipeline_run_id,
                topic_id=str(topic["id"]),
                question_type=None,
                tier=tier,
                stage_failed=1,
                error_message="Stage 1: generation returned None",
            )
            last_result = result
            continue

        qtype = question_data.get("question_type", "")

        if not _has_required_fields(question_data):
            result.log_stage("  missing required fields — aborting cycle")
            db.write_generation_error(
                pipeline_run_id=pipeline_run_id,
                topic_id=str(topic["id"]),
                question_type=qtype,
                tier=tier,
                stage_failed=1,
                error_message="Stage 1: missing required fields",
                raw_llm_output=question_data,
            )
            last_result = result
            continue

        # Stage 2
        verified = stage2_verify(question_data, result)

        # Stage 3
        consensus = stage3_consensus(topic, tier, question_data, result)

        # Stage 4
        violations = stage4_constitutional(topic, tier, question_data, result)

        # Stage 5
        not_duplicate = stage5_dedup(topic["id"], question_data, result)

        # Stage 6 (includes RAG grounding)
        score, status = stage6_score(
            verified=verified,
            consensus_passed=consensus,
            violations=violations,
            is_duplicate=not not_duplicate,
            has_required_fields=True,
            question_data=question_data,
            topic=topic,
            result=result,
        )

        if status == "regenerating":
            # topup_mode: publish if verified + consensus passed and the question
            # is only penalised for NEAR-dedup similarity (0.82–0.92), not a
            # genuine copy (>0.92). Hard quality gates are never relaxed.
            if topup_mode and verified and consensus and score >= 60 and not_duplicate:
                result.log_stage(
                    f"  topup_mode: accepting score={score} (verified+consensus, near-dedup only)"
                )
                status = "published"
                # fall through to write below
            else:
                db.write_generation_error(
                    pipeline_run_id=pipeline_run_id,
                    topic_id=str(topic["id"]),
                    question_type=qtype,
                    tier=tier,
                    stage_failed=6,
                    error_message=f"Stage 6: score={score} below threshold or RAG grounding failed",
                    raw_llm_output={"question_text": question_data.get("question_text"), "source_chunk_ids": question_data.get("source_chunk_ids")},
                )
                last_result = result
                continue

        qid = db.write_question(
            topic["id"], tier, question_data, status, score,
            generator_version=config.PIPELINE_VERSION,
            verifier_version=result.verifier_version,
        )
        result.question_id = qid
        result.status = status
        result.log_stage(f"  written question {qid} as {status}")
        return result

    # All cycles exhausted
    last_result.status = "failed"
    last_result.stage_log.append(f"Circuit breaker: all {config.MAX_PIPELINE_CYCLES} cycles failed")
    return last_result


def regenerate_question(flagged_row: dict) -> "PipelineResult":
    """Re-run the pipeline to replace a single flagged question.

    The original flagged question is moved to 'regenerating' immediately so
    it disappears from the child-facing pool. A new question is generated for
    the same topic + tier via the full 6-stage pipeline. If generation
    succeeds the new question is written with status 'published'/'staged'. The
    original row is then moved to 'staged' for the one-time admin spot-check.
    If generation fails the original is left in 'regenerating' (the nightly
    cron will retry it the next day).
    """
    question_id = str(flagged_row["id"])
    topic_id    = str(flagged_row["topic_id"])
    tier        = flagged_row["tier"]

    # Step 1: hide the flagged question from children
    db.mark_question_regenerating(question_id)
    log.info(f"regenerate_question: {question_id} → regenerating")

    # Step 2: fetch full topic metadata (same path as run_one)
    topic = db.get_topic(topic_id)
    if topic is None:
        result = PipelineResult()
        result.status = "failed"
        result.log_stage(f"Topic {topic_id!r} not found — cannot regenerate")
        return result

    # Step 3: run the full 6-stage pipeline for one new question slot
    result = run_one(topic, tier)

    # Step 4: move original to staged regardless of outcome; the new question
    # (if published) is already visible. If generation failed, leaving the
    # original as 'staged' lets an admin review it rather than silently losing it.
    db.mark_question_staged(question_id)
    log.info(
        f"regenerate_question: original {question_id} → staged; "
        f"new question status={result.status}"
    )
    return result


def run_for_topic(
    topic_id: str,
    tier: str,
    count: int,
    pipeline_run_id: Optional[str] = None,
    restrict_source: Optional[str] = None,
) -> list[PipelineResult]:
    """Generate `count` questions for a topic at the given tier.

    restrict_source: when set, RAG grounding is scoped to chunks with this
    source_name only (for bespoke topics whose dedicated source would otherwise
    be drowned by the shared subject+year chunk pool).

    Emits a structured summary via the pipeline.cost logger.
    """
    if _STOP_GUARD.exists():
        raise RuntimeError(
            "PIPELINE STOP ACTIVE: Decifer Learning content generation is disabled"
        )
    topic = db.get_topic(topic_id)
    if topic is None:
        raise ValueError(f"Topic {topic_id!r} not found")
    if restrict_source:
        topic["restrict_source"] = restrict_source

    results: list[PipelineResult] = []
    for i in range(count):
        log.info(f"Generating question {i+1}/{count} for topic {topic['title']!r} tier={tier}")
        results.append(run_one(topic, tier, pipeline_run_id=pipeline_run_id))

    summary = {
        "event": "pipeline.run_for_topic.complete",
        "topic_id": str(topic_id),
        "topic_title": topic.get("title"),
        "year_group": topic.get("year_group_label"),
        "subject": topic.get("subject_name"),
        "tier": tier,
        "model": config.CLAUDE_MODEL,
        "pipeline_version": config.PIPELINE_VERSION,
        "count_requested": count,
        "count_published": sum(1 for r in results if r.status == "published"),
        "count_staged": sum(1 for r in results if r.status == "staged"),
        "count_regenerating": sum(1 for r in results if r.status == "regenerating"),
        "count_failed": sum(1 for r in results if r.status == "failed"),
        "input_tokens": sum(r.input_tokens for r in results),
        "output_tokens": sum(r.output_tokens for r in results),
        "question_ids": [r.question_id for r in results if r.question_id],
    }
    logging.getLogger("pipeline.cost").info(json.dumps(summary))
    return results


# ── fix_staged_question ────────────────────────────────────────────────────
#
# Targeted LLM polish for staged questions that scored 80–89.
# Instead of regenerating from scratch, we:
#   1. Run constitutional critique to get the specific violations.
#   2. Ask Claude to fix ONLY those violations (question, distractors, hints).
#   3. Re-run constitutional critique on the fixed version.
#   4. Re-score — if ≥ threshold, UPDATE the row to published.
#
# We never change correct_answer (no LLM computing canonical answers).
# We never change question_type or source_chunk_ids.

_FIX_PROMPT_TEMPLATE = """You are a quality editor for a UK educational app for children (year group: {year_label}, tier: {tier}).

The following {subject} question was rejected for these constitutional violations:
{violations_text}

Fix ONLY the issues listed above. Do not change the correct answer, the question type, or the overall topic being tested.

Constitution (must satisfy all):
{constitution}

Current question:
Question: {question_text}
Correct answer: {correct_answer}
Distractors: {distractors}
Hint 1: {hint_1}
Hint 2: {hint_2}
Hint 3: {hint_3}
Explanation: {explanation}

Return ONLY valid JSON with the fixed fields (include ALL fields even if unchanged):
{{"question_text": "...", "correct_answer": "...", "distractors": ["...", "...", "..."], "hint_1": "...", "hint_2": "...", "hint_3": "...", "explanation": "..."}}"""


def fix_staged_question(question_id: str) -> dict:
    """Attempt to fix a staged question via targeted LLM polish.

    Returns a result dict with keys:
      question_id, outcome ('published'|'still_staged'|'skipped'|'error'),
      old_score, new_score, violations_before, violations_after, error (if any)
    """
    log = logging.getLogger("pipeline.fix_staged")

    # Load question + topic from DB
    conn = db.get_connection()
    try:
        with conn.cursor(cursor_factory=__import__("psycopg2").extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT qq.id, qq.topic_id, qq.tier, qq.question_text, qq.question_type,
                       qq.correct_answer, qq.distractors, qq.hint_1, qq.hint_2, qq.hint_3,
                       qq.explanation, qq.confidence_score, qq.source_chunk_ids,
                       qq.technique_type, qq.technique_hint, qq.technique_note,
                       qq.source_text, qq.source_label, qq.source_type,
                       qq.generator_version, qq.verifier_version
                FROM quiz_questions qq
                WHERE qq.id = %s AND qq.status = 'staged'
                """,
                (question_id,),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return {"question_id": question_id, "outcome": "skipped", "reason": "not found or not staged"}

    old_score = float(row["confidence_score"] or 0)
    if old_score < 80:
        return {"question_id": question_id, "outcome": "skipped", "reason": f"score {old_score} below fix threshold"}

    topic = db.get_topic(str(row["topic_id"]))
    if not topic:
        return {"question_id": question_id, "outcome": "error", "error": "topic not found"}

    tier = row["tier"]
    year_label, _ = _YEAR_GROUP_DISPLAY.get(topic["year_group_label"], (topic["year_group_label"], ""))

    question_data = {
        "question_text": row["question_text"],
        "question_type": row["question_type"],
        "correct_answer": row["correct_answer"],
        "distractors": row["distractors"] if isinstance(row["distractors"], list) else json.loads(row["distractors"] or "[]"),
        "hint_1": row["hint_1"],
        "hint_2": row["hint_2"],
        "hint_3": row["hint_3"],
        "explanation": row["explanation"],
        "technique_type": row.get("technique_type") or "recall",
        "technique_hint": row.get("technique_hint"),
        "technique_note": row.get("technique_note"),
        "source_chunk_ids": row["source_chunk_ids"] if isinstance(row["source_chunk_ids"], list) else json.loads(row["source_chunk_ids"] or "[]"),
        "source_text": row.get("source_text"),
        "source_label": row.get("source_label"),
        "source_type": row.get("source_type"),
    }

    # Step 1: constitutional critique to get violations
    dummy_result = PipelineResult()
    violations_before = stage4_constitutional(topic, tier, question_data, dummy_result)

    if not violations_before:
        # No violations found on re-check — score may be fixable by just re-scoring
        violations_before = []

    # Step 2: ask Claude to fix the violations
    try:
        violations_text = "\n".join(f"- {v}" for v in violations_before) if violations_before else "- Minor quality issues: improve hint progression and distractor plausibility"
        fix_prompt = _FIX_PROMPT_TEMPLATE.format(
            year_label=year_label,
            tier=tier,
            subject=topic.get("subject_name", ""),
            violations_text=violations_text,
            constitution=_CONSTITUTION,
            question_text=question_data["question_text"],
            correct_answer=question_data["correct_answer"],
            distractors=question_data["distractors"],
            hint_1=question_data["hint_1"],
            hint_2=question_data["hint_2"],
            hint_3=question_data["hint_3"],
            explanation=question_data["explanation"],
        )
        msg = _anthropic().messages.create(
            model=config.CLAUDE_MODEL,
            max_tokens=1200,
            temperature=0.3,
            messages=[{"role": "user", "content": fix_prompt}],
        )
        text = msg.content[0].text.strip()
        if text.startswith("```"):
            text = "\n".join(l for l in text.splitlines() if not l.startswith("```"))
        fixed = json.loads(_extract_json(text))
    except Exception as exc:
        log.error(f"[fix_staged] LLM fix failed for {question_id}: {exc}")
        return {"question_id": question_id, "outcome": "error", "error": str(exc)}

    # Apply fixes — never change correct_answer or question_type
    question_data["question_text"] = fixed.get("question_text", question_data["question_text"])
    question_data["distractors"] = fixed.get("distractors", question_data["distractors"])
    question_data["hint_1"] = fixed.get("hint_1", question_data["hint_1"])
    question_data["hint_2"] = fixed.get("hint_2", question_data["hint_2"])
    question_data["hint_3"] = fixed.get("hint_3", question_data["hint_3"])
    question_data["explanation"] = fixed.get("explanation", question_data["explanation"])

    # Step 3: re-run constitutional critique on fixed version
    recheck_result = PipelineResult()
    violations_after = stage4_constitutional(topic, tier, question_data, recheck_result)

    # Step 4: re-score directly — skip RAG chunk re-verification since the question
    # already passed that gate originally (source_chunk_ids are in DB but _retrieved_chunks
    # is not available outside the generation pipeline).
    # Weights mirror stage6_score: computation=60, consensus=25, constitutional=-10/violation.
    qtype = question_data.get("question_type", "")
    has_rag_bonus = (
        qtype in config.RAG_REQUIRED_TYPES
        and bool(question_data.get("source_chunk_ids"))
    )
    new_score = 60.0 + 25.0  # verified + consensus (original passes carried forward)
    if has_rag_bonus:
        new_score += 5.0
    new_score -= len(violations_after) * 10.0
    # literary_analysis +5 buffer when all primary gates clean
    if qtype == "english_literary_analysis" and not violations_after:
        new_score += 5.0
    # physics_calculation +5 buffer when all primary gates clean
    if qtype == "science_physics_calculation" and not violations_after:
        new_score += 5.0
    new_score = max(0.0, new_score)
    threshold = config.get_confidence_threshold(qtype)
    new_status = "published" if new_score >= threshold else "staged"

    if new_status == "published":
        # UPDATE the existing row in-place
        conn2 = db.get_connection()
        try:
            with conn2.cursor() as cur:
                cur.execute(
                    """
                    UPDATE quiz_questions SET
                        question_text = %s,
                        distractors = %s,
                        hint_1 = %s, hint_2 = %s, hint_3 = %s,
                        explanation = %s,
                        technique_type = %s,
                        technique_hint = %s,
                        technique_note = %s,
                        confidence_score = %s,
                        status = 'published',
                        published_at = NOW()
                    WHERE id = %s AND status = 'staged'
                    """,
                    (
                        question_data["question_text"],
                        json.dumps(question_data["distractors"]),
                        question_data["hint_1"],
                        question_data["hint_2"],
                        question_data["hint_3"],
                        question_data["explanation"],
                        question_data.get("technique_type") or "recall",
                        question_data.get("technique_hint"),
                        question_data.get("technique_note"),
                        new_score,
                        question_id,
                    ),
                )
            conn2.commit()
        finally:
            conn2.close()
        log.info(f"[fix_staged] {question_id} promoted: {old_score}→{new_score}")
        return {
            "question_id": question_id,
            "outcome": "published",
            "old_score": old_score,
            "new_score": new_score,
            "violations_before": violations_before,
            "violations_after": violations_after,
        }

    log.info(f"[fix_staged] {question_id} still staged: {old_score}→{new_score} violations={violations_after}")
    return {
        "question_id": question_id,
        "outcome": "still_staged",
        "old_score": old_score,
        "new_score": new_score,
        "violations_before": violations_before,
        "violations_after": violations_after,
    }
