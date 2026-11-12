"""Markers that sit on a wall square of the walk grid (loot a new wall or fix would bury).

  nav_onwall.py <slug> [floor ...]      every floor of the map when none is given
Prints one line per marker: floor, x, y, kind. Run it before and after a fix: new lines mean a wall drawn over loot."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import navlib

if len(sys.argv) < 2: sys.exit(__doc__)
slug = sys.argv[1]
d, nav = navlib.load(slug); c = nav["cell"]
ground = d.get("level") or d["levels"][0]
for fl in sys.argv[2:] or d["levels"]:
    g = navlib.grid(slug, fl, d, nav); g = g[0] if isinstance(g, tuple) else g
    for m in d["markers"]:
        if (m.get("l") or ground) == fl and m["c"] != "Label" and g[int(m["y"] // c), int(m["x"] // c)]:
            print(fl, m["x"], m["y"], m["c"])
