#!/usr/bin/env python3
"""
Turn mirrored Oak lessons (oak_lessons_raw) into live questions.

THE GAP THIS CLOSES. oak-mirror.py has been collecting Oak lessons every night
since 2026-08-18 and by 2026-09-01 held 3,004 of them — about 35,000 raw quiz
items. Nothing anywhere read that table. The warehouse had no door. This is the
door.

NO OAK CALLS. Everything here is local SQL against oak_lessons_raw. Oak cuts us
off after roughly 1,000 fetches a day, and that allowance is the whole reason
the mirror exists. So this script can be re-run as often as we like, and a rule
change below can be re-applied to every lesson ever collected in one pass.

WHAT WE COULD NOT SHOW BEFORE, AND NOW CAN. The old importer (ingest-oak-questions.py)
threw away three big groups of perfectly good questions, because at the time the
quiz screen could only show four lines of plain text:

  * 4,024 items whose question comes with a diagram. The quiz screen has rendered
    question pictures (foundation_images) since the KS1 visual work, so these are
    fine now — we keep the picture instead of dropping the question.
  * 5,231 items where Oak marks more than one answer correct. Our screen shows one
    correct answer and three wrong ones, so we keep ONE of Oak's correct answers and
    three of its distractors. The others are simply never shown, so nothing on screen
    is wrong. Guarded below: a question that asks for "two" or "all that apply" is
    still rejected, because there picking one really would be wrong.
  * Items whose wording mentions a diagram ("shown below", "this graph"). The old
    code rejected those on sight, because there was no picture. Now that check only
    applies when the item genuinely has no picture attached.

THE OTHER THREE SHAPES (added 2026-09-01, about 12,000 more items). Oak also writes
questions the child types, pairs up, or puts in order. The quiz screen now draws all
three, so we import them too:

  * short-answer -> the child types. Oak lists EVERY spelling it accepts ("12",
    "12.", "twelve", "Twelve"), so we never guess at what counts. A "true or false?"
    written this way becomes two buttons instead, because making a child spell out
    "true" is a worse question, not a harder one.
  * match  -> the child pairs a card on the left with one on the right.
  * order  -> the child moves things up and down into the right order.

None of the three uses dragging. Dragging fails the moment a finger wanders on a
phone, cannot be done with a keyboard, and shuts out a child using a screen reader.
Every one of these is answered by pressing buttons.

WHAT WE STILL SKIP, HONESTLY.
  * multiple-choice whose ANSWERS are pictures (about 1,200) — the screen can show
    picture choices, but it hardcodes empty alt text on them, so a child using a
    screen reader would get nothing. Fixing that comes before importing these.

WHERE THE NEW SHAPES MAY APPEAR. The full quiz screen only. Exams and Blitz build
their own row of buttons out of the right answer and the wrong ones, so a typing or
pairing question would show up there as a single button with the answer written on
it. Both filter these out; the list lives in lib/points.ts.

Oak content is Open Government Licence v3.0 and carries Oak's own answer key, so it
goes live directly at confidence 100 — same as every earlier Oak import. It is not
LLM-generated, so there is nothing for the generate-and-check pipeline to check.
(Measured 2026-08-03: Oak questions were 1.1% defective, our generated ones 10.3%.)

Usage:
  python3 scripts/oak-publish.py                    # dry run — prints the plan
  python3 scripts/oak-publish.py --apply            # write them
  python3 scripts/oak-publish.py --apply --target 40
  python3 scripts/oak-publish.py --report-unmapped /tmp/unmapped.json
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import uuid
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MAP_FILE = Path(__file__).resolve().parent / "oak-topic-map.json"

# ── environment ───────────────────────────────────────────────────────────────
# Same recipe as the other pipeline scripts: read .env.local through bash so that
# quoting and multi-line values behave exactly as they do everywhere else.
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


def dsn() -> str:
    """Prefer the direct connection. The pooled one rejects some statements."""
    raw = (os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL") or "").strip().strip('"')
    if not raw:
        sys.exit("no DIRECT_URL or DATABASE_URL in the environment")
    # The pooler-specific query string is not valid for a direct connection.
    return raw.split("?")[0]


# ── what the quiz screen can show ─────────────────────────────────────────────

# Wordings that genuinely need more than one answer ticked. Keeping one correct
# answer here would make the question wrong on screen, so these are rejected even
# though they are multiple-choice.
_MULTI_REQUIRED = re.compile(
    r"\b(two|three|four|both|all that apply|all of the|select all|tick all|"
    r"choose all|which \w+ are correct)\b", re.I)

# Wordings that point at styling we cannot show. Oak writes emphasis as **stars**,
# which our quiz screen would print literally, so clean() removes it — and that turns
# "choose the correct spelling for the word in bold" into a question with nothing to
# point at. Rejected rather than shown broken.
_STYLE_REFS = re.compile(r"\b(in bold|bold word|bolded|underlined|in italics|"
                         r"italicised|the highlighted word)\b", re.I)

# Wordings that only make sense next to a picture. Applied ONLY to items that have
# no picture attached — if Oak gave us the diagram, the wording is fine.
_VISUAL_REFS = (
    "bar model", "this picture", "the picture", "this image", "the image",
    "this diagram", "the diagram", "shown below", "shown above", "below:", "above:",
    "this shape", "the shape shown", "this graph", "the graph shown", "this chart",
    "odd one out", "these numbers", "this number line", "the number line",
    "this array", "the array", "this grid", "the grid", "highlighted", "shaded",
    "the following diagram", "look at the", "in the picture", "in the image",
    "this map", "the map shown", "map below", "this source", "the source shown",
    "source below", "this timeline", "the timeline shown", "this photograph",
)

GENERIC_HINTS = (
    "Read the question again slowly. What is it actually asking for?",
    "Rule out the answers you are sure are wrong first.",
    "Think back to what this lesson was teaching, then pick the closest match.",
)


def clean(s: str) -> str:
    """Oak's authoring marks, turned into things our text screen can render."""
    # Oak's blank is {{}}, but it is also written {{ }} with a space inside.
    s = re.sub(r"\{\{\s*\}\}", "_____", s)
    s = re.sub(r"\$\$(.*?)\$\$", r"\1", s, flags=re.S)
    for junk in ("\\(", "\\)", "\\[", "\\]", "$"):
        s = s.replace(junk, "")
    # Oak writes emphasis as **bold** and _italic_. Our quiz screen shows plain
    # text, so those marks would appear on screen as literal stars and lines.
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s, flags=re.S)
    s = re.sub(r"(?<!\w)_(?!_)(.+?)(?<!_)_(?!\w)", r"\1", s, flags=re.S)
    s = s.replace("**", "")
    return re.sub(r"\s+", " ", s).strip()


def norm(s: str) -> str:
    """Loose key for spotting the same question we already hold."""
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def year_number(label: str | None) -> int | None:
    """'year-3' -> 3. Returns None for anything we cannot read."""
    m = re.search(r"(\d+)", label or "")
    return int(m.group(1)) if m else None


# How far apart Oak's year and our year may be before a match is not believable.
# They legitimately differ: the National Curriculum sets History and Geography by
# key stage with no year at all, so Oak teaches Ancient Greece in year 4 where we
# put it in year 6. Two years covers that. Five does not — a five-year gap is how
# "number bonds to 10" ended up filed under Year 6 algebra on the first run.
MAX_YEAR_GAP = 2


def picture_of(node) -> dict | None:
    """Oak image nodes are {url, alt, width, height}. We keep url + alt only."""
    if not isinstance(node, dict):
        return None
    url = (node.get("url") or "").strip()
    if not url.startswith("https://"):
        return None
    return {"url": url, "alt": (node.get("alt") or "").strip() or "Question diagram"}


def common_checks(item: dict) -> tuple[str, dict | None, str]:
    """
    The tests every Oak item must pass whatever its shape.
    Returns (cleaned question text, picture or None, reason to reject).
    """
    raw_q = (item.get("question") or "").strip()
    if len(raw_q) < 10:
        return "", None, "question-too-short"
    if raw_q.endswith(":"):
        return "", None, "dangling-question"
    if _STYLE_REFS.search(raw_q):
        return "", None, "points-at-bold-or-underlined-text-we-cannot-show"

    picture = picture_of(item.get("questionImage"))
    if picture is None and any(p in raw_q.lower() for p in _VISUAL_REFS):
        return "", None, "refers-to-a-picture-we-do-not-have"
    return clean(raw_q), picture, ""


def renderable(*texts: str) -> bool:
    """Nothing left in the text that our screen would print as gibberish."""
    return not any(mark in t for t in texts
                   for mark in ("{{", "}}", "**", "\\frac", "<", ">"))


def build_short_answer(item: dict, question_text: str) -> tuple[dict | None, str]:
    """
    A question the child types the answer to.

    Oak lists every spelling it accepts — "12", "12.", "twelve", "Twelve" — so we
    never have to guess at what counts. We keep all of them.
    """
    accepted, seen = [], set()
    for a in (item.get("answers") or []):
        if a.get("type") != "text":
            return None, "typed-answer-is-not-text"
        text = clean(str(a.get("content") or ""))
        if not text or len(text) > 40:
            continue                      # typing a paragraph is not the point here
        if text.lower() not in seen:
            seen.add(text.lower())
            accepted.append({"accept": text})
    if not accepted:
        return None, "no-answer-a-child-could-type"

    # Oak files "true or false?" questions as type-in ones. Making a child spell out
    # "true" is a worse question, not a harder one — and it marks "yes" wrong. Two
    # buttons is the honest shape, so these become pick-one instead.
    words = {a["accept"].lower() for a in accepted}
    if words <= {"true", "false"} and len(words) == 1:
        right = accepted[0]["accept"]
        return {
            "question_type_suffix": None,
            "question_text": question_text,
            "correct_answer": right,
            "distractors": ["false" if right.lower() == "true" else "true"],
            "answer_parts": None,
            "explanation": f"The answer is: {right}.",
        }, ""
    # More than one blank means more than one box, and we show one.
    if question_text.count("_____") > 1:
        return None, "more-than-one-blank-to-fill"
    if not renderable(question_text, *(a["accept"] for a in accepted)):
        return None, "leftover-formatting-we-cannot-render"

    return {
        "question_type_suffix": "short_answer_text",
        "question_text": question_text,
        "correct_answer": accepted[0]["accept"],
        "distractors": [],
        "answer_parts": accepted,
        "explanation": f"The answer is: {accepted[0]['accept']}.",
    }, ""


def build_match(item: dict, question_text: str) -> tuple[dict | None, str]:
    """A question where the child pairs things up."""
    pairs, lefts, rights = [], set(), set()
    for a in (item.get("answers") or []):
        left_node, right_node = a.get("matchOption") or {}, a.get("correctChoice") or {}
        if left_node.get("type") != "text" or right_node.get("type") != "text":
            return None, "pairs-use-pictures-we-cannot-show"
        left, right = clean(str(left_node.get("content") or "")), clean(str(right_node.get("content") or ""))
        if not left or not right:
            return None, "a-pair-is-missing-a-side"
        if len(left) > 60 or len(right) > 60:
            return None, "pair-text-too-long-for-a-card"
        # A repeated card on either side makes the pairing unanswerable.
        if left.lower() in lefts or right.lower() in rights:
            return None, "the-same-card-appears-twice"
        lefts.add(left.lower())
        rights.add(right.lower())
        pairs.append({"left": left, "right": right})

    if not 2 <= len(pairs) <= 6:
        return None, "too-few-or-too-many-pairs"
    if not renderable(question_text, *(p["left"] for p in pairs), *(p["right"] for p in pairs)):
        return None, "leftover-formatting-we-cannot-render"

    return {
        "question_type_suffix": "match_pairs",
        "question_text": question_text,
        "correct_answer": "; ".join(f"{p['left']} = {p['right']}" for p in pairs)[:500],
        "distractors": [],
        "answer_parts": pairs,
        "explanation": "The pairs are: "
                       + "; ".join(f"{p['left']} goes with {p['right']}" for p in pairs),
    }, ""


def build_order(item: dict, question_text: str) -> tuple[dict | None, str]:
    """A question where the child puts things in the right order."""
    rows = []
    for a in (item.get("answers") or []):
        if a.get("type") != "text":
            return None, "order-uses-pictures-we-cannot-show"
        text = clean(str(a.get("content") or ""))
        position = a.get("order")
        if not text or not isinstance(position, int):
            return None, "an-item-has-no-position"
        if len(text) > 80:
            return None, "item-text-too-long-for-a-card"
        rows.append((position, text))

    rows.sort(key=lambda r: r[0])
    items = [{"item": t} for _, t in rows]
    if not 3 <= len(items) <= 6:
        return None, "too-few-or-too-many-things-to-order"
    if len({i["item"].lower() for i in items}) != len(items):
        return None, "the-same-item-appears-twice"
    if [p for p, _ in rows] != sorted({p for p, _ in rows}):
        return None, "two-items-claim-the-same-position"
    if not renderable(question_text, *(i["item"] for i in items)):
        return None, "leftover-formatting-we-cannot-render"

    return {
        "question_type_suffix": "ordered_list",
        "question_text": question_text,
        "correct_answer": " → ".join(i["item"] for i in items)[:500],
        "distractors": [],
        "answer_parts": items,
        "explanation": "The right order is: " + " → ".join(i["item"] for i in items),
    }, ""


def build_question(item: dict, tier: str,
                   keywords: list[tuple[str, str]]) -> tuple[dict | None, str]:
    """
    Turn one Oak quiz item into one of our questions, or explain why we can't.
    Returns (question, reason). Exactly one of the two is meaningful.
    """
    kind = item.get("questionType")
    if kind in ("short-answer", "match", "order"):
        question_text, picture, why = common_checks(item)
        if why:
            return None, why
        builder = {"short-answer": build_short_answer,
                   "match": build_match,
                   "order": build_order}[kind]
        built, why = builder(item, question_text)
        if built is None:
            return None, why
        built.update({
            "tier": tier,
            "hint_1": hint_for(keywords, built["question_text"], built["correct_answer"])
                      or GENERIC_HINTS[0],
            "hint_2": GENERIC_HINTS[1],
            "hint_3": GENERIC_HINTS[2],
            "foundation_images": [picture] if picture else None,
            "kept_one_of_several_correct": False,
        })
        return built, ""

    if kind != "multiple-choice":
        return None, "not-a-shape-we-can-show"

    raw_q = (item.get("question") or "").strip()
    if len(raw_q) < 15:
        return None, "question-too-short"
    if raw_q.endswith(":"):
        return None, "dangling-question"          # the numbers lived somewhere else
    if _MULTI_REQUIRED.search(raw_q):
        return None, "needs-more-than-one-answer"
    if _STYLE_REFS.search(raw_q):
        return None, "points-at-bold-or-underlined-text-we-cannot-show"

    answers = item.get("answers") or []
    if any(a.get("type") == "image" for a in answers):
        # The screen can show picture choices but gives them empty alt text, so a
        # child using a screen reader would get nothing. Not until that is fixed.
        return None, "picture-answers-not-accessible-yet"

    correct = [a for a in answers if a.get("type") == "text" and a.get("distractor") is not True]
    wrong = [a for a in answers if a.get("type") == "text" and a.get("distractor") is True]
    if not correct:
        return None, "no-correct-answer"
    if len(wrong) < 2:
        return None, "fewer-than-two-wrong-answers"

    picture = picture_of(item.get("questionImage"))
    if picture is None and any(p in raw_q.lower() for p in _VISUAL_REFS):
        return None, "refers-to-a-picture-we-do-not-have"

    answer_text = clean(correct[0].get("content") or "")
    if not answer_text:
        return None, "empty-correct-answer"
    distractors = [d for d in (clean(w.get("content") or "") for w in wrong) if d][:3]
    if len(distractors) < 2:
        return None, "fewer-than-two-wrong-answers"
    # A "wrong" answer identical to the right one would make the question unanswerable.
    distractors = [d for d in distractors if norm(d) != norm(answer_text)]
    if len(distractors) < 2:
        return None, "wrong-answers-repeat-the-right-one"
    if len({norm(d) for d in distractors}) != len(distractors):
        return None, "wrong-answers-repeat-each-other"

    question_text = clean(raw_q)
    # Last line of defence. If any authoring mark survived cleaning, a child would
    # see it on screen. Better to lose the question than show it broken.
    for text in (question_text, answer_text, *distractors):
        if any(mark in text for mark in ("{{", "}}", "**", "\\frac", "<", ">")):
            return None, "leftover-formatting-we-cannot-render"

    return {
        "question_type_suffix": None,          # a plain pick-one question
        "question_text": question_text,
        "correct_answer": answer_text,
        "distractors": distractors,
        "answer_parts": None,
        "hint_1": hint_for(keywords, question_text, answer_text) or GENERIC_HINTS[0],
        "hint_2": GENERIC_HINTS[1],
        "hint_3": GENERIC_HINTS[2],
        "explanation": f"The correct answer is: {answer_text}.",
        "tier": tier,
        "foundation_images": [picture] if picture else None,
        "kept_one_of_several_correct": len(correct) > 1,
    }, ""


def lesson_keywords(summary: dict | None) -> list[tuple[str, str]]:
    """The words Oak says this lesson teaches, with their meanings."""
    if not isinstance(summary, dict):
        return []
    out = []
    for kw in (summary.get("lessonKeywords") or []):
        word, desc = (kw.get("keyword") or "").strip(), (kw.get("description") or "").strip()
        if word and desc:
            out.append((word, desc))
    return out


def hint_for(keywords: list[tuple[str, str]], question: str, answer: str) -> str | None:
    """
    Explain a word this question actually uses — or say nothing.

    The first version of this took the lesson's FIRST keyword and pinned it to every
    question in the lesson. That produced clues like "What do we use a thermometer
    for? — Remember: light: it is light during the daytime", which is worse than no
    clue at all: it sends a child looking in the wrong direction. So a keyword is
    only used when it genuinely appears in this question or its answer.
    """
    haystack = f" {question.lower()} {answer.lower()} "
    for word, desc in keywords:
        stem = word.lower().strip("'\"")
        # Match on the start of the word so "measure" catches "measuring", but keep
        # it long enough that short words don't match inside unrelated ones.
        if len(stem) < 4:
            continue
        if re.search(r"(?<![a-z])" + re.escape(stem[:max(4, len(stem) - 3)]), haystack):
            return f"Remember: {word} — {desc}"[:240]
    return None


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="actually write. Without it nothing is inserted.")
    ap.add_argument("--target", type=int, default=40,
                    help="stop adding to a topic once it has this many live questions")
    ap.add_argument("--limit", type=int, default=0,
                    help="stop after this many new questions (0 = no limit)")
    ap.add_argument("--subject", action="append",
                    help="restrict to a subject; repeatable")
    ap.add_argument("--report-unmapped", metavar="FILE",
                    help="write Oak units that have no topic yet, for the mapper")
    ap.add_argument("--show", type=int, default=0, metavar="N",
                    help="print N of the questions in full, so they can be read "
                         "before anything goes in front of a child")
    ap.add_argument("--min-confidence", choices=["high", "medium", "low"], default="high",
                    help="how sure the unit-to-topic match must be. Default high. "
                         "A loose match puts the right question under the wrong "
                         "heading, so this stays strict unless you say otherwise.")
    args = ap.parse_args()

    allowed_confidence = {"high": {"high"},
                          "medium": {"high", "medium"},
                          "low": {"high", "medium", "low"}}[args.min_confidence]

    if not MAP_FILE.exists():
        sys.exit(f"no unit map at {MAP_FILE}")
    mappings = json.loads(MAP_FILE.read_text()).get("mappings", {})

    conn = psycopg2.connect(dsn())
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Our topics, by slug. Only published ones — an unpublished topic is not on the
    # site, so filling it would be invisible work.
    cur.execute("""
        SELECT t.id, t.slug, s.name AS subject, yg.label AS year,
               COUNT(q.id) FILTER (WHERE q.status = 'published') AS live
        FROM topics t
        JOIN subjects s ON s.id = t.subject_id
        JOIN year_groups yg ON yg.id = t.year_group_id
        LEFT JOIN quiz_questions q ON q.topic_id = t.id
        WHERE t.is_published
        GROUP BY t.id, t.slug, s.name, yg.label
    """)
    topics = {r["slug"]: {"id": r["id"], "subject": r["subject"],
                          "year": year_number(r["year"]), "live": int(r["live"])}
              for r in cur.fetchall()}

    # Every question we already hold, in any state, so we never add a repeat and
    # never resurrect something that was deliberately retired.
    cur.execute("SELECT question_text, correct_answer FROM quiz_questions")
    seen = {norm(r["question_text"]) + "|" + norm(r["correct_answer"]) for r in cur.fetchall()}

    cur.execute("""
        SELECT lesson_slug, unit_slug, key_stage, subject, oak_year_slug,
               quiz_json, summary_json
        FROM oak_lessons_raw
        WHERE fetch_status = 'done' AND quiz_json IS NOT NULL
        ORDER BY subject, unit_slug, lesson_slug
    """)
    lessons = cur.fetchall()

    reasons: Counter[str] = Counter()
    unmapped: dict[str, dict] = {}
    added_per_topic: dict[str, int] = {}
    to_write: list[tuple] = []
    kept_multi = 0
    with_picture = 0
    shapes: Counter[str] = Counter()

    for row in lessons:
        if args.subject and row["subject"] not in args.subject:
            continue

        key = (f"{(row['subject'] or '').lower()}/{row['key_stage']}/"
               f"{row['oak_year_slug']}/{row['unit_slug']}")
        entry = mappings.get(key)
        if not entry:
            unmapped.setdefault(key, {
                "subject": row["subject"], "key_stage": row["key_stage"],
                "oak_year": row["oak_year_slug"], "unit_slug": row["unit_slug"],
                "example_lesson": row["lesson_slug"],
            })
            reasons["unit-not-mapped-to-a-topic"] += 1
            continue

        if (entry.get("confidence") or "medium").lower() not in allowed_confidence:
            reasons["match-to-a-topic-not-sure-enough"] += 1
            continue

        topic = topics.get(entry.get("topic_slug"))
        if not topic:
            reasons["mapped-topic-missing-or-unpublished"] += 1
            continue

        oak_year, our_year = year_number(row["oak_year_slug"]), topic["year"]
        if oak_year and our_year and abs(oak_year - our_year) > MAX_YEAR_GAP:
            reasons["taught-too-many-years-apart-to-be-the-same-thing"] += 1
            continue

        slug = entry["topic_slug"]
        have = topic["live"] + added_per_topic.get(slug, 0)
        if have >= args.target:
            reasons["topic-already-full"] += 1
            continue

        keywords = lesson_keywords(row["summary_json"])
        quiz = row["quiz_json"] or {}

        for oak_quiz, tier in (("starterQuiz", "sprout"), ("exitQuiz", "explorer")):
            for item in (quiz.get(oak_quiz) or []):
                if args.limit and len(to_write) >= args.limit:
                    break
                have = topic["live"] + added_per_topic.get(slug, 0)
                if have >= args.target:
                    break

                q, why = build_question(item, tier, keywords)
                if q is None:
                    reasons[why] += 1
                    continue

                dedup_key = norm(q["question_text"]) + "|" + norm(q["correct_answer"])
                if dedup_key in seen:
                    reasons["already-have-this-question"] += 1
                    continue
                seen.add(dedup_key)

                added_per_topic[slug] = added_per_topic.get(slug, 0) + 1
                if q["kept_one_of_several_correct"]:
                    kept_multi += 1
                if q["foundation_images"]:
                    with_picture += 1

                # The quiz screen chooses which answer area to show from
                # question_type. A pick-one question keeps the old oak_<subject>
                # naming; the three new shapes must use the exact names the screen
                # looks for, or the child would be shown four empty buttons.
                qtype = q["question_type_suffix"] or f"oak_{(row['subject'] or 'gen').lower()}"
                shapes[qtype] += 1

                to_write.append((
                    str(uuid.uuid4()), topic["id"], q["tier"], q["question_text"],
                    qtype,
                    q["correct_answer"], json.dumps(q["distractors"]),
                    q["hint_1"], q["hint_2"], q["hint_3"], q["explanation"],
                    json.dumps(q["foundation_images"]) if q["foundation_images"] else None,
                    json.dumps(q["answer_parts"]) if q["answer_parts"] else None,
                    json.dumps({
                        "source": "oak",
                        "topic_slug": slug,
                        "oak_lesson_slug": row["lesson_slug"],
                        "oak_unit_slug": row["unit_slug"],
                        "oak_quiz": oak_quiz,
                        "oak_question_type": item.get("questionType"),
                        "kept_one_of_several_correct": q["kept_one_of_several_correct"],
                        "has_question_picture": bool(q["foundation_images"]),
                        "license": "OGL-v3.0 Oak National Academy",
                    }),
                ))

    # ── report ────────────────────────────────────────────────────────────────
    print(f"\nRead {len(lessons)} mirrored lessons.")
    print(f"Ready to add {len(to_write)} questions across {len(added_per_topic)} topics.")
    print(f"  {with_picture} of them keep an Oak diagram.")
    print(f"  {kept_multi} of them are Oak multi-answer questions kept as pick-one.")
    if shapes:
        print("\nBy how the child answers:")
        for name, n in shapes.most_common():
            print(f"  {n:>7}  {name}")
    if reasons:
        print("\nSkipped:")
        for why, n in reasons.most_common():
            print(f"  {n:>7}  {why}")
    if added_per_topic:
        print("\nBiggest gains:")
        for slug, n in sorted(added_per_topic.items(), key=lambda kv: -kv[1])[:15]:
            print(f"  +{n:<4} {slug} (had {topics[slug]['live']})")

    if args.show:
        # Spread the sample across the whole run rather than showing the first N,
        # which would all come from one topic and prove nothing.
        step = max(1, len(to_write) // args.show)
        print("\n" + "=" * 70)
        for row in to_write[::step][:args.show]:
            meta = json.loads(row[13])
            print(f"\n{meta['topic_slug']}")
            print(f"[{row[2]}] {row[3]}")
            print(f"   right: {row[5]}")
            if row[12]:
                print(f"   parts: {json.dumps(json.loads(row[12]))[:220]}")
            else:
                print(f"   wrong: {', '.join(json.loads(row[6]))}")
            if row[11]:
                print(f"   picture: {json.loads(row[11])[0]['url']}")
            if meta["kept_one_of_several_correct"]:
                print("   (Oak marked more than one answer right; we show one)")
            print(f"   hint: {row[7]}")
        print("\n" + "=" * 70)

    if args.report_unmapped:
        Path(args.report_unmapped).write_text(json.dumps(list(unmapped.values()), indent=2))
        print(f"\n{len(unmapped)} Oak units have no topic yet -> {args.report_unmapped}")
    elif unmapped:
        print(f"\n{len(unmapped)} Oak units have no topic yet. "
              f"Re-run with --report-unmapped FILE to list them.")

    if not args.apply:
        print("\nDRY RUN — nothing written. Add --apply to write.")
        conn.rollback()
        return 0

    psycopg2.extras.execute_batch(cur, """
        INSERT INTO quiz_questions
          (id, topic_id, tier, question_text, question_type, correct_answer,
           distractors, hint_1, hint_2, hint_3, explanation, foundation_images,
           answer_parts, confidence_score, status, question_metadata,
           generator_version, verifier_version, published_at, created_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s::jsonb,%s::jsonb,
                100.0,'published',%s::jsonb,'oak-publish-v2','oak-authoritative',
                now(), now())
    """, to_write, page_size=200)
    conn.commit()
    print(f"\nWrote {len(to_write)} live questions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
