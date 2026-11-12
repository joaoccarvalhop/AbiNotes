"""The walk grid exactly as the page builds it, for the check and review tools.

grid(slug, floor) -> (g, nav): g[y, x] = 1 where you can't walk. Built from maps/<slug>/nav.js: the tile mask (run lengths),
the plan walls, then the fixes (nav.fix, from maps/<slug>/nav-fix.json): walls and blocked areas added, "clear" areas opened,
then cuts (door-wide holes). The page does the same, then your own edits from data.nav.
"""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: (lambda t: json.loads(t[t.index("] = ") + 4:].rstrip().rstrip(";\n")))(open(p, encoding="utf-8").read())


def load(slug):
    d = rd(os.path.join(ROOT, "maps", slug, "data.js"))
    p = os.path.join(ROOT, "maps", slug, "nav.js")
    return d, (rd(p) if os.path.exists(p) else None)


def mpu(d):
    return .045 if d["name"] == "TV Station" else .09


def line(g, w, cell, close=False):
    rows, cols = g.shape
    pts = [(w[i], w[i + 1]) for i in range(0, len(w), 2)] + ([(w[0], w[1])] if close else [])
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        ax, ay, bx, by = ax / cell, ay / cell, bx / cell, by / cell
        steps = math.ceil(max(abs(bx - ax), abs(by - ay)) * 3) + 1
        for k in range(steps + 1):
            x, y = math.floor(ax + (bx - ax) * k / steps), math.floor(ay + (by - ay) * k / steps)
            if 0 <= x < cols and 0 <= y < rows: g[y, x] = 1


def fill(g, poly, cell, value):
    """Every cell whose middle is inside the polygon (flat list of map units) gets value."""
    rows, cols = g.shape
    img = Image.new("L", (cols, rows), 0)
    ImageDraw.Draw(img).polygon([(poly[i] / cell - .5, poly[i + 1] / cell - .5) for i in range(0, len(poly), 2)], fill=1)
    g[np.asarray(img).astype(bool)] = value


def apply(g, e, cell, d):
    if not e: return
    for w in e.get("walls", []): line(g, w, cell)          # same order as the page: walls, cleared areas, blocked areas, cuts
    for a in e.get("clear", []): fill(g, a, cell, 0)
    for a in e.get("areas", []): line(g, a, cell, True); fill(g, a, cell, 1)
    r = 1.6 / mpu(d) / cell
    rows, cols = g.shape
    for c in e.get("cuts", []):
        cx, cy = c[0] / cell, c[1] / cell; rr = (c[2] / mpu(d) / cell) if len(c) > 2 else r
        for y in range(math.floor(cy - rr), math.floor(cy + rr) + 1):
            for x in range(math.floor(cx - rr), math.floor(cx + rr) + 1):
                if 0 <= x < cols and 0 <= y < rows and (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= rr * rr: g[y, x] = 0


def grid(slug, fl, d=None, nav=None):
    if d is None: d, nav = load(slug)
    cell, cols, rows = nav["cell"], nav["cols"], nav["rows"]
    if fl in nav.get("masks", {}):
        runs = [int(n, 36) for n in nav["masks"][fl].split(",")]
        g = np.repeat(np.arange(len(runs)) % 2, runs).astype(np.uint8)[:cols * rows]
        g = np.pad(g, (0, cols * rows - g.size)).reshape(rows, cols)
    else:
        g = np.zeros((rows, cols), np.uint8)
    for w in nav["floors"].get(fl, {}).get("walls", []): line(g, w, cell)
    apply(g, (nav.get("fix") or {}).get(fl), cell, d)
    return g


def picture(d, slug, fl, g, cell, box, out, marks=(), width=1400):
    """The map's tiles for the box, walls as red squares, labels, loot and extracts; a tick every 50 m on the edges, in map units."""
    k = width / (box[2] - box[0])
    layer = fl if fl in d["layers"] else ("base" if "base" in d["layers"] else list(d["layers"])[0])
    size = d["tile"] * d["offsetScale"][0] / d["scale"]
    W, H = int((box[2] - box[0]) * k), int((box[3] - box[1]) * k)
    img = Image.new("RGB", (W, H), (10, 10, 10))
    for key in d["layers"][layer]["have"]:
        tx, ty = map(int, key.split("_")); ux, uy = d["offset"][0] + tx * size, d["offset"][1] + ty * size
        if ux > box[2] or uy > box[3] or ux + size < box[0] or uy + size < box[1]: continue
        s = max(1, int(size * k) + 1)
        img.paste(Image.open(os.path.join(ROOT, "maps", slug, "tiles", layer, key + ".webp")).convert("RGB").resize((s, s)), (int((ux - box[0]) * k), int((uy - box[1]) * k)))
    for pf in d["floors"]:  # the floor's plan over the tiles, as the page shows it
        if fl in pf["floor"] and not pf["src"].endswith(".svg"):
            (x0, y0), (x1, y1) = pf["bounds"]
            im = Image.open(os.path.join(ROOT, "maps", slug, pf["src"].split(f"maps/{slug}/")[1])).convert("RGBA")
            im = im.resize((max(1, int((x1 - x0) * k)), max(1, int((y1 - y0) * k))))
            img.paste(im, (int((x0 - box[0]) * k), int((y0 - box[1]) * k)), im)
    a = np.asarray(img).astype(float)
    py, px = np.mgrid[0:H, 0:W]
    rows, cols = g.shape
    cx = ((px / k + box[0]) // cell).astype(int).clip(0, cols - 1); cy = ((py / k + box[1]) // cell).astype(int).clip(0, rows - 1)
    wall = g[cy, cx].astype(bool)
    a[wall] = a[wall] * .35 + np.array([255, 30, 30]) * .65
    img = Image.fromarray(a.clip(0, 255).astype("uint8")); dr = ImageDraw.Draw(img)
    P = lambda x, y: ((x - box[0]) * k, (y - box[1]) * k)
    step = 50 / mpu(d)  # 50 m
    x = math.ceil(box[0] / step) * step
    while x < box[2]:
        q = P(x, 0)[0]; dr.line([(q, 0), (q, 8)], fill=(255, 255, 0)); dr.line([(q, H - 8), (q, H)], fill=(255, 255, 0)); dr.text((q + 2, 9), str(int(x)), fill=(255, 255, 0)); x += step
    y = math.ceil(box[1] / step) * step
    while y < box[3]:
        q = P(0, y)[1]; dr.line([(0, q), (8, q)], fill=(255, 255, 0)); dr.line([(W - 8, q), (W, q)], fill=(255, 255, 0)); dr.text((10, q + 2), str(int(y)), fill=(255, 255, 0)); y += step
    LOOT = {"Red Item Spawn", "Gold Item Spawn", "Safe", "Electronic Safe", "Secret Safe", "Premium Weapon Cases", "Military Computers", "Key"}
    for m in d["markers"]:
        if not (box[0] < m["x"] < box[2] and box[1] < m["y"] < box[3]): continue
        if (m.get("l") or d.get("level")) != fl and m["c"] != "Label": continue
        q = P(m["x"], m["y"])
        if m.get("t") == "l" and m["c"] == "Label": dr.text(q, m["n"], fill=(255, 255, 255))
        elif m["c"] in LOOT: dr.ellipse([q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4], fill=(255, 230, 0))
        elif "Extract" in m["c"]: dr.rectangle([q[0] - 5, q[1] - 5, q[0] + 5, q[1] + 5], outline=(0, 255, 255), width=2)
        elif m["c"] == "Spawn": dr.ellipse([q[0] - 6, q[1] - 6, q[0] + 6, q[1] + 6], outline=(80, 255, 80), width=2)
    for (x, y, col) in marks:
        q = P(x, y); dr.ellipse([q[0] - 7, q[1] - 7, q[0] + 7, q[1] + 7], outline=col, width=3)
    img.save(out)
    return k
