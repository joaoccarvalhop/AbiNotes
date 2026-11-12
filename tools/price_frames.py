"""Pick the market frames worth reading out of a recording (python tools/price_frames.py <frames dir> <out dir>).

The frames come from ffmpeg, cropped to the market grid, a few per second. Between two frames the page either scrolled
(found by sliding one frame's row profile over the other's) or changed (another category, another tab). A frame is kept
when the page changed, or when it has scrolled about half a screen since the last one kept: so every row of items is
seen whole at least once, without hundreds of near copies. What's kept is copied to <out dir>, numbered in order.
"""
import os, shutil, sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
names = sorted(f for f in os.listdir(src) if f.endswith(".jpg"))
STEP = 0.45  # keep after this share of the screen has scrolled by


def profile(path):  # the picture in grey, a little smaller: rows x columns
    im = Image.open(path).convert("L")
    w, h = im.size
    return np.asarray(im.resize((w // 4, h // 4)), dtype=np.float32)


def shift(a, b):
    """How far b is scrolled from a (in rows of the small picture), and how well it matches (lower is better)."""
    h = a.shape[0]
    best = (0, float(np.mean(np.abs(a - b))))
    for d in range(1, int(h * .8)):
        for s in (d, -d):  # s > 0: the page moved up (scrolled down)
            x, y = (a[s:], b[:h - s]) if s > 0 else (a[:h + s], b[-s:])
            e = float(np.mean(np.abs(x - y)))
            if e < best[1]:
                best = (s, e)
    return best


prev, moved, kept, head = None, 0, 0, None
for n in names:
    cur = profile(os.path.join(src, n))
    keep = prev is None
    # the strip with the category's title and the New / Like New / Worn tabs: a change there is a new page even when
    # the pictures stay the same (only the prices change between tabs)
    top = cur[:18]
    if head is not None and float(np.mean(np.abs(top - head))) > 5:
        keep, moved = True, 0
    if prev is not None and not keep:
        s, e = shift(prev, cur)
        if e > 12:          # nothing lines up: another category or tab
            keep, moved = True, 0
        else:
            moved += abs(s)
            if moved >= STEP * cur.shape[0]:
                keep = True
    if keep:
        kept += 1; moved = 0; head = top
        shutil.copy2(os.path.join(src, n), os.path.join(dst, f"k_{kept:03d}_{n}"))
    prev = cur
print(kept, "frames kept of", len(names))
