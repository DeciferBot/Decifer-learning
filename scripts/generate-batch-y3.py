"""
Phase 11B — Full batch generation for Year 3 English + Science.

Targets all 8 English topics + 6 Science topics, all 3 tiers (sprout/explorer/lightning),
15 questions per topic per tier.

Total capacity: 14 topics × 3 tiers × 15 questions = 630 questions attempted.
Expected publish yield: 60–80% after dedup/quality filtering.

Requires the DO droplet environment with:
  - /root/pipeline-venv (sentence-transformers + language-tool-python installed)
  - /root/decifer-learning/.env.local (DIRECT_URL + ANTHROPIC_API_KEY)
  - 59 curriculum_chunks with embeddings (run embed_chunks.py first if needed)

Run: /root/pipeline-venv/bin/python3 scripts/generate-batch-y3.py
"""

import os
import sys
import json
import time
import logging
from pathlib import Path
from datetime import datetime

# ── Pipeline stop guard ───────────────────────────────────────────────────────
_STOP_GUARD = Path(__file__).resolve().parent.parent / ".PIPELINE_STOP"
if _STOP_GUARD.exists():
    print("PIPELINE STOP ACTIVE: Decifer Learning content generation is disabled")
    sys.exit(0)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("generate-batch-y3")

# ── Load env from .env.local ──────────────────────────────────────────────
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

# Prefer DIRECT_URL (port 5432) over pgbouncer for pgvector operations
if os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

if not os.environ.get("ANTHROPIC_API_KEY"):
    log.error("ANTHROPIC_API_KEY not set")
    sys.exit(1)
if not os.environ.get("DATABASE_URL"):
    log.error("DATABASE_URL not set")
    sys.exit(1)

# ── Add pipeline to sys.path ──────────────────────────────────────────────
pipeline_dir = Path(__file__).parent.parent / "services" / "content-pipeline"
sys.path.insert(0, str(pipeline_dir))

import config
log.info(f"Pipeline {config.PIPELINE_VERSION} | model: {config.CLAUDE_MODEL} | embeddings: {config.EMBEDDINGS_ENABLED}")

import db
import pipeline as pl

# ── Topic manifest ────────────────────────────────────────────────────────

Y3_ENGLISH_TOPICS = [
    "y3-english-grammar-conjunctions",
    "y3-english-grammar-verb-tenses",
    "y3-english-grammar-fronted-adverbials",
    "y3-english-grammar-apostrophes",
    "y3-english-spelling-prefixes-suffixes",
    "y3-english-spelling-homophones",
    "y3-english-reading-comprehension",
    "y3-english-reading-vocabulary",
]

Y3_SCIENCE_TOPICS = [
    "y3-science-plants-parts-functions",
    "y3-science-plants-life-cycle",
    "y3-science-animals-nutrition-skeletons",
    "y3-science-rocks-fossils",
    "y3-science-light-shadows",
    "y3-science-forces-magnets",
]

TIERS = ["sprout", "explorer", "lightning"]
QUESTIONS_PER_BATCH = 15  # per topic per tier

# ── Helpers ───────────────────────────────────────────────────────────────

def get_topic_by_slug(slug: str) -> dict | None:
    import psycopg2
    import psycopg2.extras
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(config.DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT t.id, t.title, t.slug, t.is_published,
                       yg.label AS year_group_label, yg.key_stage,
                       s.name   AS subject_name
                FROM topics t
                JOIN year_groups yg ON yg.id = t.year_group_id
                JOIN subjects    s  ON s.id  = t.subject_id
                WHERE t.slug = %s
                """,
                (slug,),
            )
            row = cur.fetchone()
    finally:
        conn.close()
    return dict(row) if row else None


def check_publish_gate(topic_id: str) -> dict:
    import psycopg2
    import psycopg2.extras
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(config.DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM quiz_questions WHERE topic_id=%s AND status='published'",
                (topic_id,),
            )
            pub_q = cur.fetchone()["n"]
            cur.execute(
                "SELECT COUNT(*) AS n FROM learn_content WHERE topic_id=%s AND status='published'",
                (topic_id,),
            )
            pub_lc = cur.fetchone()["n"]
    finally:
        conn.close()
    return {"published_questions": pub_q, "published_learn_content": pub_lc,
            "gate_passes": pub_q >= 10 and pub_lc >= 1}


def run_topic_tier(topic: dict, tier: str, count: int) -> dict:
    run_id = db.create_pipeline_run(
        run_type="batch_y3_full",
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

        db.complete_pipeline_run(
            run_id=run_id,
            items_attempted=count,
            items_published=counts["published"],
            items_staged=counts["staged"],
            items_failed=counts["failed"] + counts["regenerating"],
            error_log=[],
            success=True,
        )
        return {"run_id": run_id, "counts": counts, "ok": True}
    except Exception as exc:
        log.error(f"Pipeline error on {topic['slug']} / {tier}: {exc}", exc_info=True)
        db.complete_pipeline_run(
            run_id=run_id, items_attempted=count,
            items_published=0, items_staged=0, items_failed=count,
            error_log=[str(exc)], success=False,
        )
        return {"run_id": run_id, "error": str(exc), "ok": False}


# ── Main ──────────────────────────────────────────────────────────────────

def main():
    all_slugs = Y3_ENGLISH_TOPICS + Y3_SCIENCE_TOPICS

    print(f"\n{'='*72}")
    print(f"  Y3 Full Batch Generation — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Topics: {len(all_slugs)} | Tiers: {len(TIERS)} | Per batch: {QUESTIONS_PER_BATCH}")
    print(f"  Total attempts: {len(all_slugs) * len(TIERS) * QUESTIONS_PER_BATCH}")
    print(f"{'='*72}\n")

    # Verify all topics exist before starting
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
        log.error("Run: npx tsx --env-file=.env.local scripts/seed-topics-english.ts")
        log.error("     npx tsx --env-file=.env.local scripts/seed-topics-science.ts")
        sys.exit(1)

    log.info(f"All {len(topics)} topics verified in DB ✓")

    grand_total = {"attempted": 0, "published": 0, "staged": 0, "failed": 0}
    topic_summaries = []
    start_time = time.time()

    for slug in all_slugs:
        topic = topics[slug]
        topic_pub = 0
        topic_staged = 0
        topic_failed = 0

        print(f"\n{'─'*60}")
        print(f"  {topic['title']} ({topic['subject_name']}, {topic['year_group_label']})")
        print(f"{'─'*60}")

        for tier in TIERS:
            result = run_topic_tier(topic, tier, QUESTIONS_PER_BATCH)
            grand_total["attempted"] += QUESTIONS_PER_BATCH

            if result["ok"]:
                c = result["counts"]
                topic_pub    += c["published"]
                topic_staged += c["staged"]
                topic_failed += c["failed"] + c["regenerating"]
                grand_total["published"] += c["published"]
                grand_total["staged"]    += c["staged"]
                grand_total["failed"]    += c["failed"] + c["regenerating"]
                log.info(
                    f"  [{tier:9s}] published={c['published']:2d} staged={c['staged']:2d} "
                    f"failed={c['failed']+c['regenerating']:2d}  run={result['run_id']}"
                )
            else:
                grand_total["failed"] += QUESTIONS_PER_BATCH
                topic_failed += QUESTIONS_PER_BATCH
                log.error(f"  [{tier:9s}] ERROR: {result['error']}")

        # Gate check after all tiers
        gate = check_publish_gate(str(topic["id"]))
        gate_str = "✅ PASS" if gate["gate_passes"] else f"🔒 HOLD (q={gate['published_questions']}/10, lc={gate['published_learn_content']}/1)"
        print(f"  Subtotal: pub={topic_pub} staged={topic_staged} failed={topic_failed} | Gate: {gate_str}")
        topic_summaries.append({
            "slug": slug,
            "title": topic["title"],
            "subject": topic["subject_name"],
            "published": topic_pub,
            "staged": topic_staged,
            "failed": topic_failed,
            "gate": gate,
        })

    elapsed = int(time.time() - start_time)
    print(f"\n{'='*72}")
    print(f"  GRAND TOTAL — completed in {elapsed//60}m {elapsed%60}s")
    print(f"  Attempted: {grand_total['attempted']}")
    print(f"  Published: {grand_total['published']}")
    print(f"  Staged:    {grand_total['staged']}")
    print(f"  Failed:    {grand_total['failed']}")
    print(f"{'='*72}")

    print(f"\n  PUBLISH GATE SUMMARY")
    print(f"  {'Topic':<45} {'Pub Q':>5} {'LC':>3} {'Gate':>6}")
    print(f"  {'─'*63}")
    for s in topic_summaries:
        g = s["gate"]
        verdict = "PASS" if g["gate_passes"] else "HOLD"
        print(f"  {s['title']:<45} {g['published_questions']:>5} {g['published_learn_content']:>3} {verdict:>6}")

    print(f"\n  NOTE: Content with status='published' is immediately live to child-facing queries.")
    print(f"  To promote a topic to is_published=true on the world map:")
    print(f"  npx tsx scripts/publish-topic.ts <slug>")
    print(f"  (Requires ≥10 published questions + ≥1 published learn_content)\n")


if __name__ == "__main__":
    import sys as _sys
    from pathlib import Path as _Path
    sys.path.insert(0, str(_Path(__file__).parent.parent / "services" / "content-pipeline"))
    from pipeline_lock import pipeline_lock, PipelineLockError
    try:
        with pipeline_lock("batch-year-3"):
            main()
    except PipelineLockError as _e:
        print(_e)
        _sys.exit(1)
