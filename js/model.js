// An-225 Mrija – parametrická geometrie modelu "rybí kostra".
// Souřadnice skutečného letadla v metrech: x = od špičky přídě dozadu (0..84),
// y = do strany (+ pravé křídlo), z = nahoru od země (0 = země, výška SOP 18,1 m).
// Každý díl = 2D polygon [u,v] v metrech + rovina (počátek O, osy U, V). Tloušťka dílu = materiál.
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
  const yt1 = x => 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1015 * x * x * x * x); // NACA tloušťka (t=1)

  function airfoil(le, c, m0, th, cam) {
    const N = 16, up = [], lo = [];
    for (let i = 0; i <= N; i++) {
      const xx = (1 - Math.cos(Math.PI * i / N)) / 2, mc = m0 + cam * c * 4 * xx * (1 - xx), h = th * Math.max(yt1(xx), 0.02);
      up.push([le + xx * c, mc + h]); lo.push([le + xx * c, mc - h]);
    }
    return up.concat(lo.reverse().slice(1, -1));
  }
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

  // ---------- silueta trupu (podle fotografie UR-82060) ----------
  const SHAPE = {
    top: [[0, 4.6], [0.3, 5.6], [1.2, 6.9], [2.8, 8.3], [4.5, 9.3], [6.5, 9.95], [10, 10.1], [24, 10.15], [29, 10.8], [40, 10.9], [47, 10.4], [55, 10.1], [65, 9.95], [72, 9.75], [79, 9.55], [83.3, 9.35], [84, 8.9]],
    bot: [[0, 4.6], [0.3, 3.6], [1.2, 2.7], [2.8, 2.0], [5, 1.65], [8, 1.45], [12, 1.4], [52, 1.4], [58, 1.7], [64, 2.6], [70, 4.0], [75, 5.4], [79, 6.6], [82.6, 7.45], [84, 8.1]],
    halfWidth: [[0, 0.3], [0.3, 1.5], [1.2, 2.45], [2.8, 3.05], [5, 3.35], [8, 3.5], [54, 3.5], [62, 3.2], [70, 2.6], [76, 1.9], [81, 1.25], [84, 0.6]],
  };
  const fTop = pchip(SHAPE.top), fBot = pchip(SHAPE.bot), fW = pchip(SHAPE.halfWidth);
  const spn = x => sm(24, 31, x) * (1 - sm(52, 60, x)); // kryty podvozku (sponsony)
  const SPW = 1.1, SPH = 2.8;
  function fusPar(x) { const t = fTop(x), b = fBot(x), f = 0.34 + 0.11 * sm(0, 10, x); return [b, t, fW(x), b + f * (t - b)]; }

  // ---------- křídlo, ocas ----------
  const WING = {
    le: a => 27 + 0.7 * a,                // náběžná hrana, šíp ~35°
    c: a => 16 - 11.5 * a / 44.2,         // hloubka 16 → 4,5 m (plocha ~905 m²)
    z: a => 10.0 - 0.06 * a,              // záporná vzepjatost
    tr: a => 0.14 - 0.04 * a / 44.2,      // relativní tloušťka profilu
    semi: 44.2,
  };
  const STAB = { le: a => 68 + 0.7 * a, c: a => 9 - 4.5 * Math.min(a, 16.3) / 16.3, z0: 9.9, dih: 0.05, semi: 16.3 };
  const FIN_TOP = 18.1;

  // ---------- sestavení modelu ----------
  // p = {L (cm), P (mm rozestup), T (mm), CW (mm pásnice), nS, nW, bed:[max,min] mm}
  // out.part(group, pts, O, U, V, opts) ; out.joint(point, size, kind)
  function buildModel(p, out) {
    const k = 10 * p.L / 84;            // mm na metr
    const pm = p.P / k, tm = p.T / k, cw = p.CW / k, seg = (p.bed[0] - 20) / k;
    const part = out.part, jn = out.joint;
    const lam = (g, pts, O, U, V, offs, o) => { const N = crs(U, V); for (const d of offs) part(g, pts, add(O, N, d * tm), U, V, o); };

    const SZ = STAB.z0, inStab = x => x > 67.5 && x < 77.5;
    const top = x => Math.min(fTop(x), inStab(x) ? SZ - tm / 2 : 99), bot = fBot;

    // páteř
    const x0 = pm / 2 + 0.2, ribX = [];
    for (let x = x0; x < 83.8; x += pm) ribX.push(x);
    const mid = x => x0 + (Math.max(0, Math.round((x - x0) / pm - 0.5)) + 0.5) * pm; // poloha mezi dvěma žebry
    sym(p.nS).forEach((d, i) => {
      const cuts = [0];
      if (84 > seg) for (let c = seg * (0.5 + i / (2 * p.nS)); c < 84 - 0.3; c += seg) cuts.push(mid(c));
      cuts.push(84);
      for (let j = 0; j < cuts.length - 1; j++) part('sp', prof(cuts[j], cuts[j + 1], top, bot, 0.3), [0, d * tm, 0], [1, 0, 0], [0, 0, 1], { name: 'Páteř' });
    });

    // žebra trupu
    for (const x of ribX) {
      const [b, t, w, zw] = fusPar(x); if (t - b < 0.05) continue;
      const cap = inStab(x) ? SZ - tm / 2 : 99, pts = [];
      for (let i = 0; i < 52; i++) {
        const a = i / 52 * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a), n = s >= 0 ? 2.3 : 3.2, h = s >= 0 ? t - zw : zw - b;
        let y = w * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), z = zw + h * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
        if (z < b + SPH) y += Math.sign(y) * SPW * spn(x) * Math.sqrt((b + SPH - z) / SPH);
        pts.push([y, Math.min(z, cap)]);
      }
      part('rb', pts, [x, 0, 0], [0, 1, 0], [0, 0, 1], { name: 'Žebro trupu' });
    }

    // křídlo – nosník jako I-profil: stojiny (svislé, levá+pravá) + pásnice (vodorovné V, průběžné přes osu)
    const W = WING, wth = a => Math.max(W.tr(a) * W.c(a), 10 / k);
    const wsx = a => W.le(a) + 0.35 * W.c(a), wsz = a => W.z(a) + 0.02 * W.c(a) * 0.91;
    const r0 = 3.9, ribA = []; for (let a = r0; a < W.semi - 0.15; a += pm) ribA.push(a);
    const emid = e => r0 + (Math.round((e - r0) / pm - 0.5) + 0.5) * pm; // motor přesně mezi dvě žebra
    const ENG = [10, 16.5, 23].map(emid);
    const hW = a => 0.92 * wth(a) * yt1(0.35), Pc = [wsx(0), 0, wsz(0)], aC = ENG[0] + 1.2;
    const sides = {};
    for (const sg of [1, -1]) {
      const Pt = [wsx(W.semi), sg * W.semi, wsz(W.semi)], U = nrm(sub(Pt, Pc)), V = nrm([-U[2] * U[0], -U[2] * U[1], 1 - U[2] * U[2]]);
      let N = crs(U, V); if (N[0] > 0) N = N.map(v => -v);
      sides[sg] = { U, V, N, Ls: Math.hypot(...sub(Pt, Pc)) };
    }
    for (const sg of [1, -1]) {
      const S = sides[sg], Ls = S.Ls, a2u = Ls / W.semi;
      sym(p.nW).forEach(d => part('sw', prof(0, Ls, u => hW(u / a2u) - (u / a2u < aC ? tm : 0), u => -hW(u / a2u) + (u / a2u < aC ? tm : 0), Ls / 24),
        add(Pc, S.N, d * tm), S.U, S.V, { name: 'Stojina nosníku' }));
      const pt = (u, s) => add(add(Pc, S.U, u), S.V, s * hW(u / a2u));
      for (const s of [1, -1]) { // pásnice (vizualizace po segmentech – vyrábí se jako jeden V díl, mírně ohnutý)
        const n = 10;
        for (let i = 0; i < n; i++) {
          const ua = aC * a2u * i / n, ub = aC * a2u * (i + 1) / n, A = pt(ua, s), B = pt(ub, s), Ua = nrm(sub(B, A));
          let Va = S.N.slice(); const pr = dot(Va, Ua); Va = nrm(Va.map((v, j) => v - pr * Ua[j]));
          const Nz = crs(Ua, Va), sgn = Nz[2] * s < 0 ? -1 : 1, len = Math.hypot(...sub(B, A));
          part('rf', [[0, -cw / 2], [len, -cw / 2], [len, cw / 2], [0, cw / 2]], add(A, Nz, sgn * tm / 2), Ua, Va, { noCount: true, name: 'Pásnice nosníku' });
        }
      }
    }
    const capFlat = 2 * aC * sides[1].Ls / W.semi * k; // rozvinutá délka V pásnice (mm)
    out.count('rf', 'Pásnice nosníku (V)', capFlat, capFlat * 0.55, 2);
    lam('rf', prof(Pc[0] - 4.5, Pc[0] + 4.5, top, bot, 0.3), [0, 0, 0], [1, 0, 0], [0, 0, 1], [-(p.nS / 2 + 0.5), p.nS / 2 + 0.5], { name: 'Příložka páteře' });
    jn([Pc[0], 0, Pc[2]], 1.6, 'spar');

    const nfs = Math.max(0, Math.floor(((p.P - p.T) / p.T - 2) / 2)); // výplně pylonu mezi žebry
    const sle = STAB.le, sc = STAB.c, FY = STAB.semi, sdh = STAB.dih;
    const fsz = SZ + sdh * FY, fz0 = fsz - 3.3, fz1 = FIN_TOP, fle = z => 77 + 0.65 * (z - fsz), fc = z => 7.0 - 3.3 * (z - fsz) / (fz1 - fsz);
    const webH = (p.nW * tm) / 2 + 0.02, ux = sides[1].U[0] / Math.abs(sides[1].U[1]);
    const EN = [], PY = []; let kp = null;

    for (const sg of [1, -1]) {
      for (const a of ribA) {
        const af = airfoil(W.le(a), W.c(a), W.z(a), wth(a), 0.02);
        if (a < aC) { // půlžebra v kořeni (kvůli pásnicím)
          const xs = Pc[0] + a * ux, dx = webH / Math.abs(sides[1].U[1]);
          part('wg', clipX(af, xs - dx, true), [0, sg * a, 0], [1, 0, 0], [0, 0, 1], { name: 'Půlžebro křídla přední' });
          part('wg', clipX(af, xs + dx, false), [0, sg * a, 0], [1, 0, 0], [0, 0, 1], { name: 'Půlžebro křídla zadní' });
        } else part('wg', af, [0, sg * a, 0], [1, 0, 0], [0, 0, 1], { name: 'Žebro křídla' });
      }
      for (const e of ENG) {
        const le = W.le(e), xa = le - 5.8, xb = le + 2.2, ze = W.z(e) - 2.4, sx = wsx(e), wl = W.z(e) - wth(e) * 0.35, wm = W.z(e);
        const r = x => { const t = (x - xa) / 8; return t < 0.1 ? 1.4 + 0.22 * Math.sqrt(t / 0.1) : t < 0.6 ? 1.62 : 1.62 - 0.72 * Math.pow((t - 0.6) / 0.4, 1.3); };
        EN.push({ e: sg * e, xa, xb, ze, r });
        const px0 = le - 1.5, ta = le + 0.3, tb = sx - 0.6, tp = [], poly = [];
        for (let x = xa; x <= xb + 1e-6; x += 0.25) tp.push([x, ze + r(x)]);
        for (const q of tp) if (q[0] < px0) poly.push(q);
        poly.push([px0, ze + r(px0)], [px0, wl], [ta, wl], [ta, wm], [tb, wm], [tb, wl]);
        if (tb < xb) { poly.push([tb, ze + r(tb)]); for (const q of tp) if (q[0] > tb) poly.push(q); }
        else poly.push([tb, ze + r(xb) * 0.7], [xb, ze + r(xb)]);
        for (let i = tp.length - 1; i >= 0; i--) poly.push([tp[i][0], 2 * ze - tp[i][1]]);
        lam('en', poly, [0, sg * e, 0], [1, 0, 0], [0, 0, 1], [-0.5, 0.5], { name: 'Gondola + pylon' });
        const fo = []; for (let j = 1; j <= nfs; j++) fo.push(0.5 + j, -(0.5 + j));
        if (fo.length) lam('rf', [[ta, wl], [tb, wl], [tb, wm], [ta, wm]], [0, sg * e, 0], [1, 0, 0], [0, 0, 1], fo, { name: 'Výplň pylonu' });
        jn([(ta + tb) / 2, sg * e, (wl + wm) / 2], 1, 'pylon');
        PY.push({ e: sg * e, arm: ((wl + wm) / 2 - (ze - 1.62)) * k, armRoot: (wl - (ze - 1.62)) * k, Lt: (tb - ta) * k, ht: (wm - wl) * k, Lp: (tb - px0) * k });
        for (const x of [xa + 0.4, xa + 3.6, xb - 0.6]) {
          const rr = r(x), c = []; for (let i = 0; i < 32; i++) { const a = i / 32 * 2 * Math.PI; c.push([sg * e + rr * Math.cos(a), ze + rr * Math.sin(a)]); }
          part('en', c, [x, 0, 0], [0, 1, 0], [0, 0, 1], { name: 'Prstenec gondoly' });
        }
      }
      // výškovka – jeden díl přes celé rozpětí (vizualizace po polovinách)
      const tipA = FY + tm, pl = [];
      for (let a = 0; a <= tipA + 1e-6; a += tipA / 8) pl.push([sle(Math.min(a, FY)), a]);
      for (let a = tipA; a >= -1e-6; a -= tipA / 8) pl.push([sle(Math.min(a, FY)) + sc(a), a]);
      part('tl', pl, [0, 0, SZ], [1, 0, 0], nrm([0, sg, sdh]), sg < 0 ? { noCount: true } : { name: 'Výškovka', dims: [2 * tipA * k, 9 * k] });
      // kýlovka – zdvojený kýl, vodorovný zářez od odtokové hrany pro výškovku
      kp = []; for (let z = fz0; z <= fz1 + 1e-6; z += 0.5) kp.push([fle(z), z]);
      for (let z = fz1; z >= fz0 - 1e-6; z -= 0.5) kp.push([fle(z) + fc(z), z]);
      lam('tl', kp, [0, sg * FY, 0], [1, 0, 0], [0, 0, 1], [-0.5, 0.5], { name: 'Kýlovka' });
      jn([sle(FY) + sc(FY) * 0.55, sg * FY, fsz], 1.2, 'fin');
      // podvozek – podélné pásy se 7 koly
      const wr = 0.63, wcx = []; for (let i = 0; i < 7; i++) wcx.push(33.6 + i * 2.6);
      const bz = x => { let z = 0.75; for (const c of wcx) { const d = x - c; if (Math.abs(d) < wr) z = Math.min(z, 0.63 - Math.sqrt(wr * wr - d * d)); } return z; };
      lam('gr', prof(33, 49.85, () => 1.55, bz, 0.08), [0, sg * 3.6, 0], [1, 0, 0], [0, 0, 1], [-0.5, 0.5], { name: 'Podvozkový pás' });
    }
    jn([72, 0, SZ - tm], 1.2, 'stab');
    for (const xr of [34.9, 42.7, 47.9]) {
      const x = mid(xr);
      lam('gr', [[-4.0, 1.0], [4.0, 1.0], [4.0, 2.3], [-4.0, 2.3]], [x, 0, 0], [0, 1, 0], [0, 0, 1], [-0.5, 0.5], { name: 'Příčník podvozku' });
      jn([x, 0, 1.6], 1.3, 'gear'); jn([x, 3.6, 1.3], 1, 'gearX'); jn([x, -3.6, 1.3], 1, 'gearX');
    }
    const xn = mid(8.5);
    const nb = y => { let z = 0.75; for (const c of [-0.6, 0.6]) { const d = y - c; if (Math.abs(d) < 0.6) z = Math.min(z, 0.6 - Math.sqrt(0.36 - d * d)); } return z; };
    lam('gr', prof(-1.2, 1.2, () => bot(xn) + 0.9, nb, 0.06), [xn, 0, 0], [0, 1, 0], [0, 0, 1], [-0.5, 0.5], { name: 'Příďová noha' });
    jn([xn, 0, bot(xn) + 0.4], 1.3, 'nose');

    // ---------- popis nosné konstrukce pro výpočet namáhání (mm, N) – viz js/stress.js
    const a2u = sides[1].Ls / W.semi, T = p.T, CW = p.CW;
    const struct = {
      k, T,
      wing: {
        semi: W.semi,
        lever: a => Math.max(0, W.semi - a) * a2u * k,            // rameno síly na konci křídla podél nosníku
        sec: a => {
          const h2 = hW(a) * k;                                     // polovina výšky I-průřezu
          if (a < aC) {                                             // stojiny + pásnice (půlžebra lepená, bez zářezů)
            const hw = 2 * (h2 - T), I = p.nW * T * hw ** 3 / 12 + 2 * CW * T * (h2 - T / 2) ** 2;
            return { W: I / h2, what: 'I-nosník (stojiny ' + p.nW + '× + pásnice)' };
          }
          const h = 2 * h2;                                         // jen stojina, hřebenové zářezy žeber 50 %
          return { W: p.nW * T * (h / 2) ** 2 / 6, what: 'stojina bez pásnic, zářez žebra 50 %' };
        },
      },
      stab: { FY, t: T, chord: y => sc(Math.min(Math.abs(y), FY)) * k, zTop: fz1, zStab: fsz },
      fin: { t: 2 * T, chord: z => fc(Math.min(Math.max(z, fsz), fz1)) * k, zTop: fz1, zStab: fsz, zBot: fz0 },
      finJoint: { L: sc(FY) * k, b: 2 * T, extra: 0, what: 'zářez kýlovky, bez výztuh' },
      spine: { t: p.nS * T, hNet: x => Math.max(0.1, (top(x) - bot(x)) * k * 0.6), xSupport: 41, xFin: fle(fz1) + fc(fz1) / 2 },
      pylons: PY.filter(q => q.e > 0).map(q => Object.assign(q, { t: 2 * T, what: 'jazýček pylonu jen ve spodní polovině profilu' })),
      gear: { t: 2 * T, hUnder: (bot(34.9) - 1.0) * k, arm: 3.6 * k, nCross: 3, ribsCarry: false, what: 'příčník pod páteří (zbytek po zářezu)' },
    };
    return { k, kp, EN, SZ, sdh, wcx: [0, 1, 2, 3, 4, 5, 6].map(i => 33.6 + i * 2.6), xn, wth, struct };
  }

  global.AN225 = { buildModel, fTop, fBot, fW, spn, SPW, WING, STAB, airfoil, SHAPE };
})(window);
