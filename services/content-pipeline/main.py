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
"""

import logging
import sys
from typing import Optional

from fastapi import FastAPI, HTTPException
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


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    import pipeline as pl
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

    return GenerateBatchResponse(
        total_published=total_published,
        total_staged=total_staged,
        total_failed=total_failed,
        results=batch_results,
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
