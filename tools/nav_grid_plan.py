"""The fix picture of a box with a fine coordinate grid and the floor's SVG plan drawn over it, for placing walls by eye.

  nav_grid_plan.py <slug> <floor> x0 y0 x1 y1 [step]    grid lines every <step> map units (default 50)
Draws what nav_fix.py show draws (tiles, walls as red squares), then: grid lines labelled in map units, the SVG plan's
footprints (green), walls (blue) and stairs (orange lines; orange squares = the stair points nav.js keeps), and every
marker of that floor (magenta rings). Output tools/out/plan-<slug>-<floor>.png."""
import math, os, subprocess, sys
import xml.etree.ElementTree as ET
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import navlib, nav_extract as NE
from PIL import Image, ImageDraw

if len(sys.argv) < 7: sys.exit(__doc__)
slug, fl = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = map(float, sys.argv[3:7]); st = float(sys.argv[7]) if len(sys.argv) > 7 else 50
subprocess.run([sys.executable, os.path.join(HERE, "nav_fix.py"), slug, fl, "show", *sys.argv[3:7]], check=True, stdout=subprocess.DEVNULL)
im = Image.open(os.path.join(HERE, "out", f"fix-{slug}-{fl}.png")).convert("RGB"); W, H = im.size; k = W / (x1 - x0)
dr = ImageDraw.Draw(im); P = lambda x, y: ((x - x0) * k, (y - y0) * k)
d, nav = navlib.load(slug)
for f in d["floors"]:
    if fl not in f["floor"] or not f["src"].endswith(".svg"): continue
    root = ET.parse(os.path.join(navlib.ROOT, "maps", slug, f["src"].split(f"maps/{slug}/")[1])).getroot()
    vb = [float(v) for v in root.get("viewBox").split()]; (bx0, by0), (bx1, by1) = f["bounds"]
    kx, ky = (bx1 - bx0) / vb[2], (by1 - by0) / vb[3]; to = lambda p: (bx0 + (p[0] - vb[0]) * kx, by0 + (p[1] - vb[1]) * ky)

    def walk(e, ins):
        for ch in e:
            tag = ch.tag.replace(NE.NS, "")
            if tag == "g": walk(ch, ins or (ch.get("id") or "").startswith("stairs"))
            elif tag == "path":
                style = ch.get("style") or ""
                for sp in NE.subpaths(ch.get("d")):
                    pts = [P(*to(q)) for q in sp]
                    if len(pts) < 2: continue
                    if ins: dr.line(pts, fill=(255, 140, 0), width=2)
                    elif "stroke:" in style: dr.line(pts, fill=(60, 120, 255), width=2)
                    else: dr.line(pts + [pts[0]], fill=(0, 255, 0), width=2)
    walk(root, False)
x = math.ceil(x0 / st) * st
while x < x1:
    q = (x - x0) * k; dr.line([(q, 0), (q, H)], fill=(0, 200, 255)); dr.text((q + 2, 2), str(int(x)), fill=(0, 255, 255)); dr.text((q + 2, H - 12), str(int(x)), fill=(0, 255, 255)); x += st
y = math.ceil(y0 / st) * st
while y < y1:
    q = (y - y0) * k; dr.line([(0, q), (W, q)], fill=(0, 200, 255)); dr.text((2, q + 2), str(int(y)), fill=(0, 255, 255)); dr.text((W - 40, q + 2), str(int(y)), fill=(0, 255, 255)); y += st
for m in d["markers"]:
    if x0 < m["x"] < x1 and y0 < m["y"] < y1 and (m.get("l") or d.get("level")) == fl and m["c"] != "Label":
        q = P(m["x"], m["y"]); dr.ellipse([q[0] - 3, q[1] - 3, q[0] + 3, q[1] + 3], outline=(255, 0, 255), width=2)
for s in nav["floors"].get(fl, {}).get("stairs", []):
    if x0 < s[0] < x1 and y0 < s[1] < y1: q = P(*s); dr.rectangle([q[0] - 6, q[1] - 6, q[0] + 6, q[1] + 6], outline=(255, 140, 0), width=3)
out = os.path.join(HERE, "out", f"plan-{slug}-{fl}.png"); im.save(out); print("picture", out)
