"""Decifer Learning — content pipeline microservice.

Phase 11A endpoints (pipeline/admin only — not child-facing):
  GET  /health                      liveness probe
  POST /verify/maths                test the maths verifier
  POST /verify/english              test the English verifier
  POST /verify/physics              test the physics verifier
  POST /verify/chemistry            test the chemistry verifier
  POST /ingest                      seed curriculum_chunks with embedded text
  POST /generate                    run the 6-stage pipeline for a topic + tier
  POST /generate/batch              batch generation for multiple topics/tiers (tracked)
  GET  /pipeline/runs               list pipeline_runs
  GET  /pipeline/runs/{id}          get a single pipeline_run
  POST /pipeline/runs/{id}/cancel   cancel a running pipeline_run
  POST /pipeline/regenerate-flagged re-run pipeline for flagged questions (max 20)
  POST /pipeline/oak-daily-update   ingest new Oak NA lessons + top-up thin topics (async)
"""

import json
import logging
import os
import sys
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(stream=sys.stdout, level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("main")

app = FastAPI(title="Decifer Learning Content Pipeline", version="1.1.0")


# ── /health ───────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    import config
    return {"status": "ok", "version": "1.1.0", "pipeline_version": config.PIPELINE_VERSION}


# ── /verify/maths ─────────────────────────────────────────────────────────

class VerifyMathsRequest(BaseModel):
    question_type: str
    correct_answer: str
    verification_expression: Optional[str] = None
    verification_equation: Optional[str] = None
    verification_variable: Optional[str] = "x"


class VerifyResponse(BaseModel):
    verified: bool
    detail: str


@app.post("/verify/maths", response_model=VerifyResponse)
def verify_maths(req: VerifyMathsRequest) -> VerifyResponse:
    from verifiers import maths as mv
    verified, detail = mv.verify(req.model_dump())
    return VerifyResponse(verified=verified, detail=detail)


# ── /verify/english ───────────────────────────────────────────────────────

class VerifyEnglishRequest(BaseModel):
    question_type: str
    question_text: str
    correct_answer: str
    explanation: Optional[str] = None
    hint_1: Optional[str] = None
    hint_2: Optional[str] = None
    hint_3: Optional[str] = None
    question_metadata: Optional[dict] = None
    source_chunk_ids: Optional[list] = None


@app.post("/verify/english", response_model=VerifyResponse)
def verify_english(req: VerifyEnglishRequest) -> VerifyResponse:
    from verifiers import english as ev
    verified, detail = ev.verify(req.model_dump())
    return VerifyResponse(verified=verified, detail=detail)


# ── /verify/physics ───────────────────────────────────────────────────────

class VerifyPhysicsRequest(BaseModel):
    question_type: str
    correct_answer: str
    verification_expression: Optional[str] = None
    verification_unit: Optional[str] = None


@app.post("/verify/physics", response_model=VerifyResponse)
def verify_physics(req: VerifyPhysicsRequest) -> VerifyResponse:
    from verifiers import physics as pv
    verified, detail = pv.verify(req.model_dump())
    return VerifyResponse(verified=verified, detail=detail)


# ── /verify/chemistry ─────────────────────────────────────────────────────

class VerifyChemistryRequest(BaseModel):
    question_type: str
    correct_answer: str
    question_text: Optional[str] = None
    question_metadata: Optional[dict] = None
    verification_equation: Optional[str] = None


@app.post("/verify/chemistry", response_model=VerifyResponse)
def verify_chemistry(req: VerifyChemistryRequest) -> VerifyResponse:
    from verifiers import chemistry as cv
    verified, detail = cv.verify(req.model_dump())
    return VerifyResponse(verified=verified, detail=detail)


# ── /ingest ───────────────────────────────────────────────────────────────

class IngestChunk(BaseModel):
    subject: str
    year_group: str
    source_name: str
    chunk_text: str


class IngestRequest(BaseModel):
    chunks: list[IngestChunk]


class IngestResponse(BaseModel):
    inserted: int
    skipped: int


@app.post("/ingest", response_model=IngestResponse)
def ingest(req: IngestRequest) -> IngestResponse:
    import config
    import db
    import pipeline as pl

    enriched = []
    for chunk in req.chunks:
        embedding = pl.embed_text(chunk.chunk_text) if config.EMBEDDINGS_ENABLED else None
        enriched.append({
            "subject": chunk.subject,
            "year_group": chunk.year_group,
            "source_name": chunk.source_name,
            "chunk_text": chunk.chunk_text,
            "embedding": embedding,
        })

    inserted, skipped = db.bulk_upsert_chunks(enriched)
    log.info(f"/ingest: {inserted} inserted, {skipped} skipped")
    return IngestResponse(inserted=inserted, skipped=skipped)


# ── /generate ─────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    topic_id: str
    tier: str = "sprout"
    count: int = 10


class QuestionResult(BaseModel):
    question_id: Optional[str]
    status: str
    confidence_score: float
    stage_log: list[str]
    input_tokens: int = 0
    output_tokens: int = 0


class PromotedTopic(BaseModel):
    id: str
    title: str


class GenerateResponse(BaseModel):
    topic_id: str
    tier: str
    published: int
    staged: int
    regenerating: int
    failed: int
    input_tokens: int
    output_tokens: int
    model: str
    pipeline_version: str
    results: list[QuestionResult]
    promoted_topics: list[PromotedTopic] = []


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    import pipeline as pl
    import db as _db
    import config

    if req.tier not in ("sprout", "explorer", "lightning"):
        raise HTTPException(status_code=400, detail="tier must be sprout | explorer | lightning")
    if not (1 <= req.count <= 50):
        raise HTTPException(status_code=400, detail="count must be 1–50")

    log.info(f"/generate topic_id={req.topic_id} tier={req.tier} count={req.count}")
    results = pl.run_for_topic(req.topic_id, req.tier, req.count)

    counts = {"published": 0, "staged": 0, "regenerating": 0, "failed": 0}
    for r in results:
        counts[r.status] = counts.get(r.status, 0) + 1

    # Publish-as-available: flip is_published if this topic just crossed the gate.
    promoted = _db.promote_ready_topics([req.topic_id])
    if promoted:
        log.info(f"Auto-promoted {len(promoted)} topic(s): {[p['title'] for p in promoted]}")

    return GenerateResponse(
        topic_id=req.topic_id,
        tier=req.tier,
        published=counts["published"],
        staged=counts["staged"],
        regenerating=counts["regenerating"],
        failed=counts["failed"],
        input_tokens=sum(r.input_tokens for r in results),
        output_tokens=sum(r.output_tokens for r in results),
        model=config.CLAUDE_MODEL,
        pipeline_version=config.PIPELINE_VERSION,
        results=[
            QuestionResult(
                question_id=r.question_id,
                status=r.status,
                confidence_score=r.confidence_score,
                stage_log=r.stage_log,
                input_tokens=r.input_tokens,
                output_tokens=r.output_tokens,
            )
            for r in results
        ],
        promoted_topics=[PromotedTopic(id=p["id"], title=p["title"]) for p in promoted],
    )


# ── /generate/batch ───────────────────────────────────────────────────────

class BatchItem(BaseModel):
    topic_id: str
    tier: str
    count: int


class GenerateBatchRequest(BaseModel):
    items: list[BatchItem]


class BatchItemResult(BaseModel):
    topic_id: str
    tier: str
    pipeline_run_id: Optional[str]
    published: int
    staged: int
    regenerating: int
    failed: int
    input_tokens: int
    output_tokens: int


class GenerateBatchResponse(BaseModel):
    total_published: int
    total_staged: int
    total_failed: int
    results: list[BatchItemResult]
    promoted_topics: list[PromotedTopic] = []


@app.post("/generate/batch", response_model=GenerateBatchResponse)
def generate_batch(req: GenerateBatchRequest) -> GenerateBatchResponse:
    """Run the pipeline for multiple topic+tier combinations. Creates a pipeline_run per item."""
    import pipeline as pl
    import db as _db
    import config

    if len(req.items) > 20:
        raise HTTPException(status_code=400, detail="Max 20 items per batch request")

    batch_results = []
    total_published = total_staged = total_failed = 0

    for item in req.items:
        if item.tier not in ("sprout", "explorer", "lightning"):
            raise HTTPException(status_code=400, detail=f"Invalid tier: {item.tier!r}")
        if not (1 <= item.count <= 50):
            raise HTTPException(status_code=400, detail="count must be 1–50")

        topic = _db.get_topic(item.topic_id)
        if topic is None:
            raise HTTPException(status_code=404, detail=f"Topic {item.topic_id!r} not found")

        run_id = _db.create_pipeline_run(
            run_type="batch",
            year_group=topic.get("year_group_label", ""),
            subject=topic.get("subject_name", ""),
            topic_id=item.topic_id,
            tier=item.tier,
        )
        log.info(f"/generate/batch topic={item.topic_id} tier={item.tier} count={item.count} run_id={run_id}")

        try:
            results = pl.run_for_topic(item.topic_id, item.tier, item.count, pipeline_run_id=run_id)
            counts = {"published": 0, "staged": 0, "regenerating": 0, "failed": 0}
            for r in results:
                counts[r.status] = counts.get(r.status, 0) + 1

            _db.complete_pipeline_run(
                run_id=run_id,
                items_attempted=item.count,
                items_published=counts["published"],
                items_staged=counts["staged"],
                items_failed=counts["failed"] + counts["regenerating"],
                error_log=[],
                success=True,
            )

            batch_results.append(BatchItemResult(
                topic_id=item.topic_id,
                tier=item.tier,
                pipeline_run_id=run_id,
                published=counts["published"],
                staged=counts["staged"],
                regenerating=counts["regenerating"],
                failed=counts["failed"],
                input_tokens=sum(r.input_tokens for r in results),
                output_tokens=sum(r.output_tokens for r in results),
            ))
            total_published += counts["published"]
            total_staged += counts["staged"]
            total_failed += counts["failed"] + counts["regenerating"]

        except Exception as exc:
            log.error(f"Batch item failed: {exc}")
            _db.complete_pipeline_run(
                run_id=run_id,
                items_attempted=item.count,
                items_published=0,
                items_staged=0,
                items_failed=item.count,
                error_log=[str(exc)],
                success=False,
            )
            batch_results.append(BatchItemResult(
                topic_id=item.topic_id,
                tier=item.tier,
                pipeline_run_id=run_id,
                published=0,
                staged=0,
                regenerating=0,
                failed=item.count,
                input_tokens=0,
                output_tokens=0,
            ))
            total_failed += item.count

    # Publish-as-available: flip is_published on any of this batch's topics
    # that just crossed the readiness gate. Idempotent and scoped to batch.
    touched_topic_ids = list({item.topic_id for item in req.items})
    promoted = _db.promote_ready_topics(touched_topic_ids)
    if promoted:
        log.info(f"Auto-promoted {len(promoted)} topic(s): {[p['title'] for p in promoted]}")

    return GenerateBatchResponse(
        total_published=total_published,
        total_staged=total_staged,
        total_failed=total_failed,
        results=batch_results,
        promoted_topics=[PromotedTopic(id=p["id"], title=p["title"]) for p in promoted],
    )


# ── /pipeline/runs ────────────────────────────────────────────────────────

@app.get("/pipeline/runs")
def list_pipeline_runs(limit: int = 50) -> list[dict]:
    import db as _db
    return _db.list_pipeline_runs(limit=min(limit, 200))


@app.get("/pipeline/runs/{run_id}")
def get_pipeline_run(run_id: str) -> dict:
    import db as _db
    run = _db.get_pipeline_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Pipeline run {run_id!r} not found")
    return run


@app.post("/pipeline/runs/{run_id}/cancel")
def cancel_pipeline_run(run_id: str) -> dict:
    import db as _db
    updated = _db.cancel_pipeline_run(run_id)
    if not updated:
        raise HTTPException(
            status_code=404,
            detail=f"Pipeline run {run_id!r} not found or not in 'running' state",
        )
    return {"status": "cancelled", "run_id": run_id}


# ── /pipeline/regenerate-flagged ─────────────────────────────────────────────
#
# Phase 12: Admin-triggered regeneration of questions with status='flagged'.
# Picks up to `limit` flagged questions (default 20), sets each to 'regenerating',
# re-runs them through the 6-stage pipeline, then writes the new status back.
# Circuit breaker: questions that have been regenerated ≥5 times are set to
# 'staged' (not re-queued) so they go through the one-time spot-check path.

class RegenerateFlaggedResponse(BaseModel):
    triggered: int
    results: list[QuestionResult]


@app.post("/pipeline/regenerate-flagged", response_model=RegenerateFlaggedResponse)
def regenerate_flagged(limit: int = 20) -> RegenerateFlaggedResponse:
    """Re-run the pipeline for all questions with status='flagged'. Max `limit` per call."""
    import pipeline as pl
    import db as _db

    if not (1 <= limit <= 50):
        raise HTTPException(status_code=400, detail="limit must be 1–50")

    flagged = _db.get_flagged_questions(limit=limit)
    if not flagged:
        return RegenerateFlaggedResponse(triggered=0, results=[])

    log.info(f"/pipeline/regenerate-flagged: processing {len(flagged)} flagged questions")

    results: list[QuestionResult] = []
    for q in flagged:
        try:
            result = pl.regenerate_question(q)
            results.append(QuestionResult(
                question_id=result.question_id,
                status=result.status,
                confidence_score=result.confidence_score,
                stage_log=result.stage_log,
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
            ))
        except Exception as exc:
            log.exception(f"Error regenerating question {q.get('id')}: {exc}")
            results.append(QuestionResult(
                question_id=str(q.get("id", "")),
                status="failed",
                confidence_score=0.0,
                stage_log=[f"exception: {exc}"],
                input_tokens=0,
                output_tokens=0,
            ))

    return RegenerateFlaggedResponse(triggered=len(flagged), results=results)


@app.post("/pipeline/regenerate-flagged-all")
def regenerate_flagged_all(background_tasks: BackgroundTasks, cap: int = 150) -> dict:
    """Drain the flagged queue as a background task, up to `cap` questions.

    Used by the nightly Vercel cron (fire-and-forget) so regeneration is not
    bounded by the 300s serverless function timeout.
    """
    if not (1 <= cap <= 500):
        raise HTTPException(status_code=400, detail="cap must be 1–500")
    background_tasks.add_task(_run_regenerate_flagged_all, cap)
    return {"status": "started", "cap": cap}


def _run_regenerate_flagged_all(cap: int) -> None:
    import pipeline as pl
    import db as _db

    done = 0
    published = 0
    while done < cap:
        batch = _db.get_flagged_questions(limit=min(20, cap - done))
        if not batch:
            break
        for q in batch:
            try:
                result = pl.regenerate_question(q)
                if result.status == "published":
                    published += 1
            except Exception as exc:
                log.exception(f"regenerate-flagged-all: error on {q.get('id')}: {exc}")
            done += 1
    log.info(f"regenerate-flagged-all complete: processed={done} published={published}")


# ── /pipeline/oak-daily-update ────────────────────────────────────────────────
#
# Triggered by Vercel cron at 04:00 UTC.
# Fetches new/updated Oak NA lessons, embeds+dedupes chunks, then generates
# questions for any topic with < 15 published questions.
# Runs as a background task — returns immediately.

@app.post("/pipeline/oak-daily-update")
def oak_daily_update(background_tasks: BackgroundTasks) -> dict:
    """
    Triggered by Vercel cron at 04:00 UTC.
    Fetches new/updated Oak NA lessons, embeds+dedupes chunks, then generates
    questions for any topic with < 15 published questions.
    Runs as a background task — returns immediately.
    """
    background_tasks.add_task(_run_oak_daily_update)
    return {"status": "started", "message": "Oak daily update running in background"}


def _run_oak_daily_update():
    import psycopg2
    import psycopg2.extras
    import time
    import uuid

    import pipeline as pl

    oak_key = os.environ.get("OAK_API_KEY", "").strip().strip('"')
    if not oak_key:
        log.error("OAK_API_KEY not set — skipping oak-daily-update")
        return

    import config

    OAK_BASE = "https://open-api.thenational.academy/api/v0"
    SOURCE = "Oak NA (OGL v3.0)"
    SUBJECT_SLUG = {
        "Maths": "maths", "English": "english", "Science": "science",
        "History": "history", "Geography": "geography",
    }
    YEAR_TO_KS = {
        "year-1": "ks1", "year-2": "ks1",
        "year-3": "ks2", "year-4": "ks2", "year-5": "ks2", "year-6": "ks2",
        "year-7": "ks3", "year-8": "ks3", "year-9": "ks3",
    }
    SIM_THRESHOLD = 0.85  # skip chunk if too similar to existing

    def oak_get(path):
        import urllib.request
        import urllib.error
        url = path if path.startswith("http") else f"{OAK_BASE}{path}"
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {oak_key}",
            "User-Agent": "Decifer-Learning/1.0",
        })
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=25) as r:
                    return json.loads(r.read().decode("utf-8"))
            except urllib.error.HTTPError as ex:
                if ex.code in (429, 403, 500, 502, 503):
                    time.sleep(3 * (attempt + 1))
                    continue
                raise
            except Exception:
                time.sleep(2)
                continue
        return None

    conn = psycopg2.connect(config.DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # Get all active topics grouped by subject + year_group
    cur.execute("""
        SELECT DISTINCT s.name as subject, yg.label as year_group
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        JOIN year_groups yg ON t.year_group_id = yg.id
        WHERE t.is_published = true
          AND s.name IN ('Maths','English','Science','History','Geography')
          AND yg.label IN ('year-1','year-2','year-3','year-4','year-5','year-6','year-7','year-8','year-9')
        ORDER BY s.name, yg.label
    """)
    combos = cur.fetchall()

    total_new_chunks = 0
    total_skipped = 0
    topics_triggered = 0

    for row in combos:
        subject = row["subject"]
        year_group = row["year_group"]
        oslug = SUBJECT_SLUG.get(subject)
        ks = YEAR_TO_KS.get(year_group)
        if not oslug or not ks:
            continue

        # Fetch Oak units for this subject/KS
        units_resp = oak_get(f"/units?subjectSlug={oslug}&keystageSlug={ks}")
        if not units_resp:
            continue
        units = units_resp if isinstance(units_resp, list) else units_resp.get("data", [])

        for unit in units[:15]:  # cap per subject/year to avoid runaway
            unit_title = unit.get("unitTitle") or unit.get("title", "")
            lessons_resp = oak_get(f"/lessons?unitSlug={unit.get('unitSlug','')}&subjectSlug={oslug}&keystageSlug={ks}")
            if not lessons_resp:
                continue
            lessons = lessons_resp if isinstance(lessons_resp, list) else lessons_resp.get("data", [])

            for lesson in lessons[:8]:
                lesson_title = lesson.get("lessonTitle") or lesson.get("title", "")
                keywords = lesson.get("lessonKeywords") or []
                intro = lesson.get("pupilLessonOutcome") or lesson.get("introText") or ""

                # Build chunk text
                kw_text = " | ".join(
                    f"{k['keyword']}: {k['description']}" for k in keywords if isinstance(k, dict) and k.get("keyword")
                ) if keywords else ""
                chunk_text = f"{unit_title} — {lesson_title}"
                if kw_text:
                    chunk_text += f"\nKeywords: {kw_text}"
                if intro:
                    chunk_text += f"\n{intro[:400]}"

                if len(chunk_text.strip()) < 30:
                    continue

                # Embed
                emb = pl.embed_text(chunk_text)
                if emb is None:
                    continue
                emb_list = emb.tolist()

                # Dedup check against existing chunks for same subject+year
                cur.execute("""
                    SELECT 1 FROM curriculum_chunks
                    WHERE subject = %s AND year_group = %s
                      AND embedding <=> %s::vector < %s
                    LIMIT 1
                """, (subject, year_group, str(emb_list), 1 - SIM_THRESHOLD))
                if cur.fetchone():
                    total_skipped += 1
                    continue

                # Insert new chunk
                cur.execute("""
                    INSERT INTO curriculum_chunks (id, subject, year_group, source_name, chunk_text, embedding)
                    VALUES (%s, %s, %s, %s, %s, %s::vector)
                    ON CONFLICT DO NOTHING
                """, (str(uuid.uuid4()), subject, year_group, SOURCE, chunk_text, str(emb_list)))
                total_new_chunks += 1

        conn.commit()

    # Now trigger generation for thin topics (< 15 published questions)
    cur.execute("""
        SELECT t.id, t.title, s.name as subject, yg.label as year_group,
               COUNT(qq.id) FILTER (WHERE qq.status = 'published') as pub_count
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        JOIN year_groups yg ON t.year_group_id = yg.id
        LEFT JOIN quiz_questions qq ON qq.topic_id = t.id
        WHERE t.is_published = true
        GROUP BY t.id, t.title, s.name, yg.label
        HAVING COUNT(qq.id) FILTER (WHERE qq.status = 'published') < 15
        ORDER BY pub_count ASC
        LIMIT 20
    """)
    thin_topics = cur.fetchall()

    for topic_row in thin_topics:
        try:
            for tier in ("sprout", "explorer", "lightning"):
                pl.run_for_topic(str(topic_row["id"]), tier, 5)
            topics_triggered += 1
        except Exception as exc:
            log.error(f"oak-daily-update: generation error for topic {topic_row['id']}: {exc}")

    cur.close()
    conn.close()

    log.info(f"oak-daily-update complete: {total_new_chunks} new chunks, {total_skipped} skipped (dedup), {topics_triggered} thin topics topped up")
