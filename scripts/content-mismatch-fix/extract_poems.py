import json, re
lines = open("/tmp/gt.txt", encoding="utf-8").read().split("\n")
BODY_MAX = 14500  # avoid the first-line index later in the file

POEMS = [
 {"key":"ozymandias","title":"Ozymandias","author_name":"Percy Bysshe Shelley","year":"1818",
  "first":"I met a traveller from an antique land","last":"The lone and level sands stretch far away.",
  "n":14,"auth":"SHELLEY","must":["Ozymandias, king of kings","Look on my works"]},
 {"key":"westminster","title":"Composed upon Westminster Bridge","author_name":"William Wordsworth","year":"1802",
  "first":"Earth has not anything to show more fair:","last":"And all that mighty heart is lying still!",
  "n":14,"auth":"WORDSWORTH","must":["This City now doth like a garment wear"]},
 {"key":"she_walks","title":"She Walks in Beauty","author_name":"Lord Byron","year":"1814",
  "first":"She walks in beauty, like the night","last":None,
  "n":18,"auth":"BYRON","must":["Of cloudless climes and starry skies"]},
 {"key":"world_too_much","title":"The World Is Too Much With Us","author_name":"William Wordsworth","year":"1807",
  "first":"The World is too much with us; late and soon,","last":None,
  "n":14,"auth":"WORDSWORTH","must":["Getting and spending, we lay waste our powers"]},
]

AUTH_RE = re.compile(r"^[A-Z][A-Z.' ]+\.\s*$")  # e.g. "P.B. SHELLEY." / "LORD BYRON."

def extract(first):
    start = None
    for i, l in enumerate(lines):
        if i > BODY_MAX:
            break
        if l.strip() == first.strip():
            start = i
            break
    if start is None:
        return None, "first line not found"
    out = []
    j = start
    while j < len(lines):
        raw = lines[j]
        s = raw.strip()
        if s and AUTH_RE.match(s) and j > start + 3:
            break
        if re.match(r"^\s+\d+\.\s+[A-Z]", raw) and j > start + 1:
            break
        out.append(raw[5:] if raw.startswith("     ") else raw.rstrip())
        j += 1
    while out and not out[-1].strip():
        out.pop()
    term = lines[j].strip() if j < len(lines) else ""
    return out, term

result = {}
for p in POEMS:
    body, term = extract(p["first"])
    key = p["key"]
    if body is None:
        print("FAIL " + key + ": " + term)
        continue
    verse = [l for l in body if l.strip()]
    ok = (verse[0].strip() == p["first"].strip()
          and len(verse) == p["n"]
          and (p["last"] is None or verse[-1].strip() == p["last"].strip())
          and all(any(m in l for l in body) for m in p["must"])
          and p["auth"] in term.upper())
    status = "OK" if ok else "VERIFY-FAIL"
    print(status + " " + key + ": lines=" + str(len(verse)) + " term='" + term + "' first='" + verse[0][:40] + "' last='" + verse[-1][:40] + "'")
    if ok:
        result[key] = {"title": p["title"], "author": p["author_name"], "year": p["year"], "text": "\n".join(body).strip()}

json.dump(result, open("/tmp/poems.json", "w"), ensure_ascii=False, indent=1)
print("\nVERIFIED " + str(len(result)) + "/" + str(len(POEMS)) + " poems -> /tmp/poems.json")
