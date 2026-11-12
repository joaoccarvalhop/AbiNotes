"""Walls for the route finder, taken from the floor plans (maps/<slug>/floors/*.svg).

In each plan a building is a filled shape (its footprint) plus white strokes (its walls). Where one stroke stops and the next
starts there is a way in, so the solid strokes are the barriers and the gaps between them are the doors. Stairs are drawn in
groups of their own with faint strokes (the steps): they are not walls; their middle is kept as a way between floors.
Some maps also draw their outdoor walls and fences as white lines on the tiles (Farm, Airport): those become a mask of
blocked cells for the ground floor, cleared inside the buildings (there the plan's walls, with their doors, decide).
Writes maps/<slug>/nav.js:
    window.ABI_NAV[slug] = { cell, cols, rows, ground, masks: { "<floor>": run lengths (base 36, free first) },
                             floors: { "<floor>": { "walls": [[x0, y0, x1, y1, ...], ...], "stairs": [[x, y], ...] } } }
in map units (the same as the markers).
"""
import base64, json, math, os, re, sys
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw

M = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "maps")
NS = "{http://www.w3.org/2000/svg}"
NUM = re.compile(r"-?\d*\.?\d+(?:e-?\d+)?")


def subpaths(d):
    """Polylines of a path: M/m start one, l/L/h/v/H/V add points, curves keep their end point, Z closes."""
    out, cur, x, y, sx, sy = [], None, 0.0, 0.0, 0.0, 0.0
    for cmd, args in re.findall(r"([MmLlHhVvCcSsQqZz])([^MmLlHhVvCcSsQqZz]*)", d):
        n = [float(v) for v in NUM.findall(args)]
        if cmd in "Mm":
            for i in range(0, len(n) - 1, 2):
                rel = cmd == "m" and (i > 0 or cur is not None)
                x, y = (x + n[i], y + n[i + 1]) if rel else (n[i], n[i + 1])
                if i == 0:
                    cur = [(x, y)]; out.append(cur); sx, sy = x, y
                else:
                    cur.append((x, y))  # extra pairs after a move are line-tos
        elif cmd in "Ll":
            for i in range(0, len(n) - 1, 2):
                x, y = (x + n[i], y + n[i + 1]) if cmd == "l" else (n[i], n[i + 1]); cur.append((x, y))
        elif cmd in "Hh":
            for v in n:
                x = x + v if cmd == "h" else v; cur.append((x, y))
        elif cmd in "Vv":
            for v in n:
                y = y + v if cmd == "v" else v; cur.append((x, y))
        elif cmd in "CcSsQq":
            step = 6 if cmd in "Cc" else 4
            for i in range(0, len(n) - step + 1, step):
                ex, ey = n[i + step - 2], n[i + step - 1]
                x, y = (x + ex, y + ey) if cmd.islower() else (ex, ey); cur.append((x, y))
        elif cmd in "Zz":
            if cur: cur.append((sx, sy))
            x, y = sx, sy
    return [p for p in out if len(p) > 1]


def convert(slug):
    t = open(os.path.join(M, slug, "data.js"), encoding="utf-8").read()
    d = json.loads(t[t.index("] = ") + 4:].rstrip().rstrip(";"))
    nav = {}
    for f in d["floors"]:
        if not f["src"].endswith(".svg"):
            continue
        root = ET.parse(os.path.join(M, slug, f["src"].split(f"maps/{slug}/")[1])).getroot()
        vb = [float(v) for v in root.get("viewBox").split()]
        (x0, y0), (x1, y1) = f["bounds"]
        kx, ky = (x1 - x0) / vb[2], (y1 - y0) / vb[3]
        to = lambda p: [round(x0 + (p[0] - vb[0]) * kx), round(y0 + (p[1] - vb[1]) * ky)]
        walls, stairs, rooms = [], [], []

        def walk(e, in_stairs):
            for ch in e:
                tag = ch.tag.replace(NS, "")
                if tag == "g":
                    st = in_stairs or (ch.get("id") or "").startswith("stairs")
                    if st and not in_stairs:  # the middle of a stair group: a way between floors
                        pts = [q for p in ch.iter(NS + "path") for sp in subpaths(p.get("d")) for q in sp]
                        if pts: stairs.append(to((sum(q[0] for q in pts) / len(pts), sum(q[1] for q in pts) / len(pts))))
                    walk(ch, st)
                elif tag == "path" and not in_stairs:
                    style = ch.get("style") or ""
                    op = re.search(r"stroke-opacity:([\d.]+)", style)
                    if "stroke:" in style and not (op and float(op.group(1)) < 1):
                        for sp in subpaths(ch.get("d")): walls.append([c for q in sp for c in to(q)])
                    elif "stroke:" not in style:  # a building's footprint
                        for sp in subpaths(ch.get("d")): rooms.append([to(q) for q in sp])
        walk(root, False)
        for fl in f["floor"]:
            e = nav.setdefault(fl, {"walls": [], "stairs": [], "rooms": []})
            e["walls"] += walls; e["stairs"] += stairs; e["rooms"] += rooms
    mpu = .045 if d["name"] == "TV Station" else .09
    cell = round(.75 / mpu)  # .75 m squares: doors are 1 to 2 m wide
    W, H = d["bounds"][1]
    cols, rows = int(W // cell) + 1, int(H // cell) + 1
    ground = d.get("level") or d["levels"][0]
    masks, lines, waters = {}, {}, {}
    for fl in d["levels"]:
        layer = fl if fl in d["layers"] else ("base" if fl == ground and "base" in d["layers"] else None)
        got = tile_mask(slug, d, layer, cell, cols, rows) if layer else None
        mask, water = got if got else (None, None)
        # plans drawn as pictures (Armory, Airport): their wall outlines are white too
        for pf in d["floors"]:
            if fl in pf["floor"] and not pf["src"].endswith(".svg"):
                pm = image_mask(slug, pf, cell, cols, rows)
                mask = pm if mask is None else mask | pm
        if mask is None: continue
        # inside a building the plan decides: clear its footprint (a little wider, to open the doors through the roof outline)
        img = Image.new("L", (cols, rows), 0); dr = ImageDraw.Draw(img)
        for room in nav.get(fl, {}).get("rooms", []):
            dr.polygon([(x / cell, y / cell) for x, y in room], fill=1, outline=1)
        inside = np.asarray(img).astype(bool)
        grow = inside.copy()  # the roof outline sits a little outside the footprint: clear a few cells round it (~2 m, so yard walls next to it stay)
        for dy in range(-3, 4):
            for dx in range(-3, 4): grow |= np.roll(np.roll(inside, dy, 0), dx, 1)
        mask &= ~grow
        masks[fl] = runs(mask)
        # for the picture only: the wall lines as clean strokes, the water as shapes
        lines[fl] = trace(mask & ~water if water is not None else mask, cell)
        if water is not None and water.any(): waters[fl] = runs(water)
    if not nav and not masks and not os.path.exists(os.path.join(M, slug, "nav-fix.json")):
        return None
    for v in nav.values():
        v.pop("rooms", None)
        v["walls"] = [shorten(w, .25 / mpu) for w in v["walls"]]
    out_obj = {"cell": cell, "cols": cols, "rows": rows, "ground": ground, "floors": nav, "masks": masks, "lines": lines, "water": waters}
    fix = os.path.join(M, slug, "nav-fix.json")  # corrections checked by hand: doors the plans miss, walls the tiles miss, false walls
    if os.path.exists(fix):
        out_obj["fix"] = json.load(open(fix, encoding="utf-8"))
    out = os.path.join(M, slug, "nav.js")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("window.ABI_NAV = window.ABI_NAV || {};\nwindow.ABI_NAV[" + json.dumps(slug) + "] = " + json.dumps(out_obj, separators=(",", ":")) + ";\n")
    return {fl: (len(v["walls"]), len(v["stairs"])) for fl, v in nav.items()}, "masks " + ",".join(masks) if masks else "no mask", os.path.getsize(out)


def shorten(w, by):
    """Pull a wall's loose ends back a little, so the doorway between two walls stays open on the grid."""
    if len(w) < 4 or (w[0], w[1]) == (w[-2], w[-1]):
        return w
    w = list(w)
    for a, b in ((0, 2), (len(w) - 2, len(w) - 4)):
        dx, dy = w[b] - w[a], w[b + 1] - w[a + 1]; L = (dx * dx + dy * dy) ** .5
        if L > by * 2.5:
            w[a] = round(w[a] + dx / L * by); w[a + 1] = round(w[a + 1] + dy / L * by)
    return w


def runs(mask):
    """A mask as the lengths of its runs, row by row, starting with a free run: base-36 numbers joined by commas."""
    flat = mask.astype(np.int8).ravel()
    edges = np.flatnonzero(np.diff(flat)) + 1
    bounds = np.concatenate(([0], edges, [flat.size]))
    lens = np.diff(bounds).tolist()
    if flat[0]: lens = [0] + lens
    return ",".join(np.base_repr(n, 36).lower() for n in lens)


def tile_mask(slug, d, layer, cell, cols, rows):
    """Blocked cells read from a layer's tiles: the white wall lines (minus short loose bits: road markings), and water.
    None when the layer has neither."""
    size = d["tile"] * d["offsetScale"][0] / d["scale"]  # a tile, in map units
    white_n = np.zeros((rows, cols), np.int32); water_n = np.zeros((rows, cols), np.int32); all_n = np.zeros((rows, cols), np.int32)
    seen = white_px = 0
    for key in d["layers"][layer]["have"]:
        tx, ty = map(int, key.split("_"))
        a = np.asarray(Image.open(os.path.join(M, slug, "tiles", layer, key + ".webp")).convert("RGB")).astype(int)
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        white = (a.min(axis=2) > 225) & (a.max(axis=2) - a.min(axis=2) < 25)
        water = (b - r > 25) & (g - r > 15) & (b >= g - 8) & (a.sum(axis=2) < 420)
        seen += white.size; white_px += white.sum()
        ys, xs = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        cx = ((d["offset"][0] + tx * size + (xs + .5) * size / a.shape[1]) // cell).astype(int)
        cy = ((d["offset"][1] + ty * size + (ys + .5) * size / a.shape[0]) // cell).astype(int)
        ok = (cx >= 0) & (cx < cols) & (cy >= 0) & (cy < rows)
        np.add.at(all_n, (cy[ok], cx[ok]), 1)
        np.add.at(white_n, (cy[ok], cx[ok]), white[ok].astype(int))
        np.add.at(water_n, (cy[ok], cx[ok]), water[ok].astype(int))
    walls = drop_small(white_n > 0, lambda n, w, h: n < 12 and max(w, h) < 9)          # a dash of road marking: under ~6 m
    water = (water_n * 2 > all_n) & (all_n > 0)
    for _ in range(3): water = water | np.roll(water, 1, 0) | np.roll(water, -1, 0) | np.roll(water, 1, 1) | np.roll(water, -1, 1)  # close the gaps
    for _ in range(3): water = water & np.roll(water, 1, 0) & np.roll(water, -1, 0) & np.roll(water, 1, 1) & np.roll(water, -1, 1)  # (a canal in patches)
    water = drop_small(water, lambda n, w, h: n < 40)     # puddles and blue roofs' bits: under ~20 m²
    has_walls = white_px / max(1, seen) > .0005
    if not has_walls and not water.any():
        return None
    print("   ", slug, layer, "walls" if has_walls else "no wall lines", "| water cells", int(water.sum()))
    return (walls if has_walls else np.zeros_like(walls)) | water, water


def thin(m):
    """Zhang-Suen thinning: a stroke a few squares wide down to its middle line, one square wide."""
    m = m.astype(np.uint8).copy()
    while True:
        changed = False
        for step in (0, 1):
            P = np.pad(m, 1)
            n = [P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:], P[2:, 2:], P[2:, 1:-1], P[2:, :-2], P[1:-1, :-2], P[:-2, :-2]]  # p2..p9
            B = sum(n)
            A = sum(((n[i] == 0) & (n[(i + 1) % 8] == 1)) for i in range(8))
            c = (n[0] * n[2] * n[4] == 0) & (n[2] * n[4] * n[6] == 0) if step == 0 else (n[0] * n[2] * n[6] == 0) & (n[0] * n[4] * n[6] == 0)
            kill = (m == 1) & (B >= 2) & (B <= 6) & (A == 1) & c
            if kill.any(): m[kill] = 0; changed = True
        if not changed: return m


def rdp(pts, eps):
    """Douglas-Peucker: keep only the points a line needs to stay within eps of the original."""
    if len(pts) < 3: return pts
    (x0, y0), (x1, y1) = pts[0], pts[-1]; L = math.hypot(x1 - x0, y1 - y0) or 1e-9
    d = [abs((x1 - x0) * (y0 - y) - (x0 - x) * (y1 - y0)) / L for x, y in pts[1:-1]]
    i = max(range(len(d)), key=d.__getitem__)
    if d[i] <= eps: return [pts[0], pts[-1]]
    return rdp(pts[:i + 2], eps)[:-1] + rdp(pts[i + 1:], eps)


def trace(mask, cell):
    """Wall squares as clean lines in map units: thinned to their middle, followed square to square, straightened."""
    m = mask.astype(bool)  # the map's lines come in bits: grow them a square so neighbouring bits join, then thin back to the middle
    m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1) | np.roll(np.roll(m, 1, 0), 1, 1) | np.roll(np.roll(m, 1, 0), -1, 1) | np.roll(np.roll(m, -1, 0), 1, 1) | np.roll(np.roll(m, -1, 0), -1, 1)
    sk = thin(m); rows, cols = sk.shape
    pts = set(zip(*np.nonzero(sk)))
    def nb0(p):  # neighbours along the stroke: a diagonal one only when no straight step already reaches it (else stairs look like forks)
        y, x = p; s = [(y + dy, x + dx) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)) if (y + dy, x + dx) in pts]
        return s + [(y + dy, x + dx) for dy in (-1, 1) for dx in (-1, 1) if (y + dy, x + dx) in pts and (y + dy, x) not in pts and (y, x + dx) not in pts]
    for _ in range(3):  # cut the short stubs thinning leaves on a line's sides
        stubs = [p for p in pts if len(nb0(p)) == 1 and any(len(nb0(q)) > 2 for q in nb0(p))]
        if not stubs: break
        pts -= set(stubs)
    nb = nb0
    used, out = set(), []
    def walk(a, b):
        path = [a, b]; used.add(frozenset((a, b)))
        while True:
            nxt = [q for q in nb(path[-1]) if frozenset((path[-1], q)) not in used]
            if len(nb(path[-1])) != 2 or not nxt: return path
            used.add(frozenset((path[-1], nxt[0]))); path.append(nxt[0])
    ends = [p for p in pts if len(nb(p)) != 2]  # line ends and junctions first, then whatever loops are left
    for p in ends + list(pts):
        for q in nb(p):
            if frozenset((p, q)) in used: continue
            path = walk(p, q)
            line = rdp([(x, y) for y, x in path], 1.1)
            if sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(line, line[1:])) < 2.5: continue  # bits under ~2 m
            out.append([round((v + .5) * cell) for x, y in line for v in (x, y)])
    return out


def image_mask(slug, pf, cell, cols, rows):
    """Cells crossed by the white wall outlines of a floor plan drawn as a picture, placed by its bounds."""
    a = np.asarray(Image.open(os.path.join(M, slug, pf["src"].split(f"maps/{slug}/")[1])).convert("RGBA")).astype(int)
    white = (a[..., :3].min(axis=2) > 225) & (a[..., :3].max(axis=2) - a[..., :3].min(axis=2) < 25) & (a[..., 3] > 200)
    (x0, y0), (x1, y1) = pf["bounds"]
    ys, xs = np.nonzero(white)
    cx = ((x0 + (xs + .5) * (x1 - x0) / a.shape[1]) // cell).astype(int); cy = ((y0 + (ys + .5) * (y1 - y0) / a.shape[0]) // cell).astype(int)
    ok = (cx >= 0) & (cx < cols) & (cy >= 0) & (cy < rows)
    m = np.zeros((rows, cols), bool); m[cy[ok], cx[ok]] = True
    print("   ", slug, pf["src"].rsplit("/", 1)[1], "plan picture walls", int(m.sum()))
    return drop_small(m, lambda n, w, h: n < 6 and max(w, h) < 5)


def drop_small(mask, small):
    """Remove the connected pieces (8 directions) that small(cells, width, height) calls small."""
    rows, cols = mask.shape; lab = np.zeros(mask.shape, np.int32); out = mask.copy(); n = 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if lab[y0, x0]: continue
        n += 1; stack = [(y0, x0)]; lab[y0, x0] = n; cells = []
        while stack:
            y, x = stack.pop(); cells.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < rows and 0 <= nx < cols and mask[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n; stack.append((ny, nx))
        ys = [c[0] for c in cells]; xs = [c[1] for c in cells]
        if small(len(cells), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1):
            for c in cells: out[c] = False
    return out

if __name__ == "__main__":
    for slug in sys.argv[1:] or ["farm", "valley", "northridge", "armory", "tv-station", "airport"]:
        print(slug, convert(slug))
