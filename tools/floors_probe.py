"""What the floor plans (maps/<slug>/floors/*.svg) hold: per map and floor, how many building groups, wall strokes and which path commands."""
import collections, json, os, re

M = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "maps")
for slug in ["farm", "valley", "northridge", "armory", "tv-station", "airport"]:
    t = open(os.path.join(M, slug, "data.js"), encoding="utf-8").read()
    d = json.loads(t[t.index("] = ") + 4:].rstrip().rstrip(";"))
    print(f"\n{slug}: levels {d['levels']}, floors:")
    for f in d["floors"]:
        p = os.path.join(M, slug, f["src"].split(f"maps/{slug}/")[1])
        if not p.endswith(".svg"):
            print("   ", f["floor"], f["src"], "(image)")
            continue
        s = open(p, encoding="utf-8").read()
        vb = re.search(r'viewBox="([^"]+)"', s).group(1)
        paths = re.findall(r'<path d="([^"]+)"(?: style="([^"]*)")?', s)
        strokes = [d_ for d_, st in paths if "stroke:" in (st or "")]
        fills = [d_ for d_, st in paths if "stroke:" not in (st or "")]
        cmds = collections.Counter(c for d_, _ in paths for c in re.findall(r"[A-Za-z]", d_))
        print("   ", f["floor"], f["src"].rsplit("/", 1)[1], "viewBox", vb, "bounds", f["bounds"], f"| fills {len(fills)} strokes {len(strokes)} | cmds {dict(cmds)}")
