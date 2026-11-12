"""Pick the market frames worth reading out of a recording (python tools/price_frames.py <frames dir> <out dir>).

The frames come from ffmpeg: 4 a second, cropped to the market grid (crop=1460:880:370:110). The video is cut into
categories where the title at the top left changes (some last only a second: masks, keys, each ammo). In each category
it keeps the first frame once it has loaded (the grid comes in dimmed), then one each time the page has scrolled a third
of the screen further, and the last one: so every row is seen whole at least once. Kept frames are copied to <out dir>,
named by order and by category number, for reading.
"""
import os, shutil, sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
names = sorted(f for f in os.listdir(src) if f.endswith(".jpg"))
STEP = 0.33


def load(path):
    im = Image.open(path).convert("L")
    w, h = im.size
    grid = np.asarray(im.resize((w // 4, h // 4)), dtype=np.float32)
    title = np.asarray(im.crop((0, 8, 560, 62)), dtype=np.float32)
    return grid, title


def shift(a, b):  # how far b scrolled from a, in rows of the small picture
    h = a.shape[0]
    best = (0, float(np.mean(np.abs(a - b))))
    for d in range(1, int(h * .8)):
        for s in (d, -d):
            x, y = (a[s:], b[:h - s]) if s > 0 else (a[:h + s], b[-s:])
            e = float(np.mean(np.abs(x - y)))
            if e < best[1]:
                best = (s, e)
    return best


frames = [load(os.path.join(src, n)) for n in names]
# categories: a run of frames whose title stays the same
segs, start = [], 0
for i in range(1, len(frames) + 1):
    # the same title differs by under 1 (grey level, on average), another by 1.5 and up
    if i == len(frames) or float(np.mean(np.abs(frames[i][1] - frames[i - 1][1]))) > 1.2:
        segs.append((start, i - 1)); start = i

keep = []
for c, (a, b) in enumerate(segs):
    if b - a < 1:
        continue  # a lone frame in a change: a fade, not a page
    first = min(a + 2, b)  # half a second in: loaded, no longer dimmed
    picked, moved, prev = [first], 0, frames[first][0]
    for i in range(first + 1, b + 1):
        s, e = shift(prev, frames[i][0])
        moved += abs(s) if e <= 12 else 10 ** 6
        if moved >= STEP * prev.shape[0]:
            picked.append(i); moved = 0
        prev = frames[i][0]
    if picked[-1] != b:
        picked.append(b)
    keep += [(c, i) for i in picked]

for k, (c, i) in enumerate(keep, 1):
    shutil.copy2(os.path.join(src, names[i]), os.path.join(dst, f"k_{k:03d}_c{c:02d}_{names[i]}"))
print(len(keep), "frames kept of", len(names), "in", len(segs), "runs")
