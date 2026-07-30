"""Runtime configuration for the Decifer Learning content pipeline."""

import os
from pathlib import Path

# Load .env in the service directory (Cloud Run injects real values as OS env from Secret Manager)
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_file)

ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")


def _psycopg2_safe_dsn(url: str) -> str:
    """Strip Prisma-only query params (e.g. pgbouncer=true) that psycopg2 rejects."""
    if not url or "?" not in url:
        return url
    from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
    parts = urlsplit(url)
    params = [(k, v) for k, v in parse_qsl(parts.query) if k.lower() not in ("pgbouncer", "connection_limit", "pool_timeout")]
    return urlunsplit(parts._replace(query=urlencode(params)))


# Prefer the direct (non-pooled) connection for long-running pipeline work.
DATABASE_URL: str = _psycopg2_safe_dsn(
    os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL", "")
)

# Embeddings via sentence-transformers (local, no API key needed).
EMBEDDINGS_ENABLED: bool = True
EMBEDDING_MODEL          = "all-MiniLM-L6-v2"
EMBEDDING_DIM            = 384

CLAUDE_MODEL = "claude-sonnet-4-6"  # Anthropic fallback only (used when DO inference is down/unset)

# ── Primary LLM: DigitalOcean serverless inference (OpenAI-compatible) ────
# 2026-07-30: all pipeline LLM calls moved off Sonnet to cut API spend.
# Generation/repair use DeepSeek's flagship; the cheaper flash model handles
# the consensus + constitutional judge calls. Quality is still gated by the
# code verifiers, dedup, and §8 confidence thresholds — a weak generation
# lands in 'staged', never 'published'.
DO_API_TOKEN: str = os.environ.get("DO_API_TOKEN", "") or os.environ.get("DO_INFERENCE_API_KEY", "")
DO_INFERENCE_BASE_URL = "https://inference.do-ai.run/v1"
GENERATION_MODEL = "deepseek-v4-pro"   # Stage 1 generation + fix/repair calls
CHECK_MODEL      = "deepseek-4-flash"  # Stage 3 consensus + Stage 4 constitutional

PIPELINE_VERSION = "1.1.1"  # Phase 2A.12

DEDUP_SIMILARITY_THRESHOLD = 0.78  # tightened from 0.82 — catches near-paraphrases of the same fact
MAX_PIPELINE_CYCLES        = 5

# ── Per-type confidence thresholds (CLAUDE.md §8) ────────────────────────
# 85 = computationally verifiable; 90 = RAG-grounded / open factual.
# Default = 90 (fail safe: unknown types get the highest bar).

CONFIDENCE_THRESHOLDS: dict[str, float] = {
    # Maths
    "maths_arithmetic":            85.0,
    "maths_algebra":               85.0,
    "maths_geometry":              85.0,
    # Descriptive-answer maths MCQ (e.g. graph transformations): the answer is a
    # phrase like "Translation 5 units up", not a number, so there is no numeric
    # verifier. Correctness is enforced by consensus (Stage 3) + constitution
    # (Stage 4); reaches 85 = verified-passthrough(60) + consensus(25).
    "maths_concept":               85.0,
    # Physics
    "science_physics_calculation": 85.0,
    # Chemistry
    "science_chemistry_equation":  85.0,
    "chemistry_element_fact":      85.0,
    # English — computationally verifiable
    "english_grammar":             85.0,
    "english_spelling":            85.0,
    "english_phonics":             85.0,
    # English — RAG-only
    "english_comprehension":       90.0,
    "english_vocabulary":          90.0,
    "english_literary_analysis":   90.0,
    # Science — RAG-only
    "biology_factual":             90.0,
    "science_factual":             90.0,
    # Humanities — RAG-only
    "history_factual":             90.0,
    "geography_factual":           90.0,
}

DEFAULT_CONFIDENCE_THRESHOLD = 90.0

# Legacy alias kept for backwards compatibility
MATHS_CONFIDENCE_THRESHOLD = 85.0

# Question types that REQUIRE non-empty source_chunk_ids (Stage 6 enforcement)
RAG_REQUIRED_TYPES: frozenset[str] = frozenset({
    "english_comprehension",
    "english_vocabulary",
    "english_literary_analysis",
    "biology_factual",
    "science_factual",
    "history_factual",
    "geography_factual",
})


def get_confidence_threshold(question_type: str) -> float:
    """Return the publish threshold for a given question_type."""
    return CONFIDENCE_THRESHOLDS.get(question_type, DEFAULT_CONFIDENCE_THRESHOLD)


# ── Year group → key stage ────────────────────────────────────────────────────
# Retrieval and the Stage-6 grounding gate both match source chunks at KEY STAGE
# granularity, not exact year. Our curriculum and the Oak source material disagree
# about which year a topic belongs to, and the disagreement is systematic: the UK
# NC fixes the key stage but leaves the year to the school. Measured on prod, the
# material for a topic is routinely filed one year later than we file the topic —
# Maya is 52 chunks in Y5 but 298 in Y6, early Islamic civilisation is 117 in Y4
# but 588 in Y5, and "Britain 1745-1901" had *zero* usable Y7 chunks while Y8+Y9
# hold ~600. Filtering on exact year made the right sources unreachable, so
# retrieval returned the nearest wrong-period Y7 chunks (Edward I, Elizabeth I)
# and a question about Edward IV scored a clean 90 inside a topic about the
# Industrial Revolution. Key stage is the honest unit of comparison.
YEAR_KEY_STAGE: dict[str, str] = {
    "year-1": "KS1", "year-2": "KS1",
    "year-3": "KS2", "year-4": "KS2", "year-5": "KS2", "year-6": "KS2",
    "year-7": "KS3", "year-8": "KS3", "year-9": "KS3",
    "year-10": "KS4", "year-11": "KS4",
}


def key_stage_for(year_group_label: str) -> str:
    """Return the key stage for a year label, or '' if unknown."""
    return YEAR_KEY_STAGE.get((year_group_label or "").strip().lower(), "")


def years_in_key_stage(year_group_label: str) -> list[str]:
    """Return every year label sharing a key stage with this one.

    Falls back to just the given label when the year is unrecognised, so an
    unexpected label narrows retrieval rather than opening it to everything.
    """
    ks = key_stage_for(year_group_label)
    if not ks:
        return [year_group_label]
    return [y for y, s in YEAR_KEY_STAGE.items() if s == ks]
