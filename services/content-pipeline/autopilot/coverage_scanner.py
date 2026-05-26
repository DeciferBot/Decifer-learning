"""
coverage_scanner.py — Topic coverage state scanner for the Decifer Learning autopilot.

Scans every curriculum topic and classifies it into one of 8 states:

    LIVE               — is_published=True, ≥10 published Q, ≥1 published LC
    NEED_Q             — has some published Q but below the 10-Q gate
    EMPTY              — 0 published Q, 0 published LC
    WEAK               — published but has flagged questions
    READY_FOR_GENERATION — 0 published Q, RAG chunks present, not blocked
    READY_FOR_TOPUP    — 0 < pub_q < 10, RAG chunks present, not blocked
    BLOCKED            — ≥ BLOCKED_THRESHOLD recent errors; needs human review
    QUARANTINED        — has flagged questions; anomaly detection raised an issue

Usage (standalone):
    python3 -c "
    from autopilot.coverage_scanner import scan_coverage, print_coverage
    rows = scan_coverage()
    print_coverage(rows)
    "

Or import and use programmatically:
    from autopilot.coverage_scanner import scan_coverage, CoverageState
    rows = scan_coverage(year_filter='year-3')
    live = [r for r in rows if r.state == CoverageState.LIVE]
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import psycopg2
import psycopg2.extras
from pgvector.psycopg2 import register_vector

# ── Constants ─────────────────────────────────────────────────────────────────

MIN_QUESTIONS = 10
MIN_LEARN_CONTENT = 1
BLOCKED_ERROR_THRESHOLD = 20  # ≥ this many recent generation errors → BLOCKED


# ── State enum ────────────────────────────────────────────────────────────────

class CoverageState(str, Enum):
    LIVE                  = "LIVE"
    NEED_Q                = "NEED_Q"
    EMPTY                 = "EMPTY"
    WEAK                  = "WEAK"
    READY_FOR_GENERATION  = "READY_FOR_GENERATION"
    READY_FOR_TOPUP       = "READY_FOR_TOPUP"
    BLOCKED               = "BLOCKED"
    QUARANTINED           = "QUARANTINED"


_STATE_SYMBOL = {
    CoverageState.LIVE:                  "🌟",
    CoverageState.NEED_Q:                "🔒",
    CoverageState.EMPTY:                 "⬜",
    CoverageState.WEAK:                  "⚠️ ",
    CoverageState.READY_FOR_GENERATION:  "🚀",
    CoverageState.READY_FOR_TOPUP:       "📈",
    CoverageState.BLOCKED:               "🚫",
    CoverageState.QUARANTINED:           "🔴",
}


# ── Data class ────────────────────────────────────────────────────────────────

@dataclass
class TopicCoverage:
    topic_id: str
    title: str
    slug: str
    year_group: str
    subject: str
    is_published: bool
    pub_q: int
    staged_q: int
    flagged_q: int
    pub_lc: int
    recent_errors: int
    last_error: Optional[str]
    chunk_count: int
    state: CoverageState
    recommended_action: str

    @property
    def questions_needed(self) -> int:
        return max(0, MIN_QUESTIONS - self.pub_q)

    @property
    def state_symbol(self) -> str:
        return _STATE_SYMBOL.get(self.state, "?")

    def as_dict(self) -> dict:
        return {
            "topic_id": self.topic_id,
            "title": self.title,
            "slug": self.slug,
            "year_group": self.year_group,
            "subject": self.subject,
            "is_published": self.is_published,
            "pub_q": self.pub_q,
            "staged_q": self.staged_q,
            "flagged_q": self.flagged_q,
            "pub_lc": self.pub_lc,
            "recent_errors": self.recent_errors,
            "last_error": self.last_error,
            "chunk_count": self.chunk_count,
            "state": self.state.value,
            "recommended_action": self.recommended_action,
            "questions_needed": self.questions_needed,
        }


# ── Classification ────────────────────────────────────────────────────────────

def _classify(row: dict) -> TopicCoverage:
    pub_q       = int(row["pub_q"] or 0)
    staged_q    = int(row["staged_q"] or 0)
    flagged_q   = int(row["flagged_q"] or 0)
    pub_lc      = int(row["pub_lc"] or 0)
    is_pub      = bool(row["is_published"])
    errors      = int(row["recent_errors"] or 0)
    chunk_count = int(row["chunk_count"] or 0)
    last_error  = row.get("last_error")

    # Priority-ordered classification.
    #
    # Content-readiness checks (LIVE / promote / generate_learn_content) come
    # BEFORE the BLOCKED check.  A topic that has already reached the publish
    # gate (10Q + LC + is_published) is LIVE regardless of how many generation
    # errors accumulated on the way there.  Putting BLOCKED first would hide
    # live topics behind their error history and cause the autopilot to keep
    # trying to generate more questions for topics that are already complete.

    if pub_q >= MIN_QUESTIONS and pub_lc >= MIN_LEARN_CONTENT and is_pub:
        if flagged_q > 0:
            # Published but has flagged questions — monitor via anomaly detection
            state  = CoverageState.QUARANTINED
            action = "regenerate_flagged"
        else:
            state  = CoverageState.LIVE
            action = "monitor"

    elif pub_q >= MIN_QUESTIONS and pub_lc >= MIN_LEARN_CONTENT and not is_pub:
        # Q and LC present but topic not promoted yet
        state  = CoverageState.NEED_Q
        action = "promote"

    elif pub_q >= MIN_QUESTIONS and pub_lc == 0:
        # Has enough Q but missing learn content
        state  = CoverageState.NEED_Q
        action = "generate_learn_content"

    elif errors >= BLOCKED_ERROR_THRESHOLD:
        # Too many recent errors and not yet at the content threshold → blocked
        state  = CoverageState.BLOCKED
        action = "manual_review"

    elif pub_q > 0 and flagged_q > 0 and not is_pub:
        state  = CoverageState.WEAK
        action = "regenerate_flagged"

    elif pub_q > 0 and pub_q < MIN_QUESTIONS:
        if chunk_count > 0:
            state  = CoverageState.READY_FOR_TOPUP
            action = "topup"
        else:
            state  = CoverageState.NEED_Q
            action = "enrich_rag_then_topup"

    elif pub_q == 0:
        if chunk_count > 0:
            state  = CoverageState.READY_FOR_GENERATION
            action = "generate"
        else:
            state  = CoverageState.EMPTY
            action = "enrich_rag_then_generate"

    else:
        state  = CoverageState.EMPTY
        action = "generate"

    return TopicCoverage(
        topic_id=row["topic_id"],
        title=row["title"],
        slug=row.get("slug") or "",
        year_group=row["year_group"],
        subject=row["subject"],
        is_published=is_pub,
        pub_q=pub_q,
        staged_q=staged_q,
        flagged_q=flagged_q,
        pub_lc=pub_lc,
        recent_errors=errors,
        last_error=last_error,
        chunk_count=chunk_count,
        state=state,
        recommended_action=action,
    )


# ── DB query ──────────────────────────────────────────────────────────────────

def _fetch_raw(
    database_url: str,
    year_filter: Optional[str] = None,
    subject_filter: Optional[str] = None,
) -> list[dict]:
    conn = psycopg2.connect(database_url)
    register_vector(conn)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            where: list[str] = []
            params: list = []
            if year_filter:
                where.append("LOWER(yg.label) = LOWER(%s)")
                params.append(year_filter)
            if subject_filter:
                where.append("LOWER(s.name) = LOWER(%s)")
                params.append(subject_filter)
            where_sql = ("WHERE " + " AND ".join(where)) if where else ""

            cur.execute(
                f"""
                SELECT
                    t.id::text           AS topic_id,
                    t.title,
                    t.slug,
                    t.is_published,
                    yg.label             AS year_group,
                    s.name               AS subject,
                    COUNT(qq.id) FILTER (WHERE qq.status = 'published') AS pub_q,
                    COUNT(qq.id) FILTER (WHERE qq.status = 'staged')    AS staged_q,
                    COUNT(qq.id) FILTER (WHERE qq.status = 'flagged')   AS flagged_q,
                    COUNT(lc.id) FILTER (WHERE lc.status = 'published') AS pub_lc,
                    (
                        SELECT COUNT(*) FROM generation_errors ge
                        WHERE ge.topic_id = t.id
                          AND ge.created_at > NOW() - INTERVAL '30 days'
                    ) AS recent_errors,
                    (
                        SELECT ge.error_message FROM generation_errors ge
                        WHERE ge.topic_id = t.id
                        ORDER BY ge.created_at DESC LIMIT 1
                    ) AS last_error,
                    (
                        SELECT COUNT(*) FROM curriculum_chunks cc
                        WHERE cc.subject = s.name AND cc.year_group = yg.label
                    ) AS chunk_count
                FROM topics t
                JOIN year_groups yg ON yg.id = t.year_group_id
                JOIN subjects    s  ON s.id  = t.subject_id
                LEFT JOIN quiz_questions qq ON qq.topic_id = t.id
                LEFT JOIN learn_content  lc ON lc.topic_id = t.id
                {where_sql}
                GROUP BY t.id, t.title, t.slug, t.is_published, yg.label, s.name
                ORDER BY s.name, yg.label, t.order_index, t.slug
                """,
                params,
            )
            return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


# ── Public API ────────────────────────────────────────────────────────────────

def scan_coverage(
    database_url: str,
    year_filter: Optional[str] = None,
    subject_filter: Optional[str] = None,
) -> list[TopicCoverage]:
    """Return classified TopicCoverage objects for every topic."""
    rows = _fetch_raw(database_url, year_filter=year_filter, subject_filter=subject_filter)
    return [_classify(r) for r in rows]


def coverage_summary(topics: list[TopicCoverage]) -> dict:
    """Return a dict of state → count for a coverage list."""
    counts: dict[str, int] = {s.value: 0 for s in CoverageState}
    for t in topics:
        counts[t.state.value] += 1
    counts["total"] = len(topics)
    return counts


# ── Pretty printer ────────────────────────────────────────────────────────────

def print_coverage(topics: list[TopicCoverage], verbose: bool = False) -> None:
    summary = coverage_summary(topics)
    total   = summary["total"]

    print(f"\n{'═' * 80}")
    print(f"  DECIFER LEARNING — AUTOPILOT COVERAGE SCAN")
    print(
        f"  {total} topics  |  "
        f"🌟 {summary['LIVE']} LIVE  |  "
        f"🔒 {summary['NEED_Q']} NEED_Q  |  "
        f"⬜ {summary['EMPTY']} EMPTY  |  "
        f"🚀 {summary['READY_FOR_GENERATION']} READY_GEN  |  "
        f"📈 {summary['READY_FOR_TOPUP']} READY_TOPUP"
    )
    if summary["BLOCKED"] or summary["QUARANTINED"] or summary["WEAK"]:
        print(
            f"  ⚠️  {summary['BLOCKED']} BLOCKED  |  "
            f"🔴 {summary['QUARANTINED']} QUARANTINED  |  "
            f"⚠️  {summary['WEAK']} WEAK"
        )
    print(f"{'═' * 80}\n")

    current_group: Optional[tuple] = None
    for t in sorted(topics, key=lambda x: (x.year_group, x.subject, x.state.value, x.slug)):
        group_key = (t.year_group, t.subject)
        if group_key != current_group:
            if current_group is not None:
                print()
            current_group = group_key
            print(f"  ── {t.year_group} · {t.subject}")
            print(f"  {'Title':<36} {'Q':>6} {'LC':>3} {'Err':>4}  {'State':<24}  Action")
            print(f"  {'─' * 80}")

        q_disp  = f"{t.pub_q}/{MIN_QUESTIONS}"
        err_disp = f"{t.recent_errors}" if t.recent_errors else "-"
        line = (
            f"  {t.title[:36]:<36} {q_disp:>6} {t.pub_lc:>3} {err_disp:>4}  "
            f"{t.state_symbol} {t.state.value:<20}  {t.recommended_action}"
        )
        print(line)
        if verbose and t.last_error:
            print(f"    └─ last error: {t.last_error[:100]}")

    print()
