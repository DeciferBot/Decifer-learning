"""
Flag near-duplicate published quiz questions within the same topic.

Uses the same sentence-transformers model as the pipeline (all-MiniLM-L6-v2).
For each pair of published questions in a topic with cosine similarity above
the threshold, keeps the higher-confidence question and flags the other.

Usage (from repo root):
  set -a && source .env.local && set +a
  python scripts/flag-duplicate-questions.py [--dry-run] [--threshold 0.82]
"""

import argparse
import os
import sys
import numpy as np
import psycopg2
import psycopg2.extras
from sentence_transformers import SentenceTransformer

parser = argparse.ArgumentParser()
parser.add_argument('--dry-run', action='store_true')
parser.add_argument('--threshold', type=float, default=0.82)
args = parser.parse_args()

THRESHOLD = args.threshold
DRY_RUN   = args.dry_run

print(f"\nDuplicate question auditor")
print(f"  threshold : {THRESHOLD}")
print(f"  dry-run   : {DRY_RUN}\n")

db_url = os.environ.get('DATABASE_URL') or os.environ.get('DIRECT_URL')
if not db_url:
    print("ERROR: DATABASE_URL or DIRECT_URL must be set")
    sys.exit(1)

conn = psycopg2.connect(db_url)
cur  = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

model = SentenceTransformer('all-MiniLM-L6-v2')

def cosine(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))

# Fetch all topics
cur.execute("""
    SELECT t.id, t.title, s.name as subject_name
    FROM topics t
    JOIN subjects s ON s.id = t.subject_id
    ORDER BY s.name, t.title
""")
topics = cur.fetchall()

total_pairs   = 0
total_flagged = 0

for topic in topics:
    cur.execute("""
        SELECT id, question_text, confidence_score
        FROM quiz_questions
        WHERE topic_id = %s AND status = 'published'
    """, (topic['id'],))
    questions = cur.fetchall()

    if len(questions) < 2:
        continue

    texts = [q['question_text'] or '' for q in questions]
    embeddings = model.encode(texts, normalize_embeddings=True)

    flagged = set()

    for i in range(len(questions)):
        for j in range(i + 1, len(questions)):
            if questions[i]['id'] in flagged or questions[j]['id'] in flagged:
                continue

            sim = cosine(embeddings[i], embeddings[j])
            if sim < THRESHOLD:
                continue

            total_pairs += 1
            qi = questions[i]
            qj = questions[j]
            score_i = float(qi['confidence_score'] or 0)
            score_j = float(qj['confidence_score'] or 0)
            keep   = qi if score_i >= score_j else qj
            to_flag = qj if score_i >= score_j else qi

            print(f"  [{topic['subject_name']}] {topic['title']}")
            print(f"    similarity : {sim:.3f}")
            print(f"    keep  (score={float(keep['confidence_score'] or 0):.1f}) : \"{(keep['question_text'] or '')[:80]}…\"")
            print(f"    flag  (score={float(to_flag['confidence_score'] or 0):.1f}) : \"{(to_flag['question_text'] or '')[:80]}…\"")

            if not DRY_RUN:
                cur.execute(
                    "UPDATE quiz_questions SET status = 'flagged' WHERE id = %s",
                    (to_flag['id'],)
                )
                conn.commit()
                print(f"    ✓ flagged")

            flagged.add(to_flag['id'])
            total_flagged += 1
            print()

conn.close()

verb = "would be" if DRY_RUN else ""
print(f"\nSummary: {total_pairs} duplicate pair(s), {total_flagged} question(s) {verb} flagged.")
if DRY_RUN and total_flagged > 0:
    print("Re-run without --dry-run to apply.")
