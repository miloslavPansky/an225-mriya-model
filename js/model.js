// An-225 Mrija – parametrická geometrie modelu "rybí kostra".
// Souřadnice skutečného letadla v metrech: x = od špičky přídě dozadu (0..84),
// y = do strany (+ pravé křídlo), z = nahoru od země (0 = země, výška SOP 18,1 m).
// Rozměry a tvar letadla: js/an225-ref.js (výkres 3 pohledů). Každý díl = 2D polygon [u,v]
// v metrech + rovina (počátek O, osy U, V). Tloušťka dílu = materiál.
(function (global) {
  'use strict';

  // ---------- pomocné funkce ----------
  function pchip(P) { // monotónní kubická interpolace (bez překmitů)
    const n = P.length, x = P.map(p => p[0]), y = P.map(p => p[1]), h = [], d = [];
    for (let i = 0; i < n - 1; i++) { h[i] = x[i + 1] - x[i]; d[i] = (y[i + 1] - y[i]) / h[i]; }
    const m = new Array(n); m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
    }
    return t => {
      if (t <= x[0]) return y[0]; if (t >= x[n - 1]) return y[n - 1];
      let i = 0; while (t > x[i + 1]) i++;
      const s = (t - x[i]) / h[i], s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h[i] * m[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h[i] * m[i + 1];
    };
  }
  const sm = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
  const nrm = v => { const l = Math.hypot(...v); return v.map(a => a / l); };
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const add = (a, b, s) => a.map((v, i) => v + b[i] * s);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const sym = n => Array.from({ length: n }, (_, i) => i - (n - 1) / 2);
  function prof(xa, xb, top, bot, st) {
    const tp = [], bt = [], n = Math.max(2, Math.ceil((xb - xa) / st));
    for (let i = 0; i <= n; i++) { const x = xa + (xb - xa) * i / n; tp.push([x, top(x)]); bt.push([x, bot(x)]); }
    return tp.concat(bt.reverse());
  }
  function clipX(P, xc, less) { // ořez polygonu svislou přímkou x = xc
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[(i + P.length - 1) % P.length], b = P[i];
      const ia = less ? a[0] <= xc : a[0] >= xc, ib = less ? b[0] <= xc : b[0] >= xc;
      const cut = () => { const t = (xc - a[0]) / (b[0] - a[0]); return [xc, a[1] + t * (b[1] - a[1])]; };
      if (ib) { if (!ia) out.push(cut()); out.push(b); } else if (ia) out.push(cut());
    }
    return out;
  }


  // =====================================================================================
  // Geometrie podle referenčních dat z výkresu (js/an225-ref.js) – viz značky původu tam.
  // =====================================================================================
  const REF = global.AN225_REF;
  if (!REF) throw new Error('Chybí js/an225-ref.js (AN225_REF) – musí se načíst před model.js');
  const RF = REF.fuselage, RW = REF.wing, RS = REF.stab, RN = REF.fin, RE = REF.engines, RG = REF.gear;

  // ---------- výrobní a konstrukční pravidla (M4) – v mm modelu
  const RULES = {
    tool: 2.0,          // fréza Ø2 mm, dog-bone R 1 mm
    slotClear: 0.1,     // šířka zářezu = naměřená tloušťka + 0,1 mm
    edgeMin: 2,         // materiál mezi zářezem a okrajem ≥ 2 × tloušťka
    minWidth: 5,        // nejužší místo dílu
    cornerR: 1.5,       // zaoblení vnějších rohů
    leadIn: 0.5,        // zkosení vstupu zářezu
    teMin: 3,           // odtoková hrana profilu (G6)
    wingMinThick: 12,   // minimální tloušťka profilu křídla (stojina nosníku ≥ 5 mm)
    flangeNotch: 3,
    flangeTip: 0.7,     // šířka pásnice u koncového žebra / u kořene     // zářezy pásnice nosníku pro žebra – hloubka od každého okraje
    stripW: 12,         // pomocná lišta křídla – šířka
    stripNotch: 3,      // pomocná lišta – zářezy pro žebra od každého okraje
    gusset: 25,         // výztuhy kýlovky – odvěsna (K7), 2 ks na kýlovku (nad a pod výškovkou, z vnitřní strany)
  };

  // ---------- trup
  const fTopBody = pchip(RF.top), fBot = pchip(RF.bot), fW = pchip(RF.halfWidth), fFair = pchip(RF.fairing);
  const XE = RF.tailEnd;
  const fFairTop = x => (x > RF.fairing[0][0] && x < RF.fairing[RF.fairing.length - 1][0]) ? Math.max(fTopBody(x), fFair(x)) : fTopBody(x);
  const SECS = RF.sections.map(s => ({ x: s.x, s: s.s === 'circle' ? Array.from({ length: 21 }, (_, i) => { const t = 2 * i / 20 - 1; return Math.sqrt(Math.max(0, 1 - t * t)); }) : s.s }));
  function secShape(x) { // normalizovaný tvar řezu s(ζ) – lineární prolnutí sousedních řezů
    if (x <= SECS[0].x) return SECS[0].s;
    for (let i = 0; i < SECS.length - 1; i++) {
      const a = SECS[i], b = SECS[i + 1];
      if (x <= b.x) { const t = sm(0, 1, (x - a.x) / (b.x - a.x)); return a.s.map((v, j) => v + (b.s[j] - v) * t); }
    }
    return SECS[SECS.length - 1].s;
  }
  const sAt = (S, z) => { const f = Math.min(20, Math.max(0, z * 20)), i = Math.min(19, Math.floor(f)), t = f - i; return S[i] + (S[i + 1] - S[i]) * t; };

  // ---------- křídlo (G3, G4, G6)
  const leLin = y => RW.le.x0 + RW.le.k * y;
  const yR = RW.tipRoundFrom, xTipLE = 51.8; // [P] zaoblení náběžné hrany konce
  const WING = {
    semi: RW.semi,
    le: y => { y = Math.abs(y); if (y <= yR) return leLin(y); const t = Math.min(1, (y - yR) / (RW.semi - yR)); return leLin(y) + (xTipLE - leLin(RW.semi)) * (1 - Math.sqrt(1 - t * t)); },
    te: y => { y = Math.abs(y); return y <= RW.teInner.yEnd ? RW.teInner.x : RW.teOuter.x0 + RW.teOuter.k * (y - RW.teOuter.y0); },
    z: y => RW.z.z0 - RW.z.k * Math.abs(y),
    tr: y => { y = Math.abs(y); const T0 = RW.thickness; return y <= RW.teInner.yEnd ? T0.root + (T0.kink - T0.root) * y / RW.teInner.yEnd : T0.kink + (T0.tip - T0.kink) * (y - RW.teInner.yEnd) / (RW.semi - RW.teInner.yEnd); },
  };
  WING.c = y => WING.te(y) - WING.le(y);
  const tD = pchip(RW.tDist);
  // profil: le, c, z (střední čára u náběžné hrany), th = tloušťka, cam = prohnutí, hMin = min. poloviční tloušťka zadní části
  function airfoil(le, c, z0, th, cam, hMin) {
    const N = 18, up = [], lo = [];
    for (let i = 0; i <= N; i++) {
      const xx = (1 - Math.cos(Math.PI * i / N)) / 2, mc = z0 + cam * c * 4 * xx * (1 - xx);
      let h = 0.5 * th * tD(xx); if (xx > 0.5) h = Math.max(h, hMin || 0);
      up.push([le + xx * c, mc + h]); lo.push([le + xx * c, mc - h]);
    }
    return up.concat(lo.reverse().slice(1, -1));
  }

  // ---------- ocasní plochy
  const STAB = { le: y => RS.le.x0 + RS.le.k * Math.abs(y), te: y => RS.te.x0 + RS.te.k * Math.abs(y), semi: RS.semi, z: RS.z };
  STAB.c = y => STAB.te(y) - STAB.le(y);
  const FIN = [[RN.bottom.le, RN.bottom.z], [RN.atStab.le, RN.atStab.z], [RN.top.le, RN.top.z], [RN.top.te, RN.top.z], [RN.atStab.te, RN.atStab.z], [RN.bottom.te, RN.bottom.z]];
  const finChord = z => { const lerp = (a, b) => { const t = (z - a.z) / (b.z - a.z); return [a.le + (b.le - a.le) * t, a.te + (b.te - a.te) * t]; }; const [l, t] = z >= RN.atStab.z ? lerp(RN.atStab, RN.top) : lerp(RN.bottom, RN.atStab); return t - l; };

  // ---------- sestavení modelu
  // p = {L (cm), P (mm rozestup), T (mm), CW (mm pásnice), nS, nW, bed:[max,min] mm}
  // out.part(group, pts, O, U, V, opts) ; out.joint(point, size, kind) ; out.count(group, name, w, h, n)
  function buildModel(p, out) {
    const k = 10 * p.L / 84;            // mm na metr
    const T = p.T, pm = p.P / k, tm = T / k, cw = p.CW / k, seg = (p.bed[0] - 20) / k;
    const part = out.part, jn = out.joint;
    const lam = (g, pts, O, U, V, offs, o) => { const N = crs(U, V); offs.forEach((d, i) => part(g, pts, add(O, N, d * tm), U, V, i && o && o.name ? Object.assign({}, o) : o)); };

    // výškovka 2 vrstvy (K6) leží na hřbetě; hřbet v oblasti kořene výškovky dorovnán k její spodní ploše
    const tS = 2 * tm, SZ = STAB.z, sx0 = STAB.le(0), sx1 = STAB.te(0);
    const stabPlate = x => sm(sx0 - 1.5, sx0, x) * (1 - sm(sx1, sx1 + 1.5, x));
    const top = x => Math.max(fFairTop(x), fTopBody(x) + (SZ - tS / 2 - fTopBody(x)) * stabPlate(x));
    const bot = fBot;
    const hwAt = (x, z) => { const H = top(x) - bot(x); return H <= 0 ? 0 : sAt(secShape(x), (z - bot(x)) / H) * fW(x); };

    // páteř (2 vrstvy) – dělení mezi dvěma žebry
    const x0 = pm / 2 + 0.25, ribX = [];
    for (let x = x0; x < XE - 0.3; x += pm) ribX.push(x);
    const mid = x => x0 + (Math.max(0, Math.round((x - x0) / pm - 0.5)) + 0.5) * pm; // poloha mezi dvěma žebry
    sym(p.nS).forEach((d, i) => {
      const cuts = [0];
      if (XE > seg) for (let c = seg * (0.5 + i / (2 * p.nS)); c < XE - 0.3; c += seg) cuts.push(mid(c));
      cuts.push(XE);
      for (let j = 0; j < cuts.length - 1; j++) part('sp', prof(cuts[j], cuts[j + 1], top, bot, 0.3), [0, d * tm, 0], [1, 0, 0], [0, 0, 1], { name: 'Páteř' });
    });

    // osa nosníku křídla: centroplán přes trup (přímý, příčný) mezi kořenovými žebry ±aK, dál přímá šípová
    //   v ose 35 % hloubky [D], u konce (aS) 42 % – dál od zaoblené náběžné hrany, aby se pásnice vešla do koncového žebra
    const aS = WING.semi - 0.6, sp0 = WING.le(0) + RW.spar * WING.c(0), sp1 = WING.le(aS) + 0.42 * WING.c(aS);
    const aK = Math.max(fW(sp0) + 0.35, 3.9);
    const sxC = sp0 + (sp1 - sp0) * aK / aS, slope = (sp1 - sxC) / (aS - aK), cosP = 1 / Math.hypot(1, slope);
    const sx = a => { a = Math.abs(a); return a <= aK ? sxC : sxC + slope * (a - aK); };

    // žebra trupu – tvar z řezů výkresu (G2), výška z bokorysu, šířka z půdorysu
    const NZ = 40;
    for (const x of ribX) {
      const b = bot(x), t = top(x), H = t - b, S = secShape(x), w = fW(x);
      if (H < 0.4 || w < 0.3) continue;
      if (Math.abs(x - sxC) < cw / 2 + tm + 0.05) continue;   // místo zabírá centroplán (stojina + kýl)
      const R = [];
      for (let i = 0; i <= NZ; i++) { const z = i / NZ; R.push([Math.max(0.02, sAt(S, z) * w), b + z * H]); }
      const pts = R.concat(R.slice().reverse().map(q => [-q[0], q[1]]));
      part('rb', pts, [x, 0, 0], [0, 1, 0], [0, 0, 1], { name: 'Žebro trupu' });
    }

    // boční podélníky trupu (K5): vodorovné pásy v rovině zs, zasunuté do bočních zářezů žeber
    const zs = 3.8, wS = 10 / k, xs0 = 0.6, xs1 = (() => { let x = 40; while (x < XE && bot(x) < zs - 0.4) x += 0.1; return x - 0.6; })();
    for (const sg of [1, -1]) {
      const outer = [], inner = [];
      for (let x = xs0; x <= xs1 + 1e-6; x += 0.25) { const yo = hwAt(x, zs); outer.push([x, sg * yo]); inner.push([x, sg * Math.max(0.05, yo - wS)]); }
      part('rf', outer.concat(inner.reverse()), [0, 0, zs], [1, 0, 0], [0, 1, 0], { name: 'Podélník trupu' });
    }

    // ---------- křídlo
    // Nosník: centroplán přes trup (přímý, bez vzepětí) mezi kořenovými žebry ±aK, dál přímý šípový se vzepětím.
    // Horní a dolní pásnice v 1 vrstvě, zapuštěné do žeber (lícují s obrysem profilu) a se zářezy pro žebra.
    // Kořen: uvnitř trupu pod dolní pásnicí kýl (lepený na pásnici) – nosník je tam ~2,5× vyšší než profil.
    const W = WING, clamp = v => Math.min(1, Math.max(0, v));
    const th = a => Math.max(W.tr(a) * W.c(a), RULES.wingMinThick / k);
    const hMin = RULES.teMin / 2 / k;
    const camAt = (a, xx) => RW.camber * W.c(a) * 4 * xx * (1 - xx);
    const ae = a => Math.max(Math.abs(a), aK);                  // centroplán má profil kořenového žebra
    const surf = (a, x, s) => { a = ae(a); const c = W.c(a), xx = clamp((x - W.le(a)) / c); let h = 0.5 * th(a) * tD(xx); if (xx > 0.5) h = Math.max(h, hMin); return W.z(a) + camAt(a, xx) + s * h; };
    const foil = a => airfoil(W.le(ae(a)), W.c(ae(a)), W.z(ae(a)), th(ae(a)), RW.camber, hMin);
    const sTop = a => surf(a, sx(a), 1), sBot = a => surf(a, sx(a), -1);
    const szc = a => (sTop(a) + sBot(a)) / 2, hS = a => (sTop(a) - sBot(a)) / 2;

    // žebra: kořenové (aK, celé) … koncové (aTip, celé), mezi nimi pravidelně půlžebra
    let aTip = W.semi - tm / 2;                                  // koncové žebro: pásnice nesmí přečnívat náběžnou hranu (≥ 2 mm)
    while (aTip > yR && sx(aTip) - W.le(aTip) < RULES.flangeTip * cw / 2 / cosP + 2 / k) aTip -= 0.05;
    const nB = Math.max(2, Math.round((aTip - aK) / pm)), pw = (aTip - aK) / nB;
    const ribA = Array.from({ length: nB + 1 }, (_, i) => aK + i * pw);
    const webH = p.nW * tm / 2 + 0.02, dxw = webH / cosP;
    // pásnice se ke konci zužuje (ohybový moment klesá k nule) – u konce zůstane víc z rybí kosti
    const cwA = a => cw * (1 - (1 - RULES.flangeTip) * clamp((Math.abs(a) - aK) / (aTip - aK)));
    const ndA = a => Math.max(0, Math.min(RULES.flangeNotch, (cwA(a) * k - p.nW * T - 2 * RULES.tool) / 2)) / k; // zářez od okraje
    const fcxA = a => (cwA(a) / 2 - ndA(a)) / cosP;              // plné jádro pásnice v rovině žebra (podél x)
    const wL = RULES.stripW / k, ndL = RULES.stripNotch / k;     // pomocná lišta v 65 % hloubky (spodní strana)
    const xL = a => W.le(a) + 0.65 * W.c(a);
    const cosL = a => 1 / Math.hypot(1, (xL(Math.abs(a) + 0.05) - xL(Math.abs(a) - 0.05)) / 0.1);
    // lišta končí na žebru, za kterým by se už nevešla za dolní pásnici (mezera ≥ 3 mm)
    let iL = 0; while (iL < nB && (xL(ribA[iL + 1]) - wL / 2 / cosL(ribA[iL + 1])) - (sx(ribA[iL + 1]) + cwA(ribA[iL + 1]) / 2 / cosP) >= 3 / k) iL++;
    const aLe = ribA[iL];

    // rovinný pás (pásnice, lišta) mezi body A–B střednice, šířka 2·hw, zářezy hloubky nd pro žebra v rovinách y = Y
    const stripSeg = (name, A, B, hw0, hw1, nd, Ys) => {
      const U = nrm(sub(B, A)), V = nrm(crs([0, 0, 1], U)), len = Math.hypot(...sub(B, A)), dh = (hw1 - hw0) / len;
      const uAt = (Y, s, d) => (Y - A[1] - V[1] * s * (hw0 - d)) / (U[1] + V[1] * s * dh); // průsečík roviny žebra s okrajem (d = odsazení dovnitř)
      const vAt = (u, s, d) => s * (hw0 + dh * u - d);
      const edge = s => {
        const pts = [[-1, vAt(-1, s, 0)]];
        if (nd > 0) for (const Y of Ys) {
          const o = [uAt(Y - tm / 2, s, 0), uAt(Y + tm / 2, s, 0)].sort((a, b) => a - b);
          const i = [uAt(Y - tm / 2, s, nd), uAt(Y + tm / 2, s, nd)].sort((a, b) => a - b);
          pts.push([o[0], vAt(o[0], s, 0)], [i[0], vAt(i[0], s, nd)], [i[1], vAt(i[1], s, nd)], [o[1], vAt(o[1], s, 0)]);
        }
        pts.push([len + 1, vAt(len + 1, s, 0)]); return pts.sort((a, b) => a[0] - b[0]);
      };
      const poly = clipX(clipX(edge(-1).concat(edge(1).reverse()), 0, false), len, true);
      part('rf', poly, A, U, V, { noCount: true, name });
    };
    const ribsIn = (a0, a1, sg) => ribA.filter(r => r + tm / 2 > a0 && r - tm / 2 < a1).map(r => sg * r);
    const bnd = [aK].concat(ribA.slice(0, -1).map((r, i) => (r + ribA[i + 1]) / 2), [aTip + tm / 2]);

    // stojiny: centroplán (příčná rovina) + šípové stojiny vnějších křídel, bez zářezů; začínají/končí na plochách žeber
    const sides = {};
    for (const sg of [1, -1]) {
      const Pk = [sxC, sg * aK, szc(aK)], Pt = [sx(aTip), sg * aTip, szc(aTip)], U = nrm(sub(Pt, Pk));
      const V = nrm([-U[2] * U[0], -U[2] * U[1], 1 - U[2] * U[2]]);
      let N = crs(U, V); if (N[0] > 0) N = N.map(v => -v);
      const S = sides[sg] = { Pk, U, V, N, a2u: Math.hypot(...sub(Pt, Pk)) / (aTip - aK) };
      const off = u => (szc(aK + u / S.a2u) - add(Pk, U, u)[2]) / V[2], hv = u => (hS(aK + u / S.a2u) - tm) / V[2];
      const u0 = tm / 2 * S.a2u, u1 = (aTip - aK - tm / 2) * S.a2u;
      const pts = prof(u0, u1, u => off(u) + hv(u), u => off(u) - hv(u), (u1 - u0) / 30);
      sym(p.nW).forEach(d => part('sw', pts, add(Pk, N, d * tm), U, V, { name: 'Stojina nosníku' }));
    }
    const a2u = sides[1].a2u, yC = aK - tm / 2, zTi = sTop(aK) - tm, zBi = sBot(aK) + tm, zBo = sBot(aK);
    lam('sw', [[-yC, zBi], [yC, zBi], [yC, zTi], [-yC, zTi]], [sxC, 0, 0], [0, 1, 0], [0, 0, 1], sym(p.nW), { name: 'Stojina centroplánu' });
    // kýl centroplánu: pod dolní pásnicí, uvnitř průřezu trupu (odstup 8 mm od obrysu), nad bočními podélníky
    const mIn = 8 / k, zDeep = Math.max(zs + 0.9, szc(aK) - 4 * hS(aK));
    const yKz = z => { let m = yC; for (let q = z; q <= zBo + 1e-6; q += 0.05) m = Math.min(m, hwAt(sxC, q) - mIn); return Math.max(0, m); };
    const KL = []; for (let i = 0; i <= 16; i++) { const z = zDeep + (zBo - zDeep) * i / 16; KL.push([yKz(z), z]); }
    lam('sw', KL.concat(KL.slice().reverse().map(q => [-q[0], q[1]])), [sxC, 0, 0], [0, 1, 0], [0, 0, 1], sym(p.nW), { name: 'Kýl centroplánu' });
    const keelH = y => { y = Math.abs(y); const q = KL.find(q => q[0] >= y); return q ? (zBo - q[1]) : 0; };
    jn([sxC, 0, zBi], 1.6, 'spar');

    // pásnice: jeden díl nahoře a jeden dole (2 ohyby 5,6° na kořenových žebrech); vizualizace po polích mezi žebry
    for (const s of [1, -1]) {
      const zf = a => s > 0 ? sTop(a) - tm / 2 : sBot(a) + tm / 2;
      stripSeg('Pásnice nosníku', [sxC, -aK, zf(aK)], [sxC, aK, zf(aK)], cw / 2, cw / 2, ndA(aK), [-aK, aK]);
      for (const sg of [1, -1]) for (let j = 0; j < bnd.length - 1; j++)
        stripSeg('Pásnice nosníku', [sx(bnd[j]), sg * bnd[j], zf(bnd[j])], [sx(bnd[j + 1]), sg * bnd[j + 1], zf(bnd[j + 1])], cwA(bnd[j]) / 2, cwA(bnd[j + 1]) / 2, ndA((bnd[j] + bnd[j + 1]) / 2), ribsIn(bnd[j], bnd[j + 1], sg));
    }
    const vW = 2 * (aTip + tm / 2) * k + p.CW, vH = (sx(aTip) - sxC) * k + p.CW * 1.2;
    out.count('rf', 'Pásnice nosníku (horní, dolní)', vW, vH, 2);
    // pomocná lišta: v 65 % hloubky, zapuštěná do spodních hran žeber, se zářezy pro žebra
    const bL = [aK - tm / 2].concat(bnd.slice(1, iL + 1), [aLe + tm / 2]);
    for (const sg of [1, -1]) for (let j = 0; j < bL.length - 1; j++) {
      const P = a => [xL(a), sg * a, surf(a, xL(a), -1) + tm / 2];
      stripSeg('Pomocná lišta křídla', P(bL[j]), P(bL[j + 1]), wL / 2, wL / 2, ndL, ribsIn(bL[j], bL[j + 1], sg));
    }
    out.count('rf', 'Pomocná lišta křídla', (aLe - aK + tm) * k * 1.02, (xL(aLe) - xL(aK)) * k + RULES.stripW, 2);

    // žebra: obrys profilu, v místě pásnic a lišty snížený o tloušťku (lože); zářezy pásnic vyplní plné zuby žebra
    const ribPoly = (a, xA, xB, rebT, rebB) => {
      const inI = (L, x) => L.some(([p0, p1]) => x > p0 + 1e-6 && x < p1 - 1e-6);
      const le = W.le(ae(a)), c = W.c(ae(a)), xs = new Set([xA, xB]);
      for (let i = 0; i <= 24; i++) { const x = le + c * (1 - Math.cos(Math.PI * i / 24)) / 2; if (x > xA && x < xB) xs.add(x); }
      for (const [p0, p1] of rebT.concat(rebB)) for (const x of [p0 - 1e-4, p0 + 1e-4, p1 - 1e-4, p1 + 1e-4]) if (x > xA && x < xB) xs.add(x);
      const X = [...xs].sort((u, v) => u - v);
      const tp = X.map(x => [x, surf(a, x, 1) - (inI(rebT, x) ? tm : 0)]), bt = X.map(x => [x, surf(a, x, -1) + (inI(rebB, x) ? tm : 0)]).reverse();
      if (Math.abs(bt[bt.length - 1][1] - tp[0][1]) < 1e-6) bt.pop();
      return tp.concat(bt);
    };
    for (const sg of [1, -1]) ribA.forEach((a, i) => {
      const xs = sx(a), fcx = fcxA(a), cl = (wL / 2 - ndL) / cosL(a), L = i <= iL ? [[xL(a) - cl, xL(a) + cl]] : [];
      const O = [0, sg * a, 0], le = W.le(a), te = W.te(a);
      if (i === 0 || i === nB) {
        const F = [[xs - fcx, xs + fcx]];
        part('wg', ribPoly(a, le, te, F, F.concat(L)), O, [1, 0, 0], [0, 0, 1], { name: i ? 'Koncové žebro' : 'Kořenové žebro' });
      } else {
        part('wg', ribPoly(a, le, xs - dxw, [[xs - fcx, xs + 1]], [[xs - fcx, xs + 1]]), O, [1, 0, 0], [0, 0, 1], { name: 'Půlžebro křídla přední' });
        part('wg', ribPoly(a, xs + dxw, te, [[xs - 1, xs + fcx]], [[xs - 1, xs + fcx]].concat(L)), O, [1, 0, 0], [0, 0, 1], { name: 'Půlžebro křídla zadní' });
      }
    });

    const emid = e => aK + (Math.round((e - aK) / pw - 0.5) + 0.5) * pw; // motor přesně mezi dvě žebra
    const ENG = RE.y.map(emid);
    const EN = [], PY = [];
    let kp = null;
    const nfs = Math.max(0, Math.floor(((pw * k - T) / T - 2) / 2)); // výplně mezi jazýčkem pylonu a žebry
    for (const sg of [1, -1]) {
      // gondoly + pylony: pylon nasazen zespodu výřezem na nosník (lepí se), prstence 1 vrstva, výřezy 50/50
      RE.y.forEach((_, i) => {
        const e = ENG[i], le = W.le(e), cE = W.c(e), xa = le - RE.intakeAhead, xb = xa + RE.length, ze = RE.zAxis[i], R0 = RE.diameter / 2;
        const r = x => { const t = (x - xa) / RE.length; const v = t < 0.1 ? 0.86 + 0.14 * Math.sqrt(Math.max(0, t) / 0.1) : t < 0.6 ? 1 : 1 - 0.45 * Math.pow((t - 0.6) / 0.4, 1.3); return R0 * v; };
        EN.push({ e: sg * e, xa, xb, ze, r });
        const xsE = sx(e), fwx = cwA(e) / 2 / cosP + 0.03;
        const ta = le + 0.25, tb = xsE - fwx, tc = xsE + fwx, td = le + 0.72 * cE;
        const hasL = e < aLe, sL0 = hasL ? xL(e) - wL / 2 / cosL(e) - 0.03 : 1e9, sL1 = hasL ? xL(e) + wL / 2 / cosL(e) + 0.03 : 1e9, xF = Math.min(sL0 - 0.3, td); // lišta prochází nad lůžkem v zadním jazýčku
        const xP0 = le - 2.6, xP1 = le + 0.35;                 // náběžná hrana pylonu: plynule z gondoly do náběžné hrany křídla
        const wl = x => surf(e, x, -1), wu = x => surf(e, x, 1) - 0.05;
        const inT = x => (x >= ta && x <= tb) || (x >= tc && x <= td);
        const xEnd = td;
        const zlF = x => x <= xb ? ze - r(x) : x <= xF ? ze + r(xb) * 0.3 + (wl(xF) - ze - r(xb) * 0.3) * (x - xb) / Math.max(0.01, xF - xb) : wl(x) + (x > sL0 && x < sL1 ? tm : 0);
        const zuF = x => {
          const g = x <= xb ? ze + r(x) : null;
          if (x < xP0) return g;
          if (x < ta) return g == null ? wl(x) : g + (wl(x) - g) * sm(xP0, xP1, x);
          if (x <= td) return inT(x) ? wu(x) : wl(x);               // mezi jazýčky výřez pro nosník (dosedá na dolní pásnici)
          return wl(x);
        };
        const XR = []; for (let x = xa + 0.3; x <= xb - 0.45; x += pw) XR.push(x);   // prstence v rozestupu žeber
        const hs = tm / 2 + RULES.slotClear / k / 2;                                   // výřez gondoly pro prstenec (1 vrstva)
        const xsS = []; for (let x = xa; x <= xEnd + 1e-6; x += 0.1) xsS.push(x);
        [ta, tb, tc, td, xF, sL0, sL1].forEach(v => xsS.push(v - 1e-4, v + 1e-4));
        const X = xsS.filter(x => x >= xa && x <= xEnd).sort((a, b) => a - b);
        const up = X.map(x => [x, zuF(x)]);
        const lo = [];                                                                 // spodní obrys s výřezy zdola do osy
        for (const x of X) {
          for (const c of XR) if (c - hs < x && (lo.length === 0 || lo[lo.length - 1][0] < c - hs)) lo.push([c - hs, zlF(c - hs)], [c - hs, ze], [c + hs, ze], [c + hs, zlF(c + hs)]);
          if (!XR.some(c => Math.abs(x - c) <= hs)) lo.push([x, zlF(x)]);
        }
        lam('en', up.concat(lo.reverse()), [0, sg * e, 0], [1, 0, 0], [0, 0, 1], [-0.5, 0.5], { name: 'Gondola + pylon' });
        const fo = []; for (let j = 1; j <= nfs; j++) fo.push(0.5 + j, -(0.5 + j));
        const tmid = (ta + tb) / 2, h0 = wl(tmid), h1 = wu(tmid), h0r = wl((tc + td) / 2), h1r = wu((tc + td) / 2);
        if (fo.length) for (const [u0, u1] of [[ta, tb], [tc, td]])
          lam('rf', [[u0, wl(u0) + (u1 > sL0 ? tm : 0) + 0.03], [u1, wl(u1) + (u1 > sL0 ? tm : 0) + 0.03], [u1, wu(u1)], [u0, wu(u0)]], [0, sg * e, 0], [1, 0, 0], [0, 0, 1], fo, { name: 'Výplň pylonu' });
        jn([xsE, sg * e, wl(xsE)], 1, 'pylon');
        if (sg > 0) PY.push({ e, arm: ((h0 + h1) / 2 - (ze - R0)) * k, armRoot: (wl(xsE) - (ze - R0)) * k, t: 2 * T,
          Wglue: 2 * ((tb - ta) * k * ((h1 - h0) * k) ** 2 + (td - tc) * k * ((h1r - h0r) * k) ** 2) / 6, Lp: (td - xP1) * k });
        // prstence (tělo motoru): 1 vrstva, výřez shora do osy pro gondolu (gondola má výřez zdola do osy)
        const hg = tm + RULES.slotClear / k / 2;
        for (const x of XR) {
          const rr = r(x), cy = sg * e, q0 = Math.asin(Math.min(0.95, hg / rr)), c = [[cy + hg, ze]];
          for (let j = 0; j <= 40; j++) { const q = Math.PI / 2 - q0 - j / 40 * (2 * Math.PI - 2 * q0); c.push([cy + rr * Math.cos(q), ze + rr * Math.sin(q)]); }
          c.push([cy - hg, ze]);
          part('en', c, [x, 0, 0], [0, 1, 0], [0, 0, 1], { name: 'Prstenec gondoly' });
        }
      });

      // výškovka – jeden díl přes celé rozpětí, 2 vrstvy (K6); vizualizace po polovinách
      const FY = STAB.semi, tipA = FY + tm, pl = [];
      for (let a = 0; a <= tipA + 1e-6; a += tipA / 8) pl.push([STAB.le(Math.min(a, FY)), a]);
      for (let a = tipA; a >= -1e-6; a -= tipA / 8) pl.push([STAB.te(Math.min(a, FY)), a]);
      const plY = pl.map(q => [q[0], sg * q[1]]);
      lam('tl', plY, [0, 0, SZ], [1, 0, 0], [0, 1, 0], [-0.5, 0.5], sg < 0 ? { noCount: true, name: 'Výškovka' } : { name: 'Výškovka', dims: [2 * tipA * k, STAB.c(0) * k] });
      // kýlovky – 2 vrstvy, vodorovný zářez od odtokové hrany pro výškovku
      kp = FIN.map(q => q.slice());
      lam('tl', kp, [0, sg * FY, 0], [1, 0, 0], [0, 0, 1], [-0.5, 0.5], { name: 'Kýlovka' });
      // výztuhy spoje kýlovka–výškovka (K7): 2 trojúhelníky z vnitřní strany (nad a pod výškovkou)
      const g = RULES.gusset / k, xg = (STAB.le(FY) + STAB.te(FY)) / 2;
      for (const ud of [1, -1]) {
        const y0 = sg * (FY - tm), z0 = SZ + ud * tS / 2;
        part('tl', [[y0, z0], [y0 - sg * g, z0], [y0, z0 + ud * g]], [xg, 0, 0], [0, 1, 0], [0, 0, 1], { name: 'Výztuha kýlovky' });
      }
      jn([xg, sg * FY, SZ], 1.2, 'fin');

      // podvozek (G5, K10): podélné pásy zasazené do žeber trupu, 7 kol
      const wr = RG.wheelR, wcx = RG.mainX, yT = 2.6;
      const gx0 = wcx[0] - 1.0, gx1 = wcx[wcx.length - 1] + 1.0;
      const bz = x => { let z = wr + 0.12; for (const c of wcx) { const d = x - c; if (Math.abs(d) < wr) z = Math.min(z, wr - Math.sqrt(wr * wr - d * d)); } return z; };
      lam('gr', prof(gx0, gx1, x => bot(x) + 1.1, bz, 0.06), [0, sg * yT, 0], [1, 0, 0], [0, 0, 1], [-0.5, 0.5], { name: 'Podvozkový pás' });
    }
    jn([(sx0 + sx1) / 2, 0, SZ - tS / 2], 1.2, 'stab');
    const wcx = RG.mainX;
    for (const xr of [wcx[1], (wcx[3] + wcx[4]) / 2, wcx[5] + 0.4]) {
      const x = mid(xr);
      lam('gr', [[-3.1, bot(x) - 0.25], [3.1, bot(x) - 0.25], [3.1, bot(x) + 0.9], [-3.1, bot(x) + 0.9]], [x, 0, 0], [0, 1, 0], [0, 0, 1], [-0.5, 0.5], { name: 'Příčník podvozku' });
      jn([x, 0, bot(x) + 0.3], 1.3, 'gear'); jn([x, 2.6, bot(x) + 0.3], 1, 'gearX'); jn([x, -2.6, bot(x) + 0.3], 1, 'gearX');
    }
    const xn = mid(RG.noseX), nr = RG.noseR;
    const nb = y => { let z = nr + 0.12; for (const c of [-0.6, 0.6]) { const d = y - c; if (Math.abs(d) < nr) z = Math.min(z, nr - Math.sqrt(nr * nr - d * d)); } return z; };
    lam('gr', prof(-1.25, 1.25, () => bot(xn) + 0.9, nb, 0.06), [xn, 0, 0], [0, 1, 0], [0, 0, 1], [-0.5, 0.5], { name: 'Příďová noha' });
    jn([xn, 0, bot(xn) + 0.4], 1.3, 'nose');

    // ---------- popis nosné konstrukce pro výpočet namáhání (mm, N) – viz js/stress.js
    const FY = STAB.semi, gmm = RULES.gusset;
    const struct = {
      k, T,
      wing: {
        semi: aTip, aK, ribs: ribA.length,
        lever: a => Math.max(0, aTip - Math.abs(a)) * a2u * k,
        // průřez: pásnice (v místě zářezu jen jádro), stojiny, v centroplánu navíc kýl pod dolní pásnicí
        sec: a => {
          a = Math.abs(a);
          const inC = a < aK, aa = inC ? aK : a, hs = hS(aa) * k, zc = szc(aa) * k, bF = inC ? p.CW : (cwA(a) - 2 * ndA(a)) * k, tW = p.nW * T;
          const R = [[bF, T, zc + hs - T / 2], [bF, T, zc - hs + T / 2], [tW, 2 * hs - 2 * T, zc]];
          const hk = inC ? keelH(a) * k : 0; if (hk > 0) R.push([tW, hk, zc - hs - hk / 2]);
          const A = R.reduce((s, r) => s + r[0] * r[1], 0), zn = R.reduce((s, r) => s + r[0] * r[1] * r[2], 0) / A;
          const I = R.reduce((s, r) => s + r[0] * r[1] ** 3 / 12 + r[0] * r[1] * (r[2] - zn) ** 2, 0);
          const e = Math.max(zc + hs - zn, zn - (zc - hs - hk));
          return { W: I / e, h: hs * 2 + hk, what: inC ? (hk > 0 ? 'centroplán: I-nosník + kýl pod pásnicí, výška ' + Math.round(hs * 2 + hk) + ' mm' : 'centroplán: I-nosník') : 'I-nosník, pásnice ' + (cwA(a) * k).toFixed(0) + ' mm se zářezy (jádro ' + bF.toFixed(0) + ' mm)' };
        },
      },
      stab: { FY, t: 2 * T, chord: y => STAB.c(Math.min(Math.abs(y), FY)) * k, zTop: RN.top.z, zStab: SZ },
      fin: { t: 2 * T, chord: z => finChord(Math.min(Math.max(z, SZ), RN.top.z)) * k, zTop: RN.top.z, zStab: SZ, zBot: RN.bottom.z },
      finJoint: { L: STAB.c(FY) * k, b: 2 * T, extra: 2 * T * gmm * gmm / 6, what: 'zářez kýlovky + 2 výztuhy ' + gmm + ' mm' },
      spine: { t: p.nS * T, hNet: x => Math.max(0.1, (top(x) - bot(x)) * k * 0.6), xSupport: (wcx[0] + wcx[wcx.length - 1]) / 2, xFin: (RN.top.le + RN.top.te) / 2, xA0: sx0, xA1: sx1 },
      pylons: PY.map(q => Object.assign(q, { what: 'vidlice pylonu: 2 jazýčky na celou výšku profilu kolem nosníku' })),
      gear: { t: 2 * T, hUnder: 0.25 * k, arm: 2.6 * k, nCross: 3, ribsCarry: true, what: 'pásy zasazené do žeber trupu (K10)' },
    };
    return { k, kp, EN, SZ, tS, wcx, wr: RG.wheelR, xn, nr, th, foil, struct, top, ribA, aK, aTip, aLe, sxC, sx, Pc: [sxC, 0, szc(aK)], sp1 };
  }

  global.AN225 = { buildModel, fTop: x => Math.max(fFairTop(x), fTopBody(x)), fTopBody, fBot, fW, WING, STAB, FIN, airfoil, secShape, RULES, XE };
})(typeof window !== 'undefined' ? window : globalThis);
