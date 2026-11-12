"""Downloads the merchant's 76 reference sounds (38 items x pick up / drop) from ABI Builder and writes them into
merchant-sounds.js, so the page plays and recognises them without internet. One .js rather than .ogg files: a page opened
by double click (file://) can't read local files with fetch, but it can load a script.

  python tools\\merchant_sounds.py

Run it again after tools/merchant_extract.py if the game adds sounds."""
import base64, json, os, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, "merchant.js"), encoding="utf8").read()
M = json.loads(src[src.index("{"):src.rindex("}") + 1])
base, names = M["soundUrl"], sorted({n for s in M["sounds"] for n in (s[1], s[2])})
out, total = {}, 0
for n in names:
    req = urllib.request.Request(base + n + ".ogg", headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req, timeout=30).read()
    if data[:4] != b"OggS": raise SystemExit(f"{n}: not an Ogg file, stopped")  # only audio goes into the page
    out[n] = "data:audio/ogg;base64," + base64.b64encode(data).decode()
    total += len(data)
dst = os.path.join(ROOT, "merchant-sounds.js")
with open(dst, "w", encoding="utf8", newline="\n") as f:
    f.write("// The merchant's reference sounds (pick up / drop of each item sound), from ABI Builder, for offline use. Made by tools/merchant_sounds.py\n")
    f.write("window.ABI_MERCHANT_SOUNDS = " + json.dumps(out, separators=(",", ":")) + ";\n")
print(f"{len(out)} sounds, {total / 1024:.0f} KB -> {dst} ({os.path.getsize(dst) / 1024:.0f} KB)")
