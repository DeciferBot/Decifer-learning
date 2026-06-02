"""
Ingest Oak National Academy rich lesson content into curriculum_chunks.

Pulls three data sources per lesson (all OGL v3.0):
  1. TRANSCRIPT  — full teaching explanation text, chunked into paragraphs
                   (~400–600 chars each). Best RAG source for question grounding.
  2. QUIZ Q&As   — text-based starter + exit quiz questions with correct answer
                   and distractors. Pre-verified Q&A pairs for direct use.
  3. SUMMARY     — keywords, key learning points, misconceptions, teacher tips.
                   Existing script only used this; we keep it but add misconceptions.

Skips image-only quiz questions (no usable text answer).
Deduplicates against existing Oak chunks for the same subject+year.
All chunks tagged source_name='Oak NA rich (OGL v3.0)'.

Usage:
  python3 scripts/ingest-oak-rich.py --subject English --years year-3 --dry-run
  python3 scripts/ingest-oak-rich.py --all
  python3 scripts/ingest-oak-rich.py --subject Maths English --years year-3 year-7
"""
from __future__ import annotations
import argparse, json, os, re, sys, time, uuid, urllib.request, urllib.parse, subprocess
from pathlib import Path

_e = subprocess.run(
    ["bash", "-c", "set -a && source /root/decifer-learning/.env.local && set +a && env"],
    capture_output=True, text=True).stdout
for line in _e.splitlines():
    if "=" in line:
        k, _, v = line.partition("="); os.environ.setdefault(k, v)
if not os.environ.get("DATABASE_URL") and os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

sys.path.insert(0, "/root/decifer-learning/services/content-pipeline")
import config
from pipeline import embed_text
import psycopg2, psycopg2.extras

OAK_BASE = "https://open-api.thenational.academy/api/v0"
OAK_KEY  = os.environ.get("OAK_API_KEY", "").strip().strip('"')
SUBJECT_SLUG = {
    "Maths": "maths", "English": "english", "Science": "science",
    "History": "history", "Geography": "geography",
}
YEAR_TO_KS = {
    "year-1": "ks1", "year-2": "ks1",
    "year-3": "ks2", "year-4": "ks2", "year-5": "ks2", "year-6": "ks2",
    "year-7": "ks3", "year-8": "ks3", "year-9": "ks3",
}
SOURCE = "Oak NA rich (OGL v3.0)"
CHUNK_MAX = 600      # chars per transcript paragraph chunk
CHUNK_MIN = 80       # discard chunks shorter than this


# ── HTTP helper ──────────────────────────────────────────────────────────────

def oak(path: str):
    url = path if path.startswith("http") else f"{OAK_BASE}{path}"
    req = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {OAK_KEY}", "User-Agent": "Decifer-Learning/1.0"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as ex:
            if ex.code in (429, 500, 502, 503):
                time.sleep(3 * (attempt + 1)); continue
            if ex.code in (400, 404):
                return None
            raise
        except Exception:
            time.sleep(2); continue
    return None


# ── Chunk builders ────────────────────────────────────────────────────────────

def _split_paragraphs(text: str, max_len: int = CHUNK_MAX) -> list[str]:
    """Split on double-newlines then hard-wrap long runs."""
    paras = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    out = []
    for para in paras:
        if len(para) <= max_len:
            out.append(para)
        else:
            # hard-wrap at sentence boundaries
            sentences = re.split(r"(?<=[.!?])\s+", para)
            buf = ""
            for s in sentences:
                if len(buf) + len(s) + 1 <= max_len:
                    buf = (buf + " " + s).strip()
                else:
                    if buf:
                        out.append(buf)
                    buf = s
            if buf:
                out.append(buf)
    return [c for c in out if len(c) >= CHUNK_MIN]


def chunks_from_transcript(ctx: str, data: dict) -> list[str]:
    raw = (data or {}).get("transcript", "") or ""
    if not raw:
        return []
    # Strip filler opening lines ("Hi, my name is…", "Let's get started")
    lines = raw.splitlines()
    start = 0
    for i, line in enumerate(lines):
        if any(phrase in line.lower() for phrase in
               ["hi, my name", "hello, my name", "let's get started",
                "ready to learn", "excited to be learning"]):
            start = i + 1
        else:
            break
    cleaned = "\n".join(lines[start:]).strip()
    return [f"{ctx}\n{c}" for c in _split_paragraphs(cleaned)]


def chunks_from_quiz(ctx: str, data: dict) -> list[str]:
    chunks = []
    for section in ("starterQuiz", "exitQuiz"):
        for q in (data or {}).get(section, []):
            question = (q.get("question") or "").strip()
            if not question:
                continue
            answers = q.get("answers") or []
            # Only use questions where at least one answer is text-based
            text_answers = [a for a in answers if a.get("type") == "text"]
            if not text_answers:
                continue
            correct = [a["content"] for a in text_answers if not a.get("distractor", True)]
            wrong   = [a["content"] for a in text_answers if a.get("distractor", False)]
            if not correct:
                continue
            parts = [f"{ctx}", f"Q: {question}", f"Correct answer: {', '.join(correct)}"]
            if wrong:
                parts.append(f"Common wrong answers: {', '.join(wrong)}")
            chunks.append("\n".join(parts))
    return chunks


def chunks_from_summary(ctx: str, data: dict) -> list[str]:
    chunks = []
    # Keywords
    for kw in (data or {}).get("lessonKeywords") or []:
        k = (kw.get("keyword") or "").strip()
        d = (kw.get("description") or "").strip()
        if k and d:
            chunks.append(f"{ctx}\nKey term — {k}: {d}")
    # Key learning points
    for item in (data or {}).get("keyLearningPoints") or []:
        t = item.get("keyLearningPoint", "") if isinstance(item, dict) else (item or "")
        if len(t) > 30:
            chunks.append(f"{ctx}\nLearning point: {t.strip()}")
    # Misconceptions (new — great for distractor generation)
    for item in (data or {}).get("misconceptionsAndCommonMistakes") or []:
        mis = (item.get("misconception") or "").strip()
        resp = (item.get("response") or "").strip()
        if mis:
            text = f"Common misconception: {mis}"
            if resp:
                text += f"\nCorrection: {resp}"
            chunks.append(f"{ctx}\n{text}")
    # Pupil outcome
    outcome = (data or {}).get("pupilLessonOutcome", "")
    if outcome and len(outcome) > 40:
        chunks.append(f"{ctx}\nLesson outcome: {outcome.strip()}")
    return chunks


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--subject", choices=list(SUBJECT_SLUG), action="append")
    ap.add_argument("--years", nargs="+")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--max-lessons-per-unit", type=int, default=12)
    ap.add_argument("--replace", action="store_true",
                    help="Delete existing Oak rich chunks for this subject+year before inserting")
    args = ap.parse_args()

    subjects = args.subject or (list(SUBJECT_SLUG) if args.all else ["Maths"])
    years    = args.years   or ([f"year-{i}" for i in range(1, 10)] if args.all else ["year-3"])

    conn = psycopg2.connect(config.DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    total_inserted = 0

    for subject in subjects:
        oslug = SUBJECT_SLUG[subject]
        for year in years:
            ks    = YEAR_TO_KS[year]
            yslug = year

            # Idempotency check
            cur.execute(
                "SELECT COUNT(*) FROM curriculum_chunks WHERE subject=%s AND year_group=%s AND source_name=%s",
                (subject, year, SOURCE))
            existing = cur.fetchone()[0]
            if existing > 20 and not args.replace and not args.dry_run:
                print(f"  · {subject} {year}: {existing} rich chunks already present — skipping (--replace to overwrite)")
                continue

            if args.replace and not args.dry_run:
                cur.execute(
                    "DELETE FROM curriculum_chunks WHERE subject=%s AND year_group=%s AND source_name=%s",
                    (subject, year, SOURCE))
                conn.commit()
                print(f"  · {subject} {year}: cleared {existing} existing rich chunks")

            groups = oak(f"/key-stages/{ks}/subject/{oslug}/units")
            if not groups:
                print(f"  ! {subject} {year}: no units from Oak"); continue

            units = []
            for g in groups:
                if g.get("yearSlug") == yslug:
                    units = g.get("units", []); break

            if not units:
                print(f"  · {subject} {year}: no Oak units for this year"); continue

            print(f"\n══ {subject} {year} ({ks}) — {len(units)} units ══")
            year_chunks = 0

            for unit in units:
                lg = oak(f"/key-stages/{ks}/subject/{oslug}/lessons"
                         f"?unit={urllib.parse.quote(unit['unitSlug'])}")
                lessons = []
                for g in (lg or []):
                    lessons += g.get("lessons", [])

                for lesson in lessons[:args.max_lessons_per_unit]:
                    slug = lesson["lessonSlug"]
                    ctx  = f"[{subject} {year}] {unit['unitTitle']} — {lesson['lessonTitle']}"

                    summary    = oak(f"/lessons/{slug}/summary")
                    transcript = oak(f"/lessons/{slug}/transcript")
                    quiz       = oak(f"/lessons/{slug}/quiz")
                    time.sleep(0.15)

                    new_chunks = (
                        chunks_from_transcript(ctx, transcript) +
                        chunks_from_quiz(ctx, quiz) +
                        chunks_from_summary(ctx, summary)
                    )

                    if args.dry_run:
                        print(f"\n  ── {lesson['lessonTitle']} ({len(new_chunks)} chunks) ──")
                        for c in new_chunks[:4]:
                            print(f"     {c[:200].replace(chr(10), ' ↵ ')}")
                        year_chunks += len(new_chunks)
                        continue

                    for ch in new_chunks:
                        emb = embed_text(ch)
                        if emb is None:
                            continue
                        cur.execute(
                            "INSERT INTO curriculum_chunks "
                            "(id, subject, year_group, source_name, chunk_text, embedding) "
                            "VALUES (%s, %s, %s, %s, %s, %s::vector)",
                            (str(uuid.uuid4()), subject, year, SOURCE, ch, str(emb.tolist())))
                        year_chunks += 1
                        total_inserted += 1

                conn.commit()

            print(f"  → {'[DRY] ' if args.dry_run else ''}{year_chunks} chunks for {subject} {year}")
            if not args.dry_run:
                total_inserted += year_chunks if args.dry_run else 0

    if not args.dry_run:
        conn.commit()
        print(f"\n── {total_inserted} chunks inserted ({SOURCE}) ──")
    else:
        print(f"\n── DRY RUN complete ──")


if __name__ == "__main__":
    main()
