"""Pictures to review the walls piece by piece: one per place (each place name on the map), ~110 m across, walls red,
ticks every 50 m in map units on the edges, yellow dots loot, cyan squares extracts, green rings spawns, magenta rings the
points nothing can reach. Writes tools/out/review/<slug>-<floor>/<nn>-<place>.png and an index.json with each box.
Usage: nav_review.py <slug> <floor> [place ...]   (a box instead of places: --box x0 y0 x1 y1 name)"""
import json, os, re, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import navlib
from nav_check import flood, near_free, CHECK

slug, fl = sys.argv[1], sys.argv[2]
d, nav = navlib.load(slug)
g = navlib.grid(slug, fl, d, nav); cell = nav["cell"]; ground = nav.get("ground") or d.get("level")
mpu = navlib.mpu(d); half = 55 / mpu
out = os.path.join(navlib.ROOT, "tools", "out", "review", f"{slug}-{fl}"); os.makedirs(out, exist_ok=True)
# who can't be reached, as in nav_check
on = lambda m: (m.get("l") or ground) == fl
seeds = ([near_free(g, int(m["x"] // cell), int(m["y"] // cell)) for m in d["markers"] if m["c"] == "Spawn"] if fl == ground
         else [near_free(g, int(x // cell), int(y // cell)) for x, y in nav["floors"].get(fl, {}).get("stairs", [])])
if not any(seeds):
    cand = [near_free(g, int(m["x"] // cell), int(m["y"] // cell)) for m in d["markers"] if m["c"] in CHECK and on(m)]
    best = -1
    for c in cand[:40]:
        if not c: continue
        s = flood(g, [c]); n = sum(1 for q in cand if q and s[q[1], q[0]])
        if n > best: best, seeds = n, [c]
seen = flood(g, seeds)
miss = [(m["x"], m["y"], (255, 0, 255)) for m in d["markers"] if m["c"] in CHECK and on(m)
        and (lambda c: not c or not seen[c[1], c[0]])(near_free(g, int(m["x"] // cell), int(m["y"] // cell)))]
args = sys.argv[3:]
if args[:1] == ["--box"]:
    boxes = [(args[5], [float(v) for v in args[1:5]])]
else:
    labels = [m for m in d["markers"] if m.get("t") == "l" and m.get("c") == "Label" and not re.search(r"\bkey\b", m["n"], re.I)]
    if args: labels = [m for m in labels if m["n"] in args]
    # only places with something to see on this floor: walls or points near them
    boxes = []
    for m in labels:
        b = [m["x"] - half, m["y"] - half * .7, m["x"] + half, m["y"] + half * .7]
        y0, y1, x0, x1 = int(max(0, b[1] // cell)), int(b[3] // cell), int(max(0, b[0] // cell)), int(b[2] // cell)
        if g[y0:y1, x0:x1].sum() < 20 and not any(b[0] < p[0] < b[2] and b[1] < p[1] < b[3] for p in miss): continue
        boxes.append((m["n"], b))
index = []
for i, (name, b) in enumerate(boxes):
    p = os.path.join(out, f"{i:02d}-{re.sub(r'[^A-Za-z0-9]+', '_', name)}.png")
    k = navlib.picture(d, slug, fl, g, cell, b, p, miss)
    index.append({"file": os.path.basename(p), "place": name, "box": [round(v) for v in b], "px_per_unit": round(k, 5)})
json.dump(index, open(os.path.join(out, "index.json"), "w"), indent=1)
print(out, len(index), "pictures;", len(miss), "unreachable points on this floor")
