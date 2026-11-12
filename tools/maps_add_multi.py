"""Adds to each map's data.js the markers that sit in several places at once (a key that opens more than one door, a
safe that can be in several rooms). markers.json keeps them as one marker with a list of spots, and the first copy of
the maps left them out; here each spot becomes a marker of its own. Running it again adds nothing twice.

  python tools\\maps_add_multi.py            (all maps; --dry shows what it would add)"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY = "--dry" in sys.argv

def body_of(js):  # data.js is one line of comment, then  (window.ABI_MAPS = …)["slug"] = {…};
    i = js.index("= {") + 2
    return js[:i], js[i:js.rindex("}") + 1], js[js.rindex("}") + 1:]

for slug in sorted(os.listdir(os.path.join(ROOT, "maps"))):
    src, dst = os.path.join(ROOT, "maps", slug, "markers.json"), os.path.join(ROOT, "maps", slug, "data.js")
    if not (os.path.exists(src) and os.path.exists(dst)): continue
    raw = json.load(open(src, encoding="utf8")); arr = raw if isinstance(raw, list) else raw.get("markers", [])
    js = open(dst, encoding="utf8").read(); head, body, tail = body_of(js)
    d = json.loads(body)
    if json.dumps(d, separators=(",", ":"), ensure_ascii=False) != body:
        sys.exit(f"{slug}: data.js would not be written back the same; stopped so nothing is lost")
    have = {(m.get("c"), m.get("n"), m.get("x"), m.get("y"), m.get("l")) for m in d["markers"]}
    added = []
    for m in arr:
        if m.get("type") != "point" or not m.get("coordinates") or not isinstance(m["coordinates"][0], list): continue
        for x, y in m["coordinates"]:
            mk = {"t": "p", "c": m["category"], "x": x, "y": y}
            if m.get("level"): mk["l"] = m["level"]
            mk["n"] = m.get("title") or m["category"]
            if m.get("info"): mk["d"] = m["info"]
            if m.get("difficulty"): mk["df"] = m["difficulty"]
            if m.get("youtube"): mk["yt"] = m["youtube"]
            if m.get("icon") and os.path.exists(os.path.join(ROOT, "maps", m["icon"].lstrip("/"))): mk["ic"] = "maps" + m["icon"]
            if m.get("loot"): mk["loot"] = m["loot"]
            k = (mk["c"], mk["n"], x, y, mk.get("l"))
            if k in have: continue
            have.add(k); d["markers"].append(mk); added.append(f'{mk["c"]}: {mk["n"]} ({mk.get("l", "")})')
    print(f"{slug}: {len(added)} added" + "".join("\n  " + a for a in added))
    if added and not DRY:
        with open(dst, "w", encoding="utf8", newline="") as f: f.write(head + json.dumps(d, separators=(",", ":"), ensure_ascii=False) + tail)
