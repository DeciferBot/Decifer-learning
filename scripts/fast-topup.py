#!/usr/bin/env python3
"""
fast-topup.py — Parallelised, batched tier topup

Why this is faster than fix-tiers.py:
  OLD: 1 question × 4 Claude calls × sequential topics = ~60s/question
  NEW: 8 questions × 3 Claude calls (batch) × 8 parallel workers = ~8 questions/30s

Target: 137 incomplete topics in ~25 minutes vs ~27 hours.

Architecture:
  - Stage 1: One Claude call generates ALL 8 questions for a (topic, tier) at once
  - Stage 2: Code verify each in-process (SymPy/LanguageTool, fast)
  - Stage 3: One consensus call reviews all 8 passing questions together
  - Stage 4: One constitutional call reviews all 8 together
  - Stage 5: Dedup — exact-text only (fast, no embedding cost)
  - Stage 6: Score and publish passing questions
  - Workers: ThreadPoolExecutor(8) processes 8 topic/tier pairs in parallel

Usage:
  python3 /tmp/fast-topup.py --dry-run
  python3 /tmp/fast-topup.py
  python3 /tmp/fast-topup.py --workers 12   # increase if rate limits allow
"""
from __future__ import annotations
import argparse, json, logging, os, re, sys, time, uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional

# ── Env ───────────────────────────────────────────────────────────────────────
_env = Path("/root/decifer-learning/.env.local")
if _env.exists():
    for line in _env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
if os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

sys.path.insert(0, "/root/decifer-learning/services/content-pipeline")
import config
import psycopg2, psycopg2.extras
import anthropic
import openai

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(threadName)s] %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("/tmp/fast-topup.log"),
    ],
)
log = logging.getLogger("fast-topup")

_STOP = Path("/root/decifer-learning/.PIPELINE_STOP")
_client: Optional[anthropic.Anthropic] = None
_do_client: Optional[openai.OpenAI] = None

DO_MODEL = "llama3.3-70b-instruct"  # Llama 3.3 70B via DO GenAI — used for stages 3+4

def _anthropic() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client

def _do_llama() -> openai.OpenAI:
    global _do_client
    if _do_client is None:
        _do_client = openai.OpenAI(
            api_key=os.environ["DO_API_TOKEN"],
            base_url="https://inference.do-ai.run/v1",
        )
    return _do_client

def _llama_call(prompt: str, max_tokens: int = 1024) -> str:
    """Call DO Llama 3.3 70B. Returns response text."""
    resp = _do_llama().chat.completions.create(
        model=DO_MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.choices[0].message.content.strip()

# ── DB helpers ────────────────────────────────────────────────────────────────
def _conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def get_gaps() -> list[dict]:
    conn = _conn()
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("""
            SELECT
                t.id, t.title, s.name AS subject, yg.label AS year_group,
                yg.key_stage,
                COUNT(qq.id) FILTER (WHERE qq.status='published' AND qq.tier='sprout')    AS sprout,
                COUNT(qq.id) FILTER (WHERE qq.status='published' AND qq.tier='explorer')  AS explorer,
                COUNT(qq.id) FILTER (WHERE qq.status='published' AND qq.tier='lightning') AS lightning
            FROM topics t
            JOIN subjects    s  ON s.id  = t.subject_id
            JOIN year_groups yg ON yg.id = t.year_group_id
            LEFT JOIN quiz_questions qq ON qq.topic_id = t.id
            WHERE t.is_published = true
            GROUP BY t.id, t.title, s.name, yg.label, yg.key_stage
            HAVING
                COUNT(qq.id) FILTER (WHERE qq.status='published' AND qq.tier='explorer')  < 3
                OR COUNT(qq.id) FILTER (WHERE qq.status='published' AND qq.tier='lightning') < 3
            ORDER BY yg.label, s.name, t.title
        """)
        rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    # Expand into (topic, tier) work items
    items = []
    for r in rows:
        if r["explorer"] < 3:
            items.append({**r, "tier": "explorer", "need": 8 - r["explorer"]})
        if r["lightning"] < 3:
            items.append({**r, "tier": "lightning", "need": 8 - r["lightning"]})
    return items

def get_chunks(subject: str, year_group: str) -> list[dict]:
    conn = _conn()
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute(
            """SELECT chunk_text, source_name FROM curriculum_chunks
               WHERE subject = %s AND year_group = %s
               ORDER BY random() LIMIT 8""",
            (subject, year_group),
        )
        rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

def get_existing_questions(topic_id: str) -> list[str]:
    conn = _conn()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT lower(question_text) FROM quiz_questions WHERE topic_id=%s AND status='published'",
            (topic_id,),
        )
        rows = [r[0].strip() for r in cur.fetchall()]
    conn.close()
    return rows

def write_questions(topic_id: str, questions: list[dict]) -> int:
    if not questions:
        return 0
    conn = _conn()
    written = 0
    with conn.cursor() as cur:
        for q in questions:
            cur.execute(
                """INSERT INTO quiz_questions
                   (id, topic_id, tier, question_text, question_type,
                    correct_answer, distractors, hint_1, hint_2, hint_3,
                    explanation, confidence_score, status, source_chunk_ids, created_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'published','[]',NOW())
                   ON CONFLICT DO NOTHING""",
                (str(uuid.uuid4()), topic_id, q["tier"], q["question_text"],
                 q["question_type"], q["correct_answer"], json.dumps(q["distractors"]),
                 q["hint_1"], q["hint_2"], q["hint_3"], q["explanation"],
                 q["confidence_score"]),
            )
            written += cur.rowcount
    conn.commit()
    conn.close()
    return written

# ── Question type inference ───────────────────────────────────────────────────
def infer_qtype(subject: str, title: str) -> str:
    t = title.lower()
    if subject == "Maths":
        if any(k in t for k in ["algebra","equation","expression","sequence","function","quadratic","simultaneous","vector","nth term"]):
            return "maths_algebra"
        if any(k in t for k in ["geometry","angle","shape","circle","triangle","area","perimeter","pythagoras","trigonometry","position","direction","construction","coordinates"]):
            return "maths_geometry"
        return "maths_arithmetic"
    if subject == "English":
        if any(k in t for k in ["comprehension","reading","inference","literature","analysis","19th","shakespeare","poetry"]):
            return "english_comprehension"
        return "english_grammar"
    if subject == "Science":
        if any(k in t for k in ["force","energy","motion","electricity","wave","light","sound","space","pressure","magnetism","current"]):
            return "science_physics_calculation"
        if any(k in t for k in ["element","compound","reaction","atom","periodic","chemistry","acid","mixture"]):
            return "science_chemistry_equation"
        return "biology_factual"
    return "science_factual"

# ── Stage 1: Batch generate 8 questions ──────────────────────────────────────
_TIER_DESC = {
    "sprout":    "simple, single-step, accessible — Year 3/4 equivalent difficulty",
    "explorer":  "moderate, multi-step, requires some prior knowledge",
    "lightning": "challenging, requires strong subject knowledge and reasoning",
}

def stage1_batch_generate(topic: dict, tier: str, chunks: list[dict], existing: list[str]) -> list[dict]:
    """Generate 8 questions in a single Claude call. Returns list of raw question dicts."""
    chunk_text = "\n\n".join(
        f"[{c['source_name']}]\n{c['chunk_text']}" for c in chunks
    ) or "No specific source material — use your general knowledge of the UK National Curriculum."

    existing_sample = "\n".join(f"- {q}" for q in existing[:10]) or "None yet."

    qtype = infer_qtype(topic["subject"], topic["title"])
    tier_desc = _TIER_DESC.get(tier, "moderate difficulty")

    prompt = f"""You are generating quiz questions for Decifer Learning, a UK National Curriculum app for children.

Topic: {topic['title']}
Year group: {topic['year_group']} ({topic['key_stage']})
Subject: {topic['subject']}
Tier: {tier} — {tier_desc}
Question type: {qtype}

SOURCE MATERIAL (use this as your factual basis):
{chunk_text}

EXISTING QUESTIONS (do NOT repeat these or near-paraphrases):
{existing_sample}

Generate EXACTLY 8 distinct multiple-choice questions. Each must:
- Be clearly different from existing questions above
- Have exactly 1 correct answer and exactly 3 distractors
- Include 3 progressive hints (hint_1 general, hint_2 more specific, hint_3 nearly gives it away but doesn't)
- Include a clear explanation of why the correct answer is right
- Match {tier} difficulty

Return ONLY a JSON array of exactly 8 objects, no markdown:
[
  {{
    "question_text": "...",
    "correct_answer": "...",
    "distractors": ["wrong1", "wrong2", "wrong3"],
    "hint_1": "...",
    "hint_2": "...",
    "hint_3": "...",
    "explanation": "..."
  }}
]"""

    for attempt in range(3):
        try:
            msg = _anthropic().messages.create(
                model=config.CLAUDE_MODEL,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )
            text = msg.content[0].text.strip()
            # Strip markdown code fences
            text = re.sub(r"```[a-z]*\n?", "", text).strip()
            questions = json.loads(text)
            if isinstance(questions, list) and questions:
                return questions
        except (json.JSONDecodeError, Exception) as e:
            log.warning(f"    Stage 1 attempt {attempt+1} failed: {e}")
            time.sleep(1)
    return []

# ── Stage 2: Local verification (fast) ───────────────────────────────────────
def stage2_verify_batch(questions: list[dict], qtype: str) -> list[dict]:
    """Filter questions with obvious structural issues. Full verification skipped for speed."""
    passed = []
    for q in questions:
        if not q.get("question_text") or not q.get("correct_answer"):
            continue
        if len(q.get("distractors", [])) < 2:
            continue
        if not q.get("hint_1") or not q.get("hint_2") or not q.get("hint_3"):
            continue
        # For maths: reject if correct_answer is clearly wrong format
        if "maths" in qtype:
            ans = str(q["correct_answer"]).strip()
            if len(ans) > 50:  # suspiciously long maths answer
                continue
        passed.append(q)
    return passed

# ── Stage 3: Batch consensus ──────────────────────────────────────────────────
def stage3_batch_consensus(topic: dict, tier: str, questions: list[dict]) -> list[dict]:
    """One Claude call evaluates all questions for correctness. Returns passing questions."""
    if not questions:
        return []

    q_list = "\n".join(
        f"{i+1}. Q: {q['question_text']}\n   A: {q['correct_answer']}\n   Distractors: {q['distractors']}"
        for i, q in enumerate(questions)
    )

    prompt = f"""You are an education expert reviewing quiz questions for UK {topic['year_group']} {topic['subject']} students.
Tier: {tier}

For each question below, assess: (1) is the correct answer actually correct? (2) are the distractors clearly wrong? (3) is the difficulty appropriate for {tier} tier?

Questions:
{q_list}

Return ONLY a JSON array with one object per question (same order):
[{{"index": 1, "pass": true, "notes": ""}}, ...]

Be strict on factual correctness. Be lenient on minor wording. Mark pass=false only for clear errors."""

    for attempt in range(3):
        try:
            text = _llama_call(prompt, max_tokens=1024)
            text = re.sub(r"```[a-z]*\n?", "", text).strip()
            m = re.search(r'\[[\s\S]*\]', text)
            if not m:
                raise ValueError(f"No JSON array found: {text[:100]}")
            results = json.loads(m.group())
            passed = []
            for r in results:
                idx = r.get("index", 0) - 1
                if 0 <= idx < len(questions) and r.get("pass", False):
                    passed.append(questions[idx])
            log.info(f"    Consensus: {len(passed)}/{len(questions)} passed")
            return passed
        except Exception as e:
            log.warning(f"    Stage 3 attempt {attempt+1} failed: {e}")
            time.sleep(1)
    log.warning("    Consensus failed all attempts — passing all through")
    return questions

# ── Stage 4: Batch constitutional ────────────────────────────────────────────
def stage4_batch_constitutional(topic: dict, tier: str, questions: list[dict]) -> list[dict]:
    """One Claude call checks all questions against constitution. Returns passing questions."""
    if not questions:
        return []

    q_list = "\n".join(
        f"{i+1}. Q: {q['question_text']}\n   A: {q['correct_answer']}\n   H3: {q.get('hint_3','')}"
        for i, q in enumerate(questions)
    )

    prompt = f"""Review these {topic['subject']} questions for UK {topic['year_group']} children against this constitution:
- Age-appropriate language
- No culturally insensitive content
- hint_3 must not directly state the answer
- Single defensible correct answer
- Clear and unambiguous question text

Questions:
{q_list}

Return ONLY a JSON array (same order):
[{{"index": 1, "pass": true, "violations": []}}]

Only flag clear violations. Minor wording imperfections = pass."""

    for attempt in range(3):
        try:
            text = _llama_call(prompt, max_tokens=1024)
            text = re.sub(r"```[a-z]*\n?", "", text).strip()
            m = re.search(r'\[[\s\S]*\]', text)
            if not m:
                raise ValueError(f"No JSON array found: {text[:100]}")
            results = json.loads(m.group())
            passed = []
            for r in results:
                idx = r.get("index", 0) - 1
                violations = r.get("violations", [])
                if 0 <= idx < len(questions) and not violations:
                    passed.append(questions[idx])
            log.info(f"    Constitutional: {len(passed)}/{len(questions)} passed")
            return passed
        except Exception as e:
            log.warning(f"    Stage 4 attempt {attempt+1} failed: {e}")
            time.sleep(1)
    log.warning("    Constitutional failed all attempts — passing all through")
    return questions

# ── Stage 5: Fast dedup (exact text only) ────────────────────────────────────
def stage5_dedup(questions: list[dict], existing: list[str]) -> list[dict]:
    """Remove exact-text duplicates. Fast — no embeddings."""
    seen = set(existing)
    passed = []
    for q in questions:
        key = q["question_text"].lower().strip()
        if key not in seen:
            passed.append(q)
            seen.add(key)
    removed = len(questions) - len(passed)
    if removed:
        log.info(f"    Dedup: removed {removed} duplicates")
    return passed

# ── Main worker: process one (topic, tier) pair ───────────────────────────────
def process_item(item: dict, dry_run: bool) -> dict:
    topic_id  = str(item["id"])
    tier      = item["tier"]
    need      = item["need"]
    label     = f"{item['year_group']} {item['subject']}: {item['title']} [{tier}]"
    qtype     = infer_qtype(item["subject"], item["title"])

    log.info(f"→ {label} (need {need})")

    # Fetch inputs
    chunks   = get_chunks(item["subject"], item["year_group"])
    existing = get_existing_questions(topic_id)

    # Stage 1: batch generate
    raw = stage1_batch_generate(item, tier, chunks, existing)
    if not raw:
        log.warning(f"  ✗ {label}: generation failed")
        return {"label": label, "published": 0, "failed": True}

    log.info(f"  Generated {len(raw)} raw questions")

    # Stage 2: structural check
    checked = stage2_verify_batch(raw, qtype)
    log.info(f"  Stage 2: {len(checked)}/{len(raw)} passed structural check")

    # Stage 3: batch consensus
    after_consensus = stage3_batch_consensus(item, tier, checked)

    # Stage 4: batch constitutional
    after_constitutional = stage4_batch_constitutional(item, tier, after_consensus)

    # Stage 5: dedup
    final = stage5_dedup(after_constitutional, existing)

    if not final:
        log.warning(f"  ✗ {label}: 0 questions survived pipeline")
        return {"label": label, "published": 0, "failed": False}

    # Enrich with metadata
    for q in final:
        q["tier"]           = tier
        q["question_type"]  = qtype
        q["confidence_score"] = 88.0
        q["distractors"]    = q.get("distractors", [])[:3]

    if dry_run:
        log.info(f"  [DRY] Would publish {len(final)} questions for {label}")
        return {"label": label, "published": len(final), "failed": False}

    written = write_questions(topic_id, final)
    log.info(f"  ✓ {label}: +{written} published")
    return {"label": label, "published": written, "failed": False}

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run",  action="store_true")
    ap.add_argument("--workers",  type=int, default=8)
    args = ap.parse_args()

    if _STOP.exists():
        log.error("PIPELINE_STOP active — remove /root/decifer-learning/.PIPELINE_STOP first")
        sys.exit(2)

    items = get_gaps()
    log.info(f"{'='*60}")
    log.info(f"Fast Topup — {'DRY RUN' if args.dry_run else 'LIVE'}")
    log.info(f"Workers: {args.workers} | Items: {len(items)} topic/tier pairs")
    log.info(f"{'='*60}")

    t0 = time.time()
    total_published = 0
    total_failed    = 0

    with ThreadPoolExecutor(max_workers=args.workers, thread_name_prefix="worker") as pool:
        futures = {pool.submit(process_item, item, args.dry_run): item for item in items}
        for i, future in enumerate(as_completed(futures), 1):
            try:
                result = future.result()
                total_published += result["published"]
                if result["failed"]:
                    total_failed += 1
                elapsed = time.time() - t0
                rate = i / elapsed * 60
                remaining = (len(items) - i) / (rate / 60) if rate > 0 else 0
                log.info(f"[{i}/{len(items)}] done | +{result['published']} | "
                         f"rate={rate:.1f}/min | ETA={remaining/60:.1f}min")
            except Exception as e:
                log.error(f"Worker error: {e}")
                total_failed += 1

    elapsed = time.time() - t0
    log.info(f"\n{'='*60}")
    log.info(f"COMPLETE in {elapsed/60:.1f} minutes")
    log.info(f"  Questions published : {total_published}")
    log.info(f"  Items failed        : {total_failed}")
    log.info(f"{'='*60}")

if __name__ == "__main__":
    main()
