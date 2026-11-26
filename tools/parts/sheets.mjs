// Výkresové listy upravených dílů křídla a gondol (SVG, rozměry v mm modelu).
// Použití: node tools/parts/sheets.mjs [výstupní složka] [--widget]
//   bez --widget: samostatné SVG soubory (docs/parts/*.svg)
//   --widget: fragmenty pro vložení do chatu (třídy ts/th, barvy přes CSS proměnné)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const ctx = { window: {} };
for (const f of ['an225-ref.js', 'model.js']) vm.runInNewContext(readFileSync(new URL('js/' + f, root), 'utf8'), ctx);
const M = ctx.window.AN225;
const WIDGET = process.argv.includes('--widget');
const outDir = process.argv.slice(2).find(a => !a.startsWith('--')) || new URL('docs/parts/', root).pathname.replace(/^\/([A-Z]:)/, '$1');

// ---- model (výchozí nastavení)
const P = { L: 80, P: 15, T: 3, CW: 20, nS: 2, nW: 2, bed: [1000, 650] };
const parts = [];
const G = M.buildModel(P, { part: (g, pts, O, U, V, o = {}) => parts.push({ g, name: o.name || '', pts, O, U, V }), joint() {}, count() {} });
const k = G.k, T = P.T;
const to3 = (q, u, v) => q.O.map((o, i) => o + q.U[i] * u + q.V[i] * v);
const mm = q => q.pts.map(([u, v]) => [u * k, v * k]);
const near = (a, b, e = 1e-3) => Math.abs(a - b) < e;

// ---- SVG pomocník
const C = WIDGET
  ? { line: 'var(--p)', dim: 'var(--s)', rib: '#EF9F27', fl: '#1D9E75', web: '#854F0B', en: '#888780', ghost: 'var(--t)' }
  : { line: '#2c2c2a', dim: '#5f5e5a', rib: '#EF9F27', fl: '#1D9E75', web: '#854F0B', en: '#888780', ghost: '#b4b2a9' };
const txt = (x, y, s, a = 'start', cls = 'ts') => WIDGET
  ? `<text class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${a}">${s}</text>`
  : `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${a}" font-family="sans-serif" font-size="${cls === 'th' ? 14 : 12}" fill="${C.dim}">${s}</text>`;
function frame(box, polys, pad = 0, flipY = true) { // box = [x, y, w, h] px; vrací mapovací funkci mm → px (stejné měřítko v obou osách)
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const P of polys) for (const [x, y] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const s = Math.min((box[2] - 2 * pad) / (x1 - x0), (box[3] - 2 * pad) / (y1 - y0));
  const ox = box[0] + (box[2] - (x1 - x0) * s) / 2, oy = box[1] + (box[3] - (y1 - y0) * s) / 2;
  const f = ([x, y]) => [ox + (x - x0) * s, flipY ? oy + (y1 - y) * s : oy + (y - y0) * s];
  f.s = s; f.bb = [x0, x1, y0, y1]; return f;
}
const poly = (f, P, fill, op = 0.35, sw = 0.8, dash) => `<polygon points="${P.map(p => f(p).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="${fill}" fill-opacity="${op}" stroke="${C.line}" stroke-width="${sw}"${dash ? ' stroke-dasharray="3 2"' : ''}/>`;
const pline = (f, P, col = C.ghost, sw = 0.8, dash = '4 3') => `<polyline points="${P.map(p => f(p).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${col}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const n1 = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
function hdim(f, xa, xb, y, lab, off = 14) { // vodorovná kóta mezi body (mm) ve výšce y (mm), odsazená o off px (kladné = dolů)
  const [ax, ay] = f([xa, y]), [bx] = f([xb, y]), yy = ay + off;
  return `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${ax.toFixed(1)}" y2="${(yy + 3).toFixed(1)}" stroke="${C.dim}" stroke-width="0.5"/>` +
    `<line x1="${bx.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${(yy + 3).toFixed(1)}" stroke="${C.dim}" stroke-width="0.5"/>` +
    `<line x1="${ax.toFixed(1)}" y1="${yy.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${C.dim}" stroke-width="0.5" marker-start="url(#dm)" marker-end="url(#dm)"/>` +
    txt((ax + bx) / 2, yy + (off > 0 ? 13 : -4), lab ?? n1(Math.abs(xb - xa)), 'middle');
}
function vdim(f, ya, yb, x, lab, off = 14) {
  const [ax, ay] = f([x, ya]), [, by] = f([x, yb]), xx = ax + off;
  return `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${(xx + 3 * Math.sign(off)).toFixed(1)}" y2="${ay.toFixed(1)}" stroke="${C.dim}" stroke-width="0.5"/>` +
    `<line x1="${ax.toFixed(1)}" y1="${by.toFixed(1)}" x2="${(xx + 3 * Math.sign(off)).toFixed(1)}" y2="${by.toFixed(1)}" stroke="${C.dim}" stroke-width="0.5"/>` +
    `<line x1="${xx.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${xx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${C.dim}" stroke-width="0.5" marker-start="url(#dm)" marker-end="url(#dm)"/>` +
    txt(xx + (off > 0 ? 5 : -5), (ay + by) / 2 + 4, lab ?? n1(Math.abs(yb - ya)), off > 0 ? 'start' : 'end');
}
const callout = (f, p, x, y, s, a = 'start') => { const [px, py] = f(p); return `<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${x}" y2="${y - 4}" stroke="${C.ghost}" stroke-width="0.5" stroke-dasharray="3 2"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="1.8" fill="${C.dim}"/>` + txt(x + (a === 'start' ? 3 : -3), y, s, a); };
function sheet(name, title, H, body) {
  const defs = `<defs><marker id="dm" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" stroke="${C.dim}" stroke-width="1.2"/></marker></defs>`;
  const svg = `<svg ${WIDGET ? 'width="100%"' : 'xmlns="http://www.w3.org/2000/svg" width="680"'} viewBox="0 0 680 ${H}" role="img"><title>${title}</title><desc>${title} – výkres dílů modelu An-225 (mm, model 80 cm)</desc>${defs}${WIDGET ? '' : `<rect width="680" height="${H}" fill="#fff"/>`}${body}</svg>`;
  writeFileSync(outDir + '/' + name + '.svg', svg);
  return svg.length;
}
mkdirSync(outDir, { recursive: true });

const ribs = parts.filter(q => q.g === 'wg' && q.O[1] > 0);
const ribAt = (name, a) => ribs.find(q => q.name === name && near(q.O[1], a));
const isUp = q => { const p = to3(q, 0, 0); return p[2] > M.WING.z(Math.max(Math.abs(p[1]), G.aK)); };
const RA = G.ribA, aK = G.aK, aTip = G.aTip, nB = RA.length - 1;
const sxAt = a => G.sx(a);
const cosP = (() => { const d = (G.sx(20.05) - G.sx(19.95)) / 0.1; return 1 / Math.hypot(1, d); })();
function clipX(P, xc, less) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[(i + P.length - 1) % P.length], b = P[i];
    const ia = less ? a[0] <= xc : a[0] >= xc, ib = less ? b[0] <= xc : b[0] >= xc;
    const cut = () => { const t = (xc - a[0]) / (b[0] - a[0]); return [xc, a[1] + t * (b[1] - a[1])]; };
    if (ib) { if (!ia) out.push(cut()); out.push(b); } else if (ia) out.push(cut());
  }
  return out;
}

// =========== 1 — konec křídla
{
  const a0 = RA[nB - 3] - 0.6;
  const inR = q => to3(q, ...q.pts[0]) && q.pts.some(([u, v]) => { const p = to3(q, u, v); return p[1] > a0 && p[1] < aTip + 1; });
  const sel = parts.filter(q => ['wg', 'rf', 'sw'].includes(q.g) && q.O[1] >= 0 && inR(q) && q.name !== 'Pomocná lišta křídla' || (q.name === 'Pomocná lišta křídla' && q.O[1] > 0 && inR(q)));
  const PL = sel.map(q => ({ q, P: clipX(q.pts.map(([u, v]) => { const p = to3(q, u, v); return [p[1] * k, -p[0] * k]; }), a0 * k, false) })).filter(o => o.P.length > 2); // půdorys: y vpravo, x dolů
  const f = frame([20, 40, 380, 300], PL.map(o => o.P).flat().length ? PL.map(o => o.P) : [[[0, 0]]], 10, true);
  let b = txt(20, 24, 'Půdorys konce pravého křídla (shora)', 'start', 'th');
  const col = q => q.g === 'wg' ? C.rib : q.g === 'sw' ? C.web : C.fl;
  for (const o of PL.filter(o => o.q.g === 'sw')) b += poly(f, o.P, col(o.q), 0.5, 0.5);
  for (const o of PL.filter(o => o.q.g === 'wg')) b += poly(f, o.P, col(o.q), 0.6, 0.5);
  for (const o of PL.filter(o => o.q.g === 'rf' && o.q.name === 'Pásnice nosníku' && isUp(o.q))) b += poly(f, o.P, col(o.q), 0.45, 0.6);
  const tip = ribAt('Koncové žebro', aTip);
  const tp = tip.pts.map(([x]) => x * k);
  b += hdim(f, (aTip - 3 * (RA[1] - RA[0])) * k, aTip * k, -Math.max(...tp), `3 pole × ${n1((RA[1] - RA[0]) * k)} mm`, 24);
  b += callout(f, [aTip * k, -(sxAt(aTip) - 1.2) * k], 420, 80, 'koncové žebro – celé, uzavírá křídlo');
  b += callout(f, [(aTip - 0.6) * k, -sxAt(aTip - 0.6) * k], 420, 120, 'pásnice končí v líci koncového žebra');
  // koncové žebro – díl
  const R = mm(tip), f2 = frame([430, 190, 200, 110], [R], 4);
  b += txt(430, 170, 'Koncové žebro (1 ks/strana)', 'start', 'th') + poly(f2, R, C.rib, 0.35, 0.8);
  const xs = R.map(p => p[0]), zs = R.map(p => p[1]);
  b += hdim(f2, Math.min(...xs), Math.max(...xs), Math.min(...zs), null, 18) + vdim(f2, Math.min(...zs), Math.max(...zs), Math.max(...xs), null, 12);
  b += txt(430, 345, 'Lože pro pásnici shora i zdola, hloubka 3 mm', 'start');
  console.log('tip', sheet('1-konec-kridla', 'Konec křídla uzavřený koncovým žebrem', 380, b));
}

// =========== 2 — kořen: centroplán + kýl
{
  const web = parts.find(q => q.name === 'Stojina centroplánu'), keel = parts.find(q => q.name === 'Kýl centroplánu');
  const Wp = mm(web), Kp = mm(keel);
  const sx = web.O[0];
  // obrys trupu v řezu x = sx
  const fus = [];
  const top = G.top(sx), bot = M.fBot(sx), S = M.secShape(sx), w = M.fW(sx);
  const sAt = (S, z) => { const f = Math.min(20, Math.max(0, z * 20)), i = Math.min(19, Math.floor(f)), t = f - i; return S[i] + (S[i + 1] - S[i]) * t; };
  for (let i = 0; i <= 40; i++) { const z = i / 40; fus.push([sAt(S, z) * w * k, (bot + z * (top - bot)) * k]); }
  const fusP = fus.concat(fus.slice().reverse().map(p => [-p[0], p[1]]));
  const rootL = ribAt('Kořenové žebro', aK); const rh = rootL.pts.map(p => p[1] * k);
  const outW = parts.filter(q => q.name === 'Stojina nosníku' && q.O[1] > 0);
  const f = frame([90, 70, 400, 280], [fusP, Wp, Kp, [[-(aK + 3) * k, Math.min(...fusP.map(p => p[1]))], [(aK + 3) * k, Math.min(...fusP.map(p => p[1]))]]], 6);
  let b = txt(20, 24, 'Pohled zepředu v rovině nosníku: centroplán uvnitř trupu', 'start', 'th');
  b += pline(f, fusP.concat([fusP[0]]), C.ghost, 0.8);
  // pásnice (řez) a kořenová žebra (pohled – jen obrys výšky)
  const zt = Math.max(...Wp.map(p => p[1])) + T, zb = Math.min(...Wp.map(p => p[1])) - T;
  for (const sg of [1, -1]) {
    b += poly(f, [[sg * (aK - T / k / 2) * k * 1, Math.min(...rh)], [sg * (aK + T / k / 2) * k, Math.min(...rh)], [sg * (aK + T / k / 2) * k, Math.max(...rh)], [sg * (aK - T / k / 2) * k, Math.max(...rh)]].map(p => [p[0], p[1]]), C.rib, 0.7, 0.5);
    b += poly(f, [[sg * (aK + 0.2) * k, zb + T], [sg * (aK + 3) * k, zb + T - 0.3 * 3 * k * 0.1], [sg * (aK + 3) * k, zt - T - 0.3], [sg * (aK + 0.2) * k, zt - T]], C.web, 0.25, 0.5, true);
  }
  b += poly(f, [[-(aK + 3) * k, zt - T], [(aK + 3) * k, zt - T], [(aK + 3) * k, zt], [-(aK + 3) * k, zt]], C.fl, 0.6, 0.5);
  b += poly(f, [[-(aK + 3) * k, zb], [(aK + 3) * k, zb], [(aK + 3) * k, zb + T], [-(aK + 3) * k, zb + T]], C.fl, 0.6, 0.5);
  b += poly(f, Wp, C.web, 0.45, 0.8) + poly(f, Kp, C.web, 0.25, 0.8);
  const kb = Math.min(...Kp.map(p => p[1])), kw = Math.max(...Kp.map(p => p[0]));
  b += vdim(f, zb, zt, (aK + 3) * k, `profil ${n1(zt - zb)}`, 16);
  b += vdim(f, kb, zt, -(aK + 3) * k, `kořen ${n1(zt - kb)}`, -16);
  b += hdim(f, -kw, kw, kb, null, 16);
  b += hdim(f, -(aK) * k, aK * k, zt, `mezi kořenovými žebry ${n1(2 * aK * k)}`, -22);
  b += callout(f, [kw * 0.4, (kb + zb) / 2], 520, 300, 'kýl centroplánu, 2 vrstvy');
  b += callout(f, [kw * 0.6, (zb + zt) / 2], 520, 262, 'stojina centroplánu, 2 vrstvy');
  b += callout(f, [(aK + 2.5) * k, zt - T / 2], 520, 60, 'pásnice – 1 díl, 1 vrstva');
  b += callout(f, [(aK) * k, Math.min(...rh) + 2], 520, 224, 'kořenové žebro');
  b += txt(40, 382, 'Odstraněno: 2. vrstva pásnic ±6 m (spojka) a příložky páteře. Páteř a kýl se kříží hřebenovým spojem.');
  console.log('root', sheet('2-koren-centroplan', 'Kořen křídla: vyšší nosník v trupu', 400, b));
}

// =========== 3 — pásnice + žebra (lože a zářezy)
{
  const fl = parts.filter(q => q.name === 'Pásnice nosníku' && q.O[1] > 1 && isUp(q));
  const segA = fl.find(q => q.O[1] > 12) || fl[3];
  const S = mm(segA);
  const f = frame([20, 40, 330, 120], [S], 8, false);
  let b = txt(20, 24, 'Pásnice – úsek u jednoho žebra', 'start', 'th');
  for (const Y of RA.filter(r => Math.abs(r - segA.O[1]) < 2.5)) for (const d of [-0.5, 0.5]) {
    const yy = Y + d * T / k, uAt = v => ((yy - segA.O[1] - segA.V[1] * v) / segA.U[1]) * k;
    b += pline(f, [[uAt(-P.CW / 2 / k - 0.3), -P.CW / 2 - 3], [uAt(P.CW / 2 / k + 0.3), P.CW / 2 + 3]], C.rib, 0.7, '3 2');
  }
  b += poly(f, S, C.fl, 0.45, 0.8);
  const vs = S.map(p => p[1]), us = S.map(p => p[0]);
  const nd = P.CW / 2 - Math.min(...vs.filter(v => v > 0));
  b += vdim(f, Math.min(...vs), Math.max(...vs), Math.max(...us), `${P.CW}`, 14);
  const nIn = S.filter(p => near(p[1], P.CW / 2 - nd, 1e-3));
  if (nIn.length >= 2) {
    const ux = nIn.map(p => p[0]).sort((a, b) => a - b);
    b += hdim(f, ux[0], ux[ux.length - 1], P.CW / 2 - nd, `${n1(ux[ux.length - 1] - ux[0])}`, -16);
    b += vdim(f, P.CW / 2 - nd, P.CW / 2, ux[0], `${n1(nd)}`, -20);
  }
  b += txt(20, 182, `zářezy ${n1(nd)} mm z obou okrajů; čárkovaně žebro (šikmo – šíp)`);
  // celá pásnice v půdorysu
  const all = parts.filter(q => q.name === 'Pásnice nosníku' && isUp(q));
  const PL = all.map(q => q.pts.map(([u, v]) => { const p = to3(q, u, v); return [p[1] * k, -p[0] * k]; }));
  const f3 = frame([380, 40, 280, 120], PL, 4);
  b += txt(380, 24, 'Horní pásnice – celý díl, shora', 'start', 'th');
  for (const P2 of PL) b += poly(f3, P2, C.fl, 0.55, 0.3);
  const xs = PL.flat().map(p => p[0]), ys = PL.flat().map(p => p[1]);
  b += hdim(f3, Math.min(...xs), Math.max(...xs), Math.min(...ys), null, 14) + vdim(f3, Math.min(...ys), Math.max(...ys), Math.max(...xs), null, 8);
  b += txt(380, 196, 'Ohyb 5,6° na obou kořenových žebrech');
  // detail žebra u nosníku
  const a = RA[Math.round(nB * 0.45)], fr = ribAt('Půlžebro křídla přední', a), rr = ribAt('Půlžebro křídla zadní', a);
  const xs0 = sxAt(a) * k, FR = mm(fr).filter(p => p[0] > xs0 - 22), RR = mm(rr).filter(p => p[0] < xs0 + 22);
  const Fz = mm(fr).map(p => p[1]);
  const clipW = (Pp, lo, hi) => { let o = Pp; o = o.filter(p => p[0] >= lo && p[0] <= hi); return o; };
  const frC = clipW(mm(fr), xs0 - 26, xs0 + 1), rrC = clipW(mm(rr), xs0 - 1, xs0 + 26);
  const f4 = frame([60, 230, 560, 170], [frC, rrC], 10);
  b += txt(20, 216, 'Detail: žebro v místě nosníku (řez rovinou žebra)', 'start', 'th');
  b += poly(f4, frC, C.rib, 0.35, 0.8) + poly(f4, rrC, C.rib, 0.35, 0.8);
  const wx = (P.nW * T / 2 + 0.02 * k) / cosP;
  const zT = Math.max(...frC.map(p => p[1])), zB = Math.min(...frC.map(p => p[1]));
  b += poly(f4, [[xs0 - wx, zB + T], [xs0 + wx, zB + T], [xs0 + wx, zT - T + 0.0], [xs0 - wx, zT - T]], C.web, 0.4, 0.6);
  const fwx = P.CW / 2 / cosP;
  b += poly(f4, [[xs0 - fwx, zT - T], [xs0 + fwx, zT - T], [xs0 + fwx, zT], [xs0 - fwx, zT]], C.fl, 0.25, 0.6, true);
  b += poly(f4, [[xs0 - fwx, zB], [xs0 + fwx, zB], [xs0 + fwx, zB + T], [xs0 - fwx, zB + T]], C.fl, 0.25, 0.6, true);
  b += vdim(f4, zT - T, zT, xs0 - fwx - 4, '3', -10);
  b += callout(f4, [xs0, zT - T / 2], 470, 236, 'pásnice v loži, líc = obrys profilu');
  b += callout(f4, [xs0 - fwx + 0.8, zT - 0.5], 160, 236, 'zub žebra v zářezu pásnice', 'end');
  b += callout(f4, [xs0, (zT + zB) / 2], 470, 425, 'stojina 2× 3 mm (řez)');
  console.log('flange', sheet('3-pasnice-zebra', 'Pásnice zapuštěné do žeber se zářezy', 450, b));
}

// =========== 4 — pomocná lišta + zadní půlžebro
{
  const st = parts.filter(q => q.name === 'Pomocná lišta křídla' && q.O[1] > 12);
  const S = mm(st[2]);
  const f = frame([20, 40, 300, 80], [S], 6, false);
  let b = txt(20, 24, 'Pomocná lišta (65 % hloubky, spodem) – úsek', 'start', 'th') + poly(f, S, C.fl, 0.45, 0.8);
  const vs = S.map(p => p[1]), us = S.map(p => p[0]);
  b += vdim(f, Math.min(...vs), Math.max(...vs), Math.max(...us), '12', 14);
  b += txt(20, 140, 'Zářezy 3 mm z obou okrajů, jádro 6 mm');
  const a = RA[Math.round(nB * 0.45)], rr = ribAt('Půlžebro křídla zadní', a), fr = ribAt('Půlžebro křídla přední', a);
  const R = mm(rr), F = mm(fr);
  const f2 = frame([20, 180, 640, 150], [R, F], 6);
  b += txt(20, 166, 'Přední a zadní půlžebro (stejné pole), lože pásnic a lišty', 'start', 'th');
  b += poly(f2, F, C.rib, 0.35, 0.8) + poly(f2, R, C.rib, 0.35, 0.8);
  const rx = R.map(p => p[0]), fx = F.map(p => p[0]), rz = R.map(p => p[1]), fz = F.map(p => p[1]);
  b += hdim(f2, Math.min(...fx), Math.max(...fx), Math.min(...fz), null, 26) + hdim(f2, Math.min(...rx), Math.max(...rx), Math.min(...fz), null, 26);
  b += vdim(f2, Math.min(...fz), Math.max(...fz), Math.min(...fx), null, -12);
  const xL = (M.WING.le(a) + 0.65 * M.WING.c(a)) * k;
  b += callout(f2, [xL, Math.min(...rz) + T + 0.5], 470, 370, 'lože lišty – zuby do zářezů lišty');
  b += callout(f2, [Math.max(...fx), Math.max(...fz) - 1.5], 260, 370, 'lože pásnice u stojiny', 'end');
  console.log('strip', sheet('4-lista-pulzebra', 'Pomocná lišta a půlžebra', 390, b));
}

// =========== 5 — gondola, pylon, prstence
{
  const go = parts.find(q => q.name === 'Gondola + pylon' && q.O[1] > 14 && q.O[1] < 22);
  const e = G.EN.reduce((b, n) => Math.abs(n.e - go.O[1]) < Math.abs(b.e - go.O[1]) ? n : b).e;
  const rings = parts.filter(q => q.name === 'Prstenec gondoly' && Math.abs(q.pts[0][0] - e) < 2 && q.pts[0][0] > 0);
  const Gp = mm(go);
  // křídlo v řezu rovinou gondoly (obrys pro orientaci)
  const af = M.airfoil(M.WING.le(e), M.WING.c(e), M.WING.z(e), G.th(e), 0.02, 1.5 / k).map(p => [p[0] * k, p[1] * k]);
  const f = frame([20, 40, 640, 200], [Gp, af], 6);
  let b = txt(20, 24, 'Gondola + pylon (prostřední motor, 2 vrstvy) – bokorys dílu', 'start', 'th');
  b += pline(f, af.concat([af[0]]), C.ghost, 0.8);
  b += poly(f, Gp, C.en, 0.4, 0.8);
  const gx = Gp.map(p => p[0]), gz = Gp.map(p => p[1]);
  b += hdim(f, Math.min(...gx), Math.max(...gx), Math.min(...gz), null, 16);
  b += vdim(f, Math.min(...gz), Math.max(...gz), Math.max(...gx), null, 14);
  const EN = G.EN.reduce((b, n) => Math.abs(n.e - e) < Math.abs(b.e - e) ? n : b), ze = EN.ze * k;
  for (const [i, q] of rings.entries()) { const x = q.O[0] * k; if (i === 1) b += callout(f, [x, ze - 3], 200, 268, 'výřez zdola do osy pro prstenec (3 mm)'); }
  const xs = G.sx(e) * k;
  b += callout(f, [xs, (M.WING.z(e)) * k - 4], 470, 268, 'výřez shora pro nosník – nasadit zespodu, lepit');
  b += callout(f, [(M.WING.le(e) - 1.2) * k, (M.WING.z(e) - 0.55) * k], 120, 60, 'náběžná hrana pylonu plynule do křídla', 'start');
  const xL = (M.WING.le(e) + 0.65 * M.WING.c(e)) * k;
  b += callout(f, [xL, (M.WING.z(e) - 0.6) * k], 560, 60, 'lože pro lištu', 'end');
  // prstenec
  const r0 = rings[1], R = mm(r0);
  const f2 = frame([60, 300, 160, 140], [R], 4);
  b += txt(20, 290, 'Prstenec (1 vrstva)', 'start', 'th') + poly(f2, R, C.en, 0.35, 0.8);
  const rx = R.map(p => p[0]), rz = R.map(p => p[1]);
  b += hdim(f2, Math.min(...rx), Math.max(...rx), Math.min(...rz), `Ø ${n1(Math.max(...rx) - Math.min(...rx))}`, 14);
  b += callout(f2, [(Math.min(...rx) + Math.max(...rx)) / 2, Math.max(...rz) - 2], 260, 330, 'výřez shora do osy, šířka 6,1 mm');
  b += txt(260, 360, `${rings.length} prstenců na gondolu v rozestupu žeber ${n1((RA[1] - RA[0]) * k)} mm`);
  b += txt(260, 380, 'Spoj 50/50: prstenec dolní polovinou do gondoly,');
  b += txt(260, 396, 'gondola horní polovinou do prstence.');
  console.log('eng', sheet('5-gondola-prstence', 'Gondola, pylon a prstence', 460, b));
}
