"""Make the site's pages from index.html.

Every page (builds.html, maps.html ...) is the same document as index.html: the
sections are drawn by app.js, not written in the HTML. A page only differs in which
section it opens on (<body data-area="...">) and its <title>. So index.html is the
one to edit, and this copies it to the other pages.

    python tools/make_pages.py          write the pages
    python tools/make_pages.py --check  only say whether they are up to date (exit 1 if not)

Run it after changing index.html. The pages are committed (GitHub Pages serves them as
they are), so a forgotten run shows up as a stale page.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "index.html"

# the same order and names as the bar in index.html (and AREAS_LIST in app.js)
PAGES = {
    "builds": "Builds",
    "loadouts": "Loadouts",
    "market": "Market",
    "gear": "Gear",
    "maps": "Maps",
    "merchant": "Merchant",
    "smelter": "Smelter",
    "trading": "Trading",
    "keybinds": "Keybinds",
    "tiers": "Tier list",
}

NOTE = "<!-- made from index.html by tools/make_pages.py: edit index.html, not this file -->\n"


def page(src: str, area: str, label: str) -> str:
    out, n1 = re.subn(r'<body class="booting" data-area="home">', f'<body class="booting" data-area="{area}">', src)
    out, n2 = re.subn(r"<title>ABI Hub</title>", f"<title>{label} · ABI Hub</title>", out)
    if n1 != 1 or n2 != 1:
        sys.exit(f"index.html no longer has exactly one <body data-area=\"home\"> and one <title>ABI Hub</title> ({n1}, {n2})")
    return out.replace("<!doctype html>\n", "<!doctype html>\n" + NOTE, 1)


def main() -> int:
    check = "--check" in sys.argv
    src = SRC.read_text(encoding="utf-8")
    stale = []
    for area, label in PAGES.items():
        dst = ROOT / f"{area}.html"
        want = page(src, area, label)
        if dst.exists() and dst.read_text(encoding="utf-8") == want:
            continue
        stale.append(dst.name)
        if not check:
            dst.write_text(want, encoding="utf-8")
    if check:
        print("stale: " + ", ".join(stale) if stale else "pages up to date")
        return 1 if stale else 0
    print(f"wrote {len(stale)} page(s)" + (": " + ", ".join(stale) if stale else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
