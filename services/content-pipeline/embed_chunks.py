"""
embed_chunks.py — Compute sentence-transformer embeddings for curriculum_chunks.

Finds all rows with NULL embedding and updates them using all-MiniLM-L6-v2
(384-dim, matches pipeline config). Safe to run multiple times — idempotent.

Usage (on DO droplet):
  /root/pipeline-venv/bin/python3 services/content-pipeline/embed_chunks.py

Or via npm script:
  npm run pipeline:embed-chunks
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

# Load .env.local if present
_env = os.path.join(os.path.dirname(__file__), '..', '..', '.env.local')
if os.path.exists(_env):
    for line in open(_env).readlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, _, v = line.partition('=')
        k = k.strip(); v = v.strip().strip('"').strip("'")
        if k and v:
            os.environ[k] = v

if os.environ.get('DIRECT_URL'):
    os.environ['DATABASE_URL'] = os.environ['DIRECT_URL']

import psycopg2
import psycopg2.extras
import numpy as np
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

print('Loading sentence-transformer model (all-MiniLM-L6-v2)...')
model = SentenceTransformer('all-MiniLM-L6-v2')
print('Model loaded.\n')

conn = psycopg2.connect(os.environ['DATABASE_URL'])
register_vector(conn)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute(
    'SELECT id, chunk_text, subject, year_group '
    'FROM curriculum_chunks WHERE embedding IS NULL '
    'ORDER BY subject, year_group'
)
rows = cur.fetchall()
print(f'Found {len(rows)} chunks with NULL embeddings\n')

if not rows:
    print('Nothing to do.')
else:
    updated = 0
    for row in rows:
        emb = model.encode(row['chunk_text'], convert_to_numpy=True).astype(np.float32)
        with conn.cursor() as w:
            w.execute(
                'UPDATE curriculum_chunks SET embedding=%s WHERE id=%s',
                (emb, row['id'])
            )
        updated += 1
        if updated % 5 == 0:
            conn.commit()
            print(f'  committed {updated}/{len(rows)}  ({row["subject"]}, {row["year_group"]})')

    conn.commit()
    print(f'\nDone. Updated {updated} chunks.')

# Summary
cur.execute(
    'SELECT subject, year_group, COUNT(*) AS total, COUNT(embedding) AS with_emb '
    'FROM curriculum_chunks '
    'GROUP BY subject, year_group '
    'ORDER BY subject, year_group'
)
print('\nEmbedding coverage:')
for r in cur.fetchall():
    d = dict(r)
    status = '✅' if d['total'] == d['with_emb'] else f"⚠  {d['with_emb']}/{d['total']}"
    print(f"  {d['subject']:<14} {d['year_group']:<8}  {status}")

conn.close()
