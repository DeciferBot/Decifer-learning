"""
Decifer Learning content pipeline — six-stage generation loop.

CLAUDE.md §9:
  Stage 1  RAG generation
  Stage 2  Code verification
  Stage 3  Consensus check
  Stage 4  Constitutional critique
  Stage 5  Semantic deduplication
  Stage 6  Confidence scoring + status write-back

Only the Maths verifier is wired in Phase 3. Physics / chemistry / English
verifiers land in Phase 11.
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


# ── Helpers ───────────────────────────────────────────────────────────────

_TIER_DESCRIPTIONS = {
    "sprout":    "Basic recall and simple one-step problems. Simple language for the year group.",
    "explorer":  "Multi-step problems requiring two or more operations. Moderate vocabulary.",
    "lightning": "Challenging problems with multiple steps, reasoning, or unfamiliar contexts.",
}

_YEAR_GROUP_DISPLAY = {
    "year-3": ("Year 3", "KS2"),
    "year-7": ("Year 7", "KS3"),
}


def _build_generation_prompt(topic: dict, tier: str, chunks: list[dict]) -> str:
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
Subject: {topic['subject_name']}
Year group: {year_label}
Difficulty tier: {tier} — {tier_desc}

{source_section}

Generate ONE multiple-choice mathematics question. Follow these rules exactly:

QUESTION: Clear, unambiguous, appropriate for {year_label}. One correct answer.

DISTRACTORS: Exactly 3 wrong answers. Each must be plausible (a common mistake), but clearly wrong on careful inspection. All 4 options (correct + 3 wrong) must be distinct.

HINTS — strictly follow this progression:
  hint_1: A general strategy or reminder (does NOT reference the specific numbers in the question).
           Example for "7 × 8": "Think about what multiplication means — equal groups."
  hint_2: A more specific step that moves toward the answer WITHOUT revealing it or listing the full sequence up to the answer.
           Example: "You can use the 4 times table to help: 7 × 4 = 28."
  hint_3: ONE clear step that leads directly to the answer (still does not state the answer itself).
           Example: "7 × 8 = 7 × 4 + 7 × 4. You already know 7 × 4 = 28. What is 28 + 28?"
  RULE: No hint may state the correct answer directly. Hint_3 must leave one small step for the pupil.

EXPLANATION: Full step-by-step working that arrives at the correct answer.

Return ONLY valid JSON with this exact structure (no extra text, no markdown fences):
{{
  "question_text": "<the question>",
  "question_type": "<maths_arithmetic | maths_algebra | maths_geometry>",
  "correct_answer": "<answer as a string, e.g. \\"56\\" or \\"x = 4\\" or \\"48 cm²\\">",
  "distractors": ["<wrong1>", "<wrong2>", "<wrong3>"],
  "hint_1": "<general strategy, no specific numbers from the question>",
  "hint_2": "<specific step toward the answer, does not reveal it>",
  "hint_3": "<final step, leaves one calculation for the pupil>",
  "explanation": "<complete step-by-step working>",
  "source_chunk_ids": [],
  "verification_expression": "<for maths_arithmetic and maths_geometry: Python expression evaluating to the numeric value of correct_answer, e.g. \\"7 * 8\\">",
  "verification_equation": "<for maths_algebra ONLY: SymPy expression equal to 0 at the solution, e.g. \\"2*x + 3 - 11\\">",
  "verification_variable": "<for maths_algebra ONLY: variable name, e.g. \\"x\\">"
}}

CRITICAL: verification_expression or verification_equation must evaluate to the exact numeric value in correct_answer.
For maths_arithmetic and maths_geometry: provide verification_expression only.
For maths_algebra: provide verification_equation and verification_variable only.
Return ONLY the JSON object."""


_CONSENSUS_PROMPT_TEMPLATE = """You are a mathematics education expert verifying a quiz question for {year_label} pupils (UK National Curriculum, {key_stage}).

No source material is provided. Evaluate based purely on mathematical correctness.

Question: {question_text}
Correct answer: {correct_answer}
Distractors: {distractors}
Tier: {tier}

Is the answer correct and unambiguous? Is the tier appropriate for {year_label}?

Respond with ONLY valid JSON:
{{"answer_is_correct": true, "answer_is_unambiguous": true, "tier_appropriate": true, "notes": ""}}"""


_CONSTITUTION = """Age-appropriate language for the stated year group.
No culturally insensitive, biased, or upsetting content.
Exactly 3 distractors — each plausible but clearly wrong on careful reflection.
Hint progression: hint_1 is general, hint_2 is more specific, hint_3 is closest to the answer but does not state it outright.
Single defensible correct answer.
Difficulty level broadly matches the stated tier (sprout=simple, explorer=multi-step, lightning=challenging).
Question text is clear and uses correct mathematical notation.
Only flag violations that are clear and significant. Do not flag minor wording imperfections or incomplete intermediate working in hints as violations."""


_CONSTITUTIONAL_PROMPT_TEMPLATE = """You are a quality reviewer for a UK mathematics educational app aimed at children.

Review the following question against this constitution:
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

    def log_stage(self, msg: str):
        log.info(msg)
        self.stage_log.append(msg)

    def add_tokens(self, msg) -> None:
        """Accumulate Anthropic usage tokens. msg.usage is the SDK return shape."""
        usage = getattr(msg, "usage", None)
        if usage is None:
            return
        self.input_tokens += int(getattr(usage, "input_tokens", 0) or 0)
        self.output_tokens += int(getattr(usage, "output_tokens", 0) or 0)


# ── Individual stages ─────────────────────────────────────────────────────

def stage1_generate(topic: dict, tier: str, result: PipelineResult) -> Optional[dict]:
    """Stage 1: RAG retrieval + Claude generation."""
    result.log_stage("Stage 1: RAG generation")
    query_embedding = embed_text(f"{topic['title']} {topic['year_group_label']} maths")
    chunks = db.retrieve_chunks(topic["subject_name"], topic["year_group_label"], query_embedding)
    result.log_stage(f"  retrieved {len(chunks)} curriculum chunks")

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
            # Strip markdown code fences if present
            if text.startswith("```"):
                text = "\n".join(
                    line for line in text.splitlines()
                    if not line.startswith("```")
                )
            data = json.loads(text)
            result.log_stage(f"  generation OK (attempt {attempt+1})")
            return data
        except (json.JSONDecodeError, IndexError) as exc:
            result.log_stage(f"  attempt {attempt+1} parse error: {exc}")
        except Exception as exc:
            result.log_stage(f"  attempt {attempt+1} API error: {exc}")
            break
    return None


def stage2_verify(question_data: dict, result: PipelineResult) -> bool:
    """Stage 2: code verification via the maths verifier."""
    result.log_stage("Stage 2: code verification")
    verified, detail = maths_verifier.verify(question_data)
    result.log_stage(f"  verified={verified} detail={detail}")
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
    result: PipelineResult,
) -> tuple[float, str]:
    """Stage 6: confidence scoring + decide status.

    Weights from CLAUDE.md §9:
      computation  60
      consensus    25
      constitutional  −10 per violation
      dedup        −20 if duplicate
      structure    −30 if missing required fields
    """
    result.log_stage("Stage 6: confidence scoring")
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

    status = (
        "published" if score >= config.MATHS_CONFIDENCE_THRESHOLD
        else "regenerating" if score >= 50
        else "staged"
    )
    result.confidence_score = score
    result.log_stage(f"  score={score} → {status}")
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

def run_one(topic: dict, tier: str) -> PipelineResult:
    """Run the full 6-stage pipeline for a single question slot.

    Retries up to MAX_PIPELINE_CYCLES if generation or verification fails.
    """
    for cycle in range(1, config.MAX_PIPELINE_CYCLES + 1):
        result = PipelineResult()
        result.log_stage(f"=== Pipeline cycle {cycle}/{config.MAX_PIPELINE_CYCLES} (tier={tier}) ===")

        # Stage 1
        question_data = stage1_generate(topic, tier, result)
        if question_data is None:
            result.log_stage("  Stage 1 failed — aborting cycle")
            continue

        if not _has_required_fields(question_data):
            result.log_stage("  missing required fields — aborting cycle")
            continue

        # Stage 2
        verified = stage2_verify(question_data, result)

        # Stage 3
        consensus = stage3_consensus(topic, tier, question_data, result)

        # Stage 4
        violations = stage4_constitutional(topic, tier, question_data, result)

        # Stage 5
        not_duplicate = stage5_dedup(topic["id"], question_data, result)

        # Stage 6
        score, status = stage6_score(
            verified=verified,
            consensus_passed=consensus,
            violations=violations,
            is_duplicate=not not_duplicate,
            has_required_fields=True,
            result=result,
        )

        qid = db.write_question(topic["id"], tier, question_data, status, score)
        result.question_id = qid
        result.status = status
        result.log_stage(f"  written question {qid} as {status}")
        return result

    # All cycles exhausted
    result = PipelineResult()
    result.status = "failed"
    result.stage_log.append(f"Circuit breaker: all {config.MAX_PIPELINE_CYCLES} cycles failed")
    return result


def run_for_topic(topic_id: str, tier: str, count: int) -> list[PipelineResult]:
    """Generate `count` questions for a topic at the given tier.

    Emits a single structured summary line via the `pipeline.cost` logger
    when the run completes, so log aggregators can track token spend per topic
    and act as a tripwire before anyone bulk-generates at scale.
    """
    topic = db.get_topic(topic_id)
    if topic is None:
        raise ValueError(f"Topic {topic_id!r} not found")

    results: list[PipelineResult] = []
    for i in range(count):
        log.info(f"Generating question {i+1}/{count} for topic {topic['title']!r} tier={tier}")
        results.append(run_one(topic, tier))

    summary = {
        "event": "pipeline.run_for_topic.complete",
        "topic_id": str(topic_id),
        "topic_title": topic.get("title"),
        "year_group": topic.get("year_group_label"),
        "subject": topic.get("subject_name"),
        "tier": tier,
        "model": config.CLAUDE_MODEL,
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
