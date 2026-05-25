"""
Top-up batch for topics below the publish-gate threshold (< 10 published questions).

For each slug listed in WEAK_TOPICS, generates additional questions per tier until
the topic reaches ≥ MIN_TARGET published questions (or exhausts TOP_UP_PER_TIER attempts).

Edit WEAK_TOPICS before running. The fixed english.py verifier must be deployed first
(it is, as of 2026-05-24 — check_correct_answer=False for grammar/spelling types).

Run: /root/pipeline-venv/bin/python3 scripts/topup-weak-topics.py
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
log = logging.getLogger("topup-weak-topics")

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
import db
import pipeline as pl

# ── Configuration ─────────────────────────────────────────────────────────────

# Minimum published questions needed to pass the gate
MIN_TARGET = 10

# How many additional questions to attempt per tier per run
TOP_UP_PER_TIER = 20

TIERS = ["sprout", "explorer", "lightning"]

# Edit this list to target specific weak topics.
# Format: slug → optional override tier list (None = all 3 tiers)
# Remove slugs once they've passed the gate.
#
# Status after batches (2026-05-25):
#   Y3 English: apostrophes=0, conjunctions=13✓Q, verb-tenses=9, prefixes-suffixes=5
#   Y3 Science: plants-parts-functions=6
#   Y7 English: standard-english=7, vocabulary-word-families=6, literature-character=3
#   Y7 Science: elements-compounds=0, particles-states=0, energy-stores=0,
#               forces-motion=0, space-solar=0
#   Y2: all 15 topics at 0 (handled by separate Y2 batch script)
WEAK_TOPICS: dict[str, list[str] | None] = {
    # ── Y3 English ───────────────────────────────────────────────────────────
    "y3-english-grammar-conjunctions":       None,  # 13 Q — needs LC only (topup skips if ≥10)
    "y3-english-grammar-verb-tenses":        None,  # 9 Q
    "y3-english-grammar-apostrophes":        None,  # 0 Q
    "y3-english-spelling-prefixes-suffixes": None,  # 5 Q
    # ── Y3 Science ───────────────────────────────────────────────────────────
    "y3-science-plants-parts-functions":     None,  # 6 Q
    # ── Y7 English (low-yield question types) ────────────────────────────────
    "y7-english-grammar-standard-english":   None,  # 7 Q
    "y7-english-vocabulary-word-families":   None,  # 6 Q
    "y7-english-literature-character":       None,  # 3 Q
    # ── Y7 Science (batch produced 0 for these topics) ───────────────────────
    "y7-science-elements-compounds-mixtures": None,  # 0 Q
    "y7-science-particles-states-of-matter":  None,  # 0 Q
    "y7-science-energy-stores-transfers":     None,  # 0 Q
    "y7-science-forces-motion":               None,  # 0 Q
    "y7-science-space-solar-system":          None,  # 0 Q
}

# ── DB helpers ─────────────────────────────────────────────────────────────────

def get_topic_by_slug(slug: str) -> dict | None:
    import psycopg2, psycopg2.extras
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(config.DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT t.id, t.title, t.slug,
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


def count_published(topic_id: str) -> int:
    import psycopg2
    from pgvector.psycopg2 import register_vector
    conn = psycopg2.connect(config.DATABASE_URL)
    register_vector(conn)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM quiz_questions WHERE topic_id=%s AND status='published'",
                (topic_id,)
            )
            return cur.fetchone()[0]
    finally:
        conn.close()


def check_gate(topic_id: str) -> dict:
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
    return {"published_questions": pub_q, "published_learn_content": pub_lc,
            "gate_passes": pub_q >= MIN_TARGET and pub_lc >= 1}


def run_tier(topic: dict, tier: str, count: int) -> dict:
    run_id = db.create_pipeline_run(
        run_type="topup",
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
            run_id=run_id, items_attempted=count,
            items_published=counts["published"], items_staged=counts["staged"],
            items_failed=counts["failed"] + counts["regenerating"],
            error_log=[], success=True
        )
        return {"run_id": run_id, "counts": counts, "ok": True}
    except Exception as exc:
        log.error(f"Pipeline error on {topic['slug']} / {tier}: {exc}", exc_info=True)
        db.complete_pipeline_run(
            run_id=run_id, items_attempted=count,
            items_published=0, items_staged=0, items_failed=count,
            error_log=[str(exc)], success=False
        )
        return {"run_id": run_id, "error": str(exc), "ok": False}


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"\n{'='*72}")
    print(f"  Top-up Batch — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Targets: {len(WEAK_TOPICS)} weak topics | {TOP_UP_PER_TIER} attempts/tier")
    print(f"  Publish gate threshold: {MIN_TARGET} questions")
    print(f"{'='*72}\n")

    start_time = time.time()
    summary = []

    for slug, override_tiers in WEAK_TOPICS.items():
        topic = get_topic_by_slug(slug)
        if not topic:
            log.warning(f"Topic not found in DB: {slug}")
            summary.append({"slug": slug, "title": "??", "status": "NOT_FOUND", "gate": None})
            continue

        tiers = override_tiers or TIERS
        before = count_published(topic["id"])

        print(f"\n{'─'*60}")
        print(f"  {topic['title']} ({topic['subject_name']}, {topic['year_group_label']})")
        print(f"  Before: {before} published | Tiers: {tiers}")
        print(f"{'─'*60}")

        if before >= MIN_TARGET:
            gate = check_gate(topic["id"])
            # Still attempt promote in case learn_content was added since last run
            promoted = db.promote_ready_topics([topic["id"]])
            if promoted:
                print(f"  🌟 Promoted to is_published=true: {promoted[0]['title']}")
            gate_str = "✅ PASS" if gate["gate_passes"] else f"🔒 HOLD (q={gate['published_questions']}, lc={gate['published_learn_content']})"
            log.info(f"  Already at {before} published — {gate_str}. Skipping.")
            summary.append({"slug": slug, "title": topic["title"], "status": "ALREADY_OK", "gate": gate})
            continue

        topic_added = 0
        for tier in tiers:
            current = count_published(topic["id"])
            if current >= MIN_TARGET:
                log.info(f"  [{tier:9s}] Reached {current} published — stopping early")
                break
            needed = MIN_TARGET - current
            attempts = min(TOP_UP_PER_TIER, needed + 5)  # a few extra for yield buffer
            log.info(f"  [{tier:9s}] current={current}, targeting +{needed}, attempting {attempts}")

            result = run_tier(topic, tier, attempts)
            if result["ok"]:
                c = result["counts"]
                topic_added += c["published"]
                log.info(f"  [{tier:9s}] published={c['published']:2d} staged={c['staged']:2d} "
                         f"failed={c['failed']+c['regenerating']:2d}")
            else:
                log.error(f"  [{tier:9s}] ERROR: {result['error']}")

        gate = check_gate(topic["id"])
        after = gate["published_questions"]
        gate_str = "✅ PASS" if gate["gate_passes"] else f"🔒 HOLD (q={after}/10, lc={gate['published_learn_content']}/1)"
        print(f"  After: {after} published (+{after - before} added) | Gate: {gate_str}")

        # Publish-as-available: flip topics.is_published the moment a topic crosses the gate.
        promoted = db.promote_ready_topics([topic["id"]])
        if promoted:
            print(f"  🌟 Promoted to is_published=true: {promoted[0]['title']}")

        summary.append({"slug": slug, "title": topic["title"],
                        "status": "PASS" if gate["gate_passes"] else "HOLD",
                        "gate": gate, "before": before, "after": after})

    elapsed = int(time.time() - start_time)
    print(f"\n{'='*72}")
    print(f"  TOP-UP COMPLETE — {elapsed//60}m {elapsed%60}s")
    print(f"\n  {'Slug':<46} {'Q':>4} {'LC':>3} {'Gate':>6}")
    print(f"  {'─'*64}")
    for s in summary:
        g = s["gate"]
        if g:
            print(f"  {s['slug']:<46} {g['published_questions']:>4} {g['published_learn_content']:>3} "
                  f"{'PASS' if g['gate_passes'] else s.get('status','HOLD'):>6}")
        else:
            print(f"  {s['slug']:<46} {'N/A':>4} {'?':>3} {s['status']:>6}")
    print()


if __name__ == "__main__":
    main()
