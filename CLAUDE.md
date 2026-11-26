# CLAUDE.md – kontext projektu An-225 Mrija (model z překližky)

Komunikace s vlastníkem: česky, stručně, technicky přesně, strukturovaně. Chyby opravuje přímo.

## Co to je
Parametrický model An-225 v konstrukci „rybí kostra“ pro výrobu z 3mm **březové** překližky na CNC (stůl 1000 × 650 mm).
Účel: hračka pro 8letého syna (nelétá) – robustní v místech namáhaných ohybem; vzhled rybí kosti zachovat.
Úplný stav, rozhodnutí a otevřené body: `README.md`; výkresy dílů `docs/parts/` (`node tools/parts/sheets.mjs`) – po změně dílů přegenerovat – při každé změně konstrukce ho aktualizuj (tabulka stavu, namáhání, historie rozhodnutí, otevřené body).

## Architektura
- `js/an225-ref.js` – **referenční geometrie z výkresu 3 pohledů** (`AN225_REF`), každá hodnota se značkou původu ([O] oficiální, [B]/[P]/[N] bokorys/půdorys/nárys, [Ř] řezy, [PR] profily, [D] dopočteno, [E] odhad). Nové poznatky o tvaru letadla zapisuj sem (s původem), ne do model.js. Nástroje odečtu a kalibrace: `tools/digitize/`. Obrázek výkresu se do repa nedává (autorská práva).
- `js/model.js` – čistá geometrie, `AN225.buildModel(params, out)`; volá `out.part(group, pts2D, O, U, V, opts)`, `out.joint(p, size, kind)`, `out.count(...)`; vrací i `struct` = popis nosné konstrukce pro výpočet namáhání. Výrobní pravidla `AN225.RULES`.
  - Jednotky: metry skutečného letadla; `k = 10·L/84` převádí na mm modelu.
  - Díl = 2D polygon v rovině (O, U, V), tloušťka = materiál, vrstvy přes `lam(..., offsets)`.
  - Trup: hřbet/břicho/šířka z `AN225_REF.fuselage` (PCHIP), tvar žeber z normalizovaných řezů výkresu (`secShape`).
- `js/stress.js` – orientační prutový výpočet namáhání (`AN225_STRESS.analyze(struct, lc)`, `envelope`), 5 zatěžovacích stavů. Při změně konstrukce aktualizuj `struct` v model.js, ať mapa odpovídá.
- `js/app.js` – three.js r128 (UMD z cdnjs), UI, URL hash stav, mapa namáhání (barvy vrcholů), bokorys/půdorys SVG s výkresem jako podkladem (načítán ze zdroje). `window.AN225_VIEW(name)` pro pohledy.
- Bez build kroku v repu; nasazení dělá GitHub Actions (`.github/workflows/pages.yml`): `node tests/model.test.mjs` → sestavení `_site` (verze v patičce `#build`, `?v=` u skriptů) → `tests/smoke.sh` v headless Chrome → deploy Pages. Push do `main` = redeploy; rozbitý test nasazení zastaví.
- `tests/model.test.mjs` obsahuje kopii výchozích hodnot `DEF` z `app.js` – při změně je sjednoť.
- Lokálně nemusí být Node: testy lze spustit přes `wslc run --rm -v "<repo>:/w" -w /w node:20-alpine node tests/model.test.mjs`.

## Konstrukční pravidla (dodržovat)
- Pouze hřebenové spoje (zářez od hrany), žádné vnitřní výřezy, pokud to není nezbytné.
- Páteř 2 vrstvy (bez příložek), s centroplánem křídla se kříží hřebenem; trup s bočními podélníky.
- Křídlo: průběžný I-nosník, stojiny bez zářezů; centroplán (kořenová žebra ±aK) s kýlem pod dolní pásnicí uvnitř trupu; pásnice 1 vrstva, 1 díl, zužující se ke konci, **zapuštěné do loží žeber se zářezy pro žebra** (líc = obrys profilu); pomocná lišta v 65 % se zářezy; konec uzavřen koncovým žebrem. Žádné další vrstvy pásnic ani příložky. Min. tloušťka profilu 12 mm, odtoková hrana ≥ 3 mm.
- Pravidelné žebrování křídel; pylon vždy mezi dvě žebra, nasazený zespodu výřezem na nosník (lepit), náběžná hrana pylonu plynule do křídla.
- Výškovka 2 vrstvy, kýlovky 2 (+ 2 výztuhy), podvozek 2 (pásy zasazené do žeber), prstence gondol 1 vrstva v rozestupu žeber, spoj s gondolou 50/50.
- Žádný díl nesmí přesáhnout pracovní plochu frézy − 20 mm; nejužší místo dílu ≥ 5 mm (obojí hlídá test).

## Další krok (backlog)
Generátor DXF (Python + ezdxf, nebo JS): polygony z `buildModel` → zářezy podle průniků dílů, dog-bone R = Ø frézy/2, číslování, nesting na desky 1000 × 650, šablona ohybu pásnice.
