"""Decifer Learning — content pipeline microservice.

Phase 3 endpoints:
  GET  /health         liveness probe
  POST /verify/maths   test the maths verifier (gate check)
  POST /ingest         seed curriculum_chunks with embedded text
  POST /generate       run the 6-stage pipeline for a topic + tier

Physics / chemistry / English verifiers are Phase 11. CLAUDE.md §9.
"""

import logging
import sys
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(stream=sys.stdout, level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("main")

app = FastAPI(title="Decifer Learning Content Pipeline", version="0.3.0")


# ── /health ───────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": "0.3.0"}


# ── /verify/maths ─────────────────────────────────────────────────────────

class VerifyMathsRequest(BaseModel):
    question_type: str
    correct_answer: str
    verification_expression: Optional[str] = None
    verification_equation: Optional[str] = None
    verification_variable: Optional[str] = "x"


class VerifyMathsResponse(BaseModel):
    verified: bool
    detail: str


@app.post("/verify/maths", response_model=VerifyMathsResponse)
def verify_maths(req: VerifyMathsRequest) -> VerifyMathsResponse:
    """Test the maths verifier in isolation (used by the Phase 3 gate check)."""
    from verifiers import maths as mv
    verified, detail = mv.verify(req.model_dump())
    return VerifyMathsResponse(verified=verified, detail=detail)


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
    """Seed curriculum_chunks in a single DB round-trip. Computes embeddings if OPENAI_API_KEY set."""
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
    results: list[QuestionResult]


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    """Run the 6-stage pipeline to generate questions for a topic."""
    import pipeline as pl

    if req.tier not in ("sprout", "explorer", "lightning"):
        raise HTTPException(status_code=400, detail="tier must be sprout | explorer | lightning")
    if not (1 <= req.count <= 50):
        raise HTTPException(status_code=400, detail="count must be 1–50")

    import config
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
