"""Hand fixes to the walls of a map, kept in maps/<slug>/nav-fix.json and built into nav.js (the page applies them).

  nav_fix.py <slug> <floor> cut x y [radius_m]          an opening (door, gap, gate): a hole in whatever wall is there (default 1.6 m)
  nav_fix.py <slug> <floor> wall x0 y0 x1 y1 [...]       a wall or fence the map misses (a line through the points)
  nav_fix.py <slug> <floor> area x0 y0 x1 y1 x2 y2 [...] a place you can't walk (polygon)
  nav_fix.py <slug> <floor> clear x0 y0 x1 y1 x2 y2 [...] a polygon where nothing blocks (false walls: road markings, wrong water)
  nav_fix.py <slug> <floor> undo                         drop the last fix of that floor
  nav_fix.py <slug> <floor> list
  nav_fix.py <slug> <floor> show x0 y0 x1 y1 [name]      picture of that box with the walls as the page sees them
All coordinates in map units (the numbers on the review pictures' edges). Every change rebuilds nav.js for the map and, with
--show x0 y0 x1 y1 at the end, draws the box again (tools/out/fix-<slug>-<floor>.png)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import navlib

args = sys.argv[1:]
show = None
if "--show" in args:
    i = args.index("--show"); show = [float(v) for v in args[i + 1:i + 5]]; args = args[:i]
slug, fl, what, nums = args[0], args[1], args[2], args[3:]
path = os.path.join(navlib.ROOT, "maps", slug, "nav-fix.json")
fix = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
f = fix.setdefault(fl, {"cuts": [], "walls": [], "areas": [], "clear": [], "order": []})
for k in ("cuts", "walls", "areas", "clear", "order"): f.setdefault(k, [])
v = [round(float(n)) for n in nums] if what not in ("cut",) else [round(float(n), 1) for n in nums]
changed = True
if what == "cut":
    f["cuts"].append([round(v[0]), round(v[1])] + ([v[2]] if len(v) > 2 else [])); f["order"].append("cuts")
elif what in ("wall", "area", "clear"):
    key = {"wall": "walls", "area": "areas", "clear": "clear"}[what]
    if len(v) < (4 if what == "wall" else 6) or len(v) % 2: sys.exit("need pairs of x y: a wall 2 points or more, an area 3 or more")
    f[key].append(v); f["order"].append(key)
elif what == "undo":
    if f["order"]: f[f["order"].pop()].pop()
elif what == "list":
    changed = False; print(json.dumps(f, indent=1))
elif what == "show":
    changed = False; show = [float(n) for n in nums[:4]]
else:
    sys.exit(__doc__)
if changed:
    json.dump(fix, open(path, "w", encoding="utf-8"), indent=1)
    import subprocess  # rebuild nav.js for this map only
    subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "nav_extract.py"), slug], check=True)
    print("saved", path)
if show:
    d, nav = navlib.load(slug); g = navlib.grid(slug, fl, d, nav)
    out = os.path.join(navlib.ROOT, "tools", "out", f"fix-{slug}-{fl}.png")
    marks = [(c[0], c[1], (80, 255, 80)) for c in f["cuts"] if show[0] < c[0] < show[2] and show[1] < c[1] < show[3]]
    navlib.picture(d, slug, fl, g, nav["cell"], show, out, marks)
    print("picture", out)
