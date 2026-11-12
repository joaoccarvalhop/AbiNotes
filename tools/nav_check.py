"""Are the walls right? Per map and floor: builds the same walk grid as the page (tile mask + plan walls), fills from where
people come in (the spawns on the ground floor, the stairs on the others) and lists what can't be reached: loot, extracts,
keys. Also writes a picture per floor (tools/out/check-<slug>-<floor>.png): walls red, reached area tinted, unreached
points magenta.
Usage: nav_check.py [slug ...]"""
import base64, collections, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import navlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: (lambda t: json.loads(t[t.index("] = ") + 4:].rstrip().rstrip(";\n")))(open(p, encoding="utf-8").read())
CHECK = {"Red Item Spawn", "Gold Item Spawn", "Safe", "Electronic Safe", "Secret Safe", "Safe (Behind Key)", "Premium Weapon Cases",
         "Military Computers", "Airdrops", "Extract", "No Backpack Extract", "Key", "Boss Spawn"}


def grid(nav, fl):
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
    return g


def near_free(g, x, y):
    rows, cols = g.shape
    for r in range(0, 5):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if max(abs(dx), abs(dy)) != r: continue
                nx, ny = x + dx, y + dy
                if 0 <= nx < cols and 0 <= ny < rows and not g[ny, nx]: return nx, ny
    return None


def flood(g, seeds):
    """Cells you can walk to from the seeds: 8 directions, never between two walls touching at a corner (as the page)."""
    rows, cols = g.shape; seen = np.zeros_like(g, bool); q = collections.deque()
    for s in seeds:
        if s and not seen[s[1], s[0]]: seen[s[1], s[0]] = True; q.append(s)
    while q:
        x, y = q.popleft()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if not dx and not dy: continue
                nx, ny = x + dx, y + dy
                if not (0 <= nx < cols and 0 <= ny < rows) or seen[ny, nx] or g[ny, nx]: continue
                if dx and dy and (g[y, nx] or g[ny, x]): continue
                seen[ny, nx] = True; q.append((nx, ny))
    return seen


def check(slug):
    d = rd(os.path.join(ROOT, "maps", slug, "data.js"))
    p = os.path.join(ROOT, "maps", slug, "nav.js")
    if not os.path.exists(p):
        print(f"\n{slug}: no walls at all"); return
    nav = rd(p); cell = nav["cell"]; ground = nav.get("ground") or d.get("level")
    labels = [m for m in d["markers"] if m.get("t") == "l" and m.get("c") == "Label"]
    place = lambda x, y: min(labels, key=lambda m: (m["x"] - x) ** 2 + (m["y"] - y) ** 2)["n"] if labels else ""
    print(f"\n{slug} (ground {ground})")
    for fl in d["levels"]:
        if fl not in nav["floors"] and fl not in nav.get("masks", {}):
            print(f"  {fl}: no walls"); continue
        g = navlib.grid(slug, fl, d, nav)  # as the page builds it, fixes included
        on = lambda m: (m.get("l") or ground) == fl
        if fl == ground:
            seeds = [near_free(g, int(m["x"] // cell), int(m["y"] // cell)) for m in d["markers"] if m["c"] == "Spawn"]
        else:
            seeds = [near_free(g, int(x // cell), int(y // cell)) for x, y in nav["floors"].get(fl, {}).get("stairs", [])]
        if not any(seeds):  # no stairs in the data: start from the point whose area holds the most points
            cand = [near_free(g, int(m["x"] // cell), int(m["y"] // cell)) for m in d["markers"] if m["c"] in CHECK and on(m)]
            best, seeds = -1, []
            for c in cand[:40]:
                if not c: continue
                s = flood(g, [c]); n = sum(1 for q in cand if q and s[q[1], q[0]])
                if n > best: best, seeds = n, [c]
        seen = flood(g, seeds)
        bad = collections.Counter(); total = 0
        pts = [m for m in d["markers"] if m["c"] in CHECK and on(m)]
        miss = []
        for m in pts:
            c = near_free(g, int(m["x"] // cell), int(m["y"] // cell))
            total += 1
            if not c or not seen[c[1], c[0]]:
                bad[place(m["x"], m["y"])] += 1; miss.append(m)
        print(f"  {fl}: {len(nav['floors'].get(fl, {}).get('walls', []))} plan walls, mask {'yes' if fl in nav.get('masks', {}) else 'no'}, "
              f"from {sum(1 for s in seeds if s)} {'spawns' if fl == ground else 'stairs'}: {total - len(miss)}/{total} reachable"
              + (f" | shut in: {dict(bad.most_common())}" if bad else ""))
        picture(d, slug, fl, g, seen, miss, nav)


def picture(d, slug, fl, g, seen, miss, nav):
    rows, cols = g.shape; cell = nav["cell"]
    xs = [m["x"] for m in d["markers"]]; ys = [m["y"] for m in d["markers"]]
    box = [max(0, np.percentile(xs, .5) - 300), max(0, np.percentile(ys, .5) - 300), np.percentile(xs, 99.5) + 300, np.percentile(ys, 99.5) + 300]
    k = min(2000 / (box[2] - box[0]), 1300 / (box[3] - box[1]))
    layer = fl if fl in d["layers"] else ("base" if "base" in d["layers"] else list(d["layers"])[0])
    size = d["tile"] * d["offsetScale"][0] / d["scale"]
    img = Image.new("RGB", (int((box[2] - box[0]) * k), int((box[3] - box[1]) * k)), (10, 10, 10))
    for key in d["layers"][layer]["have"]:
        tx, ty = map(int, key.split("_")); ux, uy = d["offset"][0] + tx * size, d["offset"][1] + ty * size
        if ux > box[2] or uy > box[3] or ux + size < box[0] or uy + size < box[1]: continue
        s = max(1, int(size * k) + 1)
        img.paste(Image.open(os.path.join(ROOT, "maps", slug, "tiles", layer, key + ".webp")).convert("RGB").resize((s, s)), (int((ux - box[0]) * k), int((uy - box[1]) * k)))
    a = np.asarray(img).astype(float)
    # walls red, reached ground slightly green: per pixel, look up its cell
    py, px = np.mgrid[0:img.size[1], 0:img.size[0]]
    cx = ((px / k + box[0]) // cell).astype(int).clip(0, cols - 1); cy = ((py / k + box[1]) // cell).astype(int).clip(0, rows - 1)
    wall = g[cy, cx].astype(bool); reach = seen[cy, cx]
    a[wall] = [255, 40, 40]
    a[reach & ~wall] = a[reach & ~wall] * .8 + np.array([0, 60, 20])
    img = Image.fromarray(a.clip(0, 255).astype("uint8")); dr = ImageDraw.Draw(img)
    P = lambda x, y: ((x - box[0]) * k, (y - box[1]) * k)
    for x, y in nav["floors"].get(fl, {}).get("stairs", []):
        q = P(x, y); dr.rectangle([q[0] - 5, q[1] - 5, q[0] + 5, q[1] + 5], outline=(80, 160, 255), width=2)
    for m in miss:
        q = P(m["x"], m["y"]); dr.ellipse([q[0] - 6, q[1] - 6, q[0] + 6, q[1] + 6], outline=(255, 0, 255), width=3)
    for m in d["markers"]:
        if m.get("t") == "l" and m.get("c") == "Label":
            dr.text(P(m["x"], m["y"]), m["n"], fill=(255, 255, 255))
    out = os.path.join(ROOT, "tools", "out", f"check-{slug}-{fl}.png"); img.save(out)


os.makedirs(os.path.join(ROOT, "tools", "out"), exist_ok=True) if __name__ == "__main__" else None
if __name__ == "__main__":
    for s in sys.argv[1:] or ["farm", "valley", "northridge", "armory", "tv-station", "airport"]:
        check(s)
