#!/usr/bin/env python3.11
"""
Seed one Year 3 Maths topic for the Phase 3 gate test.

Seeds "Multiplication Tables" under the Number Jungle zone (Year 3, Maths).
Sets is_published=False — the topic exists for pipeline content generation.
A child cannot see unpublished topics in the app (RLS enforced).

Usage:
  DATABASE_URL='...' python3.11 scripts/seed-topics.py
"""

import os
import sys
import uuid

import psycopg2
import psycopg2.extras


def main():
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        print("❌ DATABASE_URL is not set", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    conn.autocommit = False

    with conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Resolve IDs from seeded reference data
            cur.execute("SELECT id FROM year_groups WHERE label = 'year-3'")
            yg = cur.fetchone()
            if not yg:
                print("❌ year-3 not found — run Phase 2 migrations first", file=sys.stderr)
                sys.exit(1)
            year3_id = yg["id"]

            cur.execute("SELECT id FROM subjects WHERE name = 'Maths'")
            subj = cur.fetchone()
            if not subj:
                print("❌ Maths subject not found", file=sys.stderr)
                sys.exit(1)
            maths_id = subj["id"]

            cur.execute(
                "SELECT id FROM zones WHERE name = 'Number Jungle' AND year_group_id = %s",
                (year3_id,),
            )
            zone = cur.fetchone()
            if not zone:
                print("❌ Number Jungle zone not found", file=sys.stderr)
                sys.exit(1)
            zone_id = zone["id"]

            # Check if already seeded
            cur.execute(
                "SELECT id FROM topics WHERE title = 'Multiplication Tables' AND year_group_id = %s",
                (year3_id,),
            )
            existing = cur.fetchone()
            if existing:
                print(f"✅ Topic already exists: {existing['id']}")
                print(f"TOPIC_ID={existing['id']}")
                return

            topic_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO topics (id, subject_id, year_group_id, zone_id, title, order_index, is_published)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (topic_id, maths_id, year3_id, zone_id, "Multiplication Tables", 1, False),
            )

    print(f"✅ Seeded topic 'Multiplication Tables' (Year 3 Maths)")
    print(f"TOPIC_ID={topic_id}")
    conn.close()


if __name__ == "__main__":
    main()
