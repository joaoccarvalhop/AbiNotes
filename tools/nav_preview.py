"""Picture of a map with its walls (nav.js) drawn over the tiles, to check that doors are where the gaps are.
Usage: nav_preview.py <slug> [floor] [x0 y0 x1 y1 in map units] -> tools/out/<slug>-nav.png"""
import json, os, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
slug = sys.argv[1]; floor = sys.argv[2] if len(sys.argv) > 2 else "1F"
t = open(os.path.join(ROOT, "maps", slug, "data.js"), encoding="utf-8").read()
d = json.loads(t[t.index("] = ") + 4:].rstrip().rstrip(";"))
n = open(os.path.join(ROOT, "maps", slug, "nav.js"), encoding="utf-8").read()
nav = json.loads(n[n.index("] = ") + 4:].rstrip().rstrip(";\n"))
W, H = d["bounds"][1]
box = [float(v) for v in sys.argv[3:7]] if len(sys.argv) > 6 else [0, 0, W, H]
k = min(1800 / (box[2] - box[0]), 1200 / (box[3] - box[1]))  # pixels per map unit
img = Image.new("RGB", (int((box[2] - box[0]) * k), int((box[3] - box[1]) * k)), (11, 12, 13))
layer = d["layers"].get(floor) and floor or ("base" if "base" in d["layers"] else list(d["layers"])[0])
size = d["tile"] * d["offsetScale"][0] / d["scale"]  # one tile in map units
for key in d["layers"][layer]["have"]:
    tx, ty = map(int, key.split("_"))
    ux, uy = d["offset"][0] + tx * size, d["offset"][1] + ty * size
    if ux > box[2] or uy > box[3] or ux + size < box[0] or uy + size < box[1]:
        continue
    tile = Image.open(os.path.join(ROOT, "maps", slug, "tiles", layer, key + ".webp")).convert("RGB")
    s = max(1, int(size * k) + 1)
    img.paste(tile.resize((s, s)), (int((ux - box[0]) * k), int((uy - box[1]) * k)))
dr = ImageDraw.Draw(img)
P = lambda x, y: ((x - box[0]) * k, (y - box[1]) * k)
for w in nav.get(floor, {}).get("walls", []):
    pts = [P(w[i], w[i + 1]) for i in range(0, len(w), 2)]
    dr.line(pts, fill=(255, 40, 40), width=2)
    dr.ellipse([pts[0][0] - 3, pts[0][1] - 3, pts[0][0] + 3, pts[0][1] + 3], outline=(80, 255, 80))  # where a wall starts
for x, y in nav.get(floor, {}).get("stairs", []):
    px, py = P(x, y); dr.rectangle([px - 4, py - 4, px + 4, py + 4], outline=(80, 160, 255), width=2)
for mk in d["markers"]:
    if mk.get("t") == "l" and mk.get("c") == "Label" and box[0] < mk["x"] < box[2] and box[1] < mk["y"] < box[3]:
        dr.text(P(mk["x"], mk["y"]), mk["n"], fill=(255, 255, 255))
os.makedirs(os.path.join(ROOT, "tools", "out"), exist_ok=True)
out = os.path.join(ROOT, "tools", "out", f"{slug}-nav.png")
img.save(out); print(out, img.size)
