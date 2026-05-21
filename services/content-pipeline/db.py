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


# ── Curriculum chunks ─────────────────────────────────────────────────────

def retrieve_chunks(
    subject: str,
    year_group_label: str,
    query_embedding: Optional[np.ndarray],
    limit: int = 5,
) -> list[dict]:
    """Return top-N curriculum chunks for RAG generation.

    If query_embedding is None (embeddings disabled) or no embedded chunks
    exist, returns up to `limit` chunks in arbitrary order (for Maths, RAG
    grounding is optional — CLAUDE.md §8).
    """
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if query_embedding is not None:
                cur.execute(
                    """
                    SELECT id, chunk_text, source_name
                    FROM curriculum_chunks
                    WHERE subject = %s AND year_group = %s
                      AND embedding IS NOT NULL
                    ORDER BY embedding <=> %s
                    LIMIT %s
                    """,
                    (subject, year_group_label, query_embedding, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT id, chunk_text, source_name
                    FROM curriculum_chunks
                    WHERE subject = %s AND year_group = %s
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

def get_published_embeddings(topic_id: str) -> list[np.ndarray]:
    """Return embeddings of all published questions for a topic (for dedup)."""
    with get_connection() as conn:
        register_vector(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT embedding FROM curriculum_chunks
                WHERE id IN (
                    SELECT unnest(source_chunk_ids::uuid[])
                    FROM quiz_questions
                    WHERE topic_id = %s AND status = 'published'
                )
                """,
                (topic_id,),
            )
            # We actually embed question_text, not source chunks. Use a simpler approach:
            # store the question embedding in a side-channel or re-embed on the fly.
            # For Phase 3, we embed question_text separately below.
            return []


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


# ── Question write-back ────────────────────────────────────────────────────

def write_question(
    topic_id: str,
    tier: str,
    question_data: dict,
    status: str,
    confidence_score: float,
) -> str:
    """Insert a quiz_question row. Returns the new question id."""
    question_id = str(uuid.uuid4())
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO quiz_questions (
                    id, topic_id, tier, question_text, question_type,
                    correct_answer, distractors,
                    hint_1, hint_2, hint_3, explanation,
                    source_chunk_ids, confidence_score, status
                ) VALUES (
                    %s, %s, %s::\"Tier\", %s, %s,
                    %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s::\"ContentStatus\"
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
