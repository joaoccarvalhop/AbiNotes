"""Marker categories per group, with how many markers each has across all maps (to pick the default filters)."""
import collections, json, os

M = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "maps")
groups = collections.defaultdict(collections.Counter)
for slug in ["farm", "valley", "northridge", "armory", "tv-station", "airport"]:
    t = open(os.path.join(M, slug, "data.js"), encoding="utf-8").read()
    d = json.loads(t[t.index("] = ") + 4:].rstrip().rstrip(";"))
    count = collections.Counter(m["c"] for m in d["markers"])
    for name, c in d["categories"].items():
        if count[name]:
            groups[c.get("g", "Other")][name] += count[name]
for g, cats in groups.items():
    print(f"\n{g}: " + ", ".join(f"{n} {k}" for n, k in cats.most_common()))
