"""
Seed History and Geography topics + curriculum chunks for KS1, KS2, KS3.

Uses gov.uk National Curriculum statutory programmes of study (OGL v3).
Fetches pages directly — no Oak API key needed.

Run: /root/pipeline-venv/bin/python3 scripts/seed-history-geography.py
"""
from __future__ import annotations
import subprocess, os, sys, re, uuid, json
import urllib.request
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
from pipeline import embed_text
import psycopg2, psycopg2.extras

conn = psycopg2.connect(config.DATABASE_URL)
conn.autocommit = False

def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")

def fetch_text(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode("utf-8", errors="ignore")
        html = re.sub(r"<(script|style|nav|header|footer)[^>]*>.*?</\1>", " ", html, flags=re.S|re.I)
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()
    except Exception as e:
        print(f"  ✗ {url}: {e}")
        return ""

# ── Fetch curriculum content ──────────────────────────────────────────────────
SOURCES = {
    "History": [
        "https://www.gov.uk/government/publications/national-curriculum-in-england-history-programmes-of-study/national-curriculum-in-england-history-programmes-of-study",
    ],
    "Geography": [
        "https://www.gov.uk/government/publications/national-curriculum-in-england-geography-programmes-of-study/national-curriculum-in-england-geography-programmes-of-study",
    ],
}

# ── Topics from NC map ────────────────────────────────────────────────────────
HISTORY_TOPICS = {
    "year-1": [
        "Changes Within Living Memory",
        "Events Beyond Living Memory: National Significance",
        "Significant Individuals in the Past",
        "Local History: Significant Events and Places",
    ],
    "year-2": [
        "Changes Within Living Memory",
        "Events Beyond Living Memory: National Significance",
        "Significant Individuals in the Past",
        "Local History: Significant Events and Places",
    ],
    "year-3": [
        "Stone Age to Iron Age Britain",
        "The Roman Empire and Its Impact on Britain",
        "Anglo-Saxon Settlement and the Kingdoms of England",
        "Ancient Civilisations: Egypt and the Indus Valley",
    ],
    "year-4": [
        "Viking and Anglo-Saxon Struggle for England",
        "Ancient Greece: Life and Achievements",
        "Non-European Societies: Early Islamic Civilisation",
        "A British History Theme Beyond 1066",
    ],
    "year-5": [
        "Non-European Societies: Maya Civilisation",
        "Non-European Societies: Benin",
        "Local History Study",
        "A British History Theme Beyond 1066",
    ],
    "year-6": [
        "Stone Age to Iron Age Britain",
        "Roman Britain",
        "Anglo-Saxons and Vikings",
        "Ancient Greece",
    ],
    "year-7": [
        "Medieval Britain 1066–1509: Church, State and Society",
        "Early Modern Britain 1509–1745: Reformation and Revolution",
        "Britain 1745–1901: Industry, Empire and Reform",
        "Britain and the World 1901 to Present Day",
        "Thematic Study in British History",
        "World History: A Significant Society or Issue",
    ],
    "year-8": [
        "Medieval Britain: Power and People",
        "The Renaissance and Reformation",
        "Empire, Slavery and Abolition",
        "Industrial Revolution and Social Change",
        "World War One: Causes and Consequences",
        "Rise of Dictatorships in the 20th Century",
    ],
    "year-9": [
        "World War Two: Causes and Legacy",
        "The Holocaust: History and Memory",
        "Cold War and Decolonisation",
        "Britain Since 1945: Society and Politics",
        "Civil Rights Movements",
        "Contemporary World Issues",
    ],
}

GEOGRAPHY_TOPICS = {
    "year-1": [
        "Maps and Atlases: World Continents and Oceans",
        "UK: Countries, Capital Cities and Seas",
        "Comparing Localities: Physical and Human Features",
        "Seasonal and Daily Weather Patterns",
    ],
    "year-2": [
        "Maps and Atlases: World Continents and Oceans",
        "UK: Countries, Capital Cities and Seas",
        "Comparing Localities: UK and Non-European Country",
        "Physical and Human Geography: Hot and Cold Places",
    ],
    "year-3": [
        "Rocks, Soils and Volcanoes",
        "Rivers and the Water Cycle",
        "Settlements and Land Use",
        "Trade and the Global Economy",
    ],
    "year-4": [
        "Earthquakes and Plate Tectonics",
        "Climate Zones and Biomes",
        "Rivers: Features and Processes",
        "Human Geography: Population and Migration",
    ],
    "year-5": [
        "Mountains and Mountain Ranges",
        "Trade Links and Globalisation",
        "Environmental Issues and Sustainability",
        "Coasts: Features and Processes",
    ],
    "year-6": [
        "North America: Physical and Human Geography",
        "South America: Physical and Human Geography",
        "Fieldwork and Geographical Skills",
        "Environmental Change and Human Impact",
    ],
    "year-7": [
        "Globalisation and Development",
        "Plate Tectonics: Earthquakes and Volcanoes",
        "Coastal Processes and Management",
        "Weather, Climate and Climate Change",
        "Population and Urbanisation",
        "Ecosystems and Biodiversity",
    ],
    "year-8": [
        "Resource Management: Water, Food and Energy",
        "River Processes and Flooding",
        "Economic Development and Inequality",
        "Migration and Cultural Diversity",
        "Natural Hazards: Tropical Storms and Drought",
        "The Geography of Crime and Place",
    ],
    "year-9": [
        "Climate Change: Causes, Evidence and Solutions",
        "Geopolitics and Global Issues",
        "Cold Environments: Tundra and Ice",
        "Urban Issues and Planning",
        "Tourism: Benefits and Environmental Impact",
        "Fieldwork Investigation",
    ],
}

# ── Fetch and chunk curriculum text ──────────────────────────────────────────
print("── Fetching curriculum sources ───────────────────────────────────────")
subject_texts = {}
for subject, urls in SOURCES.items():
    print(f"\n  {subject}:")
    all_text = []
    for url in urls:
        print(f"    Fetching {url[:60]}...")
        text = fetch_text(url)
        if text:
            all_text.append(f"[{subject} National Curriculum]\n{text[:8000]}")
            print(f"    → {len(text)} chars")
    subject_texts[subject] = "\n\n".join(all_text)

def chunk_text(text, size=400, overlap=50):
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i+size])
        if len(chunk) >= 100:
            chunks.append(chunk)
        i += size - overlap
    return chunks

# ── Get subject IDs and year group IDs ───────────────────────────────────────
with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
    cur.execute("SELECT id, name FROM subjects")
    sub_map = {r["name"]: r["id"] for r in cur.fetchall()}
    cur.execute("SELECT id, label FROM year_groups")
    yg_map = {r["label"]: r["id"] for r in cur.fetchall()}

print("\n\nSubjects:", list(sub_map.keys()))
print("Year groups:", list(yg_map.keys()))

# Create History and Geography subjects if not present
for subject_name in ["History", "Geography"]:
    if subject_name not in sub_map:
        with conn.cursor() as cur:
            sid = str(uuid.uuid4())
            colour = "#F59E0B" if subject_name == "History" else "#10B981"
            cur.execute(
                "INSERT INTO subjects (id, name, colour_token) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING RETURNING id",
                (sid, subject_name, colour)
            )
            row = cur.fetchone()
            if row:
                sub_map[subject_name] = row[0]
                print(f"  ✓ Created subject: {subject_name}")
            else:
                cur.execute("SELECT id FROM subjects WHERE name=%s", (subject_name,))
                sub_map[subject_name] = cur.fetchone()[0]
        conn.commit()

# ── Embed and insert curriculum chunks ────────────────────────────────────────
print("\n── Embedding curriculum chunks ───────────────────────────────────────")
all_topics_data = {"History": HISTORY_TOPICS, "Geography": GEOGRAPHY_TOPICS}

for subject_name, raw_text in subject_texts.items():
    chunks = chunk_text(raw_text)
    print(f"\n  {subject_name}: {len(chunks)} chunks")

    # Insert chunks for all year groups
    ygs = list(HISTORY_TOPICS.keys()) if subject_name == "History" else list(GEOGRAPHY_TOPICS.keys())
    for yg_label in ygs:
        yg_id = yg_map.get(yg_label)
        if not yg_id:
            continue
        # Check if already have chunks
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM curriculum_chunks WHERE subject=%s AND year_group=%s AND source_name LIKE %s",
                (subject_name, yg_label, f"%{subject_name}%")
            )
            existing = cur.fetchone()[0]
        if existing > 5:
            print(f"    {yg_label}: {existing} chunks already exist — skipping")
            continue

        inserted = 0
        for chunk in chunks[:60]:  # cap at 60 chunks per year group
            emb = embed_text(chunk)
            if emb is None:
                continue
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO curriculum_chunks (id, subject, year_group, source_name, chunk_text, embedding)
                       VALUES (%s, %s, %s, %s, %s, %s::vector)""",
                    (str(uuid.uuid4()), subject_name, yg_label,
                     f"{subject_name} NC (gov.uk OGL)", chunk, str(emb.tolist()))
                )
            inserted += 1
        conn.commit()
        print(f"    {yg_label}: inserted {inserted} chunks")

# ── Seed zones and topics ─────────────────────────────────────────────────────
print("\n── Seeding zones and topics ──────────────────────────────────────────")

ZONE_THEMES = {
    "History": {
        "year-1": ("Story Steps", "steps"),
        "year-2": ("Memory Lane", "lane"),
        "year-3": ("Ancient Arenas", "arena"),
        "year-4": ("Civilisation Crossroads", "crossroads"),
        "year-5": ("Empire Explorer", "explorer"),
        "year-6": ("History Hall", "hall"),
        "year-7": ("Chronicle Castle", "castle"),
        "year-8": ("Revolution Road", "road"),
        "year-9": ("Modern Maze", "maze"),
    },
    "Geography": {
        "year-1": ("Atlas Adventure", "adventure"),
        "year-2": ("Map Makers", "map"),
        "year-3": ("Earth Explorers", "earth"),
        "year-4": ("Planet Patrol", "planet"),
        "year-5": ("World Wonders", "world"),
        "year-6": ("Global Gateway", "gateway"),
        "year-7": ("Geo Frontiers", "frontiers"),
        "year-8": ("Resource Realm", "realm"),
        "year-9": ("Climate Chronicles", "chronicles"),
    },
}

inserted_topics = 0
inserted_zones = 0

for subject_name, year_topics in all_topics_data.items():
    subject_id = sub_map.get(subject_name)
    if not subject_id:
        print(f"  ✗ No subject_id for {subject_name}")
        continue

    for yg_label, topic_titles in year_topics.items():
        yg_id = yg_map.get(yg_label)
        if not yg_id:
            print(f"  ✗ No year_group_id for {yg_label}")
            continue

        zone_name, zone_theme = ZONE_THEMES[subject_name][yg_label]

        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
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
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("SELECT id FROM topics WHERE slug=%s", (topic_slug,))
                existing = cur.fetchone()
                if existing:
                    prev_topic_id = existing["id"]
                    continue
                topic_id = str(uuid.uuid4())
                cur.execute(
                    """INSERT INTO topics (id, subject_id, year_group_id, title, slug, order_index, is_published, zone_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                    (topic_id, subject_id, yg_id, title, topic_slug, order_idx, False, zone_id)
                )
                node_id = str(uuid.uuid4())
                x = 10.0 + (order_idx % 3) * 30.0
                y = 10.0 + (order_idx // 3) * 35.0
                cur.execute(
                    """INSERT INTO world_map_nodes (id, zone_id, topic_id, x_pos, y_pos, unlocked_by_topic_id)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (node_id, zone_id, topic_id, x, y, prev_topic_id)
                )
                inserted_topics += 1
                prev_topic_id = topic_id
        conn.commit()

print(f"\n── Summary ──────────────────────────────────────────────────────────")
print(f"  Topics inserted : {inserted_topics}")
print(f"  Zones created   : {inserted_zones}")
print(f"  Done. Run the autopilot queue builder next to generate content.")
