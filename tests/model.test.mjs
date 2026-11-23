// Kontrola geometrie bez prohlížeče: node tests/model.test.mjs
// Načte js/model.js, spustí buildModel pro několik nastavení a ověří, že
// geometrie je platná a (pro výchozí nastavení) žádný díl nepřesahuje stůl frézy − 20 mm.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../js/model.js', import.meta.url), 'utf8');
const ctx = { window: {} };
vm.runInNewContext(src, ctx, { filename: 'js/model.js' });
const M = ctx.window.AN225;

let failed = 0;
const fail = (msg) => { failed++; console.error('  ✗ ' + msg); };

if (!M || typeof M.buildModel !== 'function') {
  console.error('✗ window.AN225.buildModel chybí');
  process.exit(1);
}

// výchozí hodnoty musí odpovídat DEF v js/app.js
const DEF = { L: 80, P: 15, CW: 14, T: 3, S: '2,2', B: '1000,650' };
const CASES = [
  { name: 'výchozí (80 cm, 1000×650)', p: {}, checkBed: true },
  { name: 'min. délka 50 cm', p: { L: 50 } },
  { name: 'max. délka 120 cm', p: { L: 120 } },
  { name: 'rozestup 12 mm', p: { P: 12 } },
  { name: 'rozestup 25 mm', p: { P: 25 } },
  { name: 'tloušťka 4 mm, vrstvy 3/2', p: { T: 4, S: '3,2' } },
  { name: 'vrstvy 2/1, pásnice 24 mm', p: { S: '2,1', CW: 24 } },
];

const finite = (v) => Array.isArray(v) && v.every(Number.isFinite);

for (const c of CASES) {
  const st = Object.assign({}, DEF, c.p);
  const [nS, nW] = st.S.split(',').map(Number), bed = st.B.split(',').map(Number);
  const k = 10 * st.L / 84;
  const before = failed;
  const S = { parts: 0, counted: 0, joints: 0, over: [] };
  const lim = [bed[0] - 20, bed[1] - 20];
  const checkSize = (name, w, h) => {
    const L = Math.max(w, h), Sm = Math.min(w, h);
    if (L > lim[0] || Sm > lim[1]) S.over.push(`${name || '?'} ${Math.round(L)}×${Math.round(Sm)} mm`);
  };
  const out = {
    part(g, pts, O, U, V, o = {}) {
      S.parts++;
      if (!Array.isArray(pts) || pts.length < 3) return fail(`${g}/${o.name}: polygon má < 3 body`);
      if (!pts.every(finite)) return fail(`${g}/${o.name}: NaN/Infinity v bodech polygonu`);
      if (![O, U, V].every((v) => finite(v) && v.length === 3)) return fail(`${g}/${o.name}: neplatná rovina dílu`);
      if (o.noCount) return;
      S.counted++;
      let w, h;
      if (o.dims) [w, h] = o.dims;
      else {
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        w = (Math.max(...xs) - Math.min(...xs)) * k; h = (Math.max(...ys) - Math.min(...ys)) * k;
      }
      checkSize(o.name, w, h);
    },
    joint(p) { S.joints++; if (!finite(p)) fail('spoj s neplatnou polohou'); },
    count(g, name, w, h, n) { S.counted += n; if (![w, h, n].every(Number.isFinite)) fail(`count ${name}: neplatné hodnoty`); else checkSize(name, w, h); },
  };
  try {
    M.buildModel({ L: st.L, P: st.P, T: st.T, CW: st.CW, nS, nW, bed }, out);
  } catch (e) {
    fail('výjimka: ' + (e && e.stack || e));
  }
  if (S.parts === 0) fail('nevznikl žádný díl');
  if (c.checkBed && S.over.length) fail(`díly přes pracovní plochu − 20 mm: ${S.over.join(', ')}`);
  console.log(`${failed === before ? '✓' : '✗'} ${c.name}: ${S.counted} dílů, ${S.joints} spojů${S.over.length && !c.checkBed ? ` (přes limit: ${S.over.length})` : ''}`);
}

if (failed) { console.error(`\n${failed} chyb`); process.exit(1); }
console.log('\nVše v pořádku.');
