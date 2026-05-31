"""
Generate and publish learn_content for all topics that lack it.

For each topic without a published learn_content row, this script:
  1. Retrieves the top-10 curriculum_chunks for that topic (by subject + year_group)
  2. Calls Claude to write a rich HTML lesson (body_html)
  3. Inserts it directly as status='published' (pilot fast-path — no staged review)

Run: /root/pipeline-venv/bin/python3 scripts/generate-learn-content.py

Optional flags:
  --year-group year-3          Only process topics for a specific year group
  --topic y3-english-grammar-conjunctions  Only process one topic (by slug)
  --dry-run                    Print the HTML without inserting anything

Prerequisites:
  All batch generation must have completed first (so topics exist in DB).
  ANTHROPIC_API_KEY and DATABASE_URL must be set (or .env.local present).
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import uuid
from pathlib import Path
from typing import Optional

# ── Pipeline stop guard ───────────────────────────────────────────────────────
_STOP_GUARD = Path(__file__).resolve().parent.parent / ".PIPELINE_STOP"
if _STOP_GUARD.exists():
    print("PIPELINE STOP ACTIVE: Decifer Learning content generation is disabled")
    sys.exit(0)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("generate-learn-content")

# ── Load environment ──────────────────────────────────────────────────────────

_env_file = Path(__file__).parent.parent / ".env.local"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and val:
            os.environ[key] = val
    log.info("Loaded env from .env.local")

if os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

if not os.environ.get("ANTHROPIC_API_KEY"):
    log.error("ANTHROPIC_API_KEY not set"); sys.exit(1)
if not os.environ.get("DATABASE_URL"):
    log.error("DATABASE_URL not set"); sys.exit(1)

# Add pipeline to path for config
pipeline_dir = Path(__file__).parent.parent / "services" / "content-pipeline"
sys.path.insert(0, str(pipeline_dir))
import config
import db

DATABASE_URL = os.environ["DATABASE_URL"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

# ── DB helpers ────────────────────────────────────────────────────────────────

def _label_to_year_group_key(label: str) -> str:
    """Normalise year_group label to the key format used in curriculum_chunks.
    Handles both 'Year 3' (human) and 'year-3' (DB) formats → 'year-3'.
    """
    return label.lower().replace(" ", "-")


def _label_to_display(label: str) -> str:
    """Convert 'year-3' → 'Year 3' for use in prompts."""
    # 'year-3' → 'Year 3', 'year-7' → 'Year 7', 'year-2' → 'Year 2'
    parts = label.split("-")
    return " ".join(p.capitalize() for p in parts)


def get_topics_needing_learn_content(year_group_label: Optional[str] = None,
                                     topic_slug: Optional[str] = None) -> list[dict]:
    """Return topics that have no published learn_content.

    year_group_label: match on yg.label (e.g. 'year-3' → checked case-insensitively)
    """
    import psycopg2, psycopg2.extras
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            base_q = """
                SELECT
                    t.id,
                    t.title,
                    t.slug,
                    yg.label AS year_group_label,
                    yg.key_stage,
                    s.name AS subject_name,
                    COUNT(qq.id) FILTER (WHERE qq.status = 'published') AS published_q_count,
                    COUNT(lc.id) FILTER (WHERE lc.status = 'published') AS published_lc_count
                FROM topics t
                JOIN year_groups yg ON yg.id = t.year_group_id
                JOIN subjects s ON s.id = t.subject_id
                LEFT JOIN quiz_questions qq ON qq.topic_id = t.id
                LEFT JOIN learn_content lc ON lc.topic_id = t.id
            """
            conditions = []
            params = []
            if year_group_label:
                # Accept either 'year-3' or 'Year 3' style
                normalised = year_group_label.lower().replace("-", " ")
                conditions.append("LOWER(REPLACE(yg.label, '-', ' ')) = %s")
                params.append(normalised)
            if topic_slug:
                conditions.append("t.slug = %s")
                params.append(topic_slug)

            if conditions:
                base_q += " WHERE " + " AND ".join(conditions)

            base_q += """
                GROUP BY t.id, t.title, t.slug, yg.label, yg.key_stage, s.name
                HAVING COUNT(lc.id) FILTER (WHERE lc.status = 'published') = 0
                ORDER BY yg.label, s.name, t.title
            """
            cur.execute(base_q, params)
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_curriculum_chunks(subject: str, year_group_label: str, limit: int = 10) -> list[dict]:
    """Fetch the top chunks for a subject+year_group combo.

    year_group_label is the human label (e.g. 'Year 3'), converted to the
    key format used in curriculum_chunks (e.g. 'year-3').
    """
    year_group_key = _label_to_year_group_key(year_group_label)
    import psycopg2, psycopg2.extras
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, chunk_text, source_name
                FROM curriculum_chunks
                WHERE LOWER(subject) = LOWER(%s) AND year_group = %s
                ORDER BY id
                LIMIT %s
            """, (subject, year_group_key, limit))
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def insert_learn_content(topic_id: str, body_html: str, widgets: list) -> str:
    """Insert a learn_content row as status='published'. Returns the new row ID."""
    import psycopg2, json
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(DATABASE_URL)
    register_vector(conn)
    try:
        new_id = str(uuid.uuid4())
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO learn_content (id, topic_id, body_html, learn_widgets, examples_json, status)
                VALUES (%s, %s, %s, %s::jsonb, %s, 'published')
                ON CONFLICT (topic_id) DO UPDATE
                  SET body_html=EXCLUDED.body_html,
                      learn_widgets=EXCLUDED.learn_widgets,
                      status='published'
            """, (new_id, topic_id, body_html, json.dumps(widgets), '{}'))
        conn.commit()
        return new_id
    finally:
        conn.close()


# ── Widget generation ─────────────────────────────────────────────────────────

WIDGET_SYSTEM_PROMPT = """You are generating interactive widget specs for a digital lesson on a UK school learning app.
Return ONLY valid JSON — either an empty array [] or an array with 1-2 widget objects.
No explanation, no markdown fences, no extra text. Just the JSON array."""

WIDGET_USER_TEMPLATE = """You are generating interactive widget specs for a digital lesson on: {topic_title} ({year_label}, {subject}).

The lesson content is:
{body_html_truncated}

Available widget types:
- drag_label: A diagram where students drag labels to correct positions. Use for: labelling diagrams of cells, plants, shapes, the water cycle, geographical features.
  Config: diagram_type (one of: circle, triangle, plant, animal_cell, water_cycle, right_triangle, volcano, river), items (array of {{id, label, hotspot: {{x, y}}}} where x/y are 0-100 percentage positions)

- sentence_builder: An interactive sentence-building exercise where students tap word tiles into numbered slots to form a grammatically correct sentence. Use for: English grammar topics such as fronted adverbials, conjunctions, punctuation, verb tenses, word classes, and sentence structure.
  Config: title (string), instructions (string), tiles (array of {{id, text, type}} where type is one of: noun, verb, adjective, adverb, conjunction, preposition, punctuation, other), slots (array of {{id, accepts, placeholder}} where accepts is a list of tile ids that are valid for that slot), target_sentence (the complete correct sentence as a string).

Based on the topic and content, decide if a widget would meaningfully enhance learning.
Return ONLY valid JSON — either an empty array [] if no widget is appropriate, or an array with 1-2 widget objects.

Rules:
- Only suggest drag_label for topics where labelling a diagram is genuinely useful
- x/y hotspot positions must be realistic for the diagram type
- Maximum 6 label items per drag_label widget
- Maths geometry topics: use 'circle' or 'triangle' or 'right_triangle' diagram
- Science biology topics: use 'plant' or 'animal_cell' diagram
- Science physics/earth: use 'water_cycle', 'volcano', or 'river'
- Use sentence_builder for English grammar topics (fronted adverbials, conjunctions, punctuation, verb tenses, word classes). Do NOT use it for comprehension or creative writing topics.
- sentence_builder tiles: include every word and punctuation mark in the sentence as a separate tile; add 1-2 plausible distractor tiles to increase challenge. Each slot's accepts list normally has one correct tile id, but may include alternatives where grammatically equivalent words fit.
- abstract Maths and History: return []
- Position: use 'end' (after the lesson text, as a check activity)

Example output for Y3 Science - Plants:
[{{"type":"drag_label","position":"end","config":{{"title":"Label the parts of a plant","instructions":"Tap a label, then tap where it belongs on the diagram.","diagram_type":"plant","items":[{{"id":"roots","label":"Roots","hotspot":{{"x":50,"y":90}}}},{{"id":"stem","label":"Stem","hotspot":{{"x":50,"y":62}}}},{{"id":"leaf","label":"Leaf","hotspot":{{"x":72,"y":48}}}},{{"id":"flower","label":"Flower","hotspot":{{"x":50,"y":18}}}}]}}}}]

Example output for Y3 English - Fronted Adverbials:
[{{"type":"sentence_builder","position":"end","config":{{"title":"Build the sentence","instructions":"Tap a word, then tap a box to place it.","tiles":[{{"id":"t1","text":"Carefully","type":"adverb"}},{{"id":"t2","text":"the","type":"other"}},{{"id":"t3","text":"cat","type":"noun"}},{{"id":"t4","text":"stepped","type":"verb"}},{{"id":"t5","text":"over","type":"preposition"}},{{"id":"t6","text":"puddle","type":"noun"}},{{"id":"t7","text":".","type":"punctuation"}},{{"id":"t8","text":"the","type":"other"}},{{"id":"t9","text":"slowly","type":"adverb"}}],"slots":[{{"id":"s1","accepts":["t1"],"placeholder":"adverb"}},{{"id":"s2","accepts":["t3"],"placeholder":"noun"}},{{"id":"s3","accepts":["t4"],"placeholder":"verb"}},{{"id":"s4","accepts":["t5"],"placeholder":"prep"}},{{"id":"s5","accepts":["t2","t8"],"placeholder":"det"}},{{"id":"s6","accepts":["t6"],"placeholder":"noun"}},{{"id":"s7","accepts":["t7"],"placeholder":"."}}],"target_sentence":"Carefully the cat stepped over the puddle."}}}}]

Example output for Y3 English - Comprehension:
[]"""


def generate_widgets(topic: dict, chunks: list[dict], body_html: str) -> list:
    """Call Claude Haiku to produce widget specs for a topic's learn page.

    Returns a list (possibly empty) of widget dicts. Returns [] on any error.
    """
    import anthropic, json

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    year_label = _label_to_display(topic["year_group_label"])
    subject = topic["subject_name"]
    title = topic["title"]
    body_html_truncated = body_html[:500]

    user_prompt = WIDGET_USER_TEMPLATE.format(
        topic_title=title,
        year_label=year_label,
        subject=subject,
        body_html_truncated=body_html_truncated,
    )

    try:
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=512,
            system=WIDGET_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = response.content[0].text.strip()

        # Strip any accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```", 1)[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.rsplit("```", 1)[0].strip()

        widgets = json.loads(raw)
        if not isinstance(widgets, list):
            log.warning(f"    Widget response was not a list, ignoring: {raw[:100]}")
            return []
        return widgets
    except Exception as exc:
        log.warning(f"    Widget generation failed (returning []): {exc}")
        return []


# ── HTML generation ───────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert UK primary and secondary school teacher writing engaging,
age-appropriate lesson content for a mobile learning app. Your output is a single
self-contained HTML fragment (no <html>/<head>/<body> tags) that will be rendered
inside a styled card. Use only these HTML elements:
  <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>, <hr>

Rules:
- No inline styles or class attributes.
- Keep language simple and motivating. Use 'you' to address the learner.
- Structure: brief intro → 2–4 key concepts → worked example(s) → 'Remember' tip.
- Length: 300–500 words total. Mobile-optimised — no walls of text.
- Do NOT include a title heading (the app adds it). Start with <h2> for the first section.
- Do NOT mention the app, AI, or that this is generated content.
"""

def generate_body_html(topic: dict, chunks: list[dict]) -> str:
    """Call Claude to produce HTML learn content for a topic, grounded in curriculum chunks."""
    import anthropic

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    chunk_text = "\n\n---\n\n".join(
        f"[{c['source_name']}]\n{c['chunk_text']}" for c in chunks
    )

    year_label = _label_to_display(topic["year_group_label"])  # e.g. "Year 3"
    key_stage = topic["key_stage"]                             # e.g. "KS2"
    subject = topic["subject_name"]
    title = topic["title"]

    user_prompt = f"""Write a learn page for:
  Year group: {year_label} ({key_stage})
  Subject: {subject}
  Topic: {title}

Use ONLY the following curriculum source material — do not invent facts:

{chunk_text}

Produce the HTML fragment now. Start with <h2>."""

    response = client.messages.create(
        model=config.CLAUDE_MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    html = response.content[0].text.strip()

    # Basic sanity: must start with <h2
    if not html.startswith("<h2"):
        # Claude sometimes wraps in ```html ... ```, strip it
        if "```html" in html:
            html = html.split("```html", 1)[1].split("```")[0].strip()
        elif "```" in html:
            html = html.split("```", 1)[1].split("```")[0].strip()

    return html


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate learn_content for topics lacking it.")
    parser.add_argument("--year-group", help="Filter to one year group key (e.g. year-3)")
    parser.add_argument("--topic", help="Process only this topic slug")
    parser.add_argument("--dry-run", action="store_true", help="Print HTML, don't insert")
    parser.add_argument("--force", action="store_true",
                        help="Also process topics with <10 published questions (not just gate-pass ones)")
    args = parser.parse_args()

    topics = get_topics_needing_learn_content(
        year_group_label=args.year_group,
        topic_slug=args.topic,
    )

    if not args.force:
        # By default, only do topics that already pass the question gate
        eligible = [t for t in topics if t["published_q_count"] >= 10]
        skipped = [t for t in topics if t["published_q_count"] < 10]
        if skipped:
            log.info(f"Skipping {len(skipped)} topics with <10 published questions "
                     f"(use --force to include them):")
            for t in skipped:
                log.info(f"  {t['slug']} — {t['published_q_count']} published questions")
    else:
        eligible = topics
        skipped = []

    if not eligible:
        log.info("No topics need learn_content. All done!")
        return

    log.info(f"Generating learn_content for {len(eligible)} topics...")

    ok_count = 0
    fail_count = 0

    for topic in eligible:
        slug = topic["slug"] or topic["id"]
        title = topic["title"]
        log.info(f"\n  → {title} ({topic['year_group_label']}, {topic['subject_name']}, "
                 f"pub_q={topic['published_q_count']})")

        chunks = get_curriculum_chunks(topic["subject_name"], topic["year_group_label"])
        if not chunks:
            log.warning(f"    No chunks found for {topic['subject_name']} {topic['year_group_key']}. Skipping.")
            fail_count += 1
            continue

        log.info(f"    Using {len(chunks)} curriculum chunks")

        try:
            html = generate_body_html(topic, chunks)
            widgets = generate_widgets(topic, chunks, html)
            widget_types = [w.get("type") for w in widgets]
            log.info(f"    Widgets: {widget_types if widgets else '(none)'}")

            if args.dry_run:
                print(f"\n{'─'*60}")
                print(f"  DRY RUN: {title}")
                print(f"{'─'*60}")
                print(html[:500] + ("…" if len(html) > 500 else ""))
                print(f"  Widgets: {widgets}")
                ok_count += 1
                continue

            new_id = insert_learn_content(topic["id"], html, widgets)
            log.info(f"    ✓ Inserted learn_content id={new_id}")
            ok_count += 1

            # Auto-promote if this topic now meets the gate
            promoted = db.promote_ready_topics([topic["id"]])
            if promoted:
                print(f"  🌟 Promoted to is_published=true: {promoted[0]['title']}")

        except Exception as exc:
            log.error(f"    ✗ Failed: {exc}", exc_info=True)
            fail_count += 1

    print(f"\n{'='*60}")
    if args.dry_run:
        print(f"  DRY RUN complete — {ok_count} topics would be inserted, {fail_count} failed")
    else:
        print(f"  DONE — {ok_count} topics inserted, {fail_count} failed, {len(skipped)} skipped (q<10)")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    import sys as _sys
    pipeline_dir = Path(__file__).parent.parent / "services" / "content-pipeline"
    _sys.path.insert(0, str(pipeline_dir))
    from pipeline_lock import pipeline_lock, PipelineLockError
    try:
        with pipeline_lock("learn-content"):
            main()
    except PipelineLockError as _e:
        print(_e)
        _sys.exit(1)
