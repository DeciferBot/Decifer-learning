"""Decipher Learning — content pipeline microservice.

Phase 0 scaffold only. Verifiers, RAG, and pipeline stages land in Phase 3+.
See CLAUDE.md §9.
"""

from fastapi import FastAPI

app = FastAPI(title="Decipher Learning Content Pipeline", version="0.0.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
