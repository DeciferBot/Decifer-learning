"""
Evidence verifier — external corroboration for closed-world factual questions.

WHY THIS EXISTS
Stage 2 dispatches history_factual, geography_factual, biology_factual and
science_factual to a pass-through that returns True unconditionally, yet Stage 6
awards those types the full 60-point "computation" weight. With consensus (25) and
the RAG bonus (5) that totals exactly 90, which is exactly their publish threshold.
So a third of the catalogue publishes on the say-so of one small-model call that is
explicitly told "No source material is provided. Evaluate based purely on
correctness" — a model's parametric memory grading another model's parametric
memory, with no external check anywhere.

This module supplies the missing check: search the web, and require the answer to
be *stated by a source* before it counts as verified.

TWO THINGS IT DOES THAT NOTHING ELSE DOES
  1. Requires quoted evidence. A verdict without a supporting quote is not a pass.
  2. Checks the distractors are false. Nothing in the six stages currently asks
     "is each wrong answer actually wrong?", which is why a question could ship
     asking which boundary has earthquakes but no volcanoes with "conservative"
     keyed and "collision" offered as a distractor — both are correct, so a child
     who knows more geography than the generator gets marked wrong.

Conservative by construction: anything the searches do not settle returns
"uncertain", never "confirmed". Uncertain is not a failure — it means a person
should look. Only "refuted" asserts the content is wrong.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

log = logging.getLogger("verifiers.evidence")

EVIDENCE_VERIFIER_VERSION = "1.0.0"

# The dynamic-filtering search tool filters results in a sandbox before they reach
# the context window. Do NOT also declare code_execution — this tool runs it
# internally, and a second execution environment confuses the model.
#
# Availability is model-gated: the _20260209 variant needs Opus 5/4.8/4.7/4.6,
# Sonnet 5 or Sonnet 4.6. Haiku 4.5 only has the basic variant, so a Haiku run
# silently 400s unless we pick the right one.
_SEARCH_TOOL_MODERN = "web_search_20260209"
_SEARCH_TOOL_BASIC = "web_search_20250305"
_MODERN_SEARCH_MODELS = (
    "claude-opus-5", "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6",
    "claude-sonnet-5", "claude-sonnet-4-6", "claude-fable-5",
)


def _search_tool(model: str, max_uses: int) -> dict[str, Any]:
    tool_type = (
        _SEARCH_TOOL_MODERN
        if any(model.startswith(m) for m in _MODERN_SEARCH_MODELS)
        else _SEARCH_TOOL_BASIC
    )
    return {"type": tool_type, "name": "web_search", "max_uses": max_uses}


# Effort is not universal: Haiku 4.5 rejects output_config.effort with a 400.
_EFFORT_CAPABLE_PREFIXES = (
    "claude-opus-5", "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6",
    "claude-opus-4-5", "claude-sonnet-5", "claude-sonnet-4-6", "claude-fable-5",
)

# MEASURED 2026-08-03 against the plate-boundary question, whose "Collision"
# distractor is also a correct answer — the exact defect class this module exists
# to catch:
#
#   claude-opus-5,   effort medium, 4 searches → CAUGHT it, with a quote.  $0.35
#   claude-opus-5,   effort low,    2 searches → ran out of searches.      $0.26
#   claude-sonnet-5, effort medium, 4 searches → said "confirmed". WRONG.  $0.21
#   claude-haiku-4-5                            → 400, no effort support.
#
# Sonnet's miss is the reason the default is Opus. A cheaper checker that returns
# a false "confirmed" is worse than no checker at all: it launders an unverified
# question into a verified-looking one. Starving the search budget is also a false
# economy — it costs nearly as much and answers worse.
DEFAULT_MODEL = "claude-opus-5"

_VERDICT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "verdict": {
            "type": "string",
            "enum": ["confirmed", "refuted", "uncertain"],
            "description": (
                "confirmed: a source states the keyed answer AND no source contradicts it. "
                "refuted: a source contradicts the keyed answer, or a distractor is also "
                "correct. uncertain: the searches did not settle it — the default."
            ),
        },
        "answer_evidence": {
            "type": "string",
            "description": (
                "A direct quote from a search result that states the keyed answer. "
                "Empty string if none was found. Never paraphrase here."
            ),
        },
        "answer_source_url": {"type": "string"},
        "also_correct_distractors": {
            "type": "array",
            "description": (
                "Distractors that are ALSO defensible answers to the question as worded. "
                "Empty unless a source supports one."
            ),
            "items": {
                "type": "object",
                "properties": {
                    "distractor": {"type": "string"},
                    "why_also_correct": {"type": "string"},
                    "evidence": {"type": "string"},
                },
                "required": ["distractor", "why_also_correct", "evidence"],
                "additionalProperties": False,
            },
        },
        "notes": {
            "type": "string",
            "description": "One sentence. What settled it, or what stopped it being settled.",
        },
    },
    "required": [
        "verdict", "answer_evidence", "answer_source_url",
        "also_correct_distractors", "notes",
    ],
    "additionalProperties": False,
}

_PROMPT = """You are fact-checking one question from a UK National Curriculum quiz for \
{year_label} pupils ({subject}).

Question: {question_text}
Keyed answer: {correct_answer}
Distractors (these are meant to be WRONG): {distractors}

Search the web and settle two separate things.

1. Is the keyed answer correct? You must find a source that STATES it. Quote that
   source verbatim in answer_evidence. If you cannot find one, the verdict is not
   "confirmed" no matter how confident you feel — your own knowledge is not evidence.

2. Is every distractor actually wrong? Read the question exactly as worded and ask
   whether each distractor would also be a defensible answer to it. This matters as
   much as part 1: a question with two correct options marks a knowledgeable child
   wrong. List any such distractor in also_correct_distractors with evidence.

Rules:
- "confirmed" requires BOTH a quote supporting the keyed answer AND no also-correct distractor.
- "refuted" if a source contradicts the keyed answer, or any distractor is also correct.
- "uncertain" otherwise. Prefer "uncertain" over guessing — it routes to a human, \
which is cheap. A wrong "confirmed" ships an error to a child, which is not.
- Judge the question as worded, not as you would have worded it."""


def _output_config(model: str, effort: str) -> dict[str, Any]:
    cfg: dict[str, Any] = {"format": {"type": "json_schema", "schema": _VERDICT_SCHEMA}}
    if any(model.startswith(m) for m in _EFFORT_CAPABLE_PREFIXES):
        cfg["effort"] = effort
    return cfg


def _client():
    import anthropic

    key = os.environ.get("ANTHROPIC_API_KEY", "").strip().strip('"')
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY not set — evidence verifier needs it")
    return anthropic.Anthropic(api_key=key)


def _extract_json(text: str) -> Optional[dict]:
    text = text.strip()
    if text.startswith("```"):
        text = "\n".join(l for l in text.splitlines() if not l.startswith("```"))
    start, depth = None, 0
    for i, ch in enumerate(text):
        if ch == "{":
            if start is None:
                start = i
            depth += 1
        elif ch == "}" and start is not None:
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start:i + 1])
                except json.JSONDecodeError:
                    start, depth = None, 0
    return None


def verify(
    question_data: dict,
    topic: dict,
    model: str = DEFAULT_MODEL,
    max_tokens: int = 8000,
    effort: str = "medium",
    max_searches: int = 4,
) -> dict:
    """Check one question against external sources.

    Returns a dict carrying verdict, evidence, also_correct_distractors, notes,
    plus usage/cost telemetry. Never raises: transport and parse failures come
    back as verdict "uncertain" with the error in notes, because a checker that
    throws would otherwise stall a batch run.
    """
    distractors = question_data.get("distractors")
    if not isinstance(distractors, list):
        distractors = []

    prompt = _PROMPT.format(
        year_label=topic.get("year_group_label", "unknown"),
        subject=topic.get("subject_name", "unknown"),
        question_text=question_data.get("question_text", ""),
        correct_answer=question_data.get("correct_answer", ""),
        distractors=json.dumps([str(d) for d in distractors]),
    )

    base = {
        "verdict": "uncertain",
        "answer_evidence": "",
        "answer_source_url": "",
        "also_correct_distractors": [],
        "notes": "",
        "model": model,
        "verifier_version": EVIDENCE_VERIFIER_VERSION,
        "input_tokens": 0,
        "output_tokens": 0,
        "searches": 0,
        "effort": effort,
    }

    try:
        response = _client().messages.create(
            model=model,
            max_tokens=max_tokens,
            tools=[_search_tool(model, max_searches)],
            output_config=_output_config(model, effort),
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as exc:
        base["notes"] = f"evidence check unavailable: {exc}"
        return base

    if getattr(response, "stop_reason", None) == "refusal":
        base["notes"] = "model declined to check this question"
        return base

    usage = getattr(response, "usage", None)
    if usage is not None:
        base["input_tokens"] = getattr(usage, "input_tokens", 0) or 0
        base["output_tokens"] = getattr(usage, "output_tokens", 0) or 0

    text_parts: list[str] = []
    for block in response.content:
        btype = getattr(block, "type", "")
        if btype == "text":
            text_parts.append(block.text)
        elif btype == "server_tool_use":
            base["searches"] += 1
        elif btype == "web_search_tool_result":
            # On success .content is a list of results; on failure it is a single
            # error object. Errors arrive as HTTP 200, so they must be read here.
            content = getattr(block, "content", None)
            if not isinstance(content, list):
                code = getattr(content, "error_code", None)
                if code:
                    base["notes"] = f"web search error: {code}"

    parsed = _extract_json("\n".join(text_parts))
    if parsed is None:
        base["notes"] = base["notes"] or "could not parse a verdict from the response"
        return base

    verdict = parsed.get("verdict")
    if verdict not in ("confirmed", "refuted", "uncertain"):
        verdict = "uncertain"

    also = parsed.get("also_correct_distractors") or []
    evidence = (parsed.get("answer_evidence") or "").strip()

    # Enforce the contract rather than trusting the label: "confirmed" with no
    # quote, or with a distractor that is also correct, is not confirmed.
    if verdict == "confirmed" and not evidence:
        verdict = "uncertain"
        parsed["notes"] = (parsed.get("notes") or "") + " [downgraded: no quote supplied]"
    if also and verdict == "confirmed":
        verdict = "refuted"
        parsed["notes"] = (parsed.get("notes") or "") + " [downgraded: a distractor is also correct]"

    base.update({
        "verdict": verdict,
        "answer_evidence": evidence,
        "answer_source_url": parsed.get("answer_source_url") or "",
        "also_correct_distractors": also,
        "notes": (parsed.get("notes") or base["notes"]).strip(),
    })
    return base


def estimate_cost(results: list[dict]) -> dict:
    """Actual spend for a batch, from returned usage. Rates are Claude Opus 5
    list prices ($5/MTok in, $25/MTok out) plus $10 per 1,000 web searches."""
    in_tok = sum(r.get("input_tokens", 0) for r in results)
    out_tok = sum(r.get("output_tokens", 0) for r in results)
    searches = sum(r.get("searches", 0) for r in results)
    cost = in_tok / 1e6 * 5.0 + out_tok / 1e6 * 25.0 + searches / 1000 * 10.0
    return {
        "questions": len(results),
        "input_tokens": in_tok,
        "output_tokens": out_tok,
        "searches": searches,
        "usd": round(cost, 4),
        "usd_per_question": round(cost / max(len(results), 1), 4),
    }
