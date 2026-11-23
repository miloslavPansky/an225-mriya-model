"""Poloautomatické trasování čar výkresu.
trace.py IMG SPEC.json OUT.json [OVERLAY.png x0 y0 x1 y1 scale]
SPEC: {"lines": {name: {"axis": "u"|"v", "guide": [[u,v],...], "step": 2, "win": 8}}}
axis "u": vzorkuje se podél u, hledá se v (čára ~vodorovná); "v": naopak.
Ke každému vzorku se najde středy tmavých běhů v okně ±win kolem vodítka a vezme se nejbližší.
"""
import sys, json
from PIL import Image, ImageDraw
img = Image.open(sys.argv[1]).convert('L')
W, H = img.size
px = img.load()
spec = json.load(open(sys.argv[2], encoding='utf-8'))
TH = spec.get('th', 140)

def interp(g, t, ax):
    i0 = 0 if ax == 'u' else 1
    g = sorted(g, key=lambda p: p[i0])
    if t <= g[0][i0]: return g[0][1 - i0]
    for a, b in zip(g, g[1:]):
        if a[i0] <= t <= b[i0]:
            f = (t - a[i0]) / (b[i0] - a[i0]) if b[i0] != a[i0] else 0
            return a[1 - i0] + f * (b[1 - i0] - a[1 - i0])
    return g[-1][1 - i0]

out = {}
for name, L in spec['lines'].items():
    ax, g, st, win = L['axis'], L['guide'], L.get('step', 2), L.get('win', 8)
    i0 = 0 if ax == 'u' else 1
    t0, t1 = min(p[i0] for p in g), max(p[i0] for p in g)
    res = []
    t = t0
    while t <= t1:
        c = interp(g, t, ax)
        lo, hi = int(c - win), int(c + win)
        runs, cur = [], None
        for s in range(lo, hi + 1):
            x, y = (int(t), s) if ax == 'u' else (s, int(t))
            if not (0 <= x < W and 0 <= y < H): continue
            d = px[x, y] < TH
            if d and cur is None: cur = [s, s]
            elif d: cur[1] = s
            elif cur is not None: runs.append(cur); cur = None
        if cur is not None: runs.append(cur)
        if runs:
            pick = L.get('pick', 'near')
            if pick == 'first': r = runs[0]
            elif pick == 'last': r = runs[-1]
            else: r = min(runs, key=lambda r: abs((r[0] + r[1]) / 2 - c))
            m = (r[0] + r[1]) / 2
            res.append([t, m] if ax == 'u' else [m, t])
        t += st
    out[name] = res
json.dump(out, open(sys.argv[3], 'w'), indent=0)
for k, v in out.items(): print(k, len(v))
if len(sys.argv) > 4:
    x0, y0, x1, y1 = map(int, sys.argv[5:9]); sc = float(sys.argv[9])
    im = Image.open(sys.argv[1]).convert('RGB').crop((x0, y0, x1, y1))
    im = im.resize((int(im.width * sc), int(im.height * sc)))
    d = ImageDraw.Draw(im)
    cols = [(255, 0, 0), (0, 160, 0), (0, 0, 255), (255, 0, 255), (0, 170, 170), (230, 120, 0)]
    for i, (k, v) in enumerate(out.items()):
        pts = [((p[0] - x0) * sc, (p[1] - y0) * sc) for p in v]
        if len(pts) > 1: d.line(pts, fill=cols[i % len(cols)], width=2)
    im.save(sys.argv[4])
