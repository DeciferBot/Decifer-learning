"""
Ingest Oak National Academy lesson CONTENT into curriculum_chunks.

This is the RAG source that the 6-stage pipeline retrieves from. Oak content
is rich and abundant (OGL v3.0), far better than the thin gov.uk pages. Uses
LOCAL embeddings only (no Anthropic) for the ingest itself.

For each (subject, year) we walk Oak units → lessons and build chunks from:
  - unit title + lesson title (context line)
  - each lessonKeyword {keyword, description}  (compact, high-signal)
  - the lesson pupil-facing intro / summary text when present

Chunks are tagged source_name='Oak NA (OGL v3.0)' so they're attributable and
distinguishable from the older gov.uk chunks (which can be pruned later).

Usage:
  python3 scripts/ingest-oak-chunks.py --subject Maths --years year-3 --dry-run
  python3 scripts/ingest-oak-chunks.py --all
  python3 scripts/ingest-oak-chunks.py --subject Science --years year-7 year-8 year-9
  python3 scripts/ingest-oak-chunks.py --subject History --subject Geography --years year-3 year-7
"""
from __future__ import annotations
import argparse, json, os, sys, time, uuid, urllib.request, urllib.parse, subprocess
from pathlib import Path

_e = subprocess.run(["bash","-c","set -a && source /root/decifer-learning/.env.local && set +a && env"],
                    capture_output=True, text=True).stdout
for line in _e.splitlines():
    if "=" in line:
        k,_,v = line.partition("="); os.environ.setdefault(k, v)
if not os.environ.get("DATABASE_URL") and os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]

sys.path.insert(0, "/root/decifer-learning/services/content-pipeline")
import config
from pipeline import embed_text
import psycopg2, psycopg2.extras

OAK_BASE = "https://open-api.thenational.academy/api/v0"
OAK_KEY = os.environ.get("OAK_API_KEY","").strip().strip('"')
SUBJECT_SLUG = {"Maths":"maths","English":"english","Science":"science",
                "History":"history","Geography":"geography"}
YEAR_TO_KS = {"year-1":"ks1","year-2":"ks1","year-3":"ks2","year-4":"ks2",
              "year-5":"ks2","year-6":"ks2","year-7":"ks3","year-8":"ks3","year-9":"ks3"}
SOURCE = "Oak NA (OGL v3.0)"

def oak(path):
    url = path if path.startswith("http") else f"{OAK_BASE}{path}"
    req = urllib.request.Request(url, headers={"Authorization":f"Bearer {OAK_KEY}","User-Agent":"Decifer-Learning/1.0"})
    for a in range(4):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as ex:
            if ex.code in (429,403,500,502,503): time.sleep(3*(a+1)); continue
            raise
        except Exception:
            time.sleep(2); continue
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--subject", choices=list(SUBJECT_SLUG), action="append")
    ap.add_argument("--years", nargs="+")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--max-lessons-per-unit", type=int, default=8)
    args = ap.parse_args()

    subjects = args.subject or (["Maths","English","Science","History","Geography"] if args.all else ["Maths"])
    years = args.years or ([f"year-{i}" for i in range(1,10)] if args.all else ["year-3"])

    conn = psycopg2.connect(config.DATABASE_URL); conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    total_chunks = 0
    for subject in subjects:
        oslug = SUBJECT_SLUG[subject]
        for year in years:
            ks = YEAR_TO_KS[year]; yslug = year
            # Existing Oak chunk count for this subject+year (idempotency)
            cur.execute("SELECT COUNT(*) FROM curriculum_chunks WHERE subject=%s AND year_group=%s AND source_name=%s",
                        (subject, year, SOURCE))
            if cur.fetchone()[0] > 20 and not args.dry_run:
                print(f"  · {subject} {year}: already has Oak chunks — skipping"); continue

            groups = oak(f"/key-stages/{ks}/subject/{oslug}/units")
            if not groups: print(f"  ! {subject} {year}: no units"); continue
            units = []
            for g in groups:
                if g.get("yearSlug")==yslug: units = g.get("units",[]); break
            if not units: print(f"  · {subject} {year}: no Oak units for this year"); continue

            print(f"\n══ {subject} {year} ({ks}) — {len(units)} units ══")
            year_chunks = 0
            for unit in units:
                lg = oak(f"/key-stages/{ks}/subject/{oslug}/lessons?unit={urllib.parse.quote(unit['unitSlug'])}")
                lessons = []
                for g in (lg or []): lessons += g.get("lessons",[])
                for L in lessons[:args.max_lessons_per_unit]:
                    summ = oak(f"/lessons/{L['lessonSlug']}/summary")
                    if not summ: continue
                    ctx = f"[{subject} {year}] {unit['unitTitle']} — {L['lessonTitle']}"
                    chunks = []
                    for kw in (summ.get("lessonKeywords") or []):
                        k = (kw.get("keyword") or "").strip(); d = (kw.get("description") or "").strip()
                        if k and d:
                            chunks.append(f"{ctx}\n{k}: {d}")
                    # pupil intro / lesson outcome text if present
                    for fld in ("pupilLessonOutcome","keyLearningPoints","lessonTitle"):
                        v = summ.get(fld)
                        if isinstance(v, str) and len(v) > 40:
                            chunks.append(f"{ctx}\n{v.strip()}")
                        elif isinstance(v, list):
                            for it in v:
                                t = it.get("keyLearningPoint") if isinstance(it, dict) else (it if isinstance(it,str) else None)
                                if t and len(t) > 30: chunks.append(f"{ctx}\n{t.strip()}")
                    for ch in chunks:
                        if args.dry_run:
                            if year_chunks < 4: print(f"   {ch[:140]}")
                        else:
                            emb = embed_text(ch)
                            if emb is None: continue
                            cur.execute(
                                "INSERT INTO curriculum_chunks (id,subject,year_group,source_name,chunk_text,embedding) "
                                "VALUES (%s,%s,%s,%s,%s,%s::vector)",
                                (str(uuid.uuid4()), subject, year, SOURCE, ch, str(emb.tolist())))
                        year_chunks += 1; total_chunks += 1
                    time.sleep(0.1)
                if not args.dry_run: conn.commit()
            print(f"  → {year_chunks} chunks for {subject} {year}")
    if not args.dry_run: conn.commit()
    print(f"\n── {'DRY RUN — ' if args.dry_run else ''}{total_chunks} chunks ingested ──")

if __name__ == "__main__":
    main()
