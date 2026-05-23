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

CLAUDE_MODEL               = "claude-sonnet-4-6"

MATHS_CONFIDENCE_THRESHOLD = 85.0
DEDUP_SIMILARITY_THRESHOLD = 0.92
MAX_PIPELINE_CYCLES        = 5
