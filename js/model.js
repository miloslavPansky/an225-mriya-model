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

    // žebra trupu – tvar z řezů výkresu (G2), výška z bokorysu, šířka z půdorysu
    const NZ = 40;
    for (const x of ribX) {
      const b = bot(x), t = top(x), H = t - b, S = secShape(x), w = fW(x);
      if (H < 0.4 || w < 0.3) continue;
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

    // ---------- křídlo: průběžný I-nosník bez zářezů (K1) + kořenová spojka (K2) + půlžebra
    const W = WING, yEnd = yR;                              // nosník končí na začátku zaoblení konce
    const th = a => Math.max(W.tr(a) * W.c(a), RULES.wingMinThick / k);
    const sp0 = W.le(0) + RW.spar * W.c(0), sp1 = W.le(yEnd) + RW.spar * W.c(yEnd);
    const wsx = a => sp0 + (sp1 - sp0) * Math.abs(a) / yEnd;  // přímý nosník v půdorysu
    const relS = a => (wsx(a) - W.le(a)) / W.c(a);
    const camAt = (a, xx) => RW.camber * W.c(a) * 4 * xx * (1 - xx);
    const wsz = a => W.z(a) + camAt(a, relS(a));
    const hW = a => 0.46 * th(a) * tD(relS(a));            // polovina výšky I-průřezu
    const Pc = [wsx(0), 0, wsz(0)];
    const sides = {};
    for (const sg of [1, -1]) {
      const Pt = [wsx(yEnd), sg * yEnd, wsz(yEnd)], U = nrm(sub(Pt, Pc)), V = nrm([-U[2] * U[0], -U[2] * U[1], 1 - U[2] * U[2]]);
      let N = crs(U, V); if (N[0] > 0) N = N.map(v => -v);
      sides[sg] = { U, V, N, Ls: Math.hypot(...sub(Pt, Pc)) };
    }
    const a2u = sides[1].Ls / yEnd, yK2 = 6.0;               // spojka pásnic v ose: ±6 m (2. vrstva, laminovaný ohyb)
    const tf = a => (Math.abs(a) < yK2 ? 2 : 1) * tm;
    for (const sg of [1, -1]) {
      const S = sides[sg], Ls = S.Ls;
      // stojiny: celá výška mezi pásnicemi, bez zářezů
      sym(p.nW).forEach(d => part('sw', prof(0, Ls, u => hW(u / a2u) - tf(u / a2u), u => -hW(u / a2u) + tf(u / a2u), Ls / 30),
        add(Pc, S.N, d * tm), S.U, S.V, { name: 'Stojina nosníku' }));
      const pt = (u, s) => add(add(Pc, S.U, u), S.V, s * hW(u / a2u));
      for (const s of [1, -1]) { // pásnice po segmentech (vyrábí se jako jeden V díl)
        const n = 24;
        for (let i = 0; i < n; i++) {
          const ua = Ls * i / n, ub = Ls * (i + 1) / n, A = pt(ua, s), B = pt(ub, s), Ua = nrm(sub(B, A));
          let Va = S.N.slice(); const pr = dot(Va, Ua); Va = nrm(Va.map((v, j) => v - pr * Ua[j]));
          const Nz = crs(Ua, Va), sgn = Nz[2] * s < 0 ? -1 : 1, len = Math.hypot(...sub(B, A));
          const nl = Math.abs((ua + ub) / 2 / a2u) < yK2 ? 2 : 1;
          for (let l = 0; l < nl; l++)
            part('rf', [[0, -cw / 2], [len, -cw / 2], [len, cw / 2], [0, cw / 2]], add(A, Nz, sgn * (l + 0.5) * tm), Ua, Va, { noCount: true, name: l ? 'Spojka pásnic' : 'Pásnice nosníku' });
        }
      }
    }
    const vW = 2 * yEnd * k + p.CW, vH = (sp1 - sp0) * k + p.CW * 1.2;  // rozvinutá V pásnice
    out.count('rf', 'Pásnice nosníku (V)', vW, vH, 2);
    out.count('rf', 'Spojka pásnic (V, střed)', 2 * yK2 * k + p.CW, (sp1 - sp0) * yK2 / yEnd * k + p.CW * 1.2, 2);
    lam('rf', prof(Pc[0] - 4.5, Pc[0] + 4.5, top, bot, 0.3), [0, 0, 0], [1, 0, 0], [0, 0, 1], [-(p.nS / 2 + 0.5), p.nS / 2 + 0.5], { name: 'Příložka páteře' });
    jn([Pc[0], 0, Pc[2]], 1.6, 'spar');

    // žebra: pravidelná, všechna jako přední + zadní půlžebro lepená na stojinu (stojina bez zářezů)
    const r0 = Math.max(fW(Pc[0]) + 0.35, 3.9), ribA = [];
    for (let a = r0; a < yEnd - 0.1; a += pm) ribA.push(a);
    const emid = e => r0 + (Math.round((e - r0) / pm - 0.5) + 0.5) * pm; // motor přesně mezi dvě žebra
    const ENG = RE.y.map(emid);
    const webH = (p.nW * tm) / 2 + 0.02, ux = sides[1].U[0] / Math.abs(sides[1].U[1]);
    const hMin = RULES.teMin / 2 / k;
    const foil = a => airfoil(W.le(a), W.c(a), W.z(a), th(a), RW.camber, hMin);
    const surf = (a, x, s) => { const c = W.c(a), xx = Math.min(1, Math.max(0, (x - W.le(a)) / c)); let h = 0.5 * th(a) * tD(xx); if (xx > 0.5) h = Math.max(h, hMin); return W.z(a) + camAt(a, xx) + s * h; };

    // pomocná spodní lišta (K3): v 65 % hloubky, zapuštěná do spodních hran žeber
    const aL0 = ribA[0], aL1 = ribA[ribA.length - 1], xL = a => W.le(a) + 0.65 * W.c(a), wL = 8 / k;

    const EN = [], PY = [];
    let kp = null;
    const nfs = Math.max(0, Math.floor(((p.P - p.T) / p.T - 2) / 2)); // výplně mezi jazýčkem pylonu a žebry
    for (const sg of [1, -1]) {
      for (const a of ribA) {
        const xsA = Pc[0] + a * ux, dx = webH / Math.abs(sides[1].U[1]), af = foil(a);
        part('wg', clipX(af, xsA - dx, true), [0, sg * a, 0], [1, 0, 0], [0, 0, 1], { name: 'Půlžebro křídla přední' });
        part('wg', clipX(af, xsA + dx, false), [0, sg * a, 0], [1, 0, 0], [0, 0, 1], { name: 'Půlžebro křídla zadní' });
      }
      {
        const A = [xL(aL0), sg * aL0, surf(aL0, xL(aL0), -1) + tm / 2], B = [xL(aL1), sg * aL1, surf(aL1, xL(aL1), -1) + tm / 2];
        const U = nrm(sub(B, A)), V = nrm(crs([0, 0, 1], U)), L = Math.hypot(...sub(B, A));
        part('rf', [[0, -wL / 2], [L, -wL / 2], [L, wL / 2], [0, wL / 2]], A, U, V, { name: 'Pomocná lišta křídla', dims: [L * k, 10] });
      }
      // gondoly + pylony (G5, K8, K9a)
      RE.y.forEach((_, i) => {
        const e = ENG[i], le = W.le(e), xa = le - RE.intakeAhead, xb = xa + RE.length, ze = RE.zAxis[i], R0 = RE.diameter / 2;
        const r = x => { const t = (x - xa) / RE.length; const v = t < 0.1 ? 0.86 + 0.14 * Math.sqrt(Math.max(0, t) / 0.1) : t < 0.6 ? 1 : 1 - 0.45 * Math.pow((t - 0.6) / 0.4, 1.3); return R0 * v; };
        EN.push({ e: sg * e, xa, xb, ze, r });
        // pylon jako vidlice (K8): přední a zadní jazýček na celou výšku profilu obepínají nosník
        const xsE = Pc[0] + e * ux, dxw = webH / Math.abs(sides[1].U[1]) + 0.02, cE = W.c(e);
        const ta = le + 0.25, tb = xsE - dxw - cw / 2, tc = xsE + dxw + cw / 2, td = le + 0.72 * cE; // pásnice přečnívá stojinu o cw/2
        const px0 = le - 1.0, wl = x => surf(e, x, -1), wu = x => surf(e, x, 1) - 0.05;
        const inT = x => (x >= ta && x <= tb) || (x >= tc && x <= td);
        const xEnd = Math.max(xb, td), up = [], lo = [];
        const xsS = []; for (let x = xa; x <= xEnd + 1e-6; x += 0.2) xsS.push(x);
        [ta, tb, tc, td, px0].forEach(v => xsS.push(v - 1e-4, v + 1e-4)); xsS.sort((a, b) => a - b);
        for (const x of xsS) {
          if (x < xa || x > xEnd) continue;
          const g = x <= xb ? ze + r(x) : null;
          let zu;
          if (x >= px0 && x <= td) zu = inT(x) ? wu(x) : wl(x) + (x < ta ? 0.05 : 0);    // mezi jazýčky: přilepeno ke spodní pásnici
          else zu = x <= xb ? g : wl(x);
          const zl = x <= xb ? ze - r(x) : ze + r(xb) * 0.3 + (wl(td) - 0.4 - ze - r(xb) * 0.3) * (x - xb) / Math.max(0.01, xEnd - xb);
          if (zu > zl + 0.05) { up.push([x, zu]); lo.push([x, zl]); }
        }
        lam('en', up.concat(lo.reverse()), [0, sg * e, 0], [1, 0, 0], [0, 0, 1], [-0.5, 0.5], { name: 'Gondola + pylon' });
        const fo = []; for (let j = 1; j <= nfs; j++) fo.push(0.5 + j, -(0.5 + j));
        const tmid = (ta + tb) / 2, h0 = wl(tmid), h1 = wu(tmid), h0r = wl((tc + td) / 2), h1r = wu((tc + td) / 2);
        if (fo.length) for (const [u0, u1] of [[ta, tb], [tc, td]])
          lam('rf', [[u0, wl(u0) + 0.03], [u1, wl(u1) + 0.03], [u1, wu(u1)], [u0, wu(u0)]], [0, sg * e, 0], [1, 0, 0], [0, 0, 1], fo, { name: 'Výplň pylonu' });
        jn([xsE, sg * e, wl(xsE)], 1, 'pylon');
        // lepení: dva jazýčky; efektivní plocha = součet průřezových modulů
        if (sg > 0) PY.push({ e, arm: ((h0 + h1) / 2 - (ze - R0)) * k, armRoot: (wl(xsE) - (ze - R0)) * k, t: 2 * T,
          Wglue: 2 * ((tb - ta) * k * ((h1 - h0) * k) ** 2 + (td - tc) * k * ((h1r - h0r) * k) ** 2) / 6, Lp: (td - px0) * k });
        for (const x of [xa + 0.35, xa + 3.0, xb - 0.9]) {  // prstence 2 vrstvy (K9a)
          const rr = r(x), c = []; for (let j = 0; j < 32; j++) { const q = j / 32 * 2 * Math.PI; c.push([sg * e + rr * Math.cos(q), ze + rr * Math.sin(q)]); }
          lam('en', c, [x, 0, 0], [0, 1, 0], [0, 0, 1], [-0.5, 0.5], { name: 'Prstenec gondoly' });
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
        semi: W.semi,
        lever: a => Math.max(0, W.semi - a) * a2u * k,
        sec: a => {
          const h2 = hW(a) * k, t = tf(a) * k, hw = 2 * (h2 - t);
          const I = p.nW * T * hw ** 3 / 12 + 2 * p.CW * t * (h2 - t / 2) ** 2;
          return { W: I / h2, what: 'průběžný I-nosník bez zářezů' + (Math.abs(a) < yK2 ? ' + spojka pásnic' : '') };
        },
      },
      stab: { FY, t: 2 * T, chord: y => STAB.c(Math.min(Math.abs(y), FY)) * k, zTop: RN.top.z, zStab: SZ },
      fin: { t: 2 * T, chord: z => finChord(Math.min(Math.max(z, SZ), RN.top.z)) * k, zTop: RN.top.z, zStab: SZ, zBot: RN.bottom.z },
      finJoint: { L: STAB.c(FY) * k, b: 2 * T, extra: 2 * T * gmm * gmm / 6, what: 'zářez kýlovky + 2 výztuhy ' + gmm + ' mm' },
      spine: { t: p.nS * T, hNet: x => Math.max(0.1, (top(x) - bot(x)) * k * 0.6), xSupport: (wcx[0] + wcx[wcx.length - 1]) / 2, xFin: (RN.top.le + RN.top.te) / 2, xA0: sx0, xA1: sx1 },
      pylons: PY.map(q => Object.assign(q, { what: 'vidlice pylonu: 2 jazýčky na celou výšku profilu kolem nosníku' })),
      gear: { t: 2 * T, hUnder: 0.25 * k, arm: 2.6 * k, nCross: 3, ribsCarry: true, what: 'pásy zasazené do žeber trupu (K10)' },
    };
    return { k, kp, EN, SZ, tS, wcx, wr: RG.wheelR, xn, nr, th, foil, struct, top, ribA, Pc, sp0, sp1, yEnd };
  }

  global.AN225 = { buildModel, fTop: x => Math.max(fFairTop(x), fTopBody(x)), fTopBody, fBot, fW, WING, STAB, FIN, airfoil, secShape, RULES, XE };
})(typeof window !== 'undefined' ? window : globalThis);
