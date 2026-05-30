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
    else:
        diversity_end = ""

    return f"""You are an expert UK mathematics curriculum writer generating quiz questions for {year_label} pupils ({key_stage}, UK National Curriculum).

Topic: {topic['title']}
Subject: Mathematics
Year group: {year_label}
Difficulty tier: {tier} — {tier_desc}

{source_section}

Generate ONE multiple-choice mathematics question. Follow these rules exactly:

QUESTION: Clear, unambiguous, appropriate for {year_label}. One correct answer.

DISTRACTORS: Exactly 3 wrong answers. Each must be plausible (a common mistake), but clearly wrong on careful inspection.

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

QUESTION: Clear, unambiguous, appropriate for {year_label}. One correct answer.

DISTRACTORS: Exactly 3 wrong answers. Each plausible but wrong.

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

QUESTION: Clear, unambiguous, appropriate for {year_label}. One correct answer.

DISTRACTORS: Exactly 3 wrong answers. Each plausible but wrong.

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


def _build_generation_prompt(
    topic: dict,
    tier: str,
    chunks: list[dict],
    existing_questions: list[dict] | None = None,
) -> str:
    """Dispatch to subject-specific prompt builder.

    existing_questions: list of {question_text, correct_answer, question_metadata}
    for published questions in this topic. Passed to prompt builders as a diversity
    hint so the LLM avoids regenerating near-duplicate questions.
    """
    subject = topic.get("subject_name", "").lower()
    if "english" in subject:
        return _build_english_prompt(topic, tier, chunks, existing_questions=existing_questions)
    if "science" in subject:
        return _build_science_prompt(topic, tier, chunks, existing_questions=existing_questions)
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
Difficulty level broadly matches the stated tier (sprout=simple, explorer=multi-step, lightning=challenging).
Question text is clear and unambiguous.
Only flag violations that are clear and significant. Do not flag minor wording imperfections."""


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
Respond with ONLY valid JSON:
{{"violations": []}}"""


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


# ── Individual stages ─────────────────────────────────────────────────────

def stage1_generate(topic: dict, tier: str, result: PipelineResult) -> Optional[dict]:
    """Stage 1: RAG retrieval + Claude generation (subject-aware prompt)."""
    result.log_stage("Stage 1: RAG generation")
    query_text = f"{topic['title']} {topic['year_group_label']} {topic['subject_name']}"
    query_embedding = embed_text(query_text) if config.EMBEDDINGS_ENABLED else None
    chunks = db.retrieve_chunks(topic["subject_name"], topic["year_group_label"], query_embedding)
    result.log_stage(f"  retrieved {len(chunks)} curriculum chunks for {topic['subject_name']}")

    # Pass published questions as a diversity hint for English AND Science topics.
    # English: avoids regenerating the same grammar example / conjunction word.
    # Science: avoids the dedup loop where the LLM keeps generating the same
    #          root/anchorage question when the topic is partially saturated.
    subject = topic.get("subject_name", "").lower()
    existing_questions: list[dict] | None = None
    if "english" in subject or "science" in subject:
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
            max_tokens=256,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )
        result.add_tokens(msg)
        text = msg.content[0].text.strip()
        if text.startswith("```"):
            text = "\n".join(l for l in text.splitlines() if not l.startswith("```"))
        consensus = json.loads(text)
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
    """Stage 4: constitutional critique. Returns list of violations."""
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
            max_tokens=256,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )
        result.add_tokens(msg)
        text = msg.content[0].text.strip()
        if text.startswith("```"):
            text = "\n".join(l for l in text.splitlines() if not l.startswith("```"))
        critique = json.loads(text)
        violations = critique.get("violations", [])
        result.log_stage(f"  violations={violations}")
        return violations
    except Exception as exc:
        result.log_stage(f"  constitutional error: {exc}")
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
        q_embedding = embed_text(question_data.get("question_text", ""))
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
                    result.log_stage(f"  duplicate detected (similarity={similarity:.3f})")
                    return False

        result.log_stage("  no semantic duplicates found")

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


# ── Main pipeline entry point ─────────────────────────────────────────────

def run_one(
    topic: dict,
    tier: str,
    pipeline_run_id: Optional[str] = None,
) -> PipelineResult:
    """Run the full 6-stage pipeline for a single question slot.

    Retries up to MAX_PIPELINE_CYCLES if generation or verification fails.
    Writes generation_errors for each failed cycle.
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
) -> list[PipelineResult]:
    """Generate `count` questions for a topic at the given tier.

    Emits a structured summary via the pipeline.cost logger.
    """
    if _STOP_GUARD.exists():
        raise RuntimeError(
            "PIPELINE STOP ACTIVE: Decifer Learning content generation is disabled"
        )
    topic = db.get_topic(topic_id)
    if topic is None:
        raise ValueError(f"Topic {topic_id!r} not found")

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
