#!/usr/bin/env python3
"""
build_weather.py — rebuild 'Natural Hazards: Tropical Storms and Drought' (Y8 Geography)
from authoritative Met Office (OGL) facts. Builds chapters + learn_content + chunks under
a dedicated source_name so quiz generation can be scoped with restrict_source.
Facts are kept faithful to the Met Office source pages (tropical-cyclones/facts; drought).
Does NOT republish — that happens after the quiz is generated and verified.
"""
from __future__ import annotations
import html, os, subprocess, sys, uuid

_e = subprocess.run(["bash","-c","set -a && source /root/decifer-learning/.env.local && set +a && env"],
                    capture_output=True, text=True).stdout
for line in _e.splitlines():
    if "=" in line:
        k,_,v = line.partition("="); os.environ.setdefault(k.strip(), v.strip())
if not os.environ.get("DATABASE_URL") and os.environ.get("DIRECT_URL"):
    os.environ["DATABASE_URL"] = os.environ["DIRECT_URL"]
DATABASE_URL = os.environ["DATABASE_URL"].strip().strip('"')
sys.path.insert(0, "/root/decifer-learning/services/content-pipeline")
import config
from pipeline import embed_text
import psycopg2, psycopg2.extras

TOPIC = "f5277b6b-2b7e-46a5-8af2-e5de8a5cddad"
SUBJECT, YEAR = "Geography", "year-8"
SOURCE = "Met Office (Open Government Licence)"
ATTR = ("Adapted from Met Office content (tropical cyclones; drought), "
        "© Crown copyright, Open Government Licence v3.0.")

# Each chapter: (title, outcome, [factual key points faithful to Met Office])
CHAPTERS = [
 ("How tropical storms form",
  "Explain the conditions needed for a tropical storm (tropical cyclone) to form.",
  ["Tropical storms (tropical cyclones) form over tropical oceans as low-pressure systems with organised thunderstorms and circulating winds.",
   "They need a source of warm, moist air from tropical oceans, with sea-surface temperatures normally around or above 27 °C.",
   "They need converging surface winds that force air to rise and form storm clouds.",
   "They need low wind shear — winds that do not vary greatly with height.",
   "They need to be far enough from the Equator for the Coriolis force to make the system spin."]),
 ("Stages and naming of tropical storms",
  "Describe how a tropical storm grows in strength and how it is named in different regions.",
  ["A weak early system is a tropical depression.",
   "When sustained winds reach 39 mph the system becomes a tropical storm and is given a name.",
   "When winds reach 74 mph or more it is called a hurricane, typhoon or cyclone, depending on the region.",
   "It is a hurricane in the Atlantic and eastern North Pacific, a typhoon in the western North Pacific, and a cyclone in the Indian Ocean and South Pacific."]),
 ("The structure of a tropical storm",
  "Describe the structure of a mature tropical storm, including the eye.",
  ["A mature tropical storm is a cylinder of deep thundercloud around a centre called the eye.",
   "In the eye, air is sinking (subsiding), so it is dry and often cloud-free, with little or no wind.",
   "Around the eye, intense horizontal winds can exceed 100 mph."]),
 ("Measuring tropical storms: the Saffir-Simpson scale",
  "Recall how hurricanes are categorised by wind speed on the Saffir-Simpson scale.",
  ["Hurricanes are categorised on the Saffir-Simpson scale by wind speed.",
   "Category 1 = 74-95 mph; Category 2 = 96-110 mph; Category 3 = 111-129 mph.",
   "Category 4 = 130-156 mph; Category 5 = over 156 mph."]),
 ("What is drought?",
  "Define drought and explain how it differs from other extreme weather.",
  ["In the simplest terms, drought is defined by a lack of water.",
   "Unlike most extreme weather events, droughts develop gradually.",
   "A drought can last from as little as a few weeks up to several years."]),
 ("Types of drought",
  "Identify the main types of drought and what each one affects.",
  ["Meteorological drought: when rainfall in an area falls below the regional average.",
   "Agricultural drought: when a lack of rainfall or dry soil harms farming and crops.",
   "Ecological drought: when the water shortage affects the wider local environment.",
   "Hydrological drought: when water supplies such as streams and reservoirs become depleted."]),
 ("Causes and impacts of drought",
  "Explain what drives droughts and how their severity is measured.",
  ["Droughts have many drivers — meteorological, hydrological, geological and societal — which combine together.",
   "Rising temperatures increase evaporation from the soil; as ground moisture falls, the air heats further and evaporation increases, worsening the drought.",
   "Drought severity is measured by its impact on human activities such as agriculture and leisure, and on large-scale natural events such as wildfires."]),
]

def main():
    conn = psycopg2.connect(DATABASE_URL); conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT subject_id, year_group_id FROM topics WHERE id=%s", (TOPIC,))
    t = cur.fetchone(); sid, ygid = t["subject_id"], t["year_group_id"]

    # chapters
    cur.execute("DELETE FROM curriculum_units WHERE topic_id=%s", (TOPIC,))
    rows = []
    for i,(title,outcome,pts) in enumerate(CHAPTERS):
        content = {"lessons":[{"lessonTitle":title,"pupilLessonOutcome":outcome,
                               "keyLearningPoints":pts,"keywords":[],"misconceptions":[]}],
                   "attribution":ATTR,"canonicalUrl":None}
        rows.append((str(uuid.uuid4()),sid,ygid,TOPIC,title,"",i,None,"high",
                     __import__("json").dumps(content)))
    psycopg2.extras.execute_values(cur,
        "INSERT INTO curriculum_units (id,subject_id,year_group_id,topic_id,title,description,order_index,oak_unit_slug,oak_confidence,content_json,content_fetched_at,created_at) VALUES %s",
        rows, template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now(),now())")

    # learn_content
    secs = ['<h2>Tropical Storms and Drought</h2>',
            f'<p><em>{html.escape(ATTR)}</em></p>']
    for title,outcome,pts in CHAPTERS:
        secs.append(f'<h2>{html.escape(title)}</h2>')
        secs.append("<ul>" + "".join(f"<li>{html.escape(p)}</li>" for p in pts) + "</ul>")
    body = "\n".join(secs)
    cur.execute("SELECT id FROM learn_content WHERE topic_id=%s", (TOPIC,))
    lc = cur.fetchone()
    if lc: cur.execute("UPDATE learn_content SET body_html=%s, status='published' WHERE id=%s",(body,lc["id"]))
    else:  cur.execute("INSERT INTO learn_content (id,topic_id,body_html,status) VALUES (%s,%s,%s,'published')",(str(uuid.uuid4()),TOPIC,body))

    # chunks (one per chapter, faithful facts) for quiz grounding
    cur.execute("DELETE FROM curriculum_chunks WHERE subject=%s AND year_group=%s AND source_name=%s",(SUBJECT,YEAR,SOURCE))
    n=0
    for title,outcome,pts in CHAPTERS:
        chunk = f"[Geography year-8] Natural hazards — {title}.\n" + "\n".join("- "+p for p in pts)
        emb = embed_text(chunk)
        if emb is None: raise SystemExit("embed failed")
        cur.execute("INSERT INTO curriculum_chunks (id,subject,year_group,source_name,chunk_text,embedding) VALUES (%s,%s,%s,%s,%s,%s::vector)",
                    (str(uuid.uuid4()),SUBJECT,YEAR,SOURCE,chunk,str(emb.tolist())))
        n+=1
    conn.commit()
    print(f"OK: {len(rows)} chapters, learn rebuilt, {n} Met Office chunks. Topic still UNPUBLISHED.")
    cur.close(); conn.close()

if __name__ == "__main__":
    main()
