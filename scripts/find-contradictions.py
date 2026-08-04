"""
Find questions that contradict each other, and answers that contradict their own
explanation. No API calls, no cost — local sentence-transformers embeddings and
string comparison only.

WHY THIS FINDS REAL ERRORS FOR FREE
If two published questions ask substantially the same thing and are keyed to
different answers, at least one of them is wrong. That is a proof, not a guess,
and it needs no external source to establish. The same holds inside a single row:
if the explanation names a different value from the keyed answer, the row is
internally inconsistent whatever the truth is.

This is the check to run before spending anything on external verification — it
costs nothing and every hit is a genuine defect in one of the two rows.

Usage:
  python3 scripts/find-contradictions.py                    # both checks
  python3 scripts/find-contradictions.py --threshold 0.88
  python3 scripts/find-contradictions.py --only self        # explanation vs answer
  python3 scripts/find-contradictions.py --json out.json
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict

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
from pipeline import embed_text  # noqa: E402 — local model, no network

import numpy as np  # noqa: E402
import psycopg2  # noqa: E402
import psycopg2.extras  # noqa: E402


def _norm_answer(text: str) -> str:
    """Normalise for equality: case, punctuation, articles, trailing units of
    phrasing. Deliberately conservative — over-normalising would hide real
    disagreements."""
    t = (text or "").strip().lower()
    t = re.sub(r"^(the|a|an)\s+", "", t)
    t = re.sub(r"[^\w\s.%/-]", "", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


# Content in the wild uses a Unicode minus (−, U+2212) rather than a hyphen, and
# space-separated thousands ("4 500 J", "12 000 J"). A naive \d[\d,]* misses both
# and reports the row as inconsistent when it is fine — on the first run that was
# most of the 29 hits. Normalise before extracting.
_NUM = re.compile(r"[-−–]?\d[\d,  ]*\d|\d")

_WORD_NUMBERS = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
    "eleven": "11", "twelve": "12", "twenty": "20", "thirty": "30", "forty": "40",
    "fifty": "50", "sixty": "60", "seventy": "70", "eighty": "80", "ninety": "90",
    "hundred": "100", "thousand": "1000", "million": "1000000",
}


def _numbers(text: str) -> set[str]:
    if not text:
        return set()
    found: set[str] = set()
    for raw in _NUM.findall(text):
        cleaned = (
            raw.replace(",", "")
               .replace(" ", "")
               .replace(" ", "")
               .replace("−", "-")
               .replace("–", "-")
        )
        cleaned = cleaned.lstrip("-")           # compare magnitudes, not signs
        cleaned = cleaned.lstrip("0") or "0"    # 07 and 7 are the same value
        found.add(cleaned)
    for word, digits in _WORD_NUMBERS.items():
        if re.search(rf"\b{word}\b", text, re.I):
            found.add(digits)
    return found


def check_self_consistency(rows: list[dict]) -> list[dict]:
    """A numeric answer whose value never appears in its own explanation.

    Only fires when BOTH the answer and the explanation contain numbers — a
    worded explanation of a numeric answer is fine, and is not flagged.
    """
    hits = []
    for row in rows:
        answer_nums = _numbers(row["correct_answer"])
        if not answer_nums:
            continue
        expl = row["explanation"] or ""
        expl_nums = _numbers(expl)
        if not expl_nums:
            continue
        if not (answer_nums & expl_nums):
            hits.append({
                "kind": "answer_absent_from_explanation",
                "id": str(row["id"]),
                "year": row["year_group_label"],
                "subject": row["subject_name"],
                "topic": row["title"],
                "question": row["question_text"],
                "answer": row["correct_answer"],
                "explanation": expl,
            })
    return hits


# A stem whose answer depends on the options offered cannot be compared across
# rows: "Which sentence is written in the passive voice?" has a different correct
# answer in every row because every row offers different sentences. Comparing them
# produced 400+ false positives on the first run and buried the real hits.
# Only stems that fully determine their own answer are comparable.
_OPTION_DEPENDENT = re.compile(
    r"\bwhich\b.*\b(of these|of the following|sentence|option|answer|statement|"
    r"word|shape|number|example|pair|graph|diagram)\b|"
    r"\bselect\b|\btick\b|\bchoose\b|\bidentify which\b|\bbest describes\b|"
    r"\bmost likely\b|\bbest explains\b",
    re.I,
)


def check_cross_contradictions(rows: list[dict], threshold: float) -> list[dict]:
    """Near-identical stems keyed to different answers.

    Compared within (subject, key stage) so that a Y3 and a Y6 version of the same
    question are still compared, but a maths question is never compared with a
    history one. Option-dependent stems are excluded — see _OPTION_DEPENDENT.
    """
    rows = [r for r in rows if not _OPTION_DEPENDENT.search(r["question_text"] or "")]
    print(f"  {len(rows)} stems are self-determining and therefore comparable")
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for row in rows:
        groups[(row["subject_name"], row["key_stage"])].append(row)

    hits = []
    for (subject, key_stage), members in groups.items():
        if len(members) < 2:
            continue
        vectors = []
        keep = []
        for row in members:
            vec = embed_text(row["question_text"] or "")
            if vec is None:
                continue
            norm = np.linalg.norm(vec)
            if norm == 0:
                continue
            vectors.append(vec / norm)
            keep.append(row)
        if len(keep) < 2:
            continue

        matrix = np.vstack(vectors)
        sims = matrix @ matrix.T
        n = len(keep)
        for i in range(n):
            for j in range(i + 1, n):
                if sims[i, j] < threshold:
                    continue
                a, b = keep[i], keep[j]
                ans_a, ans_b = _norm_answer(a["correct_answer"]), _norm_answer(b["correct_answer"])
                if ans_a == ans_b:
                    continue
                # One answer containing the other is usually a phrasing difference
                # ("Paris" vs "Paris, France"), not a contradiction.
                if ans_a in ans_b or ans_b in ans_a:
                    continue
                # "Saying something IS something else" vs "Saying that something
                # IS something else" is one answer, two wordings — not a conflict.
                tok_a, tok_b = set(ans_a.split()), set(ans_b.split())
                if tok_a and tok_b:
                    overlap = len(tok_a & tok_b) / min(len(tok_a), len(tok_b))
                    if overlap >= 0.75:
                        continue
                hits.append({
                    "kind": "cross_question_contradiction",
                    "similarity": round(float(sims[i, j]), 3),
                    "subject": subject,
                    "key_stage": key_stage,
                    "a": {"id": str(a["id"]), "year": a["year_group_label"],
                          "topic": a["title"], "question": a["question_text"],
                          "answer": a["correct_answer"]},
                    "b": {"id": str(b["id"]), "year": b["year_group_label"],
                          "topic": b["title"], "question": b["question_text"],
                          "answer": b["correct_answer"]},
                })
    hits.sort(key=lambda h: -h["similarity"])
    return hits


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=0.90)
    ap.add_argument("--only", choices=["cross", "self"])
    ap.add_argument("--json", help="write full findings to this path")
    ap.add_argument("--show", type=int, default=25)
    args = ap.parse_args()

    conn = psycopg2.connect(config.DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """
        SELECT qq.id, qq.question_text, qq.correct_answer, qq.explanation,
               t.title, s.name AS subject_name,
               yg.label AS year_group_label, yg.key_stage
        FROM quiz_questions qq
        JOIN topics t       ON t.id  = qq.topic_id
        JOIN subjects s     ON s.id  = t.subject_id
        JOIN year_groups yg ON yg.id = t.year_group_id
        WHERE qq.status = 'published'
        """
    )
    rows = cur.fetchall()
    conn.close()
    print(f"Loaded {len(rows)} published questions\n")

    findings: list[dict] = []

    if args.only != "self":
        print(f"Embedding locally and comparing stems (threshold {args.threshold})...")
        cross = check_cross_contradictions(rows, args.threshold)
        findings += cross
        print(f"\n{len(cross)} cross-question contradictions "
              f"(same question, different keyed answers)\n")
        for hit in cross[:args.show]:
            print(f"  sim={hit['similarity']}  {hit['subject']} {hit['key_stage']}")
            print(f"    A [{hit['a']['year']}] {hit['a']['question'][:110]}")
            print(f"      → {hit['a']['answer']}")
            print(f"    B [{hit['b']['year']}] {hit['b']['question'][:110]}")
            print(f"      → {hit['b']['answer']}")
            print()

    if args.only != "cross":
        selfhits = check_self_consistency(rows)
        findings += selfhits
        print(f"{len(selfhits)} answers whose value never appears in their own explanation\n")
        for hit in selfhits[:args.show]:
            print(f"  [{hit['year']} {hit['subject']} / {hit['topic']}]")
            print(f"    {hit['question'][:120]}")
            print(f"    answer:      {hit['answer']}")
            print(f"    explanation: {hit['explanation'][:150]}")
            print()

    if args.json:
        with open(args.json, "w") as f:
            json.dump(findings, f, indent=2)
        print(f"Full findings written to {args.json}")

    print(f"TOTAL: {len(findings)} findings, $0 spent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
