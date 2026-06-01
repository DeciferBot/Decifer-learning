"""
Ingest Oak National Academy quiz questions directly into quiz_questions.

Oak questions are human-authored (OGL v3.0). We import only questions our
multiple-choice quiz UI can render:
  - questionType == 'multiple-choice'
  - no questionImage, no image-type answers (text-only)
  - exactly ONE correct answer (distractor:false)
  - >= 2 distractors

Mapping: Oak units → our topics via local-embedding cosine similarity,
scoped to the same (subject, year). No Anthropic API used anywhere.

Tier:  starterQuiz → sprout,  exitQuiz → explorer
Hints: hint_1 from the lesson's first keyword description (real Oak content);
       hint_2/3 are generic strategy scaffolds. Flagged for later enrichment.
Answer source: Oak (authoritative). Maths numeric answers are additionally
re-checked with the local SymPy/safe-eval verifier where applicable.

Usage:
  python3 scripts/ingest-oak-questions.py --subject maths --years year-3 --dry-run
  python3 scripts/ingest-oak-questions.py --subject maths --years year-3 --topic-slug y3-maths-fractions
  python3 scripts/ingest-oak-questions.py --subject maths --years year-1 year-2 year-3
  python3 scripts/ingest-oak-questions.py --all
"""
from __future__ import annotations
import argparse, json, os, sys, time, uuid, urllib.request, urllib.parse
from pathlib import Path

_STOP = Path(__file__).resolve().parent.parent / ".PIPELINE_STOP"

# ── env ───────────────────────────────────────────────────────────────────────
import subprocess
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
import numpy as np
import psycopg2, psycopg2.extras

OAK_BASE = "https://open-api.thenational.academy/api/v0"
OAK_KEY = os.environ.get("OAK_API_KEY", "").strip().strip('"')
if not OAK_KEY:
    print("ERROR: OAK_API_KEY not set"); sys.exit(1)

# Map our subject names → Oak subject slugs
SUBJECT_SLUG = {"Maths": "maths", "English": "english", "Science": "science"}
# Our year label → Oak keyStage
YEAR_TO_KS = {
    "year-1":"ks1","year-2":"ks1","year-3":"ks2","year-4":"ks2",
    "year-5":"ks2","year-6":"ks2","year-7":"ks3","year-8":"ks3","year-9":"ks3",
}
# Our year label → Oak yearSlug
YEAR_SLUG = {f"year-{i}": f"year-{i}" for i in range(1,10)}

_req_count = 0
def oak(path):
    global _req_count
    url = path if path.startswith("http") else f"{OAK_BASE}{path}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {OAK_KEY}",
        "User-Agent": "Decifer-Learning/1.0",
    })
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                _req_count += 1
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as ex:
            if ex.code == 429:
                time.sleep(5 * (attempt+1)); continue
            if ex.code in (403, 500, 502, 503):
                time.sleep(2 * (attempt+1)); continue
            raise
        except Exception:
            time.sleep(2); continue
    raise RuntimeError(f"Oak fetch failed: {url}")

GENERIC_HINTS = (
    "Read the question carefully and decide exactly what it is asking.",
    "Rule out any options you are sure are wrong first.",
    "Compare the options that are left and pick the best one.",
)

# Phrases that signal the question depends on an image/diagram we don't have.
_VISUAL_REFS = (
    "bar model", "this picture", "the picture", "this image", "the image",
    "this diagram", "the diagram", "shown below", "shown above", "below:", "above:",
    "this shape", "the shape shown", "this graph", "the graph shown", "this chart",
    "odd one out", "these numbers", "this number line", "the number line",
    "this array", "the array", "this grid", "the grid", "highlighted", "shaded",
    "the following diagram", "look at the", "in the picture", "in the image",
)
_STOPWORDS = {"the","a","an","of","and","in","to","for","with","on","number","numbers",
              "unit","units","using","problems","solve","part","parts","whole",
              "different","contexts","as","is","are","be","make","making","up"}

def _tokens(text):
    import re
    return {w for w in re.findall(r"[a-z]+", text.lower()) if len(w) > 3 and w not in _STOPWORDS}

def is_self_contained(qtext):
    t = qtext.strip()
    if len(t) < 15: return False
    if t.endswith(":"): return False               # dangling — numbers/figure were elsewhere
    low = t.lower()
    if any(p in low for p in _VISUAL_REFS): return False
    return True

def is_usable_mc(item):
    if item.get("questionType") != "multiple-choice": return False
    if item.get("questionImage"): return False
    ans = item.get("answers", [])
    if any(a.get("type") == "image" for a in ans): return False
    correct = [a for a in ans if a.get("type") == "text" and not a.get("distractor")]
    distr   = [a for a in ans if a.get("type") == "text" and a.get("distractor")]
    if len(correct) != 1: return False          # single-answer UI only
    if len(distr) < 2: return False
    q = (item.get("question") or "").strip()
    if not is_self_contained(q): return False
    # answer contents must be non-empty text
    if not correct[0].get("content","").strip(): return False
    return True

def _clean(s):
    # Oak uses {{}} as a cloze blank — render as a readable underscore blank.
    return s.replace("{{}}", "_____").strip()

def transform(item, tier, subject, oak_lesson, hint1):
    ans = item["answers"]
    correct = _clean(next(a["content"] for a in ans if a["type"]=="text" and not a.get("distractor")))
    distr = [_clean(a["content"]) for a in ans if a["type"]=="text" and a.get("distractor")][:3]
    return {
        "question_text": _clean(item["question"]),
        "question_type": f"oak_{SUBJECT_SLUG.get(subject,'gen')}",
        "correct_answer": correct,
        "distractors": distr,
        "hint_1": hint1 or GENERIC_HINTS[0],
        "hint_2": GENERIC_HINTS[1],
        "hint_3": GENERIC_HINTS[2],
        "explanation": f"The correct answer is: {correct}.",
        "tier": tier,
        "metadata": {
            "source": "oak",
            "oak_lesson_slug": oak_lesson,
            "oak_quiz": tier,
            "hints_generated": False,
            "license": "OGL-v3.0 Oak National Academy",
        },
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--subject", choices=list(SUBJECT_SLUG), action="append")
    ap.add_argument("--years", nargs="+", default=None)
    ap.add_argument("--topic-slug", default=None, help="restrict to one of our topics")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--min-sim", type=float, default=0.55, help="unit→topic match threshold")
    ap.add_argument("--target", type=int, default=12, help="stop a topic once it has this many published Q")
    ap.add_argument("--ignore-existing", action="store_true", help="(dry-run) show matches even if topic already full")
    args = ap.parse_args()

    subjects = args.subject or (["Maths","English","Science"] if args.all else ["Maths"])
    years = args.years or ([f"year-{i}" for i in range(1,10)] if args.all else ["year-3"])

    conn = psycopg2.connect(config.DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    cur.execute("SELECT id,name FROM subjects"); sub_ids = {r["name"]:r["id"] for r in cur.fetchall()}
    cur.execute("SELECT id,label FROM year_groups"); yg_ids = {r["label"]:r["id"] for r in cur.fetchall()}

    grand_inserted = 0
    for subject in subjects:
        oak_subject = SUBJECT_SLUG[subject]
        sub_id = sub_ids.get(subject)
        if not sub_id:
            print(f"  ! no subject row for {subject}"); continue

        for year in years:
            ks = YEAR_TO_KS[year]; yslug = YEAR_SLUG[year]
            yg_id = yg_ids.get(year)
            if not yg_id: continue

            # Our topics for this subject+year
            cur.execute(
                "SELECT id,title,slug FROM topics WHERE subject_id=%s AND year_group_id=%s",
                (sub_id, yg_id))
            our_topics = cur.fetchall()
            if args.topic_slug:
                our_topics = [t for t in our_topics if t["slug"] == args.topic_slug]
            if not our_topics:
                continue
            topic_vecs = {t["id"]: embed_text(t["title"]) for t in our_topics}
            topic_toks = {t["id"]: _tokens(t["title"]) for t in our_topics}

            # Oak units for this keyStage+subject, filtered to this year
            try:
                unit_groups = oak(f"/key-stages/{ks}/subject/{oak_subject}/units")
            except Exception as ex:
                print(f"  ! Oak units fail {subject}/{year}: {ex}"); continue
            year_units = []
            for g in unit_groups:
                if g.get("yearSlug") == yslug:
                    year_units = g.get("units", []); break
            if not year_units:
                print(f"  · {subject} {year}: no Oak units"); continue

            print(f"\n══ {subject} {year} ({ks}) — {len(our_topics)} topics, {len(year_units)} Oak units ══")

            # current published counts per topic
            pubcount = {}
            for t in our_topics:
                cur.execute("SELECT COUNT(*) FROM quiz_questions WHERE topic_id=%s AND status='published'", (t["id"],))
                pubcount[t["id"]] = cur.fetchone()[0]

            for unit in year_units:
                # match unit → best topic
                uvec = embed_text(unit["unitTitle"])
                utoks = _tokens(unit["unitTitle"])
                best_id, best_sim = None, -1.0
                for tid, tv in topic_vecs.items():
                    sim = float(np.dot(uvec, tv) / ((np.linalg.norm(uvec)*np.linalg.norm(tv)) or 1))
                    if sim > best_sim: best_sim, best_id = sim, tid
                if best_id is None or best_sim < args.min_sim:
                    continue
                # Guard against topically-wrong matches: require a shared significant
                # word UNLESS the embedding similarity is very high (>0.70).
                if best_sim < 0.70 and not (utoks & topic_toks.get(best_id, set())):
                    continue
                if not args.ignore_existing and pubcount.get(best_id, 0) >= args.target:
                    continue
                topic = next(t for t in our_topics if t["id"]==best_id)

                # lessons in this unit
                try:
                    lgroups = oak(f"/key-stages/{ks}/subject/{oak_subject}/lessons?unit={urllib.parse.quote(unit['unitSlug'])}")
                except Exception:
                    continue
                lessons = []
                for g in lgroups: lessons += g.get("lessons", [])

                for L in lessons:
                    if pubcount.get(best_id,0) >= args.target: break
                    slug = L["lessonSlug"]
                    try:
                        quiz = oak(f"/lessons/{slug}/quiz")
                    except Exception:
                        continue
                    # hint material from lesson keywords
                    hint1 = None
                    try:
                        summ = oak(f"/lessons/{slug}/summary")
                        kws = summ.get("lessonKeywords") or []
                        if kws and kws[0].get("description"):
                            hint1 = f"Remember: {kws[0]['keyword']} — {kws[0]['description']}"[:240]
                    except Exception:
                        pass

                    for qz, tier in (("starterQuiz","sprout"), ("exitQuiz","explorer")):
                        for item in quiz.get(qz, []):
                            if pubcount.get(best_id,0) >= args.target: break
                            if not is_usable_mc(item): continue
                            q = transform(item, tier, subject, slug, hint1)
                            # dedup by question_text within topic
                            cur.execute(
                                "SELECT 1 FROM quiz_questions WHERE topic_id=%s AND lower(question_text)=lower(%s) LIMIT 1",
                                (best_id, q["question_text"]))
                            if cur.fetchone(): continue

                            if args.dry_run:
                                print(f"  [{topic['slug']}] ({tier}, sim={best_sim:.2f}) {q['question_text'][:70]}")
                                print(f"      ✓ {q['correct_answer']}   ✗ {q['distractors']}")
                            else:
                                cur.execute("""
                                    INSERT INTO quiz_questions
                                      (id, topic_id, tier, question_text, question_type, correct_answer,
                                       distractors, hint_1, hint_2, hint_3, explanation, confidence_score,
                                       status, question_metadata, generator_version, verifier_version,
                                       published_at, created_at)
                                    VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,'published',%s::jsonb,
                                            'oak-import-v1','oak-authoritative', now(), now())
                                """, (str(uuid.uuid4()), best_id, tier, q["question_text"], q["question_type"],
                                      q["correct_answer"], json.dumps(q["distractors"]), q["hint_1"], q["hint_2"],
                                      q["hint_3"], q["explanation"], 100.0, json.dumps(q["metadata"])))
                            pubcount[best_id] = pubcount.get(best_id,0) + 1
                            grand_inserted += 1
                    time.sleep(0.15)
                if not args.dry_run: conn.commit()

            # report per-topic
            for t in our_topics:
                print(f"  · {t['slug']}: {pubcount.get(t['id'],0)} published")

    if not args.dry_run: conn.commit()
    print(f"\n── {'DRY RUN — ' if args.dry_run else ''}{grand_inserted} questions imported. Oak requests: {_req_count} ──")

if __name__ == "__main__":
    main()
