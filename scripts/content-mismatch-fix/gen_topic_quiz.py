import os, sys, subprocess, time
_e=subprocess.run(["bash","-c","set -a && source /root/decifer-learning/.env.local && set +a && env"],capture_output=True,text=True).stdout
for line in _e.splitlines():
    if "=" in line:
        k,_,v=line.partition("="); os.environ.setdefault(k.strip(),v.strip())
if not os.environ.get("DATABASE_URL") and os.environ.get("DIRECT_URL"): os.environ["DATABASE_URL"]=os.environ["DIRECT_URL"]
DB=os.environ["DATABASE_URL"].strip().strip('"')
sys.path.insert(0,"/root/decifer-learning/services/content-pipeline")
import config, pipeline as pl
import psycopg2
TOPIC=sys.argv[1]; SRC=sys.argv[2]
c=psycopg2.connect(DB); cur=c.cursor()
cur.execute("DELETE FROM quiz_questions WHERE topic_id=%s AND status<>'published' AND created_at>now()-interval '3 hours'",(TOPIC,))
cur.execute("UPDATE quiz_questions SET status='flagged' WHERE topic_id=%s AND status='published'",(TOPIC,))
print("flagged old published:",cur.rowcount,flush=True); c.commit()
for tier,n in [("sprout",8),("explorer",8),("lightning",6)]:
    t0=time.time()
    try:
        r=pl.run_for_topic(TOPIC,tier,n,restrict_source=SRC); pub=sum(1 for x in r if getattr(x,'status',None)=='published')
        print(f"{tier}: {pub}/{len(r)} ({time.time()-t0:.0f}s)",flush=True)
    except Exception as e: print(tier,"ERR",repr(e),flush=True)
cur.execute("SELECT count(*) FROM quiz_questions WHERE topic_id=%s AND status='published'",(TOPIC,))
print("published now:",cur.fetchone()[0],flush=True); c.close()
