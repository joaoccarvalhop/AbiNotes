"""Turn what was read off a market video into a new snapshot in prices.js.

python tools/price_merge.py <read dir> <date YYYY-MM-DD> "<source>" [--write]

<read dir> holds batch_*.json, each a list of frames: {"frame", "category", "tab", "items": [{"name", "price", "dur"}]}.
An item is matched to prices.js by its category and its name as the game shows it (cut names keep their "…").
Seen several times with different prices (a misread), the price seen most often wins.
The tabs give the kinds of price: New (or no tabs) -> a plain price or "new"; Like New / Worn -> "likeNew"/"worn" with the
durability seen. Items not in prices.js yet are added. Without --write it only reports.
"""
import glob, json, os, re, sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRICES = os.path.join(ROOT, "prices.js")
read_dir, date, source = sys.argv[1], sys.argv[2], sys.argv[3]
WRITE = "--write" in sys.argv

text = open(PRICES, encoding="utf-8").read()
head, body = text.split("window.ABI_PRICES = ", 1)
data = json.loads(body.rstrip().rstrip(";"))

slug = lambda s: re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", s.lower()))
def norm(s):
    s = s.replace("...", "…").replace("..", "…").strip().lower().rstrip(".")  # "Bios." = "Bios"
    return re.sub(r"\s+", " ", s)

by_key = {(norm(i["cat"]), norm(i["name"])): i for i in data["items"]}
# a cut name may be cut at another place than last time: match on the part both show
def find(cat, name):
    k = (norm(cat), norm(name))
    if k in by_key:
        return by_key[k]
    stem = norm(name).rstrip("…")
    hits = [i for (c, n), i in by_key.items() if c == norm(cat) and (n.rstrip("…").startswith(stem) or stem.startswith(n.rstrip("…"))) and len(stem) >= 6]
    return hits[0] if len(hits) == 1 else None

seen = defaultdict(lambda: defaultdict(Counter))  # item key -> kind -> Counter of (price, dur)
cats = Counter()
for f in sorted(glob.glob(os.path.join(read_dir, "batch_*.json"))):
    for fr in json.load(open(f, encoding="utf-8")):
        cat, tab = (fr.get("category") or "").strip(), (fr.get("tab") or "").strip().lower()
        kind = {"like new": "likeNew", "worn": "worn"}.get(tab, "new")
        for it in fr.get("items", []):
            if not it.get("name") or not isinstance(it.get("price"), int) or it["price"] <= 0:
                continue
            seen[(cat, it["name"].strip())][kind][(it["price"], it.get("dur"))] += 1
            cats[cat] += 1

prices, new_items, tabs_of = {}, [], defaultdict(set)
group_of = {i["cat"]: i.get("group") for i in data["items"]}

# a cut name the game shows for several items ("ML Lever-Action Rifl…" is a stock (1) and (2); "IND Tactical Helmet …" is
# the Snow one, since the plain one fits whole): the items it can be, and the last price each had
base = lambda n: re.sub(r"\s*\(\d+\)$", "", n)
def candidates(cat, name):
    stem = norm(name).rstrip("…").strip()
    if not norm(name).endswith("…") and not any(re.search(r"\(\d+\)$", i["name"]) for i in data["items"] if i["cat"] == cat and norm(base(i["name"])) == norm(name)):
        return []
    out = []
    for i in data["items"]:
        if norm(i["cat"]) != norm(cat):
            continue
        b = norm(base(i["name"])).rstrip("…").strip()
        if b == stem and not norm(base(i["name"])).endswith("…") and norm(name).endswith("…") and not re.search(r"\(\d+\)$", i["name"]):
            continue  # the whole name fits on the card, so it isn't the cut one
        if len(stem) >= 6 and (b.startswith(stem) or stem.startswith(b)):
            out.append(i)
    return out
last = max(data["snapshots"], key=lambda s: s["date"])["prices"]
def old_price(item, kind):
    v = last.get(item["id"])
    if v is None:
        return None
    if isinstance(v, int):
        return v if kind == "new" else None
    return v.get(kind)

from itertools import permutations
assigned = defaultdict(dict)  # item id -> kind -> (price, dur)
handled = set()
for (cat, name), kinds in seen.items():
    cands = candidates(cat, name)
    if len(cands) < 2:
        continue
    handled.add((cat, name))
    for kind, c in kinds.items():
        # the distinct readings, most seen first, at most one per item (a reading seen once among many is a misread)
        reads = [k for k, n in c.most_common() if n >= 2 or len(c) <= len(cands)][:len(cands)]
        best = None
        for perm in permutations(cands, len(reads)):
            cost = sum(abs((old_price(it, kind) or r[0]) - r[0]) / max(r[0], 1) for it, r in zip(perm, reads))
            if best is None or cost < best[0]:
                best = (cost, perm)
        for it, r in zip(best[1], reads):
            assigned[it["id"]][kind] = r
for iid, kinds in assigned.items():
    out = {}
    for kind, (p, dur) in kinds.items():
        out[kind] = p
        if dur and kind != "new":
            out[kind + "Dur"] = dur
    prices[iid] = out

for (cat, name), kinds in seen.items():
    if (cat, name) in handled:
        continue
    one = candidates(cat, name)
    item = one[0] if len(one) == 1 else find(cat, name)
    if not item:
        nm = name.replace("...", "…")
        item = {"id": slug(cat) + "-" + slug(nm.rstrip("…")), "name": nm, "group": group_of.get(cat) or "Other", "cat": cat}
        if any(i["id"] == item["id"] for i in data["items"] + new_items):
            item["id"] += "-2"
        new_items.append(item)
        by_key[(norm(cat), norm(nm))] = item
    out = {}
    for kind, c in kinds.items():
        (p, dur), _ = c.most_common(1)[0]
        out[kind] = p
        if dur and kind != "new":
            out[kind + "Dur"] = dur
    prev = prices.get(item["id"], {})
    prev.update(out)
    prices[item["id"]] = prev
# only a New price (no condition tabs): stored as a plain number, like last time
for k, v in list(prices.items()):
    if set(v) == {"new"}:
        prices[k] = v["new"]

old = {s["date"] for s in data["snapshots"]}
# readings far from the last price (a digit read wrong, or a real jump): listed to check by eye
names = {i["id"]: f'{i["cat"]}: {i["name"]}' for i in data["items"] + new_items}
odd = []
for iid, v in prices.items():
    for kind, p in ([("new", v)] if isinstance(v, int) else [(k, x) for k, x in v.items() if not k.endswith("Dur")]):
        o = old_price({"id": iid}, kind)
        if o and (p > o * 2.5 or p < o / 2.5):
            odd.append(f"{names[iid]} [{kind}] {o} -> {p}")
if odd:
    print(f"{len(odd)} far from last time:"); print("\n".join(odd))
print(f"read {sum(cats.values())} cards in {len(cats)} categories -> {len(prices)} items priced, {len(new_items)} new items")
print("categories:", ", ".join(f"{c} {n}" for c, n in cats.most_common()))
if new_items:
    print("new:", "; ".join(f'{i["cat"]}: {i["name"]}' for i in new_items[:60]))
if WRITE:
    data["items"] += new_items
    data["snapshots"] = [s for s in data["snapshots"] if s["date"] != date] + [{"date": date, "source": source, "prices": prices}]
    data["snapshots"].sort(key=lambda s: s["date"])
    with open(PRICES, "w", encoding="utf-8", newline="\n") as f:
        f.write(head + "window.ABI_PRICES = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\n")
    print("written to prices.js" + (" (replaced the snapshot of that date)" if date in old else ""))
