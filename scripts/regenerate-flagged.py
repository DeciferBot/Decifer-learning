"""
Regenerate all flagged quiz questions by calling the pipeline's
/pipeline/regenerate-flagged endpoint.

Run on the DO droplet (where PIPELINE_SERVICE_URL points to localhost):
  python scripts/regenerate-flagged.py

Or locally if PIPELINE_SERVICE_URL is set:
  set -a && source .env.local && set +a
  python scripts/regenerate-flagged.py
"""

import os
import sys
import json
import urllib.request
import urllib.error
import time

base_url = os.environ.get("PIPELINE_SERVICE_URL", "http://localhost:8000").rstrip("/")

print(f"\nRegenerate flagged questions")
print(f"  pipeline : {base_url}")

# Health check first
try:
    with urllib.request.urlopen(f"{base_url}/health", timeout=10) as r:
        health = json.loads(r.read())
        print(f"  health   : {health}\n")
except Exception as e:
    print(f"\nERROR: pipeline not reachable at {base_url}: {e}")
    sys.exit(1)

# Call the regenerate-flagged endpoint
req = urllib.request.Request(
    f"{base_url}/pipeline/regenerate-flagged",
    data=b"{}",
    headers={"Content-Type": "application/json"},
    method="POST",
)

print("Starting regeneration run...")
start = time.time()
try:
    with urllib.request.urlopen(req, timeout=600) as r:
        result = json.loads(r.read())
        elapsed = time.time() - start
        print(f"\nDone in {elapsed:.0f}s")
        print(json.dumps(result, indent=2))
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"\nHTTP {e.code}: {body}")
    sys.exit(1)
except Exception as e:
    print(f"\nError: {e}")
    sys.exit(1)
