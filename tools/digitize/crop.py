"""crop.py IMG OUT x0 y0 x1 y1 [scale] [grid]  – výřez s mřížkou v ORIGINÁLNÍCH pixelech."""
import sys
from PIL import Image, ImageDraw
img, out = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = map(int, sys.argv[3:7])
sc = float(sys.argv[7]) if len(sys.argv) > 7 else 1.0
gs = int(sys.argv[8]) if len(sys.argv) > 8 else 50
im = Image.open(img).convert('RGB').crop((x0, y0, x1, y1))
im = im.resize((int(im.width * sc), int(im.height * sc)), Image.LANCZOS)
d = ImageDraw.Draw(im)
for gx in range((x0 // gs + 1) * gs, x1, gs):
    X = (gx - x0) * sc
    d.line([(X, 0), (X, im.height)], fill=(255, 0, 0) if gx % (gs * 5) == 0 else (255, 180, 180), width=1)
    if gx % (gs * 2) == 0: d.text((X + 2, 2), str(gx), fill=(200, 0, 0))
for gy in range((y0 // gs + 1) * gs, y1, gs):
    Y = (gy - y0) * sc
    d.line([(0, Y), (im.width, Y)], fill=(0, 0, 255) if gy % (gs * 5) == 0 else (180, 180, 255), width=1)
    if gy % (gs * 2) == 0: d.text((2, Y + 2), str(gy), fill=(0, 0, 200))
im.save(out)
print(im.size)
