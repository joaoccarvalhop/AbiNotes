"""What each map's data offers for planning routes: spawns, extracts (by difficulty) and the valuable loot."""
import collections, json, os, sys

M = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "maps")
VALUABLE = ("Safe", "Safe (Behind Key)", "Secret Safe", "Electronic Safe", "Premium Weapon Cases", "Red Item Spawn", "Gold Item Spawn",
            "Military Computers", "Boss Spawn", "Lookout/Rat Spot", "Sniper Scav Spawn", "Airdrops", "Key")
for slug in ["farm", "valley", "northridge", "armory", "tv-station", "airport"]:
    t = open(os.path.join(M, slug, "data.js"), encoding="utf-8").read()
    d = json.loads(t[t.index("] = ") + 4:].rstrip().rstrip(";"))
    mk = d["markers"]
    c = collections.Counter(m["c"] for m in mk)
    by_df = collections.Counter((m["c"], m.get("df", "-")) for m in mk if m["c"] in ("Spawn", "Extract", "No Backpack Extract", "Covert Ops Extract"))
    print(f"\n{d['name']}: {len(mk)} markers, difficulties {d['difficulties']}")
    print("  spawns/extracts by difficulty:", dict(by_df))
    print("  valuable:", {k: c[k] for k in VALUABLE if c.get(k)})
    print("  extract samples:", [(m.get("n"), (m.get("d") or "")[:60], m.get("df")) for m in mk if m["c"] == "Extract"][:3])
