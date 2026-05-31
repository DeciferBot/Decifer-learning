"""
Retroactively generate learn_widgets for existing learn_content rows that have
no widgets yet (learn_widgets IS NULL or = '[]').

Run: /root/pipeline-venv/bin/python3 scripts/generate-widgets-retroactive.py

Optional flags:
  --dry-run         Print widgets without writing to DB
  --topic SLUG      Only process one topic (by slug)
  --year-group KEY  Only process one year group (e.g. year-3)
  --limit N         Stop after N rows (default: all)
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

# ── Pipeline stop guard ───────────────────────────────────────────────────────
_STOP_GUARD = Path(__file__).resolve().parent.parent / ".PIPELINE_STOP"
if _STOP_GUARD.exists():
    print("PIPELINE STOP ACTIVE: content generation is disabled")
    sys.exit(0)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("generate-widgets-retroactive")

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

DATABASE_URL = os.environ["DATABASE_URL"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

pipeline_dir = Path(__file__).parent.parent / "services" / "content-pipeline"
sys.path.insert(0, str(pipeline_dir))

# ── DB helpers ────────────────────────────────────────────────────────────────

def _label_to_year_group_key(label: str) -> str:
    return label.lower().replace(" ", "-")


def _label_to_display(label: str) -> str:
    return " ".join(p.capitalize() for p in label.split("-"))


def get_rows_needing_widgets(
    year_group: str | None = None,
    topic_slug: str | None = None,
    limit: int | None = None,
) -> list[dict]:
    """Return learn_content rows with empty widgets, joined with topic/subject/year_group."""
    import psycopg2, psycopg2.extras
    from pgvector.psycopg2 import register_vector

    conn = psycopg2.connect(DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            q = """
                SELECT
                    lc.id AS lc_id,
                    lc.topic_id,
                    lc.body_html,
                    t.title,
                    t.slug,
                    yg.label AS year_group_label,
                    yg.key_stage,
                    s.name AS subject_name
                FROM learn_content lc
                JOIN topics t ON t.id = lc.topic_id
                JOIN year_groups yg ON yg.id = t.year_group_id
                JOIN subjects s ON s.id = t.subject_id
                WHERE lc.status = 'published'
                  AND (lc.learn_widgets IS NULL OR lc.learn_widgets = '[]'::jsonb)
            """
            params: list = []
            if year_group:
                normalised = year_group.lower().replace("-", " ")
                q += " AND LOWER(REPLACE(yg.label, '-', ' ')) = %s"
                params.append(normalised)
            if topic_slug:
                q += " AND t.slug = %s"
                params.append(topic_slug)
            q += " ORDER BY yg.label, s.name, t.title"
            if limit:
                q += f" LIMIT {int(limit)}"
            cur.execute(q, params)
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_curriculum_chunks(subject: str, year_group_label: str, limit: int = 10) -> list[dict]:
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


def update_widgets(lc_id: str, widgets: list) -> None:
    import psycopg2
    from pgvector.psycopg2 import register_vector

    conn = psycopg2.connect(DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE learn_content SET learn_widgets = %s::jsonb WHERE id = %s",
                (json.dumps(widgets), lc_id),
            )
        conn.commit()
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
    """Call Claude Haiku to produce widget specs. Returns [] on error."""
    import anthropic

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
            log.warning(f"    Widget response not a list, ignoring: {raw[:100]}")
            return []
        return widgets
    except Exception as exc:
        log.warning(f"    Widget generation failed (returning []): {exc}")
        return []


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Retroactively generate learn_widgets for published learn_content rows."
    )
    parser.add_argument("--dry-run", action="store_true", help="Print widgets without writing to DB")
    parser.add_argument("--topic", help="Process only this topic slug")
    parser.add_argument("--year-group", help="Filter to one year group (e.g. year-3)")
    parser.add_argument("--limit", type=int, help="Max rows to process")
    args = parser.parse_args()

    rows = get_rows_needing_widgets(
        year_group=args.year_group,
        topic_slug=args.topic,
        limit=args.limit,
    )

    if not rows:
        log.info("No rows need widgets. All done!")
        return

    log.info(f"Processing {len(rows)} learn_content rows...")

    ok_count = 0
    skipped_count = 0
    fail_count = 0

    for row in rows:
        title = row["title"]
        slug = row["slug"] or row["topic_id"]
        log.info(f"\n  → {title} ({row['year_group_label']}, {row['subject_name']})")

        chunks = get_curriculum_chunks(row["subject_name"], row["year_group_label"])
        if not chunks:
            log.warning(f"    No chunks found. Skipping.")
            skipped_count += 1
            continue

        body_html = row["body_html"] or ""
        widgets = generate_widgets(row, chunks, body_html)

        widget_types = [w.get("type") for w in widgets]
        widget_count = len(widgets)

        if args.dry_run:
            print(f"  DRY RUN: {title}")
            print(f"    Widget count: {widget_count}  types: {widget_types}")
            if widgets:
                print(f"    {json.dumps(widgets, indent=2)[:300]}")
            ok_count += 1
            continue

        try:
            update_widgets(row["lc_id"], widgets)
            log.info(f"    Updated — {widget_count} widget(s): {widget_types}")
            ok_count += 1
        except Exception as exc:
            log.error(f"    Failed to update: {exc}", exc_info=True)
            fail_count += 1

    print(f"\n{'='*60}")
    if args.dry_run:
        print(f"  DRY RUN complete — {ok_count} rows would be updated, "
              f"{skipped_count} skipped, {fail_count} errors")
    else:
        print(f"  DONE — {ok_count} rows updated, {skipped_count} skipped (no chunks), "
              f"{fail_count} errors")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
