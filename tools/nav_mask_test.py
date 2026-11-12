"""Try: which tile pixels are the white wall lines? Paints them red over the map for a look. Usage: nav_mask_test.py <slug> x0 y0 x1 y1 [threshold]"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
slug = sys.argv[1]; box = [float(v) for v in sys.argv[2:6]]; thr = int(sys.argv[6]) if len(sys.argv) > 6 else 225
t = open(os.path.join(ROOT, "maps", slug, "data.js"), encoding="utf-8").read()
d = json.loads(t[t.index("] = ") + 4:].rstrip().rstrip(";"))
layer = "base" if "base" in d["layers"] else list(d["layers"])[0]
size = d["tile"] * d["offsetScale"][0] / d["scale"]
k = 256 / size  # tile pixels per map unit
img = Image.new("RGB", (int((box[2] - box[0]) * k), int((box[3] - box[1]) * k)))
for key in d["layers"][layer]["have"]:
    tx, ty = map(int, key.split("_"))
    ux, uy = d["offset"][0] + tx * size, d["offset"][1] + ty * size
    if ux > box[2] or uy > box[3] or ux + size < box[0] or uy + size < box[1]: continue
    img.paste(Image.open(os.path.join(ROOT, "maps", slug, "tiles", layer, key + ".webp")).convert("RGB"), (int((ux - box[0]) * k), int((uy - box[1]) * k)))
a = np.asarray(img).astype(int)
white = (a.min(axis=2) > thr) & (a.max(axis=2) - a.min(axis=2) < 25)
out = a.copy(); out[white] = [255, 30, 30]
os.makedirs(os.path.join(ROOT, "tools", "out"), exist_ok=True)
p = os.path.join(ROOT, "tools", "out", f"{slug}-mask.png")
Image.fromarray(out.astype("uint8")).save(p); print(p, img.size, "white share", round(white.mean() * 100, 2), "%")
