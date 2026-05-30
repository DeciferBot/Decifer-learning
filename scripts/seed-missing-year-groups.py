"""
Seed topics and extend curriculum chunks for Y1, Y4, Y5, Y8, Y9.

Strategy:
- Topics: insert from NC map for Maths, English, Science
- Chunks: copy existing chunks to new year_group labels so the pipeline
  can retrieve them (Y1←year-2, Y4/Y5←year-3+year-6, Y8/Y9←year-7)
- Zones: create world-map zones for each new year group
- Worlds nodes: wire topics to zones sequentially

Run: /root/pipeline-venv/bin/python3 scripts/seed-missing-year-groups.py
"""

from __future__ import annotations
import subprocess, os, sys, json, uuid, re
from pathlib import Path

_STOP = Path(__file__).resolve().parent.parent / ".PIPELINE_STOP"
if _STOP.exists():
    print("PIPELINE STOP ACTIVE"); sys.exit(0)

env_out = subprocess.run(
    ["bash", "-c", "set -a && source /root/decifer-learning/.env.local && set +a && env"],
    capture_output=True, text=True
).stdout
for line in env_out.splitlines():
    if "=" in line: k, _, v = line.partition("="); os.environ.setdefault(k, v)
if not os.environ.get("DATABASE_URL") and os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

sys.path.insert(0, "/root/decifer-learning/services/content-pipeline")
import config
import psycopg2, psycopg2.extras

conn = psycopg2.connect(config.DATABASE_URL)
conn.autocommit = False

def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")

# ── Fetch existing year_groups and subjects ───────────────────────────────────
with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
    cur.execute("SELECT id, label FROM year_groups")
    yg_map = {r["label"]: r["id"] for r in cur.fetchall()}
    cur.execute("SELECT id, name FROM subjects")
    sub_map = {r["name"]: r["id"] for r in cur.fetchall()}

print("Year groups:", list(yg_map.keys()))
print("Subjects:", list(sub_map.keys()))

# ── Year group definitions to add ─────────────────────────────────────────────
NEW_YEAR_GROUPS = [
    {"label": "year-1", "key_stage": "KS1"},
    {"label": "year-4", "key_stage": "KS2"},
    {"label": "year-5", "key_stage": "KS2"},
    {"label": "year-8", "key_stage": "KS3"},
    {"label": "year-9", "key_stage": "KS3"},
]

# ── Topics per year group ─────────────────────────────────────────────────────
TOPICS = {
    "year-1": {
        "Maths": [
            "Number and Place Value",
            "Addition and Subtraction",
            "Multiplication and Division",
            "Fractions",
            "Measurement",
            "Geometry: Properties of Shapes",
            "Geometry: Position and Direction",
        ],
        "English": [
            "Phonics: Grapheme-Phoneme Correspondences",
            "Reading Comprehension: Stories and Poetry",
            "Spelling: Phoneme Segmentation",
            "Writing Composition: Sentences and Narratives",
            "Grammar: Capitals, Full Stops and Question Marks",
        ],
        "Science": [
            "Plants",
            "Animals Including Humans",
            "Everyday Materials",
            "Seasonal Changes",
        ],
    },
    "year-4": {
        "Maths": [
            "Number and Place Value",
            "Addition and Subtraction",
            "Multiplication and Division",
            "Fractions and Decimals",
            "Measurement",
            "Geometry: Properties of Shapes",
            "Geometry: Position and Direction",
            "Statistics",
        ],
        "English": [
            "Reading: Comparisons Within and Across Texts",
            "Reading: Language, Structure and Presentation",
            "Spelling: Further Prefixes and Suffixes",
            "Spelling: Possessive Apostrophes",
            "Writing Composition: Settings, Characters and Plot",
            "Grammar: Noun Phrases and Determiners",
            "Grammar: Standard and Non-Standard English",
            "Grammar: Pronoun Choice for Cohesion",
        ],
        "Science": [
            "Living Things and Their Habitats",
            "Animals Including Humans: Digestion",
            "States of Matter",
            "Sound",
            "Electricity",
        ],
    },
    "year-5": {
        "Maths": [
            "Number and Place Value",
            "Addition and Subtraction",
            "Multiplication and Division",
            "Fractions, Decimals and Percentages",
            "Measurement",
            "Geometry: Properties of Shapes",
            "Geometry: Position and Direction",
            "Statistics",
        ],
        "English": [
            "Reading: Figurative Language and Authorial Choices",
            "Reading: Summarising and Retrieving Information",
            "Spelling: Silent Letters and Etymology",
            "Spelling: Homophones and Commonly Confused Words",
            "Writing Composition: Cohesion Within and Across Paragraphs",
            "Grammar: Relative Clauses",
            "Grammar: Modal Verbs and Adverbs for Possibility",
            "Grammar: Parenthesis — Brackets, Dashes, Commas",
        ],
        "Science": [
            "Living Things and Their Habitats",
            "Animals Including Humans: Human Lifecycle",
            "Properties and Changes of Materials",
            "Earth and Space",
            "Forces",
        ],
    },
    "year-8": {
        "Maths": [
            "Number: Fractions, Decimals and Percentages",
            "Number: Standard Form and Indices",
            "Algebra: Expanding and Factorising",
            "Algebra: Solving Equations and Inequalities",
            "Algebra: Graphs and Coordinates",
            "Geometry: Pythagoras' Theorem",
            "Geometry: Transformations",
            "Probability and Statistics",
            "Ratio and Proportion",
        ],
        "English": [
            "Reading: Shakespeare — Play Study",
            "Reading: 19th-Century Fiction",
            "Reading: Language and Structural Analysis",
            "Writing: Formal Expository Essays",
            "Writing: Narrative and Imaginative Writing",
            "Writing: Persuasive Arguments",
            "Grammar: Register — Formal vs Informal",
            "Grammar: Standard English and Language Variation",
        ],
        "Science": [
            "Cells: Structure and Function",
            "Nutrition and Digestion",
            "Gas Exchange and Respiration",
            "Atoms, Elements and Compounds",
            "Chemical Reactions",
            "The Periodic Table",
            "Energy: Stores and Transfers",
            "Forces and Motion",
            "Waves: Sound and Light",
        ],
    },
    "year-9": {
        "Maths": [
            "Number: Surds and Exact Values",
            "Algebra: Quadratics and Simultaneous Equations",
            "Algebra: Functions and Sequences",
            "Geometry: Circle Theorems",
            "Geometry: Trigonometry",
            "Probability: Combined Events",
            "Statistics: Interpreting Data",
            "Vectors",
            "Rates of Change",
        ],
        "English": [
            "Reading: Seminal World Literature",
            "Reading: 19th-Century Poetry",
            "Reading: Comparing Texts and Authors",
            "Writing: Planning, Drafting and Editing",
            "Writing: Formal Essays and Reports",
            "Writing: Narrative Craft",
            "Spoken English: Presentations and Debates",
            "Grammar: Complex Sentence Structures",
        ],
        "Science": [
            "Reproduction and Genetics",
            "Inheritance, DNA and Evolution",
            "Ecosystems and Biodiversity",
            "Pure and Impure Substances",
            "Earth and Atmosphere",
            "Electricity: Current and Static",
            "Magnetism and Electromagnetism",
            "Space Physics",
            "Pressure in Fluids",
        ],
    },
}

# ── Zone themes per year group ─────────────────────────────────────────────────
ZONE_THEMES = {
    "year-1": {
        "Maths":   ("Counting Castle",   "castle"),
        "English": ("Story Garden",       "garden"),
        "Science": ("Wonder Woods",       "forest"),
    },
    "year-4": {
        "Maths":   ("Number Fortress",   "fortress"),
        "English": ("Readers' Realm",    "library"),
        "Science": ("Explorer's Lab",    "laboratory"),
    },
    "year-5": {
        "Maths":   ("Decimal Desert",    "desert"),
        "English": ("Writer's Workshop", "workshop"),
        "Science": ("Space Station",     "space"),
    },
    "year-8": {
        "Maths":   ("Algebra Archipelago", "archipelago"),
        "English": ("Literature Labyrinth","labyrinth"),
        "Science": ("Science Citadel",     "citadel"),
    },
    "year-9": {
        "Maths":   ("Summit of Calculus", "mountain"),
        "English": ("Scholar's Tower",    "tower"),
        "Science": ("Research Reactor",   "reactor"),
    },
}

# ── Chunk source mapping (which existing year_group chunks to copy from) ───────
CHUNK_SOURCE = {
    "year-1": ["year-2"],
    "year-4": ["year-3", "year-6"],
    "year-5": ["year-3", "year-6"],
    "year-8": ["year-7"],
    "year-9": ["year-7"],
}

inserted_topics = 0
inserted_zones = 0
copied_chunks = 0

with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:

    # ── 1. Upsert year groups ─────────────────────────────────────────────────
    for yg in NEW_YEAR_GROUPS:
        if yg["label"] in yg_map:
            print(f"  Year group {yg['label']} already exists — skipping")
            continue
        yg_id = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO year_groups (id, label, key_stage) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING RETURNING id",
            (yg_id, yg["label"], yg["key_stage"])
        )
        row = cur.fetchone()
        if row:
            yg_map[yg["label"]] = row["id"]
            print(f"  ✓ Created year group {yg['label']}")
        else:
            cur.execute("SELECT id FROM year_groups WHERE label=%s", (yg["label"],))
            yg_map[yg["label"]] = cur.fetchone()["id"]

    conn.commit()

    # ── 2. Create zones + topics ───────────────────────────────────────────────
    for yg_label, subjects in TOPICS.items():
        yg_id = yg_map.get(yg_label)
        if not yg_id:
            print(f"  ✗ No year_group id for {yg_label}")
            continue

        for subject_name, topic_titles in subjects.items():
            subject_id = sub_map.get(subject_name)
            if not subject_id:
                print(f"  ✗ No subject id for {subject_name}")
                continue

            zone_name, zone_theme = ZONE_THEMES[yg_label][subject_name]

            # Check/create zone
            cur.execute(
                "SELECT id FROM zones WHERE year_group_id=%s AND subject_id=%s",
                (yg_id, subject_id)
            )
            zone_row = cur.fetchone()
            if zone_row:
                zone_id = zone_row["id"]
            else:
                zone_id = str(uuid.uuid4())
                cur.execute(
                    "INSERT INTO zones (id, year_group_id, subject_id, name, theme) VALUES (%s, %s, %s, %s, %s)",
                    (zone_id, yg_id, subject_id, zone_name, zone_theme)
                )
                inserted_zones += 1
                print(f"  ✓ Zone: {zone_name} ({yg_label}/{subject_name})")

            prev_topic_id = None
            for order_idx, title in enumerate(topic_titles):
                topic_slug = f"{yg_label}-{slug(subject_name)}-{slug(title)}"[:80]

                cur.execute("SELECT id FROM topics WHERE slug=%s", (topic_slug,))
                existing = cur.fetchone()
                if existing:
                    topic_id = existing["id"]
                else:
                    topic_id = str(uuid.uuid4())
                    cur.execute(
                        """INSERT INTO topics (id, subject_id, year_group_id, title, slug, order_index, is_published, zone_id)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                        (topic_id, subject_id, yg_id, title, topic_slug, order_idx, False, zone_id)
                    )
                    inserted_topics += 1

                    # World map node
                    node_id = str(uuid.uuid4())
                    x = 10.0 + (order_idx % 4) * 25.0
                    y = 10.0 + (order_idx // 4) * 30.0
                    cur.execute(
                        """INSERT INTO world_map_nodes (id, zone_id, topic_id, x_pos, y_pos, unlocked_by_topic_id)
                           VALUES (%s, %s, %s, %s, %s, %s)""",
                        (node_id, zone_id, topic_id, x, y, prev_topic_id)
                    )

                prev_topic_id = topic_id

    conn.commit()
    print(f"\n  ✓ {inserted_topics} topics inserted, {inserted_zones} zones created")

    # ── 3. Copy curriculum chunks to new year group labels ────────────────────
    print("\n── Copying curriculum chunks ─────────────────────────────────────────")
    for target_yg, source_ygs in CHUNK_SOURCE.items():
        for source_yg in source_ygs:
            # Check if already copied
            cur.execute(
                "SELECT COUNT(*) FROM curriculum_chunks WHERE year_group=%s",
                (target_yg,)
            )
            existing_count = cur.fetchone()[0]
            if existing_count > 50:
                print(f"  {target_yg} already has {existing_count} chunks — skipping copy from {source_yg}")
                continue

            cur.execute(
                "SELECT COUNT(*) FROM curriculum_chunks WHERE year_group=%s",
                (source_yg,)
            )
            source_count = cur.fetchone()[0]
            print(f"  Copying {source_count} chunks from {source_yg} → {target_yg}...")

            cur.execute(
                """INSERT INTO curriculum_chunks (id, subject, year_group, source_name, chunk_text, embedding)
                   SELECT gen_random_uuid(), subject, %s, source_name || ' [adapted for ' || %s || ']', chunk_text, embedding
                   FROM curriculum_chunks WHERE year_group=%s""",
                (target_yg, target_yg, source_yg)
            )
            n = cur.rowcount
            copied_chunks += n
            print(f"  ✓ Copied {n} chunks → {target_yg}")
            conn.commit()

print(f"\n── Summary ──────────────────────────────────────────────────────────────")
print(f"  Topics inserted : {inserted_topics}")
print(f"  Zones created   : {inserted_zones}")
print(f"  Chunks copied   : {copied_chunks}")
print(f"  Done.")
