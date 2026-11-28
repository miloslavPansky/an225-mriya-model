// =====================================================================================
// An-225 Mrija – REFERENČNÍ GEOMETRIE (znalostní báze pro model)
// =====================================================================================
// Jednotky: metry skutečného letadla. Souřadnice: x = od špičky přídě dozadu,
// y = do strany (+ pravé křídlo), z = nahoru od země.
//
// ZDROJ VÝKRESU: výkres 3 pohledů + řezy + profily
//   https://drawingdatabase.com/wp-content/uploads/2014/03/An-225-3.jpg  (2862 × 1983 px)
//   Obrázek není v repozitáři (autorská práva) – pro opakované měření ho stáhni,
//   postup a skripty jsou v tools/digitize/.
//
// ZNAČKY PŮVODU (u každé hodnoty v komentáři):
//   [O]  oficiální údaj (Wikipedia / výrobce)
//   [B]  odečteno z bokorysu      [P] z půdorysu      [N] z nárysu
//   [Ř]  z řezů trupu 1-1 … 9-9   [PR] z profilů křídla 10-10 … 13-13
//   [D]  dopočteno z jiných hodnot (vzorec uveden)
//   [E]  odhad / konstrukční volba (zdůvodnění uvedeno) – kandidát na zpřesnění
//
// KALIBRACE (px originálu → m):
//   bokorys: 19,83 px/m (měřítko 0–30 m: 0 → u=85, 30 → u=680); špička přídě u=162;
//            země v=425 (zvoleno tak, aby vrchol kýlovky = 18,1 m [O]; spodky kol na
//            výkrese leží o ~6 px níž → pneumatiky „propadlé“, rozdíl 0,3 m)
//            Délka 84,0 m [O] sedí na výkrese přesně (konec kýlovky u=1828).
//   půdorys: podél 20,04 px/m (špička v=283, konec trupu v=1828 ⇒ 77,1 m = shodné s bokorysem),
//            příčně 20,25 px/m; křídlo navíc přeškálováno ×1,0084, aby polorozpětí = 44,2 m [O].
//            Osa výkresu je pootočená ~0,3° (osa u≈1918 u přídě, 1926 u ocasu) ⇒ šířky trupu
//            měřeny jako polovina rozdílu levého a pravého okraje.
//   nárys:   vodorovně 19,83 px/m, osa u=931; svisle 19,67 px/m se zemí v=1705
//            (spodky kol), tak aby vrchol kýlovky = 18,1 m.
//   Přesnost: ±1–2 px výkresu ≈ ±0,1 m; mezi pohledy výkresu jsou rozdíly ~1–2 %.
// =====================================================================================
(function (global) {
  'use strict';

  const REF = {
    // ---------------------------------------------------------------- oficiální údaje
    official: {
      length: 84.0,        // [O]
      span: 88.4,          // [O]
      height: 18.1,        // [O] (vrchol kýlovky)
      wingArea: 905,       // [O] m²; z obrysu níže vychází 969 m² včetně části v trupu [D]
      cargoHold: { length: 43.35, width: 6.4, height: 4.4 }, // [O] vnitřek – dolní mez pro vnější rozměry
      stabSpan: 32.65,     // [O?] jediný zdroj, neověřeno; výkres dává 31,4 m k ose kýlovek [P]
    },

    // ---------------------------------------------------------------- trup
    fuselage: {
      // Horní obrys (hřbet) bez kapotáže křídla [B]; nos a kabina trasovány, puchýře na hřbetě vyhlazeny.
      // Za x≈70 je hřbet zakrytý výškovkou → konec trupu [E] podle šířky konce v půdorysu (1,6 m).
      top: [[0, 3.78], [0.45, 4.4], [0.8, 4.65], [1.6, 5.35], [2.6, 6.1], [3.6, 6.75], [5.0, 7.45], [7.0, 8.15],
        [7.6, 8.45], [8.2, 8.9], [10.2, 9.18], [25.7, 9.3], [29.2, 9.35], [42.5, 9.45], [59.0, 9.47], [67.5, 9.5],
        [70.0, 9.45], [74.0, 9.2], [77.05, 8.4]],
      // Spodní obrys (břicho) [B]; v oblasti podvozku = spodek krytů podvozku (kola jsou pod ním).
      bot: [[0, 3.78], [0.4, 3.25], [0.8, 3.0], [1.8, 2.42], [2.8, 2.04], [4.2, 1.85], [6.9, 1.39], [9.7, 1.08],
        [16.0, 0.83], [30.0, 0.78], [50.0, 0.85], [53.0, 1.05], [56.0, 1.4], [59.3, 1.84], [63.5, 2.7], [67.8, 3.83],
        [71.6, 4.92], [76.45, 6.73], [77.05, 7.0]],
      tailEnd: 77.05,      // [B] konec trupu (dál už jen kýlovky); půdorys dává 77,1 [P]
      // Kapotáž kořene křídla – horní obrys hrbu [B] (x 30,7–40,2).
      fairing: [[30.66, 9.35], [31.27, 10.36], [32.27, 10.72], [35.7, 10.74], [36.51, 10.64], [38.93, 9.68], [39.74, 9.43], [40.14, 9.4]],
      // Největší poloviční šířka (včetně krytů podvozku) [P]. x 23–43 z trasování pravého okraje
      // (korekce na pootočení osy), nos a ocas jako polovina rozdílu okrajů.
      halfWidth: [[0, 0], [0.85, 1.04], [1.85, 1.8], [2.84, 2.17], [4.84, 2.72], [6.83, 3.09], [8.83, 3.36], [10.8, 3.5],
        [23.0, 3.55], [43.0, 3.5], [46.0, 3.62], [52.0, 3.72], [55.7, 3.7], [58.7, 3.33], [61.7, 3.04],
        [64.7, 2.85],   // [E] interpolováno – v půdorysu zakryto náběžnou hranou výškovky
        [67.7, 2.47], [70.7, 1.7], [73.7, 1.4], [75.7, 1.11], [77.05, 0.81]],
      // Řezy trupu [Ř]: tvar normalizovaný – s(ζ) = poloviční šířka / největší poloviční šířka řezu,
      // ζ = 0 (spodek) … 1 (vršek) po 0,05. Výška řezu = top−bot z bokorysu, šířka = halfWidth z půdorysu.
      // Polohy řezů x odečteny ze šipek v bokorysu [B]. Řez 1-1 (x=2,07) je kruh.
      // ratio = šířka/výška řezu na výkrese (kontrola souladu s bokorysem a půdorysem).
      sectionZeta: 0.05,
      sections: [
        { name: '1-1', x: 2.07, ratio: 1.0, s: 'circle' },
        { name: '2-2', x: 6.18, ratio: 1.198, s: [0.131, 0.483, 0.662, 0.766, 0.834, 0.869, 0.883, 0.959, 0.89, 0.89, 0.876, 0.848, 0.821, 0.779, 0.724, 0.669, 0.593, 0.517, 0.428, 0.324, 0.138] },
        { name: '3-3', x: 10.79, ratio: 0.988, s: [0.195, 0.591, 0.811, 0.906, 0.931, 0.95, 1.0, 0.95, 0.943, 0.924, 0.893, 0.843, 0.78, 0.698, 0.616, 0.56, 0.51, 0.465, 0.415, 0.327, 0.132] },
        { name: '4-4', x: 24.86, ratio: 1.074, s: [0.448, 0.644, 0.782, 0.856, 0.885, 0.902, 0.914, 0.908, 0.902, 0.879, 0.856, 0.816, 0.793, 0.782, 0.776, 0.776, 0.776, 0.839, 0.948, 0.914, 0.247] },
        // 5-5: horní pětina (ζ ≥ 0,7) [E] – na výkrese řez zachytil konec kapotáže křídla (úzký hřbet s dutým přechodem);
        //   nahrazeno eliptickým vypouklým vrškem od ζ = 0,65 (s = 0,766) k plochému vršku s = 0,164. Původně:
        //   …0.754, 0.754, 0.526, 0.257, 0.129, 0.216, 0.164
        { name: '5-5', x: 41.2, ratio: 0.842, s: [0.491, 0.719, 0.86, 0.936, 0.936, 0.93, 0.912, 0.901, 0.889, 0.865, 0.83, 0.789, 0.766, 0.766, 0.76, 0.741, 0.708, 0.658, 0.585, 0.474, 0.164] },
        { name: '6-6', x: 54.9, ratio: 0.921, s: [0.219, 0.707, 0.896, 0.921, 0.945, 0.957, 0.957, 0.933, 0.921, 0.878, 0.823, 0.75, 0.677, 0.64, 0.537, 0.488, 0.427, 0.378, 0.305, 0.226, 0.226] },
        { name: '7-7', x: 59.5, ratio: 1.117, s: [0.691, 0.852, 0.907, 0.926, 1.0, 0.938, 0.932, 0.92, 0.895, 0.87, 0.821, 0.772, 0.716, 0.661, 0.605, 0.555, 0.519, 0.457, 0.37, 0.222, 0.111] },
        { name: '8-8', x: 64.9, ratio: 1.098, s: [0.119, 0.679, 0.851, 0.925, 0.97, 0.985, 1.0, 0.993, 0.985, 0.963, 0.933, 0.895, 0.858, 0.828, 0.784, 0.754, 0.709, 0.664, 0.612, 0.552, 0.119] },
        { name: '9-9', x: 68.8, ratio: 1.04, s: [0.067, 0.609, 0.762, 0.857, 0.914, 0.952, 0.981, 0.991, 1.0, 0.991, 0.981, 0.981, 0.962, 0.962, 0.952, 0.943, 0.924, 0.924, 0.905, 0.895, 0.867] },
      ],
    },

    // ---------------------------------------------------------------- křídlo
    wing: {
      semi: 44.2,                 // [O] polorozpětí
      le: { x0: 21.71, k: 0.6113 },   // [P] náběžná hrana přímá: x = x0 + k·y (šíp NH ≈ 31,4°)
      teInner: { x: 42.35, yEnd: 11.2 }, // [P] vnitřní odtoková hrana kolmo k trupu do zalomení
      teOuter: { x0: 42.42, y0: 11.2, k: 0.3087 }, // [P] vnější OH: x = x0 + k·(y − y0)
      tipRoundFrom: 42.6,         // [P] od tohoto y je náběžná hrana konce zaoblená (konec ~ rovnoběžný s osou)
      // hloubky [D]: osa 20,64 m, zalomení 13,79 m, konec 3,88 m
      z: { z0: 9.66, k: 0.0985 }, // [N] výška střední čáry: z = z0 − k·y (záporná vzepjatost ≈ 5,6°)
      //   body nárysu: y=5,0 → 9,30; y=20,0 → 7,47; y=44,7 → 5,34 (proloženo přímkou)
      thickness: { root: 0.12, kink: 0.12, tip: 0.10 }, // relativní tloušťka: kořen 11,75 % [PR 10-10],
      //   zalomení 12,3 % [PR 11-11], konec [E] (řez 13-13 příliš malý na odečet)
      // Rozložení tloušťky profilu normalizované na max (x/c → t/tmax) [PR 10-10];
      // max. tloušťka ve 40 % hloubky, tupější zadní část než NACA 4-digit.
      tDist: [[0, 0], [0.025, 0.28], [0.05, 0.4], [0.1, 0.5], [0.15, 0.7], [0.2, 0.83], [0.3, 0.96], [0.4, 1.0], [0.5, 0.957],
        [0.6, 0.85], [0.7, 0.7], [0.8, 0.5], [0.9, 0.24], [0.95, 0.09], [1.0, 0.0]],
      //   hodnoty 0,025–0,05 [E] (náběžná hrana na výkrese neostrá, doplněno tvarem NACA)
      camber: 0.02,               // [E] prohnutí střední čáry (výkres nečitelné, nadkritický profil má malé)
      spar: 0.35,                 // [E] poloha hlavního nosníku modelu v hloubce (konstrukční volba)
    },

    // ---------------------------------------------------------------- motory (6× D-18T)
    engines: {
      y: [10.2, 18.0, 25.8],      // [P]+[N] průměr obou pohledů (P: 10,3/18,05/25,6; N: 9,9/17,9/25,6), ×1,0084
      zAxis: [5.08, 4.62, 4.24],  // [N] výška osy gondoly nad zemí
      intakeAhead: 4.3,           // [P] vstup leží 4,2–4,5 m před náběžnou hranou křídla v dané stanici
      length: 7.6,                // [E] délka gondoly vč. výstupního kužele (bokorys: gondoly se překrývají)
      diameter: 3.0,              // [N] vnější průměr (59 px); dosavadní model 3,24 m
    },

    // ---------------------------------------------------------------- ocasní plochy
    stab: {
      le: { x0: 63.81, k: 0.764 },  // [P] náběžná hrana: x = x0 + k·y (kořen u trupu x=65,8 při y=2,6)
      te: { x0: 74.6, k: 0.466 },   // [P] odtoková hrana: x = x0 + k·y (y=2,6 → 75,85; y=15,36 → 81,8)
      semi: 15.7,                   // [P] k ose kýlovky; oficiálních 32,65/2 = 16,3 neověřeno
      z: 9.9,                       // [B] výška roviny výškovky u kořene
      dihedral: 0.0,                // [N] na nárysu prakticky vodorovná (dosavadní model +2,9°)
    },
    fin: {                          // dvojitá kýlovka na koncích výškovky [B]
      top: { z: 18.1, le: 80.2, te: 84.0 },     // [B]/[O]
      atStab: { z: 9.93, le: 73.8, te: 82.5 },  // [B]
      bottom: { z: 7.06, le: 77.05, te: 82.6 }, // [B] spodní část pod výškovkou
      cant: 0,                      // [E] nárys naznačuje sklon ~10° dovnitř – neověřeno, model svisle
    },

    // ---------------------------------------------------------------- podvozek
    gear: {
      mainX: [35.3, 37.0, 38.7, 40.4, 42.1, 43.9, 45.6], // [B] osy 7 párů kol (rozestup 1,71 m)
      wheelR: 0.66,                 // [B] průměr pneu 1,36 m na výkrese → poloměr modelu 0,66 (zaokr.)
      track: 3.8,                   // [E] polovina rozchodu hlavního podvozku (nárys ~3,7–4,3 m, nečitelné)
      noseX: 10.6,                  // [B] osa příďového kola
      noseR: 0.6,                   // [E]
    },
  };

  global.AN225_REF = REF;
})(typeof window !== 'undefined' ? window : globalThis);
