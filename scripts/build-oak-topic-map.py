"""
Build an LLM-assisted mapping from Oak National Academy unit slugs → our NC-derived topic slugs.

Cosine similarity fails for subjects like History where Oak unit titles are event-specific
("The Norman Conquest", "The Black Death") but our topics are NC period-buckets
("Medieval Britain 1066-1509: Church, State and Society"). An LLM reasons about dates,
subject matter, and curriculum knowledge to make the correct match.

Output: scripts/oak-topic-map.json  (commit this — it is a curated, reviewable artefact)

The ingest scripts consult this map first and fall back to cosine similarity only for
units not yet mapped.

Usage:
  # Map H/G for the two pilot years (most common)
  python3 scripts/build-oak-topic-map.py --subject History --subject Geography --years year-3 year-7

  # Map everything
  python3 scripts/build-oak-topic-map.py --all

  # Preview without writing
  python3 scripts/build-oak-topic-map.py --subject History --years year-7 --dry-run

  # Force re-map units already in the file (e.g. after re-seeding topics)
  python3 scripts/build-oak-topic-map.py --subject History --years year-7 --rebuild
"""
from __future__ import annotations
import argparse, json, os, sys, time, urllib.request, urllib.parse, subprocess
from pathlib import Path

# ── env ───────────────────────────────────────────────────────────────────────
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
import psycopg2, psycopg2.extras
import anthropic

OAK_BASE = "https://open-api.thenational.academy/api/v0"
OAK_KEY = os.environ.get("OAK_API_KEY", "").strip().strip('"')
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip().strip('"')

MAP_FILE = Path(__file__).resolve().parent / "oak-topic-map.json"

SUBJECT_SLUG = {"Maths": "maths", "English": "english", "Science": "science",
                "History": "history", "Geography": "geography"}
YEAR_TO_KS = {
    "year-1": "ks1", "year-2": "ks1",
    "year-3": "ks2", "year-4": "ks2", "year-5": "ks2", "year-6": "ks2",
    "year-7": "ks3", "year-8": "ks3", "year-9": "ks3",
}

# Confidence weights for summary line
CONF_SYMBOL = {"high": "✓", "medium": "~", "low": "?"}


def oak(path):
    url = path if path.startswith("http") else f"{OAK_BASE}{path}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {OAK_KEY}",
        "User-Agent": "Decifer-Learning/1.0",
    })
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as ex:
            if ex.code in (429, 500, 502, 503):
                time.sleep(3 * (attempt + 1)); continue
            raise
        except Exception:
            time.sleep(2); continue
    raise RuntimeError(f"Oak fetch failed: {url}")


def map_unit(client, unit_title, subject, year, ks, topics):
    """Ask Claude to map one Oak unit title to one of our NC-derived topic slugs."""
    topic_lines = "\n".join(f"  {t['slug']}: {t['title']}" for t in topics)

    prompt = f"""You are a UK National Curriculum expert specialising in {subject}.

Your task: decide which of our NC-aligned topics best matches this Oak National Academy lesson unit.

Oak unit title: "{unit_title}"
Subject: {subject}
Key Stage: {ks.upper()}, Year: {year.replace('-', ' ').title()}

Our topics for {subject} {year}:
{topic_lines}

Reasoning guidance:
- Use your curriculum knowledge, not just word overlap.
- For History: a unit titled "The Norman Conquest" → period 1066, therefore Medieval Britain 1066-1509.
  A unit titled "The Industrial Revolution" → period ~1760-1840, therefore 1745-1901.
- For Geography: reason about whether a unit is physical, human, or regional geography.
- Return "none" ONLY if this unit genuinely covers content that none of our listed topics address
  at this year level (e.g. it belongs to a different year group entirely).
- Prefer a specific match over "none" — it is better to be approximately right than to discard good content.

Return valid JSON only, no markdown, no prose:
{{"topic_slug": "<slug or none>", "confidence": "high|medium|low", "reasoning": "<one concise sentence>"}}"""

    import re as _re
    for attempt in range(3):
        try:
            resp = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.content[0].text.strip()
            # strip markdown code fences if present
            text = _re.sub(r"^```[a-z]*\n?", "", text).rstrip("`").strip()
            return json.loads(text)
        except json.JSONDecodeError:
            m = _re.search(r'\{[^{}]+\}', text, _re.DOTALL)
            if m:
                try:
                    return json.loads(m.group())
                except Exception:
                    pass
            time.sleep(1)
        except Exception as ex:
            print(f"    [Claude error attempt {attempt+1}]: {ex}")
            time.sleep(2)
    return {"topic_slug": "none", "confidence": "low", "reasoning": "Claude call failed"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--subject", choices=list(SUBJECT_SLUG), action="append")
    ap.add_argument("--years", nargs="+")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--rebuild", action="store_true",
                    help="re-map units already in the file (e.g. after re-seeding topics)")
    args = ap.parse_args()

    if not OAK_KEY:
        print("ERROR: OAK_API_KEY not set"); sys.exit(1)
    if not ANTHROPIC_KEY:
        print("ERROR: ANTHROPIC_API_KEY not set"); sys.exit(1)

    subjects = args.subject or (list(SUBJECT_SLUG) if args.all else ["History", "Geography"])
    years = args.years or ([f"year-{i}" for i in range(1, 10)] if args.all else ["year-3", "year-7"])

    # Load existing map
    existing_mappings = {}
    if MAP_FILE.exists():
        try:
            existing_mappings = json.loads(MAP_FILE.read_text()).get("mappings", {})
            print(f"Loaded {len(existing_mappings)} existing mappings from {MAP_FILE.name}")
        except Exception as ex:
            print(f"Warning: could not read existing map: {ex}")
    mappings = dict(existing_mappings)

    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    conn = psycopg2.connect(config.DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute("SELECT id, name FROM subjects")
    sub_ids = {r["name"]: r["id"] for r in cur.fetchall()}
    cur.execute("SELECT id, label FROM year_groups")
    yg_ids = {r["label"]: r["id"] for r in cur.fetchall()}

    new_count = skipped_count = none_count = 0

    for subject in subjects:
        oak_subject = SUBJECT_SLUG[subject]
        sub_id = sub_ids.get(subject)
        if not sub_id:
            print(f"\n  ! No subject row in DB for '{subject}' — run seed-history-geography.py first")
            continue

        for year in years:
            ks = YEAR_TO_KS[year]
            yg_id = yg_ids.get(year)
            if not yg_id:
                continue

            cur.execute(
                "SELECT id, title, slug FROM topics WHERE subject_id=%s AND year_group_id=%s",
                (sub_id, yg_id))
            topics = [{"id": r["id"], "title": r["title"], "slug": r["slug"]}
                      for r in cur.fetchall()]
            if not topics:
                print(f"\n  · {subject} {year}: no topics in DB — skipping")
                continue

            try:
                unit_groups = oak(f"/key-stages/{ks}/subject/{oak_subject}/units")
            except Exception as ex:
                print(f"\n  ! Oak units fetch failed for {subject}/{year}: {ex}"); continue

            year_units = []
            for g in unit_groups:
                if g.get("yearSlug") == year:
                    year_units = g.get("units", []); break
            if not year_units:
                print(f"\n  · {subject} {year}: no Oak units found"); continue

            print(f"\n══ {subject} {year} ({ks.upper()}) — {len(year_units)} Oak units, {len(topics)} topics ══")
            print(f"   Topics: {', '.join(t['slug'].split('-', 2)[-1] for t in topics)}")

            for unit in year_units:
                map_key = f"{subject.lower()}/{ks}/{year}/{unit['unitSlug']}"

                if map_key in mappings and not args.rebuild:
                    entry = mappings[map_key]
                    sym = CONF_SYMBOL.get(entry.get("confidence", "low"), "?")
                    if entry["topic_slug"] == "none":
                        print(f"  (cached ✗) {unit['unitTitle'][:65]}")
                    else:
                        print(f"  (cached {sym}) {unit['unitTitle'][:55]} → {entry['topic_slug'].split('-', 2)[-1]}")
                    skipped_count += 1
                    continue

                result = map_unit(client, unit["unitTitle"], subject, year, ks, topics)
                topic_slug = result.get("topic_slug", "none") or "none"
                confidence = result.get("confidence", "low")
                reasoning = result.get("reasoning", "")

                # Validate: make sure the returned slug actually exists in our topics
                valid_slugs = {t["slug"] for t in topics}
                if topic_slug != "none" and topic_slug not in valid_slugs:
                    print(f"    [warn] Claude returned unknown slug '{topic_slug}' — marking none")
                    topic_slug = "none"
                    confidence = "low"
                    reasoning = f"Claude returned invalid slug; original: {reasoning}"

                mappings[map_key] = {
                    "unit_title": unit["unitTitle"],
                    "topic_slug": topic_slug,
                    "confidence": confidence,
                    "reasoning": reasoning,
                    "subject": subject,
                    "year": year,
                }

                sym = CONF_SYMBOL.get(confidence, "?")
                if topic_slug == "none":
                    print(f"  ✗       {unit['unitTitle'][:60]}")
                    print(f"          {reasoning[:100]}")
                    none_count += 1
                else:
                    short_slug = topic_slug.split('-', 2)[-1] if '-' in topic_slug else topic_slug
                    print(f"  {sym} [{confidence:6s}] {unit['unitTitle'][:50]} → {short_slug}")
                    print(f"          {reasoning[:100]}")
                new_count += 1
                time.sleep(0.4)  # gentle rate limiting

    # Summary
    matched = sum(1 for v in mappings.values() if v["topic_slug"] != "none")
    unmatched = sum(1 for v in mappings.values() if v["topic_slug"] == "none")
    print(f"\n── {'DRY RUN — ' if args.dry_run else ''}"
          f"{new_count} new mappings ({none_count} unmatched this run) | "
          f"Map total: {len(mappings)} ({matched} matched, {unmatched} none) ──")

    if not args.dry_run:
        out = {
            "version": "1",
            "note": "LLM-assisted Oak unit → NC topic map. Commit this file. Re-run build-oak-topic-map.py after re-seeding topics.",
            "mappings": mappings,
        }
        MAP_FILE.write_text(json.dumps(out, indent=2))
        print(f"Written → {MAP_FILE}")


if __name__ == "__main__":
    main()
