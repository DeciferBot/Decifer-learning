"""
Seed curriculum_units from oak-topic-map.json and link topics.

Reads the Oak topic map (scripts/oak-topic-map.json) which maps Oak unit slugs
to our topic slugs. For each entry:
  1. Insert a curriculum_units row (idempotent via ON CONFLICT oak_unit_slug)
  2. UPDATE topics SET unit_id = <unit>.id WHERE slug = <topic_slug>

Run on the DO droplet:
  cd /root/decifer-learning
  python3 scripts/seed-curriculum-units.py
  python3 scripts/seed-curriculum-units.py --dry-run   # preview only
"""
from __future__ import annotations
import argparse, json, os, subprocess, sys, uuid
from collections import defaultdict
from pathlib import Path

# Load env (droplet pattern)
_e = subprocess.run(
    ["bash", "-c", "set -a && source /root/decifer-learning/.env.local && set +a && env"],
    capture_output=True, text=True
).stdout
for line in _e.splitlines():
    if "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k, v)

db_url = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
if not db_url:
    print("ERROR: DIRECT_URL / DATABASE_URL not set", file=sys.stderr)
    sys.exit(1)

import psycopg2, psycopg2.extras

HERE = Path(__file__).parent
MAP_PATH = HERE / "oak-topic-map.json"

def load_map() -> dict:
    with open(MAP_PATH) as f:
        data = json.load(f)
    return data["mappings"]

def fetch_lookup(cur, table, key_col, val_col) -> dict:
    cur.execute(f"SELECT {key_col}, {val_col} FROM {table}")
    return {row[0]: row[1] for row in cur.fetchall()}

def run(dry_run: bool):
    mappings = load_map()

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    subjects  = fetch_lookup(cur, "subjects",    "name",  "id")   # "History" → uuid
    ygs       = fetch_lookup(cur, "year_groups", "label", "id")   # "year-7"  → uuid
    topic_slugs = fetch_lookup(cur, "topics",    "slug",  "id")   # slug → uuid

    # Group by (subject, year) to assign order_index
    by_subj_year: dict[tuple, list] = defaultdict(list)
    for oak_slug, entry in mappings.items():
        key = (entry.get("subject", ""), entry.get("year", ""))
        by_subj_year[key].append((oak_slug, entry))

    inserted = 0
    linked   = 0
    skipped  = 0

    for (subj_name, year_label), units in sorted(by_subj_year.items()):
        subj_id = subjects.get(subj_name)
        yg_id   = ygs.get(year_label)
        if not subj_id or not yg_id:
            print(f"  SKIP — unknown subject '{subj_name}' or year '{year_label}'")
            skipped += len(units)
            continue

        for order_idx, (oak_slug, entry) in enumerate(units):
            unit_title = entry.get("unit_title", oak_slug)
            topic_slug = entry.get("topic_slug", "none")
            confidence = entry.get("confidence", "")
            # Enquiry question lives in the Oak slug itself (after last /)
            description = oak_slug.split("/")[-1].replace("-", " ").capitalize()

            print(f"  {'[DRY] ' if dry_run else ''}unit: {unit_title[:70]}")
            print(f"        → topic_slug: {topic_slug}  (order {order_idx})")

            if dry_run:
                inserted += 1
                continue

            # Upsert curriculum_unit
            cur.execute("""
                INSERT INTO curriculum_units
                    (subject_id, year_group_id, title, description,
                     order_index, oak_unit_slug, oak_confidence)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (oak_unit_slug) DO UPDATE
                    SET title          = EXCLUDED.title,
                        description    = EXCLUDED.description,
                        order_index    = EXCLUDED.order_index,
                        oak_confidence = EXCLUDED.oak_confidence
                RETURNING id
            """, (subj_id, yg_id, unit_title, description,
                  order_idx, oak_slug, confidence))
            unit_id = cur.fetchone()[0]
            inserted += 1

            # Link to topic via curriculum_units.topic_id (many units → one topic)
            if topic_slug and topic_slug != "none":
                topic_id = topic_slugs.get(topic_slug)
                if topic_id:
                    cur.execute(
                        "UPDATE curriculum_units SET topic_id = %s WHERE id = %s AND topic_id IS NULL",
                        (topic_id, unit_id)
                    )
                    if cur.rowcount:
                        linked += 1
                        print(f"        linked to topic id={topic_id}")
                    else:
                        print(f"        topic already linked")
                else:
                    print(f"        WARNING: topic slug '{topic_slug}' not in DB")

    if not dry_run:
        conn.commit()

    conn.close()
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Done: {inserted} units upserted, {linked} topics linked, {skipped} skipped")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
