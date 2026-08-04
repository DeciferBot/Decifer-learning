"""
Check every grounded question against the source it actually cites.

THE POINT: Stage 6's RAG gate checks that a cited chunk exists and carries the
right subject and key stage. It never checks that the chunk SAYS the thing the
answer claims. A question can cite a perfectly valid Year 8 history chunk and
assert something the chunk never mentions, and still score 90.

This closes that. The model is given the chunk text and the question, and must
quote the span of the chunk that supports the keyed answer. No quote, or a quote
that is not actually in the chunk, means not supported — and the quote is
verified against the chunk in code, not taken on trust.

Runs on the pipeline's existing DO DeepSeek route. No Anthropic API calls.

VERDICTS, recorded in question_metadata.grounding_check:
  supported     the chunk states the answer, quote verified present in the chunk
  unsupported   the chunk does not state it — the citation is decorative
  contradicted  the chunk states something incompatible with the keyed answer
  no_source     the row cites no chunk, so there is nothing to check against

Nothing is retired. This records evidence; acting on it is a separate decision.

Usage:
  python3 scripts/prove-grounded.py --limit 25 --dry-run
  python3 scripts/prove-grounded.py --all
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import threading
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed

_REPO = "/root/decifer-learning"

_e = subprocess.run(
    ["bash", "-c", f"set -a && source {_REPO}/.env.local && set +a && env"],
    capture_output=True, text=True,
).stdout
for line in _e.splitlines():
    if "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k, v)

sys.path.insert(0, f"{_REPO}/services/content-pipeline")
import config  # noqa: E402
from pipeline import _llm_call, _extract_json  # noqa: E402

import psycopg2  # noqa: E402
import psycopg2.extras  # noqa: E402
import psycopg2.pool  # noqa: E402

GROUNDED_TYPES = (
    "history_factual", "geography_factual", "biology_factual", "science_factual",
    "english_comprehension", "english_vocabulary", "english_literary_analysis",
    "chemistry_element_fact",
)

_PROMPT = """You are checking whether a source passage supports a quiz answer.

SOURCE PASSAGE:
\"\"\"
{chunk_text}
\"\"\"

Question: {question_text}
Keyed answer: {correct_answer}

Decide, using ONLY the passage above. Your own knowledge is not evidence here —
the question is whether THIS passage supports THIS answer.

Respond with ONLY valid JSON:
{{"verdict": "supported" | "unsupported" | "contradicted",
  "quote": "the exact span of the passage that supports the answer, copied character for character, or empty string",
  "reason": "one sentence"}}

- "supported" requires a quote copied EXACTLY from the passage. Do not paraphrase,
  do not tidy the wording, do not join separated sentences. It will be checked
  against the passage automatically and a quote that is not found counts as unsupported.
- "contradicted" means the passage states something incompatible with the keyed answer.
- "unsupported" means the passage simply does not settle it. That is a normal,
  expected outcome — prefer it over stretching a quote to fit."""

_write_lock = threading.Lock()


def _normalise(text: str) -> str:
    """Loose comparison so punctuation and whitespace differences do not sink a
    genuine quote, while still requiring the words to really be in the passage."""
    t = (text or "").lower()
    t = t.replace("’", "'").replace("‘", "'")
    t = t.replace("“", '"').replace("”", '"')
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def check(row: dict) -> dict:
    chunk_text = row.get("chunk_text") or ""
    out = {"verdict": "no_source", "quote": "", "reason": "", "quote_verified": False}
    if not chunk_text.strip():
        out["reason"] = "row cites no retrievable chunk"
        return out

    try:
        msg = _llm_call(
            prompt=_PROMPT.format(
                chunk_text=chunk_text[:6000],
                question_text=row["question_text"],
                correct_answer=row["correct_answer"],
            ),
            max_tokens=500,
            temperature=0,
        )
        parsed = _extract_json(msg.content[0].text)
        parsed = json.loads(parsed) if isinstance(parsed, str) else parsed
    except Exception as exc:
        out["verdict"] = "unsupported"
        out["reason"] = f"check unavailable: {exc}"
        return out

    if not isinstance(parsed, dict):
        out["verdict"] = "unsupported"
        out["reason"] = "could not parse a verdict"
        return out

    verdict = parsed.get("verdict")
    if verdict not in ("supported", "unsupported", "contradicted"):
        verdict = "unsupported"
    quote = (parsed.get("quote") or "").strip()
    out["reason"] = (parsed.get("reason") or "")[:300]

    # Verify the quote in code. A "supported" verdict whose quote is not actually
    # in the passage is the failure mode this whole check exists to prevent, so it
    # is downgraded rather than believed.
    if quote:
        out["quote"] = quote[:500]
        haystack, needle = _normalise(chunk_text), _normalise(quote)
        out["quote_verified"] = bool(needle) and needle in haystack

    if verdict == "supported" and not out["quote_verified"]:
        out["verdict"] = "unsupported"
        out["reason"] = ("claimed supported but the quote is not in the passage; "
                         + out["reason"])[:300]
    else:
        out["verdict"] = verdict
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=25)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--concurrency", type=int, default=8)
    args = ap.parse_args()

    conn = psycopg2.connect(config.DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    limit_sql = "" if args.all else f"LIMIT {int(args.limit)}"
    # Fetch the questions WITHOUT joining chunk text. A correlated subquery that
    # aggregates curriculum_chunks for every row at once exceeds the statement
    # timeout; chunk text is pulled per row below, which is an indexed point read.
    cur.execute(
        f"""
        SELECT qq.id, qq.question_text, qq.correct_answer, qq.question_type,
               qq.source_chunk_ids,
               yg.label AS year_group_label, s.name AS subject_name
        FROM quiz_questions qq
        JOIN topics t       ON t.id  = qq.topic_id
        JOIN subjects s     ON s.id  = t.subject_id
        JOIN year_groups yg ON yg.id = t.year_group_id
        WHERE qq.status = 'published'
          AND qq.question_type = ANY(%s)
          AND qq.source_chunk_ids IS NOT NULL
          AND qq.source_chunk_ids <> '[]'::jsonb
          AND qq.question_metadata->'grounding_check' IS NULL
        ORDER BY md5(qq.id::text)
        {limit_sql}
        """,
        (list(GROUNDED_TYPES),),
    )
    rows = cur.fetchall()

    _chunk_pool = psycopg2.pool.ThreadedConnectionPool(1, args.concurrency + 1,
                                                       config.DATABASE_URL)

    def load_chunks(row) -> dict:
        ids = row.get("source_chunk_ids") or []
        if isinstance(ids, str):
            try:
                ids = json.loads(ids)
            except Exception:
                ids = []
        ids = [str(i) for i in ids if str(i).strip()]
        if not ids:
            row["chunk_text"] = ""
            return row
        c = _chunk_pool.getconn()
        try:
            with c.cursor() as cc:
                cc.execute(
                    "SELECT chunk_text FROM curriculum_chunks WHERE id::text = ANY(%s)",
                    (ids,),
                )
                row["chunk_text"] = "\n\n---\n\n".join(r[0] or "" for r in cc.fetchall())
        except Exception:
            row["chunk_text"] = ""
        finally:
            _chunk_pool.putconn(c)
        return row
    print(f"Checking {len(rows)} grounded questions against their own cited sources "
          f"via {config.GENERATION_MODEL}\n", flush=True)
    if not rows:
        return 0

    verdicts: Counter = Counter()
    done = 0
    write_cur = conn.cursor()

    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = {pool.submit(lambda x: check(load_chunks(x)), r): r for r in rows}
        for fut in as_completed(futures):
            row = futures[fut]
            result = fut.result()
            verdicts[result["verdict"]] += 1
            done += 1

            if result["verdict"] == "contradicted":
                print(f"  CONTRADICTED [{row['year_group_label']} {row['subject_name']}] "
                      f"{(row['question_text'] or '')[:74]}", flush=True)
                print(f"               keyed {row['correct_answer']!r} | {result['reason'][:150]}",
                      flush=True)
            if done % 100 == 0:
                print(f"  ... {done}/{len(rows)}  {dict(verdicts)}", flush=True)

            if args.dry_run:
                continue
            with _write_lock:
                write_cur.execute(
                    """
                    UPDATE quiz_questions
                       SET question_metadata = COALESCE(question_metadata, '{}'::jsonb)
                           || jsonb_build_object('grounding_check', %s::jsonb)
                     WHERE id = %s
                    """,
                    (json.dumps({
                        "verdict": result["verdict"],
                        "quote": result["quote"],
                        "quote_verified": result["quote_verified"],
                        "reason": result["reason"],
                        "method": f"{config.GENERATION_MODEL}+quote-verified-in-code",
                    }), row["id"]),
                )

    print(f"\nVerdicts: {dict(verdicts)}")
    print("Nothing retired — this records evidence only.")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
