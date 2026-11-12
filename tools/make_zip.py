"""Builds ABI-Hub.zip for friends: the page, its data, the pictures and the maps, inside one "ABI Hub" folder.

  python tools\\make_zip.py

Leaves out what only the tools use (nav-fix.json, tools/, docs/). The read-me comes from tools/zip/LEIA-ME.txt."""
import os, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "ABI-Hub.zip")
TOP = "ABI Hub"
SKIP = {"nav-fix.json"}  # the tools' input: its fixes are already built into nav.js

def files():
    for f in ("abi-hub.html", "builds.js", "prices.js", "merchant.js", "merchant-sounds.js"):
        yield os.path.join(ROOT, f), f
    yield os.path.join(ROOT, "tools", "zip", "LEIA-ME.txt"), "LEIA-ME.txt"
    for top in ("images", "maps"):  # everything in them (maps: each map plus the shared icons)
        for d, _, names in os.walk(os.path.join(ROOT, top)):
            for n in sorted(names):
                if n in SKIP: continue
                p = os.path.join(d, n); yield p, os.path.relpath(p, ROOT)

tmp = OUT + ".tmp"
count = 0
with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for path, rel in files():
        z.write(path, TOP + "/" + rel.replace(os.sep, "/")); count += 1
os.replace(tmp, OUT)  # only swap the old zip out once the new one is complete
print(f"{count} files, {os.path.getsize(OUT) / 1e6:.1f} MB -> {OUT}")
