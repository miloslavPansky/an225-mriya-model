// Orientační výpočet namáhání nosných dílů modelu (prutová teorie, bez MKP).
// Vstup: geo.struct z AN225.buildModel (rozměry v mm, síly v N). Výstup: využití = σ / dovolené napětí.
// Účel: porovnat varianty konstrukce a najít slabá místa – ne přesná pevnostní predikce.
(function (global) {
  'use strict';

  // Materiál: bříza 3 mm, 3 vrstvy. Pevnost v ohybu ve směru vlákna krycí dýhy ~50–70 MPa,
  // bereme 40 MPa (tenká deska, rozptyl, zářezy). Lepený spoj namáhaný odtržením kolmo
  // k povrchu (PVAc + povrchová dýha) ~2 MPa.
  const MAT = { fm: 40, fPeel: 2.0, fBear: 15 };   // fBear: otlačení hrany překližky (čep v otvoru)

  // Zatěžovací stavy – hraní 8letého dítěte (zvednutí, tlak rukou, „přistání“), ne pády.
  const LC = [
    { id: 'wing', name: 'Křídlo – 30 N svisle na konec křídla', F: 30 },
    { id: 'tailV', name: 'Ocas – 25 N svisle na vrchol každé kýlovky', F: 25 },
    { id: 'tailS', name: 'Kýlovka – 20 N bočně na vrchol', F: 20 },
    { id: 'eng', name: 'Motor – 50 N bočně na gondolu', F: 50 },
    { id: 'gear', name: 'Podvozek – 100 N při dosednutí', F: 100 },
  ];

  function analyze(S, id) {
    const lc = LC.find(l => l.id === id), F = lc ? lc.F : 0, k = S.k, fm = MAT.fm, fp = MAT.fPeel;
    const st = S.stab, fn = S.fin, w = S.wing, sp = S.spine, g = S.gear;
    // --- jednotlivé kontroly: vrací {u, s (MPa), what}
    const wingAt = a => { const q = w.sec(a), M = F * w.lever(a), s = M / q.W; return { u: s / fm, s, what: q.what }; };
    const stabV = y => { const q = st.sec(y), M = F * Math.max(0, st.FY - Math.abs(y)) * k, s = M / q.W; return { u: s / fm, s, what: q.what }; };
    const stabS = y => { const q = st.sec(y), M = F * (fn.zTop - fn.zStab) * k, s = M / q.W; return { u: s / fm, s, what: q.what }; };
    const finS = z => { if (z < fn.zStab) return { u: 0, s: 0 }; const q = fn.sec(z), M = F * (fn.zTop - z) * k, s = M / q.W; return { u: s / fm, s, what: q.what }; };
    // spoj kýlovka–výškovka: moment kýlovky = dvojice sil v horní a dolní patce, stojina je otlačuje v otvorech
    const finJ = () => { const j = S.finJoint, M = F * (fn.zTop - fn.zStab) * k, s = M / j.hc / j.Ab; return { u: s / MAT.fBear, s, what: j.what }; };
    const isTail = n => /výškov|kýlov/.test(n || ''), isStab = n => /výškov/.test(n || '');
    // ocas: síla z kýlovek vstupuje do páteře přes kořen výškovky (xA0…xA1) – za ním páteř nenese nic
    const spineV = x => {
      if (x < sp.xSupport) return { u: 0, s: 0 };
      const f = sp.xA1 != null ? Math.min(1, Math.max(0, (sp.xA1 - x) / (sp.xA1 - sp.xA0))) : 1;
      const h = sp.hNet(x), M = 2 * F * Math.max(0, sp.xFin - x) * k * f, s = M / (sp.t * h * h / 6); return { u: s / fm, s };
    };
    const pyl = q => {
      const Mr = F * q.armRoot, sr = Mr / (q.Lp * q.t ** 2 / 6);                 // ohyb pylonu u spodku křídla
      const Mj = F * q.arm, sj = Mj / (q.Wglue != null ? q.Wglue : 2 * q.Lt * q.ht ** 2 / 6); // odtržení lepení jazýčku (2 plochy)
      return { root: { u: sr / fm, s: sr }, joint: { u: sj / fp, s: sj, what: q.what } };
    };
    const gearC = () => {
      if (g.ribsCarry) return { u: 0.02, s: 0.02 * fm, what: g.what };
      const Fs = F / 2 / g.nCross, M = Fs * g.arm, s = M / (g.t * g.hUnder ** 2 / 6); return { u: s / fm, s, what: g.what };
    };
    const nearPylon = y => S.pylons.reduce((b, q) => Math.abs(Math.abs(y) - Math.abs(q.e)) < Math.abs(Math.abs(y) - Math.abs(b.e)) ? q : b, S.pylons[0]);

    // --- pole využití pro obarvení: field(group, name, P[x,y,z] v m) → u | null (neposuzováno)
    const field = (grp, name, P, kind) => {
      const y = Math.abs(P[1]);
      switch (id) {
        case 'wing':
          if (!isTail(name) && (grp === 'sw' || grp === 'wg' || (grp === 'rf' && /nosníku/.test(name))) && y <= w.semi) return wingAt(y).u;
          return null;
        case 'tailV':
          if (isStab(name)) return stabV(Math.min(y, st.FY)).u;
          if (isTail(name)) return 0.02;
          if (grp === 'sp') return P[0] < sp.xSupport ? null : spineV(P[0]).u;
          return null;
        case 'tailS':
          if (isStab(name) && /pásnice/.test(name) && y > st.FY - 1) return Math.max(finJ().u, stabS(st.FY).u);   // patky
          if (isStab(name)) return stabS(Math.min(y, st.FY)).u;
          if (isTail(name)) return P[2] < fn.zStab ? 0.05 : finS(P[2]).u;
          return null;
        case 'eng': {
          if (grp === 'en' && name === 'Gondola + pylon') return pyl(nearPylon(y)).root.u;
          if (grp === 'en') return 0.05;
          if (grp === 'rf' && name === 'Výplň pylonu') return pyl(nearPylon(y)).joint.u;
          return null;
        }
        case 'gear':
          if (grp === 'gr' && name === 'Příčník podvozku') return gearC().u;
          if (grp === 'gr') return 0.05;
          if (grp === 'rb' && g.ribsCarry && P[0] > 33 && P[0] < 50) return 0.05;
          return null;
      }
      return null;
    };

    // --- nejvíc namáhaná místa (pro tabulku)
    const crit = [];
    const push = (label, r) => crit.push({ label, u: r.u, s: r.s, what: r.what || '' });
    if (id === 'wing') {
      let worst = null;
      for (let a = 0.3; a < w.semi - 0.5; a += 0.25) { const r = wingAt(a); if (!worst || r.u > worst.r.u) worst = { a, r }; }
      push('Kořen v ose trupu (hluboké stojiny)', wingAt(0.3));
      if (w.aK) push('U boku trupu (kořenové žebro)', wingAt(w.aK + 0.05));
      push(`Nejslabší průřez nosníku (${(worst.a * k / 10).toFixed(0)} cm od osy)`, worst.r);
      push('Nosník v 70 % polorozpětí', wingAt(0.7 * w.semi));
    } else if (id === 'tailV') {
      push('Výškovka v ose (hluboké stojiny)', stabV(0.2)); push('Výškovka u kořenového žebra', stabV(st.aK + 0.05)); push('Výškovka v polovině', stabV(st.FY / 2));
      let m = { u: 0, s: 0 }; for (let x = sp.xSupport; x < sp.xFin; x += 0.5) { const r = spineV(x); if (r.u > m.u) m = r; } push('Páteř (ocasní část)', m);
    } else if (id === 'tailS') {
      push('Spoj kýlovka–výškovka (stojina v otvorech patek)', finJ()); push('Kýlovka nad výškovkou', finS(fn.zStab + 0.01));
      push('Výškovka u kýlovky', stabS(st.FY - 0.5)); push('Výškovka u kořenového žebra', stabS(st.aK + 0.05));
    } else if (id === 'eng') {
      S.pylons.forEach((q, i) => { const r = pyl(q); push(`Pylon ${i + 1} – lepení jazýčku`, r.joint); push(`Pylon ${i + 1} – ohyb u křídla`, r.root); });
    } else if (id === 'gear') {
      push('Příčník podvozku u páteře', gearC());
    }
    crit.sort((a, b) => b.u - a.u);
    return { field, crit, lc };
  }

  // obálka: maximum přes všechny stavy
  function envelope(S) {
    const all = LC.map(l => analyze(S, l.id));
    return {
      field: (g, n, P, kind) => { let m = null; for (const a of all) { const u = a.field(g, n, P, kind); if (u != null && (m == null || u > m)) m = u; } return m; },
      crit: all.flatMap(a => a.crit.map(c => Object.assign({}, c, { label: c.label + ' · ' + a.lc.name.split(' – ')[0] }))).sort((a, b) => b.u - a.u).slice(0, 8),
      lc: { id: 'env', name: 'Obálka – maximum ze všech stavů' },
    };
  }

  // barevná škála využití: 0 zelená → 0,5 žlutá → 1 červená → ≥1,5 tmavě fialová
  function color(u) {
    const S = [[0, [29, 158, 117]], [0.5, [239, 191, 60]], [0.8, [232, 120, 40]], [1.0, [214, 40, 40]], [1.5, [110, 20, 90]]];
    if (u <= 0) return S[0][1].map(v => v / 255);
    for (let i = 1; i < S.length; i++) if (u <= S[i][0]) {
      const [a, ca] = S[i - 1], [b, cb] = S[i], t = (u - a) / (b - a);
      return ca.map((v, j) => (v + (cb[j] - v) * t) / 255);
    }
    return S[S.length - 1][1].map(v => v / 255);
  }

  global.AN225_STRESS = { MAT, LC, analyze, envelope, color };
})(typeof window !== 'undefined' ? window : globalThis);
