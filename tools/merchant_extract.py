"""Builds merchant.js (window.ABI_MERCHANT) from the ABI Builder merchant page: items, the 38 sounds, cargo pools per map/mode.

  python tools\\merchant_extract.py          downloads the page again, then writes merchant.js

merchant.js layout (short, the page reads it):
  sounds:   [[id, pickup file, drop file]]          files live at SOUND_URL + name + ".ogg"
  types:    {typeId: "Flammables"}
  profiles: [[id, [[map name, mode]...]]]           a profile is the set of maps/modes sharing one stock
  items:    {id: [name, rarity 1-6, contact price, reference price, w, h, soundId, category, icon url]}
  pools:    [[profile, typeId, cargo price, pool weight, item weight total, [[itemId, weight]...]]]
            one cargo you can buy and what can be in it: an item's chance is its weight / the total; cargos with the same
            name and price are told apart by nothing in game, so the page mixes them by pool weight"""
import json, os
import merchant_probe as mp

ROOT = mp.ROOT
OUT = os.path.join(ROOT, "merchant.js")

if os.path.exists(mp.PAGE): os.remove(mp.PAGE)  # always the current page
d = mp.data(mp.payload(mp.page()))
meta = d.get("meta", {})
items = {}
for it in d["items"]:
    if it.get("kind", "item") != "item": continue
    w, h = (it.get("size") or [1, 1])[:2]
    items[it["id"]] = [it["name"], it.get("rarity", 0), it.get("contactPrice", 0), it.get("referencePrice", 0), w, h,
                       it.get("soundId", 0), it.get("categoryName", ""), it.get("iconUrl", "") if it.get("iconAvailable", True) else ""]
pools = [[p["profile"], p["typeId"], p["price"], p.get("weight", 1), p.get("weightTotal") or sum(x["weight"] for x in p["items"]),
           [[x["id"], x["weight"]] for x in p["items"] if x["id"] in items]] for p in d["pools"]]
out = {
    "source": "https://abibuilder.com/merchant",
    "scrapedAt": meta.get("scrapedAt", ""), "dataVersion": meta.get("dataVersion", ""),
    "soundUrl": "https://abibuilder.com/audio/merchant/",
    "sounds": [[s["id"], s["pickup"], s["drop"]] for s in sorted(d["sounds"], key=lambda s: s["id"])],
    "types": {t["id"]: t["name"] for t in d["types"]},
    "profiles": [[p["id"], [[m["mapName"], m["mode"]] for m in p["maps"]]] for p in d["profiles"]],
    "items": items,
    "pools": [p for p in pools if p[5]],
}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("// Field Merchant data, from ABI Builder (game data " + out["dataVersion"] + "). Made by tools/merchant_extract.py: run it again to update.\n")
    f.write("window.ABI_MERCHANT = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(f"{len(items)} items, {len(out['pools'])} cargos, {len(out['profiles'])} profiles, {len(out['sounds'])} sounds -> {OUT} ({os.path.getsize(OUT) // 1024} KB)")
for p in out["profiles"]: print("  profile", p[0], ", ".join(f"{a} {b}" for a, b in p[1]) or "(no map)")
