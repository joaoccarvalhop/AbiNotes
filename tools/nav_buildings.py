"""Do all buildings have walls? Indoor loot (drawers, computers, registers, safes, document boxes...) sits inside a building:
groups of it with no wall anywhere around mean a building the grid doesn't know. Lists them per map and floor, by place,
and draws each one (tools/out/buildings/<slug>-<floor>-<n>.png) so it can be fixed with nav_fix.py.
Usage: nav_buildings.py [slug ...]"""
import collections, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import navlib

INDOOR = {"Office Drawers", "Computers", "Cash Registers", "Document Boxes", "Safe", "Small Safe", "Electronic Safe", "Military Computers",
          "Retro Safe", "Secret Safe", "Safe (Behind Key)"}  # (medkits and biscuit tins turn up outdoors too)


def check(slug):
    d, nav = navlib.load(slug)
    if not nav:
        print(f"\n{slug}: no walls at all"); return
    mpu, cell, ground = navlib.mpu(d), nav["cell"], nav.get("ground") or d.get("level")
    labels = [m for m in d["markers"] if m.get("t") == "l" and m.get("c") == "Label"]
    place = lambda x, y: min(labels, key=lambda m: (m["x"] - x) ** 2 + (m["y"] - y) ** 2)["n"] if labels else ""
    out = os.path.join(navlib.ROOT, "tools", "out", "buildings"); os.makedirs(out, exist_ok=True)
    print(f"\n{slug}")
    for fl in d["levels"]:
        pts = [m for m in d["markers"] if m["c"] in INDOOR and (m.get("l") or ground) == fl]
        if not pts: continue
        g = navlib.grid(slug, fl, d, nav)
        # group what's within ~10 m of each other: one building
        groups, left = [], list(pts)
        while left:
            grp = [left.pop()]
            for q in grp:
                near = [m for m in left if math.hypot(m["x"] - q["x"], m["y"] - q["y"]) * mpu < 10]
                for m in near: left.remove(m)
                grp += near
            groups.append(grp)
        bare = []
        for grp in groups:
            cx, cy = sum(m["x"] for m in grp) / len(grp), sum(m["y"] for m in grp) / len(grp)
            span = max(math.hypot(m["x"] - cx, m["y"] - cy) for m in grp) * mpu
            r = (span + 8) / mpu / cell  # the group plus 8 m round it, in cells
            x0, x1 = int(max(0, cx / cell - r)), int(min(g.shape[1], cx / cell + r))
            y0, y1 = int(max(0, cy / cell - r)), int(min(g.shape[0], cy / cell + r))
            walls = int(g[y0:y1, x0:x1].sum())
            if walls < 25:  # under ~20 m of wall round a group of indoor loot: no building there
                bare.append((place(cx, cy), round(cx), round(cy), len(grp), walls))
        print(f"  {fl}: {len(groups)} indoor groups, {len(bare)} with no walls round them")
        for i, (pl, x, y, n, w) in enumerate(sorted(bare)):
            print(f"     {pl}: ({x}, {y}) {n} indoor boxes, {w} wall squares near")
            half = 40 / mpu
            navlib.picture(d, slug, fl, g, cell, [x - half, y - half * .7, x + half, y + half * .7], os.path.join(out, f"{slug}-{fl}-{i:02d}.png"), [(x, y, (255, 0, 255))], 900)


for s in sys.argv[1:] or ["farm", "valley", "northridge", "armory", "tv-station", "airport"]:
    check(s)
