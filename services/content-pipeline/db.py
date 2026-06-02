"""
Database helpers for the Decifer Learning content pipeline.

All connections use DATABASE_URL (direct Postgres — bypasses pgbouncer and RLS).
This is the pipeline service running on Google Cloud Run; it is never called from browser
or child-facing code. CLAUDE.md §5 (service role in pipeline is fine; service
role key itself is not used here — direct Postgres URL bypasses RLS as postgres
superuser).
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import psycopg2
import psycopg2.extras
from pgvector.psycopg2 import register_vector

import config


def get_connection() -> psycopg2.extensions.connection:
    """Open a direct Postgres connection and register the vector type."""
    if not config.DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")
    conn = psycopg2.connect(config.DATABASE_URL)
    register_vector(conn)
    return conn


# ── Topic lookup ──────────────────────────────────────────────────────────

def get_topic(topic_id: str) -> Optional[dict]:
    """Return topic row joined with year_group label and subject name."""
    conn = get_connection()
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
                WHERE t.id = %s
                """,
                (topic_id,),
            )
            row = cur.fetchone()
    finally:
        conn.close()
    return dict(row) if row else None


# ── Publish-as-available auto-promotion ───────────────────────────────────

def promote_ready_topics(topic_ids: list[str]) -> list[dict]:
    """
    Auto-promote topics to is_published=true once they hit the readiness gate
    (CLAUDE.md Phase 3/11): >= 1 published learn_content AND >= 10 published
    quiz_questions. Practice games are optional — the UI hides Practise when
    no game exists.

    Idempotent. Never flips a topic back to false. Only inspects the given
    topic_ids (typically the topics touched by the just-finished batch) so we
    don't scan the whole topics table on every batch.

    Mirrors scripts/publish-ready-topics.ts (the manual runner). Keep the
    thresholds in sync if either changes.

    Returns [{id, title}] for newly promoted topics.
    """
    if not topic_ids:
        return []

    # topics.id is a uuid column. Cast the parameter so both str inputs (from
    # HTTP requests / Pydantic models) and uuid.UUID inputs (from psycopg2 rows)
    # work without bespoke conversion in callers.
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE topics t
                SET is_published = TRUE
                WHERE t.id = ANY(%s::uuid[])
                  AND t.is_published = FALSE
                  AND (SELECT COUNT(*) FROM learn_content
                       WHERE topic_id = t.id AND status = 'published') >= 1
                  AND (SELECT COUNT(*) FROM quiz_questions
                       WHERE topic_id = t.id AND status = 'published') >= 10
                RETURNING t.id::text AS id, t.title
                """,
                ([str(t) for t in topic_ids],),
            )
            promoted = [dict(r) for r in cur.fetchall()]
            conn.commit()
    finally:
        conn.close()
    return promoted


# ── Flagged question regeneration ────────────────────────────────────────

def get_flagged_questions(limit: int = 20) -> list[dict]:
    """Return up to `limit` quiz_questions with status='flagged', joined with their topic."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT qq.id, qq.topic_id, qq.tier, qq.question_text,
                       t.title AS topic_title,
                       yg.label AS year_group_label, yg.key_stage,
                       s.name   AS subject_name
                FROM quiz_questions qq
                JOIN topics      t  ON t.id  = qq.topic_id
                JOIN year_groups yg ON yg.id = t.year_group_id
                JOIN subjects    s  ON s.id  = t.subject_id
                WHERE qq.status = 'flagged'
                ORDER BY qq.created_at ASC
                LIMIT %s
                """,
                (limit,),
            )
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def mark_question_regenerating(question_id: str) -> None:
    """Set a single question's status to 'regenerating' so it disappears from child view."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE quiz_questions SET status = 'regenerating' WHERE id = %s",
                (question_id,),
            )
            conn.commit()
    finally:
        conn.close()


def mark_question_staged(question_id: str) -> None:
    """Move a question to 'staged' for one-time admin spot-check after regeneration."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE quiz_questions SET status = 'staged' WHERE id = %s",
                (question_id,),
            )
            conn.commit()
    finally:
        conn.close()


# ── Curriculum chunks ─────────────────────────────────────────────────────

def retrieve_chunks(
    subject: str,
    year_group_label: str,
    query_embedding: Optional[np.ndarray],
    limit: int = 8,
) -> list[dict]:
    """Return top-N curriculum chunks for RAG generation.

    Prioritises 'Oak NA rich (OGL v3.0)' chunks by applying a 0.12 distance
    bonus — they contain full lesson transcripts and quiz Q&As which produce
    significantly better generation quality than the thin NC programme docs.

    If query_embedding is None (embeddings disabled) or no embedded chunks
    exist, returns up to `limit` chunks in insertion order, Oak rich first.
    """
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if query_embedding is not None:
                cur.execute(
                    """
                    SELECT id, chunk_text, source_name, subject, year_group
                    FROM curriculum_chunks
                    WHERE subject = %s AND year_group = %s
                      AND embedding IS NOT NULL
                    ORDER BY
                      (embedding <=> %s::vector)
                      - (CASE WHEN source_name = 'Oak NA rich (OGL v3.0)' THEN 0.12 ELSE 0 END)
                    LIMIT %s
                    """,
                    (subject, year_group_label, str(query_embedding.tolist()), limit),
                )
            else:
                cur.execute(
                    """
                    SELECT id, chunk_text, source_name, subject, year_group
                    FROM curriculum_chunks
                    WHERE subject = %s AND year_group = %s
                    ORDER BY
                      CASE WHEN source_name = 'Oak NA rich (OGL v3.0)' THEN 0 ELSE 1 END
                    LIMIT %s
                    """,
                    (subject, year_group_label, limit),
                )
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def bulk_upsert_chunks(chunks: list[dict]) -> tuple[int, int]:
    """Bulk-insert curriculum chunks in a single connection. Returns (inserted, skipped)."""
    inserted = 0
    skipped = 0
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            for chunk in chunks:
                cur.execute(
                    "SELECT id FROM curriculum_chunks WHERE subject=%s AND year_group=%s AND chunk_text=%s",
                    (chunk["subject"], chunk["year_group"], chunk["chunk_text"]),
                )
                if cur.fetchone():
                    skipped += 1
                    continue
                cur.execute(
                    """
                    INSERT INTO curriculum_chunks (id, subject, year_group, source_name, chunk_text, embedding)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        str(uuid.uuid4()),
                        chunk["subject"],
                        chunk["year_group"],
                        chunk["source_name"],
                        chunk["chunk_text"],
                        chunk.get("embedding"),
                    ),
                )
                inserted += 1
        conn.commit()
    finally:
        conn.close()
    return inserted, skipped


# ── Deduplication ─────────────────────────────────────────────────────────

def get_published_question_texts(topic_id: str) -> list[dict]:
    """Return id + question_text for all published questions in a topic."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, question_text
                FROM quiz_questions
                WHERE topic_id = %s AND status = 'published'
                """,
                (topic_id,),
            )
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_published_questions_full(topic_id: str) -> list[dict]:
    """Return question_text, correct_answer, and question_metadata for all published questions.

    Used by the English prompt builder to inject a diversity hint — the LLM is told
    which answers and stimulus sentences already exist so it generates distinct questions.
    Capped at 20 rows to keep prompt size manageable.
    """
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT question_text, correct_answer, question_metadata
                FROM quiz_questions
                WHERE topic_id = %s AND status = 'published'
                ORDER BY created_at DESC
                LIMIT 20
                """,
                (topic_id,),
            )
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


# ── Question write-back ────────────────────────────────────────────────────

def write_question(
    topic_id: str,
    tier: str,
    question_data: dict,
    status: str,
    confidence_score: float,
    generator_version: str = "",
    verifier_version: str = "",
) -> str:
    """Insert a quiz_question row with provenance fields. Returns the new question id."""
    question_id = str(uuid.uuid4())
    published_at = datetime.now(timezone.utc) if status == "published" else None
    question_metadata = question_data.get("question_metadata")

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO quiz_questions (
                    id, topic_id, tier, question_text, question_type,
                    correct_answer, distractors,
                    hint_1, hint_2, hint_3, explanation,
                    source_chunk_ids, confidence_score, status,
                    question_metadata, generator_version, verifier_version, published_at
                ) VALUES (
                    %s, %s, %s::\"Tier\", %s, %s,
                    %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s::\"ContentStatus\",
                    %s, %s, %s, %s
                )
                """,
                (
                    question_id,
                    topic_id,
                    tier,
                    question_data["question_text"],
                    question_data["question_type"],
                    question_data["correct_answer"],
                    json.dumps(question_data.get("distractors", [])),
                    question_data.get("hint_1"),
                    question_data.get("hint_2"),
                    question_data.get("hint_3"),
                    question_data.get("explanation"),
                    json.dumps(question_data.get("source_chunk_ids", [])),
                    confidence_score,
                    status,
                    json.dumps(question_metadata) if question_metadata is not None else None,
                    generator_version or config.PIPELINE_VERSION,
                    verifier_version,
                    published_at,
                ),
            )
        conn.commit()
    finally:
        conn.close()
    return question_id


def count_published_questions(topic_id: str) -> int:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM quiz_questions WHERE topic_id=%s AND status='published'",
                (topic_id,),
            )
            return cur.fetchone()[0]
    finally:
        conn.close()


# ── Pipeline run tracking ─────────────────────────────────────────────────

def create_pipeline_run(
    run_type: str,
    year_group: str,
    subject: str,
    topic_id: Optional[str] = None,
    tier: Optional[str] = None,
) -> str:
    """Create a pipeline_runs row and return its id."""
    run_id = str(uuid.uuid4())
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO pipeline_runs (
                    id, run_type, year_group, subject, topic_id, tier,
                    status, pipeline_version
                ) VALUES (%s, %s, %s, %s, %s, %s, 'running', %s)
                """,
                (run_id, run_type, year_group, subject, topic_id, tier, config.PIPELINE_VERSION),
            )
        conn.commit()
    finally:
        conn.close()
    return run_id


def complete_pipeline_run(
    run_id: str,
    items_attempted: int,
    items_published: int,
    items_staged: int,
    items_failed: int,
    error_log: list[str],
    success: bool = True,
) -> None:
    """Mark a pipeline_runs row as completed or failed."""
    status = "completed" if success else "failed"
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE pipeline_runs SET
                    status = %s,
                    items_attempted = %s,
                    items_published = %s,
                    items_staged = %s,
                    items_failed = %s,
                    error_log = %s,
                    completed_at = now()
                WHERE id = %s
                """,
                (
                    status,
                    items_attempted,
                    items_published,
                    items_staged,
                    items_failed,
                    json.dumps(error_log),
                    run_id,
                ),
            )
        conn.commit()
    finally:
        conn.close()


def get_pipeline_run(run_id: str) -> Optional[dict]:
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM pipeline_runs WHERE id = %s", (run_id,))
            row = cur.fetchone()
    finally:
        conn.close()
    return dict(row) if row else None


def list_pipeline_runs(limit: int = 50) -> list[dict]:
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT %s",
                (limit,),
            )
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def cancel_pipeline_run(run_id: str) -> bool:
    """Mark a running pipeline run as cancelled. Returns True if updated."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE pipeline_runs SET status = 'cancelled', completed_at = now()
                WHERE id = %s AND status = 'running'
                """,
                (run_id,),
            )
            updated = cur.rowcount > 0
        conn.commit()
    finally:
        conn.close()
    return updated


# ── Generation error tracking ─────────────────────────────────────────────

def write_generation_error(
    pipeline_run_id: Optional[str],
    topic_id: Optional[str],
    question_type: Optional[str],
    tier: Optional[str],
    stage_failed: Optional[int],
    error_message: str,
    raw_llm_output: Optional[dict] = None,
) -> str:
    """Write a generation_errors row. Returns the new error id."""
    error_id = str(uuid.uuid4())
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO generation_errors (
                    id, pipeline_run_id, topic_id, question_type, tier,
                    stage_failed, error_message, raw_llm_output
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    error_id,
                    pipeline_run_id,
                    topic_id,
                    question_type,
                    tier,
                    stage_failed,
                    error_message,
                    json.dumps(raw_llm_output) if raw_llm_output is not None else None,
                ),
            )
        conn.commit()
    finally:
        conn.close()
    return error_id


# ── Coverage dashboard queries ────────────────────────────────────────────

def get_topic_coverage(year_group: Optional[str] = None, subject: Optional[str] = None) -> list[dict]:
    """Return topic coverage stats for the admin coverage dashboard."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            params = []
            where_clauses = []
            if year_group:
                where_clauses.append("yg.label = %s")
                params.append(year_group)
            if subject:
                where_clauses.append("s.name = %s")
                params.append(subject)

            where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

            cur.execute(
                f"""
                SELECT
                    t.id,
                    t.title,
                    t.is_published,
                    yg.label AS year_group,
                    s.name   AS subject,
                    COUNT(CASE WHEN qq.status = 'published' THEN 1 END) AS published_questions,
                    COUNT(CASE WHEN qq.status = 'staged'    THEN 1 END) AS staged_questions,
                    COUNT(CASE WHEN qq.status = 'flagged'   THEN 1 END) AS flagged_questions
                FROM topics t
                JOIN year_groups yg ON yg.id = t.year_group_id
                JOIN subjects    s  ON s.id  = t.subject_id
                LEFT JOIN quiz_questions qq ON qq.topic_id = t.id
                {where_sql}
                GROUP BY t.id, t.title, t.is_published, yg.label, s.name
                ORDER BY s.name, yg.label, t.order_index
                """,
                params,
            )
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()
