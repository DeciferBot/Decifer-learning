"""
Phase 11B — Controlled generation run for the DO droplet.

Identical scope to generate-controlled-11b.py (2 topics × 3 questions at sprout
tier) but does NOT set EMBEDDINGS_ENABLED=False — sentence_transformers IS
available on the droplet, so embeddings fall through to the config.py default
(True).

NOT for local-dev use. Run this script directly on the Digital Ocean droplet
where the pipeline dependencies (sentence_transformers, LanguageTool JVM, etc.)
are installed.

Usage (on DO droplet):
  python3 scripts/generate-controlled-11b-do.py

Environment variables required (export before running, or place in .env.local):
  DATABASE_URL       — Supabase direct URL (port 5432, not pgbouncer)
  ANTHROPIC_API_KEY
"""

import os
import sys
import logging
from pathlib import Path

# ── Pipeline stop guard ───────────────────────────────────────────────────────
_STOP_GUARD = Path(__file__).resolve().parent.parent / ".PIPELINE_STOP"
if _STOP_GUARD.exists():
    print("PIPELINE STOP ACTIVE: Decifer Learning content generation is disabled")
    sys.exit(0)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("generate-controlled-11b-do")

# ── Load env from .env.local if present ──────────────────────────────────────
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

# Prefer DIRECT_URL (port 5432) over pgbouncer URL for pgvector compatibility
if os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

if not os.environ.get("ANTHROPIC_API_KEY"):
    log.error("ANTHROPIC_API_KEY not set — cannot run pipeline")
    sys.exit(1)

if not os.environ.get("DATABASE_URL"):
    log.error("DATABASE_URL not set — cannot connect to DB")
    sys.exit(1)

# NOTE: EMBEDDINGS_ENABLED is intentionally NOT overridden here.
# sentence_transformers is available on the DO droplet; config.py default (True) applies.

# ── Add pipeline to sys.path ──────────────────────────────────────────────────
pipeline_dir = Path(__file__).parent.parent / "services" / "content-pipeline"
sys.path.insert(0, str(pipeline_dir))

import config
log.info(f"Pipeline version: {config.PIPELINE_VERSION}, model: {config.CLAUDE_MODEL}")
log.info(f"Embeddings enabled: {config.EMBEDDINGS_ENABLED}")

import db
import pipeline as pl


def get_topic_by_slug(slug: str) -> dict | None:
    """Return topic dict by slug."""
    import psycopg2
    import psycopg2.extras
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(config.DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT t.id, t.title, t.is_published,
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


def run_controlled(topic_slug: str, tier: str, count: int) -> dict:
    """Run the pipeline for a topic and return a summary."""
    topic = get_topic_by_slug(topic_slug)
    if topic is None:
        return {"error": f"Topic not found: {topic_slug}"}

    log.info(
        f"\n{'='*60}\n"
        f"Topic: {topic['title']} ({topic['subject_name']}, {topic['year_group_label']})\n"
        f"Tier: {tier}, Count: {count}\n"
        f"{'='*60}"
    )

    run_id = db.create_pipeline_run(
        run_type="controlled_11b_do",
        year_group=topic["year_group_label"],
        subject=topic["subject_name"],
        topic_id=str(topic["id"]),
        tier=tier,
    )
    log.info(f"Pipeline run created: {run_id}")

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

        summary = {
            "topic_slug": topic_slug,
            "topic_title": topic["title"],
            "subject": topic["subject_name"],
            "year_group": topic["year_group_label"],
            "tier": tier,
            "pipeline_run_id": run_id,
            "published": counts["published"],
            "staged": counts["staged"],
            "regenerating": counts["regenerating"],
            "failed": counts["failed"],
            "question_ids": [r.question_id for r in results if r.question_id],
        }

        for i, r in enumerate(results, 1):
            log.info(f"  Q{i}: status={r.status} score={r.confidence_score:.1f}")
            for step in r.stage_log:
                log.info(f"    {step}")

        return summary

    except Exception as exc:
        log.error(f"Pipeline failed: {exc}", exc_info=True)
        db.complete_pipeline_run(
            run_id=run_id,
            items_attempted=count,
            items_published=0,
            items_staged=0,
            items_failed=count,
            error_log=[str(exc)],
            success=False,
        )
        return {"error": str(exc), "pipeline_run_id": run_id}


def check_publish_gate(topic_slug: str) -> dict:
    """Report gate status for a topic without publishing."""
    topic = get_topic_by_slug(topic_slug)
    if topic is None:
        return {"error": f"Topic not found: {topic_slug}"}

    import psycopg2
    import psycopg2.extras
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(config.DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM quiz_questions WHERE topic_id=%s AND status='published'",
                (str(topic["id"]),),
            )
            pub_q = cur.fetchone()["n"]
            cur.execute(
                "SELECT COUNT(*) AS n FROM learn_content WHERE topic_id=%s AND status='published'",
                (str(topic["id"]),),
            )
            pub_lc = cur.fetchone()["n"]
    finally:
        conn.close()

    gate_passes = pub_q >= 10 and pub_lc >= 1
    return {
        "topic_slug": topic_slug,
        "topic_title": topic["title"],
        "published_questions": pub_q,
        "published_learn_content": pub_lc,
        "gate_passes": gate_passes,
        "gate_verdict": "PASS" if gate_passes else (
            f"HOLD — need >=10 questions (have {pub_q}), "
            f"need >=1 learn_content (have {pub_lc})"
        ),
    }


if __name__ == "__main__":
    print("\n" + "="*70)
    print("  Phase 11B — Controlled Generation Run (DO Droplet)")
    print(f"  Pipeline version: {config.PIPELINE_VERSION}")
    print(f"  Model: {config.CLAUDE_MODEL}")
    print(f"  Embeddings: {config.EMBEDDINGS_ENABLED} (sentence_transformers available on droplet)")
    print("="*70 + "\n")

    # Scope: 1 English topic + 1 Science topic, 3 questions each at sprout
    runs = [
        ("y3-english-grammar-conjunctions", "sprout", 3),
        ("y3-science-plants-parts-functions", "sprout", 3),
    ]

    results = []
    for slug, tier, count in runs:
        r = run_controlled(slug, tier, count)
        results.append(r)

    print("\n" + "="*70)
    print("  GENERATION SUMMARY")
    print("="*70)
    for r in results:
        if "error" in r:
            print(f"\n  ERROR {r.get('topic_slug', 'unknown')}: {r['error']}")
        else:
            print(f"\n  Topic: {r['topic_title']} ({r['subject']}, {r['year_group']})")
            print(f"  Run ID: {r['pipeline_run_id']}")
            print(f"  Published: {r['published']}, Staged: {r['staged']}, "
                  f"Regenerating: {r['regenerating']}, Failed: {r['failed']}")
            print(f"  Question IDs: {r['question_ids']}")

    print("\n" + "="*70)
    print("  PUBLISH GATE STATUS")
    print("="*70)
    for slug, _, _ in runs:
        g = check_publish_gate(slug)
        if "error" in g:
            print(f"\n  ERROR {slug}: {g['error']}")
        else:
            verdict_icon = "PASS" if g["gate_passes"] else "HOLD"
            print(f"\n  [{verdict_icon}] {g['topic_title']}: {g['gate_verdict']}")

    print("\n  NOTE: No content is published via this script.")
    print("  To publish, run: npx tsx scripts/publish-topic.ts <topic-slug>")
    print("  Publication requires >=10 published questions + published learn_content.\n")
