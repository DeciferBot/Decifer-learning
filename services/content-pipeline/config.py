"""Runtime configuration for the Decifer Learning content pipeline."""

import os
from pathlib import Path

# Load .env in the service directory (Cloud Run injects real values as OS env from Secret Manager)
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_file)

ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")
DATABASE_URL: str      = os.environ.get("DATABASE_URL", "")

# Embeddings via sentence-transformers (local, no API key needed).
EMBEDDINGS_ENABLED: bool = True
EMBEDDING_MODEL          = "all-MiniLM-L6-v2"
EMBEDDING_DIM            = 384

CLAUDE_MODEL = "claude-sonnet-4-6"

PIPELINE_VERSION = "1.1.0"  # Phase 11A

DEDUP_SIMILARITY_THRESHOLD = 0.92
MAX_PIPELINE_CYCLES        = 5

# ── Per-type confidence thresholds (CLAUDE.md §8) ────────────────────────
# 85 = computationally verifiable; 90 = RAG-grounded / open factual.
# Default = 90 (fail safe: unknown types get the highest bar).

CONFIDENCE_THRESHOLDS: dict[str, float] = {
    # Maths
    "maths_arithmetic":            85.0,
    "maths_algebra":               85.0,
    "maths_geometry":              85.0,
    # Physics
    "science_physics_calculation": 85.0,
    # Chemistry
    "science_chemistry_equation":  85.0,
    "chemistry_element_fact":      85.0,
    # English — computationally verifiable
    "english_grammar":             85.0,
    "english_spelling":            85.0,
    # English — RAG-only
    "english_comprehension":       90.0,
    "english_vocabulary":          90.0,
    "english_literary_analysis":   90.0,
    # Science — RAG-only
    "biology_factual":             90.0,
    "science_factual":             90.0,
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
})


def get_confidence_threshold(question_type: str) -> float:
    """Return the publish threshold for a given question_type."""
    return CONFIDENCE_THRESHOLDS.get(question_type, DEFAULT_CONFIDENCE_THRESHOLD)
