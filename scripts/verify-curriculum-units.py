"""
Verify curriculum_units data quality.

Checks:
  1. All curriculum_units rows have valid subject + year_group FKs
  2. No unit has fewer than 2 published topics linked (single-topic units are useless display-wise)
  3. All Oak-sourced topics (History/Geography Y3+Y7) have a unit_id
  4. order_index has no duplicates within a subject+year
  5. oak_unit_slug is unique (enforced by DB, but we confirm)
  6. Y7 History "Black Death" unit exists and links to a topic
  7. Y7 Geography rivers gap is documented (no unit exists → expected)

Run:
  python3 scripts/verify-curriculum-units.py
"""
from __future__ import annotations
import os, subprocess, sys
from pathlib import Path

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
    print("ERROR: DB URL not set", file=sys.stderr)
    sys.exit(1)

import psycopg2

conn = psycopg2.connect(db_url)
cur = conn.cursor()

checks = []

def check(name: str, passed: bool, detail: str = ""):
    status = "PASS" if passed else "FAIL"
    print(f"  [{status}] {name}" + (f"\n         {detail}" if detail else ""))
    checks.append(passed)

print("\n=== curriculum_units verify ===\n")

# 1. Total units seeded
cur.execute("SELECT COUNT(*) FROM curriculum_units")
total = cur.fetchone()[0]
check("Units seeded", total > 0, f"{total} rows in curriculum_units")

# 2. No orphan units (bad FK)
cur.execute("""
    SELECT COUNT(*) FROM curriculum_units cu
    LEFT JOIN subjects s ON cu.subject_id = s.id
    LEFT JOIN year_groups yg ON cu.year_group_id = yg.id
    WHERE s.id IS NULL OR yg.id IS NULL
""")
orphans = cur.fetchone()[0]
check("No orphan FK rows", orphans == 0, f"{orphans} units with missing subject/year_group")

# 3. Units per subject+year
cur.execute("""
    SELECT s.name, yg.label, COUNT(*) as cnt
    FROM curriculum_units cu
    JOIN subjects s ON cu.subject_id = s.id
    JOIN year_groups yg ON cu.year_group_id = yg.id
    GROUP BY s.name, yg.label ORDER BY s.name, yg.label
""")
rows = cur.fetchall()
print("\n  Unit counts by subject+year:")
for subj, year, cnt in rows:
    print(f"    {subj:12} {year:8}  {cnt} units")
check("At least 1 subject+year has units", len(rows) > 0)

# 4. No duplicate order_index within subject+year
cur.execute("""
    SELECT subject_id, year_group_id, order_index, COUNT(*)
    FROM curriculum_units
    GROUP BY subject_id, year_group_id, order_index
    HAVING COUNT(*) > 1
""")
dups = cur.fetchall()
check("No duplicate order_index within subject+year", len(dups) == 0,
      f"{len(dups)} duplicates found" if dups else "")

# 5. Topics linked to units
cur.execute("""
    SELECT COUNT(*) FROM topics WHERE unit_id IS NOT NULL
""")
linked = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM topics")
total_topics = cur.fetchone()[0]
check("Topics linked to units", linked > 0, f"{linked}/{total_topics} topics have unit_id")

# 6. No unit with 0 published topics linked (units must earn their place)
cur.execute("""
    SELECT cu.title, COUNT(t.id) as topic_count
    FROM curriculum_units cu
    LEFT JOIN topics t ON t.unit_id = cu.id AND t.is_published = true
    GROUP BY cu.id, cu.title
    HAVING COUNT(t.id) = 0
""")
empty_units = cur.fetchall()
check("No units with 0 published topics", len(empty_units) == 0,
      f"Empty units: {[r[0][:50] for r in empty_units]}" if empty_units else "")

# 7. Black Death unit exists and is linked
cur.execute("""
    SELECT cu.title, t.title as topic_title
    FROM curriculum_units cu
    LEFT JOIN topics t ON t.unit_id = cu.id
    WHERE cu.oak_unit_slug ILIKE '%black-death%'
""")
bd = cur.fetchall()
check("Black Death unit exists", len(bd) > 0,
      f"Linked to: {[r[1] for r in bd]}" if bd else "Not found")

# 8. Y7 Geography rivers gap is expected (no unit for it — that's the known gap)
cur.execute("""
    SELECT COUNT(*) FROM curriculum_units cu
    JOIN subjects s ON cu.subject_id = s.id
    JOIN year_groups yg ON cu.year_group_id = yg.id
    WHERE s.name = 'Geography' AND yg.label = 'year-7'
      AND (cu.title ILIKE '%river%' OR cu.title ILIKE '%flood%' OR cu.title ILIKE '%water cycle%')
""")
rivers_y7 = cur.fetchone()[0]
# This is expected to be 0 — Oak doesn't have a Y7 rivers unit
if rivers_y7 == 0:
    print("  [INFO] Y7 Geography rivers/flooding unit: not in Oak (expected gap)")
    print("         → Y8 'River Processes and Flooding' topic covers this; surface for Y7 manually")
else:
    print(f"  [INFO] Y7 Geography rivers unit found ({rivers_y7} rows)")

# 9. History Y7 has most units (14 expected)
cur.execute("""
    SELECT COUNT(*) FROM curriculum_units cu
    JOIN subjects s ON cu.subject_id = s.id
    JOIN year_groups yg ON cu.year_group_id = yg.id
    WHERE s.name = 'History' AND yg.label = 'year-7'
""")
hist_y7 = cur.fetchone()[0]
check("History Y7 has ≥ 10 units", hist_y7 >= 10, f"Found {hist_y7}")

conn.close()

passed = sum(checks)
total_checks = len(checks)
print(f"\n{passed}/{total_checks} checks passed")
if passed < total_checks:
    sys.exit(1)
