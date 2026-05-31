"""
Apply learn_widgets column migration to Supabase.
Run: /root/pipeline-venv/bin/python3 scripts/migrate-learn-widgets.py
"""
import subprocess, os, sys
env_out = subprocess.run(['bash','-c','set -a && source /root/decifer-learning/.env.local && set +a && env'], capture_output=True, text=True).stdout
for line in env_out.splitlines():
    if '=' in line: k,_,v=line.partition('='); os.environ.setdefault(k,v)
if not os.environ.get('DATABASE_URL') and os.environ.get('DIRECT_URL'):
    os.environ['DATABASE_URL'] = os.environ['DIRECT_URL']

sys.path.insert(0, '/root/decifer-learning/services/content-pipeline')
import config, psycopg2

conn = psycopg2.connect(config.DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

cur.execute("ALTER TABLE learn_content ADD COLUMN IF NOT EXISTS learn_widgets JSONB DEFAULT '[]'")
print("✓ learn_widgets column added (or already exists)")

cur.execute("SELECT COUNT(*) FROM learn_content WHERE learn_widgets IS NULL OR learn_widgets = '[]'::jsonb")
print(f"  Rows with empty widgets: {cur.fetchone()[0]}")

conn.close()
print("Done.")
