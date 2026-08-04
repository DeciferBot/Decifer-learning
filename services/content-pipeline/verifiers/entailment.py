"""
Entailment verifier — the missing Stage 2 proof for grounded question types.

WHAT IT REPLACES
history_factual, geography_factual, biology_factual, science_factual and the
RAG-only English types had no Stage 2 check at all. The dispatcher returned
`True, "RAG-only type — grounding enforced at Stage 6"` unconditionally, and
Stage 6 then awarded the full 60-point computation weight for that non-check.
Stage 6's own RAG gate only verified that a cited chunk EXISTS and carries a
matching subject and key stage — never that the chunk says the thing the answer
claims.

WHAT IT DOES INSTEAD
Gives the model the cited chunk and the question, and requires it to quote the
span that supports the answer. The quote is then checked against the chunk IN
CODE. A "supported" verdict whose quote is not actually in the chunk is rejected,
so the model cannot talk its way to a pass — the same principle as SymPy deciding
maths rather than the model asserting an answer.

Fails closed: no chunks, no quote, an unverifiable quote, or a transport error
all return False.

Returns (verified: bool, detail: str). Never raises.
"""
from __future__ import annotations

import json
import re
from typing import Any

ENTAILMENT_VERIFIER_VERSION = "1.0.0"

_PROMPT = """You are checking whether a source passage supports a quiz answer.

SOURCE PASSAGE:
\"\"\"
{chunk_text}
\"\"\"

Question: {question_text}
Keyed answer: {correct_answer}

Decide using ONLY the passage above. Your own knowledge is not evidence here.

Respond with ONLY valid JSON:
{{"verdict": "supported" | "unsupported" | "contradicted",
  "quote": "the exact span of the passage supporting the answer, copied character for character, or empty string",
  "reason": "one sentence"}}

- "supported" requires a quote copied EXACTLY from the passage. It is checked
  against the passage automatically; a quote that cannot be found counts as
  unsupported, so do not paraphrase or tidy the wording.
- "unsupported" means the passage does not settle it. That is a normal outcome.
- "contradicted" means the passage states something incompatible with the answer."""


def _first_json_object(text: str):
    """Parse the first balanced JSON object out of a model reply.

    Local rather than imported from pipeline.py so this module stays testable on
    its own — importing pipeline here also risks a circular import.
    """
    text = (text or "").strip()
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


def _normalise(text: str) -> str:
    t = (text or "").lower().replace("’", "'").replace("‘", "'")
    t = t.replace("“", '"').replace("”", '"')
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _chunk_text_for(question_data: dict) -> str:
    """Assemble the text of the chunks this question actually cites."""
    cited = question_data.get("source_chunk_ids") or []
    if isinstance(cited, str):
        try:
            cited = json.loads(cited)
        except Exception:
            cited = []
    cited = {str(c) for c in cited}
    chunks = question_data.get("_retrieved_chunks") or []
    texts = [
        str(c.get("chunk_text") or "")
        for c in chunks
        if str(c.get("id")) in cited
    ]
    return "\n\n---\n\n".join(t for t in texts if t.strip())


def verify(question_data: dict, llm_call: Any = None) -> tuple[bool, str]:
    """Stage 2 for grounded types. `llm_call` is injected to avoid a circular
    import with pipeline.py; when omitted it is imported lazily."""
    chunk_text = _chunk_text_for(question_data)
    if not chunk_text.strip():
        return False, "entailment: question cites no retrievable chunk text"

    if llm_call is None:
        from pipeline import _llm_call as llm_call  # noqa: PLC0415

    try:
        msg = llm_call(
            prompt=_PROMPT.format(
                chunk_text=chunk_text[:6000],
                question_text=question_data.get("question_text", ""),
                correct_answer=question_data.get("correct_answer", ""),
            ),
            max_tokens=500,
            temperature=0,
        )
        parsed = _first_json_object(msg.content[0].text)
    except Exception as exc:
        return False, f"entailment: check unavailable ({exc}) — failing closed"

    if not isinstance(parsed, dict):
        return False, "entailment: could not parse a verdict"

    verdict = parsed.get("verdict")
    quote = (parsed.get("quote") or "").strip()
    reason = (parsed.get("reason") or "")[:200]

    if verdict == "contradicted":
        return False, f"entailment: the cited source contradicts the answer — {reason}"
    if verdict != "supported":
        return False, f"entailment: the cited source does not support the answer — {reason}"

    needle, haystack = _normalise(quote), _normalise(chunk_text)
    if not needle or needle not in haystack:
        return False, (
            "entailment: claimed supported but the supporting quote is not present "
            "in the cited passage"
        )
    return True, f"entailment: supported by a verified quote — {quote[:120]!r}"


# ── Tests ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from types import SimpleNamespace

    CHUNK = ("The Roman army left Britain in AD 410. Emperor Honorius told the "
             "Britons to look to their own defence.")

    def fake(payload):
        def _call(**kwargs):
            return SimpleNamespace(content=[SimpleNamespace(text=json.dumps(payload))])
        return _call

    data = {
        "question_text": "In which year did the Roman army leave Britain?",
        "correct_answer": "AD 410",
        "source_chunk_ids": ["c1"],
        "_retrieved_chunks": [{"id": "c1", "chunk_text": CHUNK}],
    }

    passed = failed = 0

    def check(label, payload, expect, data_override=None):
        global passed, failed
        ok, detail = verify(data_override or data, llm_call=fake(payload))
        if ok == expect:
            passed += 1
            print(f"  PASS  {label}")
        else:
            failed += 1
            print(f"  FAIL  {label}: verified={ok} detail={detail}")

    check("real quote is accepted",
          {"verdict": "supported", "quote": "The Roman army left Britain in AD 410",
           "reason": "states it"}, True)
    check("invented quote is rejected even when it claims supported",
          {"verdict": "supported", "quote": "The Romans departed in the year 410 CE",
           "reason": "states it"}, False)
    check("supported with no quote is rejected",
          {"verdict": "supported", "quote": "", "reason": "I know this"}, False)
    check("unsupported is rejected",
          {"verdict": "unsupported", "quote": "", "reason": "not in passage"}, False)
    check("contradicted is rejected",
          {"verdict": "contradicted", "quote": "", "reason": "passage says 409"}, False)
    check("no cited chunk fails closed",
          {"verdict": "supported", "quote": "The Roman army left Britain in AD 410"},
          False, {**data, "_retrieved_chunks": []})
    check("citing a chunk that was not retrieved fails closed",
          {"verdict": "supported", "quote": "The Roman army left Britain in AD 410"},
          False, {**data, "source_chunk_ids": ["other"]})

    print(f"\n{passed} passed, {failed} failed")
    raise SystemExit(1 if failed else 0)
