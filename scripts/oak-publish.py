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

PICTURE ANSWERS (added 2026-09-01). "Which of these is a circle?", where the child
chooses between pictures. These were held back because the answer buttons were given
no description, so a child using a screen reader heard nothing where the answer
should be. The button is now named out loud by its picture's description, and that
description is also what we store as the answer, so the record of what a child
answered reads as words rather than "B".

Held to the strictest rules here, because a picture question with a missing or
muddled picture is not merely ugly, it is impossible:
  * every picture must have been fetched and seen to load (see oak-check-images.py);
  * every picture must carry a description, under 120 characters, that does not
    repeat itself the way an auto-written one does;
  * no two pictures in one question may be described the same way, or a child
    listening cannot tell them apart.
Anything failing any of those is left out.

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
    # "which of the statements below ARE correct" — plural phrasing promises
    # several right answers, and our screen offers one. The answers we would
    # show are safe (the extra right ones are never displayed), but the wording
    # itself tells the child to look for more than one. Words over children.
    r"choose all|which [^?]{0,60}are (correct|true|right)|are correct\?|are true\?)\b", re.I)

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


def picture_of(node, picture_ok=None) -> dict | None:
    """
    Oak image nodes are {url, alt, width, height}. We keep url + alt only, and only
    when the link has been fetched and seen to load — a broken box beside a question
    is worse than no picture, because the question then refers to nothing.
    """
    if not isinstance(node, dict):
        return None
    url = (node.get("url") or "").strip()
    if not url.startswith("https://"):
        return None
    if picture_ok is not None and not picture_ok(url):
        return None
    return {"url": url, "alt": (node.get("alt") or "").strip() or "Question diagram"}


def common_checks(item: dict, picture_ok=None) -> tuple[str, dict | None, str]:
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

    picture = picture_of(item.get("questionImage"), picture_ok)
    if picture is None and any(p in raw_q.lower() for p in _VISUAL_REFS):
        return "", None, "refers-to-a-picture-we-do-not-have"
    if picture is None and item.get("questionImage"):
        return "", None, "the-picture-beside-this-question-does-not-load"
    return clean(raw_q), picture, ""


def renderable(*texts: str) -> bool:
    """Nothing left in the text that our screen would print as gibberish."""
    return not any(mark in t for t in texts
                   for mark in ("{{", "}}", "**", "\\frac", "<", ">"))


# Turns of phrase that only appear in a description written by a machine looking at
# a photograph. They describe the photograph rather than the thing being asked about
# — "a white rock sitting on top of a counter next to a knife and a bowl of food" is
# an answer about rocks, and the knife and the food are noise a child does not need.
# Oak's picture descriptions are auto-written and many read like this, so they are
# left out rather than read aloud to a child who cannot see the picture.
_AUTO_CAPTION_TELLS = re.compile(
    r"\b(on a white background|in the background|sitting on top of|"
    r"laying on top of|next to a|in the middle of the|a close up of|"
    r"a picture of a|a photo of a|with a white wall|on a wooden table|"
    r"on a white table|in front of a)\b", re.I)


def rambling(text: str) -> bool:
    """
    True when a description repeats itself, the way an auto-written one does.

    Oak's picture descriptions are mostly good, but some loop: "a pink square with
    a black border in the middle of the square is a square with a black border in
    the middle of the square is a rectangle". Read out to a child who cannot see the
    picture, that is worse than useless. Any run of four words that appears twice is
    enough to throw it out.
    """
    words = re.findall(r"[a-z]+", text.lower())
    runs = set()
    for i in range(len(words) - 3):
        run = tuple(words[i:i + 4])
        if run in runs:
            return True
        runs.add(run)
    return False


def build_picture_choice(item: dict, question_text: str,
                         picture_ok) -> tuple[dict | None, str]:
    """
    A question where the child chooses between pictures — "which of these is a
    circle?".

    These were left out until now because the answer buttons were given no
    description at all, so a child using a screen reader heard nothing but silence
    where the answer should be. Every picture here carries a description, that
    description is what the button is called out loud, and the description is also
    the answer we store — so the record of what a child answered reads as words
    rather than "B".

    Nothing is allowed through unless EVERY picture in it has been fetched and seen
    to load. A missing picture in a question like this does not merely look wrong;
    it makes the question impossible.
    """
    options, seen = [], set()
    for a in (item.get("answers") or []):
        if a.get("type") != "image":
            return None, "mixes-pictures-and-words"
        content = a.get("content") or {}
        url = (content.get("url") or "").strip()
        alt = clean(str(content.get("alt") or ""))
        if not url.startswith("https://"):
            return None, "a-picture-has-no-address"
        if not alt:
            return None, "a-picture-has-no-description"
        # Oak's picture descriptions are written by machine, not by a teacher:
        # measured across all 3,618 of them, the average is 111 characters and half
        # contain phrases like "sitting on top of a counter next to a knife". Only
        # 16 are under 60 characters. So there is no clean subset to keep, and the
        # descriptions are used for ONE thing only — saying out loud what a picture
        # shows, to a child who cannot see it. They are never printed on screen and
        # never stored as the answer (see below). A rambling one is still far better
        # than silence; one that repeats itself is not, so that check stays.
        if len(alt) > 200:
            return None, "a-picture-description-is-too-long-to-listen-to"
        if rambling(alt):
            return None, "a-picture-description-repeats-itself"
        if not picture_ok(url):
            return None, "a-picture-does-not-load"
        # Two pictures described the same way cannot be told apart by ear.
        if alt.lower() in seen:
            return None, "two-pictures-are-described-the-same-way"
        seen.add(alt.lower())
        options.append({"alt": alt, "url": url, "wrong": a.get("distractor") is True})

    right = [o for o in options if not o["wrong"]]
    wrong = [o for o in options if o["wrong"]]
    if len(right) != 1:
        return None, "not-exactly-one-right-picture"
    if len(wrong) < 2:
        return None, "fewer-than-two-wrong-pictures"
    if not renderable(question_text):
        return None, "leftover-formatting-we-cannot-render"

    # The answer stored is a plain letter, NOT the description.
    #
    # The first version stored the description, and it would have been printed to
    # every child who got the question wrong: "Not quite. The answer is an adult
    # oranguel holding a baby oranguel on a tree branch in a zoo enclosure at the
    # zoo". Misspelling and all, because Oak's descriptions are machine-written.
    # A letter can never embarrass us on screen, and every screen that shows these
    # questions shows the picture rather than the letter.
    chosen = [right[0]] + wrong[:3]
    letters = ["A", "B", "C", "D"][:len(chosen)]
    return {
        "question_type_suffix": "picture_choice",
        "question_text": question_text,
        "correct_answer": letters[0],
        "distractors": letters[1:],
        "answer_parts": None,
        "option_images": {letters[i]: {"url": o["url"], "alt": o["alt"]}
                          for i, o in enumerate(chosen)},
        "explanation": "The right picture is shown above.",
    }, ""


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


def build_question(item: dict, tier: str, keywords: list[tuple[str, str]],
                   picture_ok) -> tuple[dict | None, str]:
    """
    Turn one Oak quiz item into one of our questions, or explain why we can't.
    Returns (question, reason). Exactly one of the two is meaningful.
    """
    kind = item.get("questionType")
    picture_answers = any(a.get("type") == "image" for a in (item.get("answers") or []))

    if kind == "multiple-choice" and picture_answers:
        question_text, picture, why = common_checks(item, picture_ok)
        if why:
            return None, why
        built, why = build_picture_choice(item, question_text, picture_ok)
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
        built.setdefault("option_images", None)
        return built, ""

    if kind in ("short-answer", "match", "order"):
        question_text, picture, why = common_checks(item, picture_ok)
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
        built.setdefault("option_images", None)
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

    correct = [a for a in answers if a.get("type") == "text" and a.get("distractor") is not True]
    wrong = [a for a in answers if a.get("type") == "text" and a.get("distractor") is True]
    if not correct:
        return None, "no-correct-answer"
    if len(wrong) < 2:
        return None, "fewer-than-two-wrong-answers"

    picture = picture_of(item.get("questionImage"), picture_ok)
    if picture is None and any(p in raw_q.lower() for p in _VISUAL_REFS):
        return None, "refers-to-a-picture-we-do-not-have"
    if picture is None and item.get("questionImage"):
        return None, "the-picture-beside-this-question-does-not-load"

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
        "option_images": None,
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
    ap.add_argument("--only", metavar="SHAPE",
                    help="restrict to one way of answering, e.g. picture_choice. "
                         "Meant for reading a new shape before it goes live.")
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
    # Pictures already fetched and seen to load. Anything not in here is treated as
    # broken, so a picture nobody has checked is never put in front of a child.
    cur.execute("SELECT url FROM oak_image_checks WHERE ok")
    working_pictures = {r["url"] for r in cur.fetchall()}
    picture_ok = working_pictures.__contains__
    print(f"{len(working_pictures)} Oak pictures have been checked and load.")

    cur.execute("SELECT question_text, correct_answer FROM quiz_questions")
    seen = {norm(r["question_text"]) + "|" + norm(r["correct_answer"]) for r in cur.fetchall()}
    cur.execute("SELECT COUNT(*) AS n FROM quiz_questions WHERE generator_version = 'oak-publish-v2'")
    already_v2 = cur.fetchone()["n"]

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

        if entry.get("topic_slug") == "none":
            # Examined, questions and all, and found to teach something we have no
            # topic for — handwriting, debating, speaking. A decision, not a gap.
            reasons["examined-and-has-no-home-here"] += 1
            continue

        confidence = (entry.get("confidence") or "medium").lower()
        # Two kinds of match, two bars. A name-based match rests on the unit's
        # title, so it must be highly sure. A deep match was judged on the unit's
        # own quiz questions — stronger evidence — so its "medium" is worth more
        # than a name-based "medium", and is accepted. "Low" is never enough:
        # low from either pass means even the model reading the questions could
        # not tell where they belong, and guessing is how questions end up in
        # front of the wrong children.
        deep = entry.get("mapped_by") == "oak-map-units-deep"
        acceptable = (confidence in allowed_confidence
                      or (deep and confidence in ("high", "medium")))
        if not acceptable:
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

                q, why = build_question(item, tier, keywords, picture_ok)
                if q is None:
                    reasons[why] += 1
                    continue

                # The shape name the quiz screen dispatches on. A plain pick-one
                # question keeps the old oak_<subject> naming; the newer shapes must
                # use the exact names the screen looks for, or a child would be shown
                # four empty buttons.
                qtype = q["question_type_suffix"] or f"oak_{(row['subject'] or 'gen').lower()}"
                if args.only and qtype != args.only:
                    continue

                # What makes this question different from one we already hold.
                #
                # Normally the wording plus the right answer is enough. Picture
                # questions store their answer as the letter "A", so two completely
                # different questions that happen to share a stem — "Which of these
                # is a plant?" appears in several Oak lessons with different
                # photographs — would look identical and the second would be thrown
                # away. For those, the pictures themselves are what differs.
                identity = q["correct_answer"]
                if q.get("option_images"):
                    identity = "|".join(sorted(v["url"] for v in q["option_images"].values()))
                dedup_key = norm(q["question_text"]) + "|" + norm(identity)
                if dedup_key in seen:
                    reasons["already-have-this-question"] += 1
                    continue
                seen.add(dedup_key)

                added_per_topic[slug] = added_per_topic.get(slug, 0) + 1
                if q["kept_one_of_several_correct"]:
                    kept_multi += 1
                if q["foundation_images"]:
                    with_picture += 1

                shapes[qtype] += 1

                to_write.append((
                    str(uuid.uuid4()), topic["id"], q["tier"], q["question_text"],
                    qtype,
                    q["correct_answer"], json.dumps(q["distractors"]),
                    q["hint_1"], q["hint_2"], q["hint_3"], q["explanation"],
                    json.dumps(q["foundation_images"]) if q["foundation_images"] else None,
                    json.dumps(q["answer_parts"]) if q["answer_parts"] else None,
                    json.dumps(q["option_images"]) if q.get("option_images") else None,
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
            meta = json.loads(row[14])
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
           answer_parts, option_images, confidence_score, status, question_metadata,
           generator_version, verifier_version, published_at, created_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s::jsonb,
                100.0,'published',%s::jsonb,'oak-publish-v2','oak-authoritative',
                now(), now())
        ON CONFLICT DO NOTHING
    """, to_write, page_size=200)
    # ON CONFLICT DO NOTHING, because the database has its own duplicate rule from
    # the July clean-up: no two questions may share wording + answer + wrong
    # answers. Two DIFFERENT picture questions with the same wording collide on it
    # — their stored answers are just the letters A to D, so to the rule they look
    # identical even though their pictures differ. One such collision used to
    # abort the entire batch and nothing at all was written. Now the colliding
    # question is quietly dropped and everything else lands; the count below is
    # measured from the database, not assumed.
    cur.execute("SELECT COUNT(*) AS n FROM quiz_questions WHERE generator_version = 'oak-publish-v2'")
    before_commit = cur.fetchone()["n"]
    conn.commit()
    skipped_by_db = len(to_write) - (before_commit - already_v2)
    print(f"\nWrote {before_commit - already_v2} live questions."
          + (f" ({skipped_by_db} dropped by the database's duplicate rule.)" if skipped_by_db else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
