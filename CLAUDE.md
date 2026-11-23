# CLAUDE.md – kontext projektu An-225 Mrija (model z překližky)

Komunikace s vlastníkem: česky, stručně, technicky přesně, strukturovaně. Chyby opravuje přímo.

## Co to je
Parametrický model An-225 v konstrukci „rybí kostra“ pro výrobu z 3mm překližky na CNC (stůl 1000 × 650 mm).
Úplný stav, rozhodnutí a otevřené body: `README.md` – při každé změně konstrukce ho aktualizuj (tabulka stavu, historie rozhodnutí, otevřené body).

## Architektura
- `js/model.js` – čistá geometrie, `AN225.buildModel(params, out)`; volá `out.part(group, pts2D, O, U, V, opts)`, `out.joint(p, size)`, `out.count(...)`.
  - Jednotky: metry skutečného letadla; `k = 10·L/84` převádí na mm modelu.
  - Díl = 2D polygon v rovině (O, U, V), tloušťka = materiál, vrstvy přes `lam(..., offsets)`.
  - Silueta trupu: `SHAPE.top/bot/halfWidth` (PCHIP body), průřez = superelipsa (horní n=2,3, dolní n=3,2) + kryty podvozku `spn()`.
- `js/app.js` – three.js r128 (UMD z cdnjs), UI, URL hash stav, bokorys/půdorys SVG. `window.AN225_VIEW(name)` pro pohledy (použitelné pro headless snímky).
- Bez build kroku; GitHub Pages servíruje `main` / root.

## Konstrukční pravidla (dodržovat)
- Pouze hřebenové spoje (zářez od hrany), žádné vnitřní výřezy, pokud to není nezbytné.
- Páteř 2 vrstvy, v místě nosníku příložky; nosník křídla = jeden I-díl (stojiny + V pásnice) vkládaný shora.
- Pravidelné žebrování křídel; pylon vždy mezi dvě žebra.
- Výškovka 1 vrstva, kýlovky 2, podvozek 2.
- Žádný díl nesmí přesáhnout pracovní plochu frézy − 20 mm.

## Další krok (backlog)
Generátor DXF (Python + ezdxf, nebo JS): polygony z `buildModel` → zářezy podle průniků dílů, dog-bone R = Ø frézy/2, číslování, nesting na desky 1000 × 650.
