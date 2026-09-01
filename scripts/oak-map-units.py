#!/usr/bin/env python3
"""
Work out which of our topics each Oak unit belongs to, and write it into
scripts/oak-topic-map.json.

WHY THIS IS THE BOTTLENECK. On 2026-09-01 we held 3,004 mirrored Oak lessons and
could place only 39 of them, because only 34 Oak units had ever been matched to
one of our topics. Everything else was collected and stranded. The collector and
the publisher are both fine; the missing piece was the matching.

WHY NOT JUST COMPARE THE WORDS. Oak names units after the thing being taught
("The Black Death", "The Norman Conquest"). We name topics after the National
Curriculum bucket ("Medieval Britain 1066-1509"). Nothing about those two strings
overlaps. Working out that one sits inside the other needs actual knowledge of
dates and subject matter, so this asks a model rather than counting shared words.

WHY WE OFFER THE WHOLE KEY STAGE. Oak files a unit under the year IT teaches it;
the National Curriculum sets History and Geography by key stage with no year at
all, so Oak's year and ours legitimately differ. The earlier importer demanded an
exact year match and was therefore blind to most of Oak's library (Ancient Greece
is filed under year 4, we teach it in year 6). So every topic in the key stage is
offered as a candidate, and the model picks on subject matter.

NO OAK CALLS. Units and lesson titles come from oak_lessons_raw, which the nightly
mirror already filled. Oak's daily allowance is never touched.

SAFE TO RE-RUN. Existing entries are kept unless --rebuild is passed, so this can
be run again after new lessons are mirrored and it will only do the new work.

Usage:
  python3 scripts/oak-map-units.py                     # dry run, prints proposals
  python3 scripts/oak-map-units.py --apply             # write into the map file
  python3 scripts/oak-map-units.py --apply --subject History
  python3 scripts/oak-map-units.py --apply --rebuild   # re-decide everything
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MAP_FILE = Path(__file__).resolve().parent / "oak-topic-map.json"

for _envfile in (REPO / ".env.local", Path("/root/decifer-learning/.env.local")):
    if _envfile.exists():
        _e = subprocess.run(["bash", "-c", f"set -a && source {_envfile} && set +a && env"],
                            capture_output=True, text=True).stdout
        for line in _e.splitlines():
            if "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k, v)
        break

import psycopg2  # noqa: E402
import psycopg2.extras  # noqa: E402

MODEL = os.environ.get("OAK_MAP_MODEL", "claude-sonnet-5")

# Which of our year groups sit inside each Oak key stage. Candidates are drawn
# from the whole key stage, deliberately — see the note at the top.
KS_YEARS = {
    "ks1": ["year-1", "year-2"],
    "ks2": ["year-3", "year-4", "year-5", "year-6"],
    "ks3": ["year-7", "year-8", "year-9"],
    "ks4": ["year-10", "year-11"],
}

PROMPT = """You are matching lesson units from Oak National Academy to topics in a \
UK National Curriculum learning app.

Our {subject} topics for {key_stage} are listed below. Each has a slug and a title.

{topic_list}

Below are Oak units. For each one, decide which single topic slug above it belongs \
in, judging by subject matter — dates, concepts and skills — not by wording.

Rules:
- Oak files a unit under the year it teaches. Our year may differ. Ignore the year \
and match on subject matter alone.
- If a unit does not sit clearly inside any topic above, answer "none". A wrong \
match puts questions in front of the wrong children, so "none" is the safe answer \
when you are unsure.
- confidence is "high", "medium" or "low".

Oak units:
{unit_list}

Reply with JSON only, no other text:
{{"mappings": [{{"unit_slug": "...", "topic_slug": "..." or "none", \
"confidence": "high|medium|low", "reasoning": "one short sentence"}}]}}"""


# The second look, for units the first pass could not place.
#
# The first pass judges a unit by its NAME, and that fails in a predictable way:
# Oak names many units after a kind of writing ("Harriet Tubman: biographical
# writing", "persuasive letter writing") while our topics are named after the
# skill being tested ("relative clauses", "cohesion across paragraphs"). The two
# vocabularies share no words, so the model rightly says "none" — even though the
# QUESTIONS inside such a unit often test exactly one of our skills. So the second
# look shows the model the actual questions and asks it to judge by those alone.
DEEP_PROMPT = """You are placing question banks from Oak National Academy into a \
UK National Curriculum learning app.

Our {subject} topics for {key_stage}:

{topic_list}

Below are Oak units WITH SAMPLE QUIZ QUESTIONS from inside them. The unit's name \
describes the writing task the class did; ignore it. Judge ONLY by what the sample \
questions actually test. A unit called "biographical writing" whose questions ask \
about relative clauses belongs in a relative-clauses topic.

Rules:
- Match on what the questions test, not the unit name or year.
- If the questions test handwriting, speaking, debating, or another skill none of \
the topics covers, answer "none" — that is a correct answer, not a failure. A wrong \
match puts questions in front of the wrong children.
- confidence is "high", "medium" or "low".

Oak units and their sample questions:
{unit_list}

Reply with JSON only, no other text:
{{"mappings": [{{"unit_slug": "...", "topic_slug": "..." or "none", \
"confidence": "high|medium|low", "reasoning": "one short sentence"}}]}}"""


def dsn() -> str:
    raw = (os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL") or "").strip().strip('"')
    if not raw:
        sys.exit("no DIRECT_URL or DATABASE_URL in the environment")
    return raw.split("?")[0]


def ask(client, prompt: str) -> dict:
    """One model call. Returns {} rather than raising, so one bad batch is not fatal."""
    try:
        # No temperature: the current models reject it as deprecated.
        msg = client.messages.create(
            model=MODEL, max_tokens=8000,
            messages=[{"role": "user", "content": prompt}])
        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    except Exception as exc:                       # network, rate limit, overload
        print(f"    !! model call failed: {exc}")
        return {}
    # Models sometimes wrap JSON in a code fence or add a sentence before it.
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        print("    !! no JSON in the reply")
        return {}
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError as exc:
        print(f"    !! reply was not valid JSON: {exc}")
        return {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write the map file")
    ap.add_argument("--subject", action="append", help="restrict to a subject; repeatable")
    ap.add_argument("--rebuild", action="store_true", help="re-decide units already mapped")
    ap.add_argument("--deep", action="store_true",
                    help="the second look: show the model each unit's actual quiz "
                         "questions instead of its name, and record a final 'none' "
                         "for units that truly have no home. Slower per unit; run "
                         "it only on what the first pass could not place.")
    ap.add_argument("--batch", type=int, default=25, help="units per model call")
    ap.add_argument("--max-calls", type=int, default=200, help="cap the model calls")
    args = ap.parse_args()

    key = (os.environ.get("ANTHROPIC_API_KEY") or "").strip().strip('"')
    if not key:
        sys.exit("no ANTHROPIC_API_KEY in the environment")
    import anthropic
    client = anthropic.Anthropic(api_key=key)

    doc = json.loads(MAP_FILE.read_text()) if MAP_FILE.exists() else {}
    doc.setdefault("version", "1")
    doc.setdefault("note", "LLM-assisted Oak unit -> NC topic map. Keep this file in the code.")
    mappings: dict = doc.setdefault("mappings", {})

    conn = psycopg2.connect(dsn())
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("""
        SELECT t.slug, t.title, s.name AS subject, yg.label AS year
        FROM topics t
        JOIN subjects s ON s.id = t.subject_id
        JOIN year_groups yg ON yg.id = t.year_group_id
        WHERE t.is_published
        ORDER BY yg.label, t.order_index
    """)
    topics_by_subject_ks: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in cur.fetchall():
        for ks, years in KS_YEARS.items():
            if r["year"] in years:
                topics_by_subject_ks[(r["subject"], ks)].append(dict(r))
    known_slugs = {t["slug"] for group in topics_by_subject_ks.values() for t in group}

    # One row per Oak unit, with a few lesson titles as evidence of what it teaches.
    cur.execute("""
        SELECT subject, key_stage, oak_year_slug, unit_slug,
               (array_agg(lesson_title ORDER BY lesson_slug))[1:5] AS lesson_titles,
               COUNT(*) AS lessons
        FROM oak_lessons_raw
        WHERE fetch_status = 'done'
        GROUP BY subject, key_stage, oak_year_slug, unit_slug
        ORDER BY subject, key_stage, unit_slug
    """)
    units = [dict(r) for r in cur.fetchall()]

    if args.deep:
        # The evidence for the second look: a handful of real questions from each
        # unit, pulled from the mirror. What a unit's questions test is a far
        # better witness than what the unit is called.
        cur.execute("""
            SELECT unit_slug, quiz_json FROM oak_lessons_raw
            WHERE fetch_status = 'done' AND quiz_json IS NOT NULL
        """)
        samples: dict[str, list[str]] = defaultdict(list)
        for r in cur.fetchall():
            bucket = samples[r["unit_slug"]]
            if len(bucket) >= 6:
                continue
            quiz = r["quiz_json"] or {}
            for part in ("starterQuiz", "exitQuiz"):
                for item in (quiz.get(part) or []):
                    text = (item.get("question") or "").strip().replace("\n", " ")
                    if len(text) > 12 and len(bucket) < 6:
                        bucket.append(text[:140])
        for u in units:
            u["question_samples"] = samples.get(u["unit_slug"], [])

    # Let go of the database before the thinking starts. The model calls below take
    # many minutes, and an open read transaction blocks anything that needs to change
    # this table — a real deadlock we hit on 2026-09-01. Everything needed is already
    # in memory by this point.
    cur.close()
    conn.rollback()
    conn.close()

    pending: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for u in units:
        if args.subject and u["subject"] not in args.subject:
            continue
        map_key = (f"{(u['subject'] or '').lower()}/{u['key_stage']}/"
                   f"{u['oak_year_slug']}/{u['unit_slug']}")
        settled = mappings.get(map_key)
        if settled and not args.rebuild:
            # A unit already placed in a topic stays placed. A unit recorded as
            # "none" is re-examined ONLY by the deep pass, which brings new
            # evidence (the questions); repeating the name-based pass on it
            # would just repeat the same shrug.
            if settled.get("topic_slug") != "none" or not args.deep:
                continue
        u["map_key"] = map_key
        pending[(u["subject"], u["key_stage"])].append(u)

    total_pending = sum(len(v) for v in pending.values())
    print(f"{len(units)} Oak units mirrored. {total_pending} still need a topic.\n")
    if not total_pending:
        return 0

    calls = 0
    matched = skipped = 0
    for (subject, ks), group in sorted(pending.items()):
        candidates = topics_by_subject_ks.get((subject, ks), [])
        if not candidates:
            print(f"-- {subject} {ks}: we teach no {subject} at {ks}. "
                  f"{len(group)} units left alone.")
            skipped += len(group)
            continue

        topic_list = "\n".join(
            f"  {t['slug']}  —  {t['title']}  ({t['year']})" for t in candidates)

        for i in range(0, len(group), args.batch):
            if calls >= args.max_calls:
                print("\nReached the model-call cap. Re-run to continue.")
                break
            chunk = group[i:i + args.batch]
            if args.deep:
                unit_list = "\n\n".join(
                    f"  {u['unit_slug']}\n" + "\n".join(
                        f"    Q: {q}" for q in (u.get("question_samples") or [])[:6])
                    for u in chunk)
            else:
                unit_list = "\n".join(
                    f"  {u['unit_slug']}  —  teaches: "
                    f"{'; '.join((u['lesson_titles'] or [])[:5])}" for u in chunk)

            print(f"-- {subject} {ks}: asking about {len(chunk)} units "
                  f"({len(candidates)} topics to choose from)")
            reply = ask(client, (DEEP_PROMPT if args.deep else PROMPT).format(
                subject=subject, key_stage=ks.upper(),
                topic_list=topic_list, unit_list=unit_list))
            calls += 1

            by_slug = {u["unit_slug"]: u for u in chunk}
            for m in (reply.get("mappings") or []):
                u = by_slug.get(m.get("unit_slug"))
                if not u:
                    continue
                topic_slug = (m.get("topic_slug") or "none").strip()
                if topic_slug == "none":
                    if args.deep:
                        # The deep pass has read the unit's own questions and still
                        # found no home — that IS the answer, so it is written down.
                        # Without a record, every future run would ask again, and
                        # the publisher would keep reporting the unit as work left
                        # to do rather than a decision already made.
                        mappings[u["map_key"]] = {
                            "unit_title": u["unit_slug"].replace("-", " "),
                            "topic_slug": "none",
                            "confidence": m.get("confidence", "medium"),
                            "reasoning": (m.get("reasoning") or "")[:400],
                            "subject": subject,
                            "year": u["oak_year_slug"],
                            "mapped_by": "oak-map-units-deep",
                        }
                        print(f"    {u['unit_slug'][:52]:<52} -> none ({(m.get('reasoning') or '')[:60]})")
                    skipped += 1
                    continue
                if topic_slug not in known_slugs:
                    # The model invented a slug. Never trust it into the map.
                    print(f"    !! made-up topic '{topic_slug}' for {u['unit_slug']} — dropped")
                    skipped += 1
                    continue
                mappings[u["map_key"]] = {
                    "unit_title": u["unit_slug"].replace("-", " "),
                    "topic_slug": topic_slug,
                    "confidence": m.get("confidence", "medium"),
                    "reasoning": (m.get("reasoning") or "")[:400],
                    "subject": subject,
                    "year": u["oak_year_slug"],
                    "mapped_by": "oak-map-units-deep" if args.deep else "oak-map-units",
                }
                matched += 1
                print(f"    {u['unit_slug'][:52]:<52} -> {topic_slug}")

    print(f"\n{matched} units matched, {skipped} left unmatched, {calls} model calls.")
    if not args.apply:
        print("DRY RUN — the map file was not changed. Add --apply to write it.")
        return 0
    MAP_FILE.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {MAP_FILE} — now holds {len(mappings)} units.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
