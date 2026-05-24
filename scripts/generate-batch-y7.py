"""
Full batch generation for Year 7 English + Science.

Targets 8 English + 8 Science topics, all 3 tiers (sprout/explorer/lightning),
15 questions per topic per tier.

Prerequisites (must run first):
  npx tsx --env-file=.env.local scripts/seed-topics-english-y7.ts
  npx tsx --env-file=.env.local scripts/seed-topics-science-y7.ts
  npx tsx --env-file=.env.local scripts/seed-chunks-english-y7.ts
  npx tsx --env-file=.env.local scripts/seed-chunks-science-y7.ts
  python3 /tmp/embed_chunks.py   (on DO droplet, to compute embeddings for new chunks)

Run: /root/pipeline-venv/bin/python3 scripts/generate-batch-y7.py
"""

import os
import sys
import time
import logging
from pathlib import Path
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("generate-batch-y7")

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

pipeline_dir = Path(__file__).parent.parent / "services" / "content-pipeline"
sys.path.insert(0, str(pipeline_dir))

import config
log.info(f"Pipeline {config.PIPELINE_VERSION} | model: {config.CLAUDE_MODEL} | embeddings: {config.EMBEDDINGS_ENABLED}")
import db
import pipeline as pl

Y7_ENGLISH_TOPICS = [
    "y7-english-grammar-sentence-types",
    "y7-english-grammar-punctuation-effect",
    "y7-english-grammar-standard-english",
    "y7-english-vocabulary-word-families",
    "y7-english-reading-inference",
    "y7-english-reading-language-analysis",
    "y7-english-writing-persuasive",
    "y7-english-literature-character",
]

Y7_SCIENCE_TOPICS = [
    "y7-science-cells-structure",
    "y7-science-reproduction",
    "y7-science-ecosystems-food-chains",
    "y7-science-particles-states-of-matter",
    "y7-science-elements-compounds-mixtures",
    "y7-science-forces-motion",
    "y7-science-energy-stores-transfers",
    "y7-science-space-solar-system",
]

TIERS = ["sprout", "explorer", "lightning"]
QUESTIONS_PER_BATCH = 15


def get_topic_by_slug(slug):
    import psycopg2, psycopg2.extras
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(config.DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT t.id, t.title, t.slug, t.is_published,
                       yg.label AS year_group_label, yg.key_stage,
                       s.name AS subject_name
                FROM topics t
                JOIN year_groups yg ON yg.id = t.year_group_id
                JOIN subjects s ON s.id = t.subject_id
                WHERE t.slug = %s
            """, (slug,))
            row = cur.fetchone()
    finally:
        conn.close()
    return dict(row) if row else None


def check_publish_gate(topic_id):
    import psycopg2, psycopg2.extras
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(config.DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT COUNT(*) AS n FROM quiz_questions WHERE topic_id=%s AND status='published'", (topic_id,))
            pub_q = cur.fetchone()["n"]
            cur.execute("SELECT COUNT(*) AS n FROM learn_content WHERE topic_id=%s AND status='published'", (topic_id,))
            pub_lc = cur.fetchone()["n"]
    finally:
        conn.close()
    return {"published_questions": pub_q, "published_learn_content": pub_lc, "gate_passes": pub_q >= 10 and pub_lc >= 1}


def run_topic_tier(topic, tier, count):
    run_id = db.create_pipeline_run(
        run_type="batch_y7_full",
        year_group=topic["year_group_label"],
        subject=topic["subject_name"],
        topic_id=str(topic["id"]),
        tier=tier,
    )
    try:
        results = pl.run_for_topic(str(topic["id"]), tier, count, pipeline_run_id=run_id)
        counts = {"published": 0, "staged": 0, "regenerating": 0, "failed": 0}
        for r in results:
            counts[r.status] = counts.get(r.status, 0) + 1
        db.complete_pipeline_run(run_id=run_id, items_attempted=count,
            items_published=counts["published"], items_staged=counts["staged"],
            items_failed=counts["failed"] + counts["regenerating"], error_log=[], success=True)
        return {"run_id": run_id, "counts": counts, "ok": True}
    except Exception as exc:
        log.error(f"Pipeline error on {topic['slug']} / {tier}: {exc}", exc_info=True)
        db.complete_pipeline_run(run_id=run_id, items_attempted=count,
            items_published=0, items_staged=0, items_failed=count, error_log=[str(exc)], success=False)
        return {"run_id": run_id, "error": str(exc), "ok": False}


def main():
    all_slugs = Y7_ENGLISH_TOPICS + Y7_SCIENCE_TOPICS
    print(f"\n{'='*72}")
    print(f"  Y7 Full Batch Generation — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Topics: {len(all_slugs)} | Tiers: {len(TIERS)} | Per batch: {QUESTIONS_PER_BATCH}")
    print(f"  Total attempts: {len(all_slugs) * len(TIERS) * QUESTIONS_PER_BATCH}")
    print(f"{'='*72}\n")

    topics = {}
    missing = []
    for slug in all_slugs:
        t = get_topic_by_slug(slug)
        if t:
            topics[slug] = t
        else:
            missing.append(slug)

    if missing:
        log.error(f"Missing topics (not seeded): {missing}")
        log.error("Run the seed-topics-english-y7.ts and seed-topics-science-y7.ts scripts first.")
        sys.exit(1)

    log.info(f"All {len(topics)} topics verified in DB ✓")

    # Check that Y7 chunks have embeddings
    import psycopg2
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(config.DATABASE_URL)
    register_vector(conn)
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM curriculum_chunks WHERE year_group='year-7' AND embedding IS NULL")
        null_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM curriculum_chunks WHERE year_group='year-7'")
        total_count = cur.fetchone()[0]
    conn.close()

    if total_count == 0:
        log.error("No Y7 curriculum_chunks found. Run seed-chunks-english-y7.ts and seed-chunks-science-y7.ts first.")
        sys.exit(1)
    if null_count > 0:
        log.error(f"{null_count}/{total_count} Y7 chunks have NULL embeddings. Run embed_chunks.py first.")
        sys.exit(1)
    log.info(f"Y7 chunks: {total_count} total, all have embeddings ✓")

    grand_total = {"attempted": 0, "published": 0, "staged": 0, "failed": 0}
    topic_summaries = []
    start_time = time.time()

    for slug in all_slugs:
        topic = topics[slug]
        topic_pub = topic_staged = topic_failed = 0

        print(f"\n{'─'*60}")
        print(f"  {topic['title']} ({topic['subject_name']}, {topic['year_group_label']})")
        print(f"{'─'*60}")

        for tier in TIERS:
            result = run_topic_tier(topic, tier, QUESTIONS_PER_BATCH)
            grand_total["attempted"] += QUESTIONS_PER_BATCH
            if result["ok"]:
                c = result["counts"]
                topic_pub += c["published"]; topic_staged += c["staged"]
                topic_failed += c["failed"] + c["regenerating"]
                grand_total["published"] += c["published"]
                grand_total["staged"] += c["staged"]
                grand_total["failed"] += c["failed"] + c["regenerating"]
                log.info(f"  [{tier:9s}] published={c['published']:2d} staged={c['staged']:2d} "
                         f"failed={c['failed']+c['regenerating']:2d}  run={result['run_id']}")
            else:
                grand_total["failed"] += QUESTIONS_PER_BATCH; topic_failed += QUESTIONS_PER_BATCH
                log.error(f"  [{tier:9s}] ERROR: {result['error']}")

        gate = check_publish_gate(str(topic["id"]))
        gate_str = "✅ PASS" if gate["gate_passes"] else f"🔒 HOLD (q={gate['published_questions']}/10, lc={gate['published_learn_content']}/1)"
        print(f"  Subtotal: pub={topic_pub} staged={topic_staged} failed={topic_failed} | Gate: {gate_str}")
        topic_summaries.append({"slug": slug, "title": topic["title"], "subject": topic["subject_name"],
                                 "published": topic_pub, "staged": topic_staged, "failed": topic_failed, "gate": gate})

    elapsed = int(time.time() - start_time)
    print(f"\n{'='*72}")
    print(f"  GRAND TOTAL — {elapsed//60}m {elapsed%60}s")
    print(f"  Attempted: {grand_total['attempted']}  Published: {grand_total['published']}  "
          f"Staged: {grand_total['staged']}  Failed: {grand_total['failed']}")
    print(f"{'='*72}")
    print(f"\n  PUBLISH GATE SUMMARY")
    print(f"  {'Topic':<50} {'Pub Q':>5} {'LC':>3} {'Gate':>6}")
    print(f"  {'─'*68}")
    for s in topic_summaries:
        g = s["gate"]
        print(f"  {s['title']:<50} {g['published_questions']:>5} {g['published_learn_content']:>3} {'PASS' if g['gate_passes'] else 'HOLD':>6}")
    print()


if __name__ == "__main__":
    main()
