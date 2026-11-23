"""Změří řezy trupu: pro každý řez v boxu najde vnější obrys po řádcích (levý/pravý okraj),
vrátí normalizovaný profil: zeta (0 = spodek, 1 = vršek) -> poloviční šířka / výška řezu.
sections.py IMG OUT.json OVERLAY.png"""
import sys, json
from PIL import Image, ImageDraw
im = Image.open(sys.argv[1]).convert('L'); px = im.load()
TH = 140
# název: (box x0,y0,x1,y1 v orig px, u středové osy)
S = {
  '2-2': (225, 935, 372, 1080, 297),
  '3-3': (400, 900, 560, 1070, 481),
  '4-4': (585, 895, 760, 1070, 674),
  '5-5': (775, 880, 950, 1085, 862),
  '6-6': (195, 1150, 360, 1340, 277),
  '7-7': (390, 1150, 555, 1310, 475),
  '8-8': (590, 1160, 740, 1295, 655),
  '9-9': (800, 1165, 935, 1270, 866),
}
res = {}
ov = im.convert('RGB'); d = ImageDraw.Draw(ov)
for n, (x0, y0, x1, y1, uc) in S.items():
    rows = []
    for v in range(y0, y1):
        dark = [u for u in range(x0, x1) if px[u, v] < TH]
        # vyřadit tenké čáry os (středová osa, vodorovná osa): stačí vzít krajní tmavé pixely,
        # ale ignorovat osu, pokud je to jediný tmavý pixel blízko uc
        dark = [u for u in dark if abs(u - uc) > 4]
        if len(dark) < 2: rows.append(None); continue
        rows.append((v, min(dark), max(dark)))
    vv = [r for r in rows if r and (r[2] - r[1]) > 6]
    # vodorovná osa (čerchovaná) přesahuje obrys -> odfiltrovat řádky, kde šířka skočí o >25 % proti sousedům
    clean = []
    for i, r in enumerate(vv):
        nb = [q[2] - q[1] for q in vv[max(0, i - 4):i] + vv[i + 1:i + 5]]
        med = sorted(nb)[len(nb) // 2] if nb else r[2] - r[1]
        if (r[2] - r[1]) > med * 1.12 + 3: continue
        clean.append(r)
    top, bot = clean[0][0], clean[-1][0]
    H = bot - top
    prof = []
    for v, l, r in clean:
        z = (bot - v) / H
        prof.append([round(z, 4), round((r - l) / 2 / H, 4), round(((l + r) / 2 - uc) / H, 4)])
        d.point([(l, v), (r, v)], fill=(255, 0, 0))
    res[n] = {'H_px': H, 'top': top, 'bot': bot, 'prof': prof}
    print(n, 'H', H, 'maxW/H', max(p[1] for p in prof) * 2)
json.dump(res, open(sys.argv[2], 'w'))
ov.crop((130, 860, 960, 1360)).save(sys.argv[3])
