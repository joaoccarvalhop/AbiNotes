"""The walk grid the page builds (tile mask + plan walls), over the map, for a box. Blocked cells red; loot and extracts dots.
Usage: nav_grid_view.py <slug> <floor> x0 y0 x1 y1 -> tools/out/<slug>-grid.png"""
import base64, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
slug, fl = sys.argv[1], sys.argv[2]; box = [float(v) for v in sys.argv[3:7]]
rd = lambda p: (lambda t: json.loads(t[t.index("] = ") + 4:].rstrip().rstrip(";\n")))(open(p, encoding="utf-8").read())
d = rd(os.path.join(ROOT, "maps", slug, "data.js")); nav = rd(os.path.join(ROOT, "maps", slug, "nav.js"))
cell, cols, rows = nav["cell"], nav["cols"], nav["rows"]
g = np.zeros(cols * rows, np.uint8)
if fl in nav.get("masks", {}):
    g = np.repeat(np.arange(len(nav["masks"][fl].split(","))) % 2, [int(n, 36) for n in nav["masks"][fl].split(",")]).astype(np.uint8)
g = g.reshape(rows, cols)
for w in nav["floors"].get(fl, {}).get("walls", []):
    for i in range(2, len(w), 2):
        ax, ay, bx, by = w[i - 2] / cell, w[i - 1] / cell, w[i] / cell, w[i + 1] / cell
        steps = math.ceil(max(abs(bx - ax), abs(by - ay)) * 3) + 1
        for k in range(steps + 1):
            x, y = int(ax + (bx - ax) * k / steps), int(ay + (by - ay) * k / steps)
            if 0 <= x < cols and 0 <= y < rows: g[y, x] = 1
layer = fl if fl in d["layers"] else "base"
size = d["tile"] * d["offsetScale"][0] / d["scale"]; k = min(1600 / (box[2] - box[0]), 1100 / (box[3] - box[1]))  # pixels per map unit
img = Image.new("RGB", (int((box[2] - box[0]) * k), int((box[3] - box[1]) * k)))
for key in d["layers"][layer]["have"]:
    tx, ty = map(int, key.split("_")); ux, uy = d["offset"][0] + tx * size, d["offset"][1] + ty * size
    if ux > box[2] or uy > box[3] or ux + size < box[0] or uy + size < box[1]: continue
    s = max(1, int(size * k) + 1)
    img.paste(Image.open(os.path.join(ROOT, "maps", slug, "tiles", layer, key + ".webp")).convert("RGB").resize((s, s)), (int((ux - box[0]) * k), int((uy - box[1]) * k)))
img = img.convert("RGBA"); ov = Image.new("RGBA", img.size, (0, 0, 0, 0)); dr = ImageDraw.Draw(ov)
for y in range(int(box[1] // cell), int(box[3] // cell) + 1):
    for x in range(int(box[0] // cell), int(box[2] // cell) + 1):
        if 0 <= x < cols and 0 <= y < rows and g[y, x]:
            dr.rectangle([(x * cell - box[0]) * k, (y * cell - box[1]) * k, ((x + 1) * cell - box[0]) * k - 1, ((y + 1) * cell - box[1]) * k - 1], fill=(255, 0, 0, 120))
LOOT = {"Red Item Spawn", "Gold Item Spawn", "Safe", "Electronic Safe", "Secret Safe", "Premium Weapon Cases", "Military Computers", "Large Weapon Cases", "Ammo Caches"}
for mk in d["markers"]:
    if box[0] < mk["x"] < box[2] and box[1] < mk["y"] < box[3] and (mk["c"] in LOOT or "Extract" in mk["c"]):
        px, py = (mk["x"] - box[0]) * k, (mk["y"] - box[1]) * k
        dr.ellipse([px - 5, py - 5, px + 5, py + 5], fill=(0, 255, 255, 255) if "Extract" in mk["c"] else (255, 255, 0, 255))
img = Image.alpha_composite(img, ov).convert("RGB")
out = os.path.join(ROOT, "tools", "out", f"{slug}-grid.png"); img.save(out); print(out, img.size)
