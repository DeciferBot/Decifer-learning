"""
Tier-1 Oak ingestion — Computing + Modern Foreign Languages (French/Spanish/German).

Self-contained and SAFE to run alongside other Oak jobs:
  • Rate-aware: checks /rate-limit before each lesson batch; if remaining < FLOOR
    it sleeps until the window resets (so it never starves other sessions/jobs).
  • Idempotent: skips subjects/topics/chunks/questions that already exist.
  • §4-compliant: imports Oak's HUMAN-AUTHORED quiz questions directly (Oak is the
    answer authority — no LLM produces answers). No translation verifier needed
    because we do NOT LLM-generate MFL. Computing top-up generation (optional, via
    the existing pipeline) is left to a separate step.

Creates topics directly FROM Oak units (one topic per unit, capped) so unit→topic
mapping is exact — no fuzzy matching. Builds zones + world_map_nodes too.

Usage:
  python3 scripts/ingest-oak-tier1.py --dry-run          # plan only
  python3 scripts/ingest-oak-tier1.py --seed-only        # topics+zones, no questions
  python3 scripts/ingest-oak-tier1.py                    # full: seed + chunks + questions
  python3 scripts/ingest-oak-tier1.py --subject Computing
"""
from __future__ import annotations
import argparse, json, os, re, sys, time, uuid, urllib.request, urllib.parse, subprocess
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
SOURCE = "Oak NA (OGL v3.0)"
RATE_FLOOR = 25          # pause when remaining drops below this
MAX_UNITS_PER_YEAR = 10  # cap topics created per (subject, year)

# (our subject name, Oak slug, colour token, [years])
TARGETS = [
    ("Computing", "computing", "#7C3AED", [f"year-{i}" for i in range(1,10)]),
    ("French",    "french",    "#2563EB", [f"year-{i}" for i in range(3,10)]),
    ("Spanish",   "spanish",   "#DC2626", [f"year-{i}" for i in range(3,10)]),
    ("German",    "german",    "#CA8A04", [f"year-{i}" for i in range(7,10)]),
]
YEAR_TO_KS = {"year-1":"ks1","year-2":"ks1","year-3":"ks2","year-4":"ks2",
              "year-5":"ks2","year-6":"ks2","year-7":"ks3","year-8":"ks3","year-9":"ks3"}

def slug(t): return re.sub(r"[^a-z0-9]+","-",t.lower()).strip("-")[:80]

def rate_remaining():
    try:
        return oak_raw("/rate-limit")
    except Exception:
        return {"remaining": 1000, "reset": 0}

def oak_raw(path):
    url = path if path.startswith("http") else f"{OAK_BASE}{path}"
    req = urllib.request.Request(url, headers={"Authorization":f"Bearer {OAK_KEY}","User-Agent":"Decifer-Learning/1.0"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode("utf-8"))

def oak(path):
    """Rate-aware GET with backoff. Sleeps until reset when budget is low."""
    for attempt in range(6):
        try:
            return oak_raw(path)
        except urllib.error.HTTPError as ex:
            if ex.code in (429, 403):
                rl = rate_remaining()
                rem = rl.get("remaining", 0)
                if rem < RATE_FLOOR:
                    reset_ms = rl.get("reset", 0)
                    wait = max(30, min(3600, int(reset_ms/1000 - time.time()) + 5)) if reset_ms else 120
                    print(f"  ⏳ rate budget low ({rem}); sleeping {wait}s until reset…", flush=True)
                    time.sleep(wait); continue
                time.sleep(3*(attempt+1)); continue
            if ex.code in (400, 404):
                return None   # lesson has no quiz / bad path — skip
            if ex.code in (500,502,503):
                time.sleep(2*(attempt+1)); continue
            raise
        except Exception:
            time.sleep(2); continue
    return None

# ── question filtering (mirrors ingest-oak-questions quality bar) ──────────────
_VISUAL = ("this picture","the picture","this image","the image","this diagram",
           "the diagram","shown below","shown above","below:","above:","odd one out",
           "highlighted","look at the","in the picture","listen to","the audio","the recording")
def usable_mc(it):
    if it.get("questionType")!="multiple-choice" or it.get("questionImage"): return False
    ans=it.get("answers",[])
    if any(a.get("type")=="image" for a in ans): return False
    c=[a for a in ans if a.get("type")=="text" and not a.get("distractor")]
    d=[a for a in ans if a.get("type")=="text" and a.get("distractor")]
    if len(c)!=1 or len(d)<2: return False
    q=(it.get("question") or "").strip()
    if len(q)<12 or q.endswith(":"): return False
    if any(p in q.lower() for p in _VISUAL): return False
    if not c[0].get("content","").strip(): return False
    return True

def clean(s):
    s=s.replace("{{}}","_____"); s=re.sub(r"\$\$(.*?)\$\$",r"\1",s)
    for t in ("\\(","\\)","\\[","\\]","$"): s=s.replace(t,"")
    return s.strip()

GENERIC = ("Read the question carefully and decide what it is asking.",
           "Rule out the options you are sure are wrong first.",
           "Compare the options that are left and pick the best one.")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--subject", action="append", help="restrict to Computing/French/Spanish/German")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--seed-only", action="store_true")
    args=ap.parse_args()

    targets=[t for t in TARGETS if not args.subject or t[0] in args.subject]
    conn=psycopg2.connect(config.DATABASE_URL); conn.autocommit=False
    cur=conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute("SELECT id,label FROM year_groups"); yg={r["label"]:r["id"] for r in cur.fetchall()}
    cur.execute("SELECT id,name FROM subjects"); subj={r["name"]:r["id"] for r in cur.fetchall()}

    rl=rate_remaining()
    print(f"Oak rate budget: {rl.get('remaining')}/1000 remaining")

    n_topics=n_chunks=n_q=0
    for sname, oslug, colour, years in targets:
        # ensure subject row
        if sname not in subj:
            if args.dry_run:
                print(f"[would create subject] {sname}")
                sid="(dry)"
            else:
                sid=str(uuid.uuid4())
                cur.execute("INSERT INTO subjects (id,name,colour_token) VALUES (%s,%s,%s) "
                            "ON CONFLICT (name) DO UPDATE SET colour_token=EXCLUDED.colour_token RETURNING id",
                            (sid,sname,colour))
                row=cur.fetchone(); sid=row["id"] if row else None
                if sid is None:
                    cur.execute("SELECT id FROM subjects WHERE name=%s",(sname,)); sid=cur.fetchone()["id"]
                subj[sname]=sid; conn.commit()
                print(f"✓ subject {sname}")
        else:
            sid=subj[sname]

        for year in years:
            ks=YEAR_TO_KS[year]; yid=yg.get(year)
            if not yid: continue
            groups=oak(f"/key-stages/{ks}/subject/{oslug}/units")
            units=[]
            for g in (groups or []):
                if g.get("yearSlug")==year: units=g.get("units",[])[:MAX_UNITS_PER_YEAR]; break
            if not units:
                continue
            print(f"\n══ {sname} {year} ({ks}) — {len(units)} units ══")

            # zone for this subject+year
            zid=None
            if not args.dry_run:
                cur.execute("SELECT id FROM zones WHERE year_group_id=%s AND subject_id=%s",(yid,sid))
                z=cur.fetchone()
                if z: zid=z["id"]
                else:
                    zid=str(uuid.uuid4())
                    cur.execute("INSERT INTO zones (id,year_group_id,subject_id,name,theme) VALUES (%s,%s,%s,%s,%s)",
                                (zid,yid,sid,f"{sname} Zone",slug(sname)))
                conn.commit()

            prev=None
            for idx,unit in enumerate(units):
                tslug=f"{year}-{oslug}-{slug(unit['unitTitle'])}"[:80]
                if args.dry_run:
                    print(f"  [topic] {unit['unitTitle']}")
                    continue
                cur.execute("SELECT id FROM topics WHERE slug=%s",(tslug,))
                t=cur.fetchone()
                if t: tid=t["id"]
                else:
                    tid=str(uuid.uuid4())
                    cur.execute("""INSERT INTO topics (id,subject_id,year_group_id,title,slug,order_index,is_published,zone_id)
                                   VALUES (%s,%s,%s,%s,%s,%s,false,%s)""",
                                (tid,sid,yid,unit["unitTitle"],tslug,idx,zid))
                    cur.execute("""INSERT INTO world_map_nodes (id,zone_id,topic_id,x_pos,y_pos,unlocked_by_topic_id)
                                   VALUES (%s,%s,%s,%s,%s,%s)""",
                                (str(uuid.uuid4()),zid,tid,10.0+(idx%3)*30,10.0+(idx//3)*30,prev))
                    n_topics+=1
                prev=tid
                if args.seed_only:
                    conn.commit(); continue

                # lessons → chunks + questions
                lg=oak(f"/key-stages/{ks}/subject/{oslug}/lessons?unit={urllib.parse.quote(unit['unitSlug'])}")
                lessons=[]
                for g in (lg or []): lessons+=g.get("lessons",[])
                cur.execute("SELECT COUNT(*) FROM quiz_questions WHERE topic_id=%s AND status='published'",(tid,))
                have=cur.fetchone()[0]
                for L in lessons[:10]:
                    if have>=12: break
                    quiz=oak(f"/lessons/{L['lessonSlug']}/quiz")
                    summ=oak(f"/lessons/{L['lessonSlug']}/summary")
                    # chunks from keywords
                    if summ:
                        for kw in (summ.get("lessonKeywords") or []):
                            k=(kw.get("keyword") or "").strip(); d=(kw.get("description") or "").strip()
                            if k and d:
                                ch=f"[{sname} {year}] {unit['unitTitle']} — {L['lessonTitle']}\n{k}: {d}"
                                emb=embed_text(ch)
                                if emb is not None:
                                    cur.execute("INSERT INTO curriculum_chunks (id,subject,year_group,source_name,chunk_text,embedding) "
                                                "VALUES (%s,%s,%s,%s,%s,%s::vector)",
                                                (str(uuid.uuid4()),sname,year,SOURCE,ch,str(emb.tolist())))
                                    n_chunks+=1
                    hint1=None
                    if summ and summ.get("lessonKeywords"):
                        kw0=summ["lessonKeywords"][0]
                        if kw0.get("description"): hint1=f"Remember: {kw0['keyword']} — {kw0['description']}"[:240]
                    for qz,tier in (("starterQuiz","sprout"),("exitQuiz","explorer")):
                        for it in (quiz or {}).get(qz,[]):
                            if have>=12: break
                            if not usable_mc(it): continue
                            ans=it["answers"]
                            corr=clean(next(a["content"] for a in ans if a["type"]=="text" and not a.get("distractor")))
                            dist=[clean(a["content"]) for a in ans if a["type"]=="text" and a.get("distractor")][:3]
                            qt=clean(it["question"])
                            cur.execute("SELECT 1 FROM quiz_questions WHERE topic_id=%s AND lower(question_text)=lower(%s) LIMIT 1",(tid,qt))
                            if cur.fetchone(): continue
                            cur.execute("""INSERT INTO quiz_questions
                                (id,topic_id,tier,question_text,question_type,correct_answer,distractors,
                                 hint_1,hint_2,hint_3,explanation,confidence_score,status,question_metadata,
                                 generator_version,verifier_version,published_at,created_at)
                                VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,'published',%s::jsonb,
                                        'oak-import-v1','oak-authoritative',now(),now())""",
                                (str(uuid.uuid4()),tid,tier,qt,f"oak_{oslug}",corr,json.dumps(dist),
                                 hint1 or GENERIC[0],GENERIC[1],GENERIC[2],f"The correct answer is: {corr}.",100.0,
                                 json.dumps({"source":"oak","oak_lesson_slug":L["lessonSlug"],"oak_quiz":tier,
                                             "hints_generated":False,"license":"OGL-v3.0 Oak National Academy"})))
                            have+=1; n_q+=1
                    time.sleep(0.12)
                conn.commit()
            print(f"  · {sname} {year}: topics+content committed")

    if not args.dry_run: conn.commit()
    print(f"\n── {'DRY RUN — ' if args.dry_run else ''}topics:{n_topics} chunks:{n_chunks} questions:{n_q} ──")

if __name__=="__main__":
    main()
