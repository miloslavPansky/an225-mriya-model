"""Převod trasovaných čar výkresu na data modelu (metry skutečného letadla)."""
import sys, json
from PIL import Image
D = sys.argv[1]  # adresář calc
IMG = sys.argv[2]
side = json.load(open(D + '/out/side_out.json'))
plan = json.load(open(D + '/out/plan_out.json'))
sec = json.load(open(D + '/out/sec_out.json'))

SX, U0, VG = 19.83, 162, 425           # bokorys: px/m, špička přídě, země (kýlovka = 18,1 m)
PX, PV0, PU0 = 20.04, 283, 1922        # půdorys: px/m podél, špička, osa
PY = PX * 44.66 / 44.2                  # příčné měřítko kalibrované na rozpětí 88,4 m

def med(vals, k=3):
    out = []
    for i in range(len(vals)):
        w = sorted(vals[max(0, i - k):i + k + 1]); out.append(w[len(w) // 2])
    return out

def dp(pts, eps):  # Douglas–Peucker
    if len(pts) < 3: return pts
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    L = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5 or 1e-9
    dmax, im = 0, 0
    for i, (x, y) in enumerate(pts[1:-1], 1):
        d = abs((y1 - y0) * x - (x1 - x0) * y + x1 * y0 - y1 * x0) / L
        if d > dmax: dmax, im = d, i
    if dmax > eps: return dp(pts[:im + 1], eps)[:-1] + dp(pts[im:], eps)
    return [pts[0], pts[-1]]

r2 = lambda v: round(v, 2)
# --- bokorys: horní a dolní obrys
top = sorted(side['top'] + [p for p in side['nose_up'] if p[0] < 300])
tx = [(u - U0) / SX for u, v in top]; tz = med([(VG - v) / SX for u, v in top], 4)
# odstranit puchýře na hřbetě: dolní obálka v okně
tz2 = [min(tz[max(0, i - 6):i + 7]) if tx[i] > 12 else tz[i] for i in range(len(tz))]
T = dp([[r2(x), r2(z)] for x, z in zip(tx, tz2)], 0.06)
bot = sorted(side['bot'])
bx = [(u - U0) / SX for u, v in bot]; bz = [(VG - v) / SX for u, v in bot]
# v oblasti kol (x 34–47) brát dno krytu podvozku (horní obrys kol ignorovat): max z v okně
bz2 = [max(bz[max(0, i - 8):i + 9]) if 33 < bx[i] < 47.5 else bz[i] for i in range(len(bz))]
bz2 = med(bz2, 3)
B = dp([[r2(x), r2(z)] for x, z in zip(bx, bz2)], 0.06)
fa = sorted(side['fair']); F = dp([[r2((u - U0) / SX), r2((VG - v) / SX)] for u, v in fa], 0.06)
print('TOP', json.dumps(T)); print('BOT', json.dumps(B)); print('FAIR', json.dumps(F))

# --- půdorys: poloviční šířka trupu
fr = sorted(plan['fusR'] + plan['fusR2'], key=lambda p: p[1])
hw = [[r2((v - PV0) / PX), r2((u - PU0) / PY)] for u, v in fr]
hw = [p for p in hw if p[1] > 0]
xs = [p[0] for p in hw]; ws = med([p[1] for p in hw], 3)
HW = dp([[x, r2(w)] for x, w in zip(xs, ws)], 0.04)
print('HW', json.dumps(HW))

# --- křídlo (levé, zrcadleno): y = rozpětí od osy, x = podél
cv = lambda pts: [[r2((PU0 - u) / PY), r2((v - PV0) / PX)] for u, v in pts]
LE = dp(sorted(cv(plan['LE_L'])), 0.05); TEo = dp(sorted(cv(plan['TE_Lout'])), 0.05); TEi = dp(sorted(cv(plan['TE_Lin'])), 0.05)
TIP = cv(plan['tipL'])
print('LE', json.dumps(LE)); print('TEout', json.dumps(TEo)); print('TEin', json.dumps(TEi)); print('TIP', json.dumps(TIP[:: max(1, len(TIP) // 8)]))

# --- řezy: normalizovaný tvar s(zeta) = poloviční šířka / max poloviční šířka
stn = {'2-2': 6.18, '3-3': 10.79, '4-4': 24.86, '5-5': 41.2, '6-6': 54.9, '7-7': 59.5, '8-8': 64.9, '9-9': 68.8}
Z = [i / 20 for i in range(21)]
SEC = []
for n, s in sec.items():
    pr = sorted(s['prof']); mw = max(p[1] for p in pr)
    def at(z):
        best = min(pr, key=lambda p: abs(p[0] - z)); return best[1] / mw
    SEC.append([stn[n], round(mw * 2, 3), [round(at(z), 3) for z in Z]])
print('SEC', json.dumps(SEC))

# --- profil křídla 10-10 (kořen) a 12-12
im = Image.open(IMG).convert('L'); px = im.load()
def foil(u0, u1, v0, v1):
    up, lo = [], []
    for u in range(u0, u1):
        col = [v for v in range(v0, v1) if px[u, v] < 140]
        if col: up.append((u, min(col))); lo.append((u, max(col)))
    ua, ub = up[0][0], up[-1][0]; c = ub - ua
    # tětiva: přímka mezi náběžným a odtokovým bodem (střed)
    va = (up[0][1] + lo[0][1]) / 2; vb = (up[-1][1] + lo[-1][1]) / 2
    res = []
    for k in range(0, 21):
        t = k / 20; u = int(ua + t * (c - 1)); i = u - ua
        vc = va + t * (vb - va)
        res.append([round(t, 2), round((vc - up[i][1]) / c, 4), round((vc - lo[i][1]) / c, 4)])
    return c, res
for name, box in {'10-10': (2310, 2720, 1355, 1420), '12-12': (2310, 2560, 1490, 1530)}.items():
    c, r = foil(*box); print('FOIL', name, c, json.dumps(r))
