# An-225 Mrija – model z překližky, konstrukce „rybí kostra“

Parametrický 3D model letadla Antonov An-225 Mrija pro výrobu z 3mm březové překližky na CNC frézce.
Živý náhled: **https://miloslavpansky.github.io/an225-mriya-model/**
(nastavení se ukládá do URL, odkaz lze poslat dál; diskuse v [Discussions](../../discussions), úkoly v [Issues](../../issues)).

![Jako foto](docs/img/01_jako_foto.jpg)
<sub>Náhledy v `docs/img/` jsou ze stavu před úpravou geometrie podle výkresu.</sub>

## Stav projektu (k 24. 11. 2026)

| Oblast | Stav |
|---|---|
| Koncept konstrukce | odsouhlaseno – rybí kostra: páteř + příčná žebra, křídla/ocas/gondoly/podvozek nasazené na páteř |
| Účel | **hračka pro 8letého syna** – nelétá; robustní v místech namáhaných ohybem, nedimenzováno na pády |
| Geometrie | **podle výkresu 3 pohledů** (bokorys, půdorys, nárys, 9 řezů trupu, profily křídla) – data s původem v [`js/an225-ref.js`](js/an225-ref.js), postup v [`tools/digitize/`](tools/digitize/) |
| Materiál | **3mm bříza** (BB/BB, EN 636-2, emisní třída E1); topol a karton opuštěny |
| Výroba | CNC fréza, pracovní plocha 1000 × 650 mm, fréza Ø2 mm |
| 3D vizualizace | hotovo; mapa namáhání (5 zatěžovacích stavů + obálka), výkres jako podklad bokorysu/půdorysu; automatický test a nasazení přes GitHub Actions |
| Výrobní podklady (DXF) | **nezačato** – další krok |

## Rozměry a měřítko

| Parametr | Skutečnost | Model (délka 80 cm, 1:105) |
|---|---|---|
| Délka | 84,0 m | 800 mm |
| Rozpětí | 88,4 m | 842 mm |
| Výška (SOP) | 18,1 m | 172 mm |
| Šířka trupu (max., vč. krytů podvozku) | 7,4 m [výkres] | 71 mm |
| Výška trupu | ~8,5 m [výkres] | ~81 mm |
| Hloubka křídla osa / zalomení / konec | 20,6 / 13,8 / 3,9 m | 196 / 131 / 37 mm |
| Vzepětí křídla | −5,6° [nárys] | |
| Gondola Ø × délka | 3,0 × 7,6 m | 29 × 72 mm |

Souřadnice v kódu: metry skutečného letadla, `x` od špičky přídě, `y` do strany, `z` od země.
Všechny rozměry letadla jsou v `js/an225-ref.js` se značkou původu (oficiální / bokorys / půdorys / nárys / řez / profil / dopočteno / odhad).

## Konstrukce

### Páteř
- 2 vrstvy (2 × 3 mm), při délce ≤ ~95 cm z jednoho kusu.
- Hřebenové spoje se žebry: páteř zářez shora do 40 % výšky, žebro zespodu do 60 % → souvislý pás páteře 60 %.
- Případné dělení páteře vždy mezi dvěma žebry, spoje vrstev vystřídané.
- V místě nosníku křídla příložky z obou stran (±4,5 m skut.), zářez shora na celou výšku nosníku, nosník se neprořezává.
- Hřbet pod kořenem výškovky dorovnán k její spodní ploše → výškovka podepřena po celé hloubce kořene.

### Trup
- Tvar žeber z řezů 1-1 … 9-9 výkresu (normalizovaný tvar, mezi řezy plynulé prolnutí), výška z bokorysu, šířka z půdorysu.
- **Boční podélníky** (K5): vodorovné pásy 10 mm ve výšce 3,8 m (skut.), od přídě po ~66 m, zasunuté do bočních zářezů žeber → každé žebro drženo ve 3 bodech.

### Křídlo – průběžný I-nosník bez zářezů (K1, K2, K3)
- **Pásnice** horní a dolní: každá jeden V-díl přes celé rozpětí (~825 × 211 mm), šířka konstantní (výchozí 14 mm). V ose plynulý ohyb 2 × 5,6° (vzepětí) v šířce trupu (R ≈ 330 mm) – ohýbat za vlhka do šablony.
- **Kořenová spojka** (K2): v ose ±6 m (skut.) druhá vrstva na obou pásnicích, laminovaná v ohybu (drží tvar ohybu a zesiluje kořen).
- **Stojiny**: 2 vrstvy na každé křídlo, **bez zářezů** po celé délce; přímý nosník v 35–41 % hloubky, končí na začátku zaoblení konce křídla.
- **Žebra**: pravidelná (shodný rozestup s trupem), **všechna jako přední + zadní půlžebro** lepená na stojinu, s výřezy pro pásnice.
- **Pomocná spodní lišta** (K3): 8 × 3 mm v 65 % hloubky, zapuštěná do spodních hran žeber – svazuje žebra, shora neviditelná.
- Profil podle řezů výkresu (max. tloušťka ve 40 %), relativní tloušťka 12 % → 10 %; **min. tloušťka profilu 12 mm** (stojina ≥ 5 mm), **odtoková hrana tupá ≥ 3 mm** (G6).

### Gondoly
- Gondola + pylon 2 vrstvy; **pylon jako vidlice** (K8): přední a zadní jazýček na celou výšku profilu obepínají nosník, mezi nimi je pylon přilepen ke spodní pásnici. Mezera k žebrům vyplněna výplněmi; zadní jazýček má zářez pro pomocnou lištu.
- Motor vždy přesně mezi dvěma žebry; polohy podle výkresu (10,2 / 18,0 / 25,8 m od osy, posunuto na nejbližší střed mezi žebry).
- 3 prstence na gondolu, **2 vrstvy** (K9a).

### Ocasní plochy
- **Výškovka 2 vrstvy** (K6), jeden díl přes celé rozpětí, vodorovná (podle nárysu).
- Kýlovky 2 vrstvy podle bokorysu, včetně části pod výškovkou.
- Spoj kýlovka–výškovka: vodorovný zářez v kýlovce **od odtokové hrany** + **2 trojúhelníkové výztuhy 25 mm** z vnitřní strany nad a pod výškovkou (K7).

### Podvozek (zdvojený)
- 2 podélné pásy se 7 koly (polohy a Ø podle bokorysu), ve vzdálenosti ±2,6 m, **zasazené hřebenem do žeber trupu** v oblasti podvozku (K10) – zatížení nesou žebra.
- 3 příčníky mezi žebry (doplňkové), příďová noha zdvojená.

### Pravidla spojů a výroby (M4, M5)
- Všechny spoje jsou **hřebenové** (zářez od hrany) – žádné vnitřní výřezy.
- Šířka zářezu = **naměřená** tloušťka desky + 0,1 mm (měřit každou desku); před výrobou zkušební hřebínek s šířkami +0 až +0,3 mm.
- Materiál mezi zářezem a okrajem ≥ 2 × tloušťka; nejužší místo dílu ≥ 5 mm (kontroluje test); vnější rohy R ≥ 1,5 mm; vstup do zářezu zkosit 0,5 mm.
- Fréza Ø2 mm **downcut** (netrhá horní dýhu), odlehčení rohů (dog-bone) R 1 mm, můstky (tabs) u malých dílů, deska upnutá po celé ploše.
- Pravidla jsou v kódu jako `AN225.RULES` (`js/model.js`).

## Namáhání (orientační výpočet, `js/stress.js`)
Prutová teorie; bříza: ohyb 40 MPa, lepený spoj na odtržení 2 MPa. Zatěžovací stavy pro hraní 8letého dítěte:
křídlo 30 N na konec, ocas 25 N svisle na každou kýlovku, kýlovka 20 N bočně, motor 50 N bočně, podvozek 100 N.

| Místo (využití = napětí / dovolené) | Původní návrh | Po úpravách |
|---|---|---|
| Křídlo – nejslabší průřez nosníku | 704 % (stojina se zářezy) | 73 % |
| Lepení jazýčku vnějšího pylonu | 737 % | 101 % ⚠ |
| Spoj kýlovka–výškovka | 274 % | 80 % |
| Příčník podvozku | 98 % | ~0 % (nesou žebra) |
| Výškovka u trupu | 72 % | 14 % |
| Páteř – ocasní část | – | 20 % |

## Odmítnuté / změněné varianty (historie rozhodnutí)
1. Vodorovné vrstvy (stohování) → nahrazeno rybí kostrou.
2. Výztuha páteře na ocase → zbytečná, odstraněna.
3. Dva samostatné nosníky křídel → nahrazeno jedním průběžným dílem vkládaným shora.
4. Karton s rýhovaným ohybem nosníku → u překližky nelze, nahrazeno I-profilem s pásnicemi.
5. Žebra kýlovek → u překližky zbytečná.
6. Zářez kýlovky od náběžné hrany → nevyplněný úsek, nahrazeno zářezem od odtokové hrany.
7. Formát A4 (karton) → stůl frézy 1000 × 650 mm.
8. Silueta z fotografie → **výkres 3 pohledů** (G1–G6).
9. Topol → **bříza** (M1).
10. Stojina se zářezy pro celá žebra za vnitřním motorem → **průběžný I-nosník bez zářezů, všechna žebra jako půlžebra** (K1–K3).
11. Výškovka 1 vrstva → **2 vrstvy** (K6).
12. Zvažováno a zamítnuto (mění vzhled rybí kosti nebo není potřeba): plné vrstvené křídlo, plný konec křídla, vrstvená gondola, pojízdný podvozek, rozestup žeber 18 mm, předepsaný směr vlákna a křížení vrstev (M2, M3), bezpečnostní úpravy hračky (B1–B3).

## Otevřené body
- [ ] Naměřená tloušťka březové překližky (šířka zářezů).
- [ ] Vnější pylon na hranici (101 % při 50 N bočně) – případně silnější lepidlo, nebo za vnější motory netahat.
- [ ] Ohyb pásnice v ose (2 × 5,6°) – ověřit na zkušebním kusu.
- [ ] Odhady v `js/an225-ref.js` označené [E] (rozchod podvozku, sklon kýlovek, délka gondol, tloušťka profilu u konce).
- [ ] Generátor DXF: díly s číslováním, zářezy z průniků dílů, dog-bone, rozmístění na desky 1000 × 650 mm, šablona ohybu pásnice.
- [ ] Návod ke stavbě (pořadí lepení).

## Struktura repozitáře
```
index.html                   stránka (GitHub Pages)
js/an225-ref.js              referenční geometrie z výkresu (s původem každé hodnoty)
js/model.js                  parametrická geometrie (díly, spoje, pravidla RULES) – bez závislosti na three.js
js/stress.js                 orientační výpočet namáhání + barevná škála
js/app.js                    UI, 3D render (three.js r128 z cdnjs), mapa namáhání, bokorys/půdorys s podkladem, URL stav
tests/model.test.mjs         kontrola geometrie v Node (polygony, díly ≤ stůl − 20 mm, min. šířka 5 mm, namáhání)
tests/smoke.sh               kouřový test stránky v headless Chrome + snímek
tools/digitize/              skripty pro odečet z výkresu (Python + Pillow)
.github/workflows/pages.yml  CI: test → build → deploy na GitHub Pages
docs/img/                    náhledy (stav před úpravou podle výkresu)
CLAUDE.md                    kontext pro Claude Code
```

## Lokální spuštění
Stačí otevřít `index.html` v prohlížeči (nebo `python3 -m http.server`).
Test geometrie: `node tests/model.test.mjs`.

## CI / nasazení
Každý push do `main` spustí workflow **Pages** (`.github/workflows/pages.yml`):
1. kontrola syntaxe JS a geometrie (`tests/model.test.mjs`) – při chybě se nenasazuje,
2. sestavení `_site` – do patičky se vloží verze (commit + čas), skripty dostanou `?v=<commit>` proti cache,
3. kouřový test v headless Chrome (model se musí vykreslit), snímek se uloží jako artefakt `preview`,
4. nasazení na GitHub Pages (zdroj Pages = GitHub Actions).

Pull requesty do `main` se jen testují. Ruční spuštění: Actions → Pages → Run workflow.

## Galerie (stav před úpravou podle výkresu)
| | |
|---|---|
| ![](docs/img/02_celkovy_pohled.jpg) | ![](docs/img/03_bokorys.jpg) |
| ![](docs/img/04_pudorys.jpg) | ![](docs/img/05_zepredu.jpg) |
| ![](docs/img/06_koren_kridla.jpg) | ![](docs/img/07_nosnik_a_pater.jpg) |
| ![](docs/img/08_ocas.jpg) | |
