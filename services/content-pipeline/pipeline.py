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
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

import config
import db
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
    "year-3": ("Year 3", "KS2"),
    "year-7": ("Year 7", "KS3"),
}

# ── Subject-aware prompt builders ─────────────────────────────────────────

def _build_maths_prompt(topic: dict, tier: str, chunks: list[dict]) -> str:
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

    return f"""You are an expert UK mathematics curriculum writer generating quiz questions for {year_label} pupils ({key_stage}, UK National Curriculum).

Topic: {topic['title']}
Subject: Mathematics
Year group: {year_label}
Difficulty tier: {tier} — {tier_desc}

{source_section}

Generate ONE multiple-choice mathematics question. Follow these rules exactly:

QUESTION: Clear, unambiguous, appropriate for {year_label}. One correct answer.

DISTRACTORS: Exactly 3 wrong answers. Each must be plausible (a common mistake), but clearly wrong on careful inspection.

HINTS — strictly follow this progression:
  hint_1: A general strategy or reminder (does NOT reference the specific numbers in the question).
  hint_2: A more specific step that moves toward the answer WITHOUT revealing it.
  hint_3: ONE clear step that leads directly to the answer (still does not state the answer itself).
  RULE: No hint may state the correct answer directly.

EXPLANATION: Full step-by-step working that arrives at the correct answer.

Valid question_type values: maths_arithmetic, maths_algebra, maths_geometry

Return ONLY valid JSON with this exact structure (no extra text, no markdown fences):
{{
  "question_text": "<the question>",
  "question_type": "<maths_arithmetic | maths_algebra | maths_geometry>",
  "correct_answer": "<answer as a string>",
  "distractors": ["<wrong1>", "<wrong2>", "<wrong3>"],
  "hint_1": "<general strategy>",
  "hint_2": "<specific step>",
  "hint_3": "<final step, leaves one calculation>",
  "explanation": "<complete step-by-step working>",
  "source_chunk_ids": [],
  "verification_expression": "<for maths_arithmetic and maths_geometry: Python expression evaluating to the numeric value of correct_answer>",
  "verification_equation": "<for maths_algebra ONLY: SymPy expression equal to 0 at the solution>",
  "verification_variable": "<for maths_algebra ONLY: variable name>"
}}"""


def _build_english_prompt(topic: dict, tier: str, chunks: list[dict]) -> str:
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
  english_grammar          — question about a grammar rule (uses intentional error in stimulus)
  english_spelling         — question about a spelling mistake (uses intentional error in stimulus)
  english_comprehension    — comprehension question (REQUIRES source_chunk_ids)
  english_vocabulary       — vocabulary question (REQUIRES source_chunk_ids)
  english_literary_analysis — literary analysis (REQUIRES source_chunk_ids)

For english_grammar and english_spelling, include question_metadata with:
  instruction_text: grammatically correct instruction to the pupil
  stimulus_text: the text shown to the child (may contain intentional error)
  intentional_error_type: e.g. "missing_comma", "wrong_verb_tense", "misspelled_word"
  intentional_error_span: {{"start": <char_offset>, "end": <char_offset>}} (0-indexed, within stimulus_text)

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
    "instruction_text": "<instruction (for grammar/spelling only)>",
    "stimulus_text": "<stimulus text (for grammar/spelling only)>",
    "intentional_error_type": "<error type (for grammar/spelling only)>",
    "intentional_error_span": {{"start": 0, "end": 0}}
  }}
}}

For comprehension/vocabulary/literary_analysis, omit question_metadata or set it to null."""


def _build_science_prompt(topic: dict, tier: str, chunks: list[dict]) -> str:
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

For science_physics_calculation:
  - correct_answer should include the numeric value and unit, e.g. "9.81 N"
  - Add verification_expression: a safe arithmetic expression evaluating to the numeric value
  - Add verification_unit: SI unit string, e.g. "N", "m/s", "J"

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
}}"""


def _build_generation_prompt(topic: dict, tier: str, chunks: list[dict]) -> str:
    """Dispatch to subject-specific prompt builder."""
    subject = topic.get("subject_name", "").lower()
    if "english" in subject:
        return _build_english_prompt(topic, tier, chunks)
    if "science" in subject:
        return _build_science_prompt(topic, tier, chunks)
    return _build_maths_prompt(topic, tier, chunks)


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

    prompt = _build_generation_prompt(topic, tier, chunks)

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
    "english_grammar", "english_spelling", "english_comprehension",
    "english_vocabulary", "english_literary_analysis",
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

    existing = db.get_published_question_texts(topic_id)
    if not existing:
        result.log_stage("  no existing published questions — passes dedup")
        return True

    q_embedding = embed_text(question_data.get("question_text", ""))
    if q_embedding is None:
        result.log_stage("  embedding failed — skipping dedup")
        return True

    for row in existing:
        ex_embedding = embed_text(row["question_text"])
        if ex_embedding is None:
            continue
        similarity = float(
            np.dot(q_embedding, ex_embedding)
            / (np.linalg.norm(q_embedding) * np.linalg.norm(ex_embedding) + 1e-12)
        )
        if similarity > config.DEDUP_SIMILARITY_THRESHOLD:
            result.log_stage(f"  duplicate detected (similarity={similarity:.3f})")
            return False

    result.log_stage("  no duplicates found")
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
    score = 0.0
    if verified:
        score += 60
    if consensus_passed:
        score += 25
    score -= len(violations) * 10
    if is_duplicate:
        score -= 20
    if not has_required_fields:
        score -= 30
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


def run_for_topic(
    topic_id: str,
    tier: str,
    count: int,
    pipeline_run_id: Optional[str] = None,
) -> list[PipelineResult]:
    """Generate `count` questions for a topic at the given tier.

    Emits a structured summary via the pipeline.cost logger.
    """
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
