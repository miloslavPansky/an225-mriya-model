# Digitalizace výkresu An-225

Nástroje, kterými byla z výkresu 3 pohledů odečtena referenční geometrie v [`js/an225-ref.js`](../../js/an225-ref.js).

Výkres (není v repozitáři kvůli autorským právům):
https://drawingdatabase.com/wp-content/uploads/2014/03/An-225-3.jpg (2862 × 1983 px)

```powershell
mkdir ref; curl.exe -L -o ref/an225-3.jpg https://drawingdatabase.com/wp-content/uploads/2014/03/An-225-3.jpg
```

Vyžaduje Python 3 + Pillow. Všechny souřadnice jsou v pixelech **originálu**.

| Skript | Účel |
|---|---|
| `crop.py IMG OUT x0 y0 x1 y1 [scale] [grid]` | výřez s mřížkou (popisky = px originálu) pro ruční odečet |
| `trace.py IMG side.json out/side_out.json [overlay.png x0 y0 x1 y1 scale]` | poloautomatické trasování čar podle vodítek; overlay pro vizuální kontrolu |
| `sections.py IMG out/sec_out.json overlay.png` | normalizované řezy trupu 2-2 … 9-9 |
| `process.py . IMG` | převod trasování na metry (bokorys, půdorys, řezy) |

`side.json`, `plan.json` = vodítka trasování; `out/` = surové výsledky trasování.

## Kalibrace
Viz hlavička `js/an225-ref.js` (měřítka, počátky, volba země, korekce pootočení osy).

## Postup a poznámky
1. Hrubé body odečíst z `crop.py` výřezů, vložit jako vodítka do `*.json`.
2. `trace.py` najde přesné středy čar v okně ±`win` px; overlay vždy zkontrolovat.
3. `process.py` převede na metry a zjednoduší (Douglas–Peucker).
4. Výsledky byly **ručně dočištěny** před zápisem do `an225-ref.js`:
   - trasování zachytávalo i sousední čáry (osy, náběžnou hranu výškovky, kola) – nahrazeno ručním odečtem,
   - šířky trupu u přídě a ocasu měřeny jako polovina rozdílu okrajů (osa výkresu je pootočená ~0,3°),
   - profily křídla: náběžná hrana a popisky řezu ruší automatiku, použito jen rozložení tloušťky.
5. Hodnoty, které výkres neumožnil odečíst, jsou v `an225-ref.js` označené `[E]` se zdůvodněním.
