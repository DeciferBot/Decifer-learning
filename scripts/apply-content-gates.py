"""
Run the deterministic content gates (services/content-pipeline/verifiers/gates.py)
over the published corpus and report — or act on — what fails.

Report mode is the default. Nothing is written without --apply.

Destinations, and why they differ:

  retired  — the row must never reach a child again AND must never be walked back
             into 'published' by a nightly cron. Sensitivity failures (the context
             is wrong, not the maths) and containment failures (the stem points at
             material the child cannot see) are both unfixable in place.
             NOTE: 'flagged' and 'staged' are input queues that lead back to
             'published'; only 'retired' is terminal. See prisma/schema.prisma.

  repaired — markup defects are pure string surgery (unconverted {{ }} cloze,
             stray markdown emphasis, an A)/B)/C)/D) block duplicated inside the
             stem). Fix the text in place and leave the row published.

  reported — structure failures (missing hints, stub explanations, fewer than 3
             distractors) are real but repairable by the existing pipeline. This
             script counts them and leaves them alone rather than dumping ~1,000
             rows into a queue that would republish them unchanged.

Usage:
  python3 scripts/apply-content-gates.py                    # report
  python3 scripts/apply-content-gates.py --apply            # retire + repair
  python3 scripts/apply-content-gates.py --apply --only sensitivity
  python3 scripts/apply-content-gates.py --show 20          # print failing examples
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict

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
from verifiers import gates  # noqa: E402

import psycopg2  # noqa: E402
import psycopg2.extras  # noqa: E402


_CLASSES = ("sensitivity", "containment", "containment_review", "markup", "structure")


def _classify(violations: list[str]) -> str:
    """Worst-wins: an unfixable violation dominates a merely repairable one."""
    if any(v.startswith("sensitive_context:") for v in violations):
        return "sensitivity"
    if any(v.startswith("containment:") for v in violations):
        return "containment"
    if any(v.startswith("containment_review:") for v in violations):
        return "containment_review"
    if any(v.startswith("markup:") for v in violations):
        return "markup"
    return "structure"


# ── Markup repairs (string surgery only) ──────────────────────────────────

_CLOZE = re.compile(r"\{\{\s*\}\}")
_INLINE_OPTIONS = re.compile(r"\n\s*[A-D]\)\s.*$", re.S)


def repair_markup(text: str) -> str:
    if not text:
        return text
    out = _CLOZE.sub("_____", text)
    out = out.replace("**", "").replace("__", "")
    out = _INLINE_OPTIONS.sub("", out)
    return out.strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write changes (default: report only)")
    ap.add_argument("--only", choices=list(_CLASSES), help="restrict action to one class")
    ap.add_argument("--show", type=int, default=0, help="print N failing examples per class")
    args = ap.parse_args()

    conn = psycopg2.connect(config.DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """
        SELECT qq.id, qq.question_text, qq.correct_answer, qq.distractors,
               qq.hint_1, qq.hint_2, qq.hint_3, qq.explanation,
               qq.question_metadata, qq.foundation_images,
               t.title, s.name AS subject_name, yg.label AS year_group_label
        FROM quiz_questions qq
        JOIN topics t       ON t.id  = qq.topic_id
        JOIN subjects s     ON s.id  = t.subject_id
        JOIN year_groups yg ON yg.id = t.year_group_id
        WHERE qq.status = 'published'
        """
    )
    rows = cur.fetchall()
    print(f"Scanning {len(rows)} published questions with gates v{gates.GATES_VERSION}\n")

    buckets: dict[str, list] = defaultdict(list)
    reasons: Counter = Counter()

    for row in rows:
        distractors = row["distractors"]
        if isinstance(distractors, str):
            try:
                distractors = json.loads(distractors)
            except Exception:
                distractors = []

        question_data = {
            "question_text": row["question_text"],
            "correct_answer": row["correct_answer"],
            "distractors": distractors,
            "hint_1": row["hint_1"], "hint_2": row["hint_2"], "hint_3": row["hint_3"],
            "explanation": row["explanation"],
            "question_metadata": row["question_metadata"],
            "foundation_images": row["foundation_images"],
        }
        topic = {
            "title": row["title"],
            "subject_name": row["subject_name"],
            "year_group_label": row["year_group_label"],
        }

        ok, violations = gates.run_all(question_data, topic)
        if ok:
            continue
        cls = _classify(violations)
        buckets[cls].append((row, violations))
        for v in violations:
            reasons[v.split(":")[0] + ":" + v.split(":")[1] if v.count(":") >= 1 else v] += 1

    print(f"{'class':14} {'rows':>6}   destination")
    print("-" * 58)
    dest = {"sensitivity": "retired", "containment": "retired",
            "containment_review": "reported only (needs a person)",
            "markup": "repaired in place", "structure": "reported only"}
    total = 0
    for cls in _CLASSES:
        n = len(buckets[cls])
        total += n
        print(f"{cls:14} {n:6}   {dest[cls]}")
    print("-" * 58)
    print(f"{'TOTAL':14} {total:6}   of {len(rows)} published "
          f"({100.0 * total / max(len(rows), 1):.1f}%)\n")

    print("Top violation reasons:")
    for reason, n in reasons.most_common(15):
        print(f"  {n:5}  {reason}")

    if args.show:
        for cls in _CLASSES:
            if not buckets[cls]:
                continue
            print(f"\n── {cls} examples ──")
            for row, violations in buckets[cls][:args.show]:
                print(f"  [{row['year_group_label']} {row['subject_name']} / {row['title']}]")
                print(f"    {(row['question_text'] or '')[:150]}")
                for v in violations:
                    print(f"      ! {v}")

    if not args.apply:
        print("\nReport only. Re-run with --apply to act.")
        return 0

    classes = [args.only] if args.only else ["sensitivity", "containment", "markup"]
    retired = repaired = 0

    for cls in classes:
        if cls in ("sensitivity", "containment"):
            ids = [str(row["id"]) for row, _ in buckets[cls]]
            for i in range(0, len(ids), 200):
                chunk = ids[i:i + 200]
                cur.execute(
                    """
                    UPDATE quiz_questions
                       SET status = 'retired',
                           question_metadata =
                             COALESCE(question_metadata, '{}'::jsonb)
                             || jsonb_build_object(
                                  'retired_reason', %s,
                                  'retired_by', %s,
                                  'retired_at', now()::text)
                     WHERE id = ANY(%s::uuid[]) AND status = 'published'
                    """,
                    (f"gate:{cls}", f"apply-content-gates/gates-{gates.GATES_VERSION}", chunk),
                )
                retired += cur.rowcount
            conn.commit()

        elif cls == "markup":
            for row, _ in buckets["markup"]:
                new_stem = repair_markup(row["question_text"])
                distractors = row["distractors"]
                if isinstance(distractors, str):
                    try:
                        distractors = json.loads(distractors)
                    except Exception:
                        distractors = []
                new_distractors = [repair_markup(str(d)) for d in (distractors or [])]
                new_answer = repair_markup(row["correct_answer"] or "")

                candidate = {
                    "question_text": new_stem,
                    "correct_answer": new_answer,
                    "distractors": new_distractors,
                }
                now_clean, remaining = gates.check_markup(candidate)
                if not now_clean:
                    # Repair did not clear it — leave the row alone rather than
                    # shipping half-fixed text.
                    print(f"  skip {row['id']}: markup survives repair — {remaining}")
                    continue
                cur.execute(
                    """
                    UPDATE quiz_questions
                       SET question_text = %s, correct_answer = %s, distractors = %s::jsonb
                     WHERE id = %s AND status = 'published'
                    """,
                    (new_stem, new_answer, json.dumps(new_distractors), row["id"]),
                )
                repaired += cur.rowcount
            conn.commit()

    print(f"\nApplied: {retired} retired, {repaired} markup-repaired.")
    cur.execute("SELECT status, COUNT(*) FROM quiz_questions GROUP BY 1 ORDER BY 2 DESC")
    print("\nStatus counts now:")
    for r in cur.fetchall():
        print(f"  {r['status']:14} {r['count']}")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
