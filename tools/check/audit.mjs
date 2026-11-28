// Kontrola vyrobitelnosti všech dílů modelu (výchozí nastavení):
//  1) nejužší místo materiálu každého dílu (paprsek z každého bodu obrysu dovnitř) – limit RULES.minMaterial (3 mm),
//  2) průniky hmoty dvou dílů (bod uvnitř jednoho dílu leží uvnitř druhého) = chybějící/nekompatibilní zářez.
// Použití: node tools/check/audit.mjs [--all]   (--all vypíše všechny nálezy, jinak souhrn po dvojicích názvů)
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const ctx = { window: {} };
for (const f of ['an225-ref.js', 'model.js']) vm.runInNewContext(readFileSync(new URL('js/' + f, root), 'utf8'), ctx);
const M = ctx.window.AN225;
const P = { L: 80, P: 15, T: 3, CW: 20, nS: 2, nW: 2, bed: [1000, 650] };
const parts = [];
const G = M.buildModel(P, { part: (g, pts, O, U, V, o = {}) => parts.push({ g, name: o.name || g, pts, O, U, V, fold: o.fold, holes: o.holes || [] }), joint() {}, count() {} });
const k = G.k, T = P.T, LIM = (M.RULES.minMaterial || 3), EPS = 0.25;   // mm
const ALL = process.argv.includes('--all');
const f1 = v => (Math.round(v * 10) / 10).toString().replace('.', ',');

const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = v => { const l = Math.hypot(...v); return v.map(a => a / l); };
for (const q of parts) {
  q.P2 = q.pts.map(([u, v]) => [u * k, v * k]); q.H2 = q.holes.map(h => h.map(([u, v]) => [u * k, v * k]));
  q.N = nrm(crs(q.U, q.V)); q.Om = q.O.map(v => v * k);
  q.to3 = (u, v, n = 0) => q.fold ? q.fold(u / k, v / k, n / k).map(c => c * k) : [0, 1, 2].map(i => q.Om[i] + q.U[i] * u + q.V[i] * v + q.N[i] * n);
  const c = []; for (const [u, v] of q.P2) for (const n of [-T / 2, T / 2]) c.push(q.to3(u, v, n));
  q.bb = [0, 1, 2].map(i => [Math.min(...c.map(p => p[i])) - 1, Math.max(...c.map(p => p[i])) + 1]);
  q.edges = [q.P2, ...q.H2].flatMap(L => L.map((a, i) => [a, L[(i + 1) % L.length]]));
}
const inPoly = (L, x, y) => { let r = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const [xi, yi] = L[i], [xj, yj] = L[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) r = !r; } return r; };
const segD = (x, y, [a, b]) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)) : 0; return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); };
const inside = (q, x, y, m) => inPoly(q.P2, x, y) && !q.H2.some(h => inPoly(h, x, y)) && q.edges.every(e => segD(x, y, e) > m);

// ---- 1) nejužší místo materiálu: rastr 0,2 mm, kružnice o průměru LIM vepsané do materiálu musí pokrýt celý díl
//      (nepokrytá místa = užší než LIM). Ostré vnější rohy (úhel ≥ 45°) se nepočítají – kružnice do nich nedosáhne.
const edt1 = (f, n) => {   // Felzenszwalb: 1D čtvercová vzdálenost
  const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1); let kk = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    if (f[q] === Infinity) continue;
    if (f[v[kk]] === Infinity) { v[kk] = q; continue; }
    let s2; while (true) { s2 = ((f[q] + q * q) - (f[v[kk]] + v[kk] * v[kk])) / (2 * q - 2 * v[kk]); if (s2 <= z[kk] && kk > 0) kk--; else break; }
    if (s2 <= z[kk] && kk === 0) { v[0] = q; z[1] = Infinity; continue; }
    kk++; v[kk] = q; z[kk] = s2; z[kk + 1] = Infinity;
  }
  if (f[v[0]] === Infinity) { d.fill(Infinity); return d; }
  kk = 0; for (let q = 0; q < n; q++) { while (z[kk + 1] < q) kk++; d[q] = (q - v[kk]) ** 2 + f[v[kk]]; }
  return d;
};
const edt = (feat, W, H) => {   // feat[i] = true → vzdálenost 0; vrací vzdálenost v pixelech
  const g = new Float64Array(W * H); for (let i = 0; i < W * H; i++) g[i] = feat[i] ? 0 : Infinity;
  const col = new Float64Array(H);
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) col[y] = g[y * W + x]; const d = edt1(col, H); for (let y = 0; y < H; y++) g[y * W + x] = d[y]; }
  const row = new Float64Array(W);
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) row[x] = g[y * W + x]; const d = edt1(row, W); for (let x = 0; x < W; x++) g[y * W + x] = Math.sqrt(d[x]); }
  return g;
};
const thin = new Map(), RES = 0.2, R = LIM / 2;
for (const q of parts) {
  const xs = q.P2.map(p => p[0]), ys = q.P2.map(p => p[1]), x0 = Math.min(...xs) - 1, y0 = Math.min(...ys) - 1;
  const W = Math.ceil((Math.max(...xs) - x0 + 1) / RES), H = Math.ceil((Math.max(...ys) - y0 + 1) / RES);
  const mat = new Uint8Array(W * H), loops = [q.P2, ...q.H2];
  for (let j = 0; j < H; j++) {
    const y = y0 + (j + 0.5) * RES, X = [];
    for (const L of loops) for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; if ((a[1] > y) !== (b[1] > y)) X.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
    X.sort((u, v) => u - v);
    for (let m = 0; m + 1 < X.length; m += 2) { const i0 = Math.max(0, Math.ceil((X[m] - x0) / RES - 0.5)), i1 = Math.min(W - 1, Math.floor((X[m + 1] - x0) / RES - 0.5)); for (let i = i0; i <= i1; i++) mat[j * W + i] = 1; }
  }
  const din = edt(Array.from(mat, v => !v), W, H);
  const cen = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) cen[i] = mat[i] && din[i] * RES >= R ? 1 : 0;
  const dc = edt(cen, W, H);
  // ostré vnější rohy
  const corners = [];
  for (const L of loops) {
    const ar = L.reduce((s, a, i) => { const b = L[(i + 1) % L.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
    L.forEach((b, i) => {
      const a = L[(i + L.length - 1) % L.length], c = L[(i + 1) % L.length], u = [a[0] - b[0], a[1] - b[1]], w = [c[0] - b[0], c[1] - b[1]];
      const lu = Math.hypot(...u), lw = Math.hypot(...w); if (lu < 1e-9 || lw < 1e-9) return;
      const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]), ang = Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / lu / lw)));
      const convex = L === q.P2 ? cr * ar > 0 : cr * ar < 0;
      if (convex && ang >= Math.PI / 4 - 1e-6) corners.push([b, R / Math.sin(ang / 2) + 0.3]);
    });
  }
  let best = null;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const id = j * W + i; if (!mat[id] || dc[id] * RES <= R + RES || din[id] * RES < 0.3) continue;
    const p = [x0 + (i + 0.5) * RES, y0 + (j + 0.5) * RES];
    if (corners.some(([c, r]) => Math.hypot(p[0] - c[0], p[1] - c[1]) < r)) continue;
    // šířka v tomto místě ≈ 2 × největší vepsaná kružnice, která místo obsahuje (odhad: 2 × vzdálenost k okraji v okolí)
    let w = 0; for (let jj = Math.max(0, j - 15); jj < Math.min(H, j + 16); jj++) for (let ii = Math.max(0, i - 15); ii < Math.min(W, i + 16); ii++) { const t = jj * W + ii; if (mat[t] && Math.hypot(ii - i, jj - j) * RES <= din[t] * RES + RES) w = Math.max(w, 2 * din[t] * RES); }
    if (!best || w < best.d) best = { d: w, at: q.to3(p[0], p[1]) };
  }
  if (best) { const key = q.g + ' / ' + q.name; const o = thin.get(key); if (!o || best.d < o.d) thin.set(key, Object.assign(best, { n: (o ? o.n : 0) + 1 })); else o.n++; }
}

// ---- 2) průniky hmoty
const hits = new Map();
const pairs = [];
for (let i = 0; i < parts.length; i++) for (let j = 0; j < parts.length; j++) {
  if (i === j) continue; const a = parts[i], b = parts[j];
  if (b.fold) continue;                                        // test „bod uvnitř“ jen proti rovinným dílům
  if (a.bb.every((r, d) => r[0] < b.bb[d][1] && r[1] > b.bb[d][0])) pairs.push([a, b]);
}
const byA = new Map(); for (const [a, b] of pairs) { if (!byA.has(a)) byA.set(a, []); byA.get(a).push(b); }
for (const [a, Bs] of byA) {
  const xs = a.P2.map(p => p[0]), ys = a.P2.map(p => p[1]);
  for (let u = Math.min(...xs) + 0.35; u < Math.max(...xs); u += 0.7) for (let v = Math.min(...ys) + 0.35; v < Math.max(...ys); v += 0.7) {
    if (!inside(a, u, v, EPS)) continue;
    for (const n of [-T / 2 + 0.3, 0, T / 2 - 0.3]) {
      const X = a.to3(u, v, n);
      for (const b of Bs) {
        if (X.some((c, d) => c < b.bb[d][0] || c > b.bb[d][1])) continue;
        const r = [X[0] - b.Om[0], X[1] - b.Om[1], X[2] - b.Om[2]], nb = dot(r, b.N);
        if (Math.abs(nb) > T / 2 - EPS) continue;
        if (!inside(b, dot(r, b.U), dot(r, b.V), EPS)) continue;
        const key = [a.g + '/' + a.name, b.g + '/' + b.name].sort().join('  ×  ');
        const h = hits.get(key) || { n: 0, at: X, parts: new Set(), pts: [] }; h.n++; if (h.pts.length < 8) h.pts.push(X.map(f1).join(' ')); h.parts.add(parts.indexOf(a)); h.parts.add(parts.indexOf(b)); hits.set(key, h);
      }
    }
  }
}
console.log(`Díly: ${parts.length}. Limit materiálu ${LIM} mm.\n\n== Tenká místa (< ${LIM} mm) ==`);
if (!thin.size) console.log('  žádná');
for (const [key, o] of [...thin].sort((p, q) => p[1].d - q[1].d)) console.log(`  ${key}: ${f1(o.d)} mm  (${o.n} dílů) u [${o.at.map(f1).join(', ')}]`);
console.log(`\n== Průniky hmoty (chybí zářez) ==`);
if (!hits.size) console.log('  žádné');
for (const [key, h] of [...hits].sort((p, q) => q[1].n - p[1].n)) { console.log(`  ${key}: ${h.n} bodů, ${h.parts.size} dílů, např. [${h.at.map(f1).join(', ')}]`); if (ALL) console.log('      ' + h.pts.join(' | ')); }
process.exitCode = thin.size || hits.size ? 1 : 0;
