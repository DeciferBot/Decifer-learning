"""
Pilot: ingest public sources for ONE topic (KS1 Fractions) and test generation quality.

Steps:
  1. Fetch gov.uk NC Maths + BBC Bitesize KS1 Fractions
  2. Extract relevant text, chunk it
  3. Embed + insert into curriculum_chunks (tagged as pilot)
  4. Generate 5 questions for Fractions topic
  5. Print results for quality review

Run on droplet:
  /root/pipeline-venv/bin/python3 /tmp/test-public-sources.py
"""
import sys, os, re, subprocess, urllib.request, json, textwrap

# ── env ───────────────────────────────────────────────────────────────────────
env_out = subprocess.run(
    ['bash', '-c', 'set -a && source /root/decifer-learning/.env.local && set +a && env'],
    capture_output=True, text=True
).stdout
for line in env_out.splitlines():
    if '=' in line:
        k, _, v = line.partition('=')
        os.environ.setdefault(k, v)
if not os.environ.get('DATABASE_URL') and os.environ.get('DIRECT_URL'):
    os.environ['DATABASE_URL'] = os.environ['DIRECT_URL']

sys.path.insert(0, '/root/decifer-learning/services/content-pipeline')
import db, config
from pipeline import run_one, embed_text
import psycopg2, psycopg2.extras

TOPIC_ID   = 'afc55182-8a5a-4b71-b64a-b96287752051'  # Fractions Y2
SUBJECT    = 'Maths'
YEAR_GROUP = 'year-2'
SOURCE_TAG = 'pilot-public-sources'

# ── 1. Fetch + extract text ───────────────────────────────────────────────────
def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode('utf-8', errors='ignore')

def strip_html(html):
    # Remove scripts, styles, nav
    html = re.sub(r'<(script|style|nav|header|footer)[^>]*>.*?</\1>', ' ', html, flags=re.S|re.I)
    # Strip tags
    text = re.sub(r'<[^>]+>', ' ', html)
    # Collapse whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def extract_fractions_section(text):
    """Pull out paragraphs mentioning fractions/halves/thirds/quarters."""
    paras = [p.strip() for p in re.split(r'\n{2,}', text) if p.strip()]
    keywords = ['fraction', 'half', 'halves', 'third', 'quarter', 'numerator',
                'denominator', 'equal part', '1/2', '1/3', '1/4', '2/4', '3/4']
    relevant = []
    for p in paras:
        pl = p.lower()
        if any(k in pl for k in keywords) and len(p) > 40:
            relevant.append(p)
    return relevant

print("── Step 1: Fetching sources ─────────────────────────────────────────")

print("  Fetching gov.uk NC Maths...")
gov_html = fetch("https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study/national-curriculum-in-england-mathematics-programmes-of-study")
gov_text = strip_html(gov_html)
gov_paras = extract_fractions_section(gov_text)
print(f"  → {len(gov_paras)} relevant paragraphs from gov.uk")

print("  Fetching BBC Bitesize KS1 Fractions...")
bbc_html = fetch("https://www.bbc.co.uk/bitesize/topics/z3rbg82")
bbc_text = strip_html(bbc_html)
bbc_paras = extract_fractions_section(bbc_text)
print(f"  → {len(bbc_paras)} relevant paragraphs from BBC Bitesize")

# Also fetch a couple of BBC article pages for richer content
bbc_articles = [
    "https://www.bbc.co.uk/bitesize/articles/zrjpkmn",  # halves
    "https://www.bbc.co.uk/bitesize/articles/z3f8jfr",  # quarters
]
for url in bbc_articles:
    try:
        html = fetch(url)
        text = strip_html(html)
        paras = extract_fractions_section(text)
        bbc_paras.extend(paras)
        print(f"  → {len(paras)} paragraphs from {url.split('/')[-1]}")
    except Exception as e:
        print(f"  ✗ {url}: {e}")

all_paras = (
    [f"[National Curriculum KS1 Maths] {p}" for p in gov_paras] +
    [f"[BBC Bitesize KS1 Fractions] {p}" for p in bbc_paras]
)
print(f"\n  Total: {len(all_paras)} paragraphs to chunk")

# ── 2. Chunk ──────────────────────────────────────────────────────────────────
print("\n── Step 2: Chunking ─────────────────────────────────────────────────")
CHUNK_SIZE  = 400   # chars
CHUNK_OVERLAP = 80

def chunk_text(text, size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunk = ' '.join(words[i:i+60])   # ~400 chars
        if len(chunk) >= 60:
            chunks.append(chunk)
        i += 50   # overlap
    return chunks

raw_chunks = []
for para in all_paras:
    if len(para) <= CHUNK_SIZE:
        raw_chunks.append(para)
    else:
        raw_chunks.extend(chunk_text(para))

# Deduplicate
seen, chunks = set(), []
for c in raw_chunks:
    key = c[:80]
    if key not in seen and len(c.strip()) > 60:
        seen.add(key)
        chunks.append(c)

print(f"  {len(chunks)} unique chunks ready")
for i, c in enumerate(chunks[:3]):
    print(f"  [{i}] {c[:120]}...")

# ── 3. Embed + insert ─────────────────────────────────────────────────────────
print("\n── Step 3: Embedding + inserting into curriculum_chunks ─────────────")

conn = psycopg2.connect(config.DATABASE_URL)

# Remove previous pilot chunks to keep it clean
with conn.cursor() as cur:
    cur.execute("DELETE FROM curriculum_chunks WHERE source_name = %s", (SOURCE_TAG,))
    conn.commit()
    print(f"  Cleared old pilot chunks")

inserted = 0
for chunk in chunks:
    emb = embed_text(chunk)
    if emb is None:
        continue
    emb_list = emb.tolist()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO curriculum_chunks (subject, year_group, source_name, chunk_text, embedding)
            VALUES (%s, %s, %s, %s, %s::vector)
        """, (SUBJECT, YEAR_GROUP, SOURCE_TAG, chunk, str(emb_list)))
    conn.commit()
    inserted += 1
    if inserted % 5 == 0:
        print(f"  Inserted {inserted}/{len(chunks)}...")

print(f"  ✓ {inserted} chunks embedded and inserted")
conn.close()

# ── 4. Generate 5 questions ───────────────────────────────────────────────────
print("\n── Step 4: Generating 5 questions ───────────────────────────────────")
topic = db.get_topic(TOPIC_ID)
tiers = ['sprout', 'sprout', 'explorer', 'explorer', 'lightning']

results = []
for tier in tiers:
    print(f"  Generating {tier}...")
    result = run_one(topic, tier)
    status = getattr(result, 'status', 'none')
    score  = getattr(result, 'confidence_score', 0)
    results.append((tier, status, score, result))
    print(f"    → {status} (score={score:.1f})")
    for line in getattr(result, 'stage_log', []):
        print(f"      {line}")

# ── 5. Quality report ─────────────────────────────────────────────────────────
print("\n── Step 5: Quality report ───────────────────────────────────────────")
published = [(t,s,sc,r) for t,s,sc,r in results if s == 'published']
staged    = [(t,s,sc,r) for t,s,sc,r in results if s == 'staged']
failed    = [(t,s,sc,r) for t,s,sc,r in results if s not in ('published','staged')]

print(f"  Published : {len(published)}/5")
print(f"  Staged    : {len(staged)}/5")
print(f"  Failed    : {len(failed)}/5")

print("\n  New published questions:")
for tier, status, score, result in published:
    # Fetch the actual question from DB
    conn = psycopg2.connect(config.DATABASE_URL)
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("""
            SELECT question_text, correct_answer, hint_1, hint_2, hint_3, distractors
            FROM quiz_questions
            WHERE topic_id = %s AND status = 'published'
            ORDER BY created_at DESC LIMIT 1
        """, (TOPIC_ID,))
        q = cur.fetchone()
    conn.close()
    if q:
        print(f"\n  [{tier}] score={score:.1f}")
        print(f"  Q: {q['question_text']}")
        print(f"  A: {q['correct_answer']}")
        print(f"  Hint 1: {q['hint_1']}")

print("\n── Done ─────────────────────────────────────────────────────────────")
print("Review the published questions above.")
print("If quality is good, run the full ingestion across all topics.")
