// UI + 3D render (three.js r128) pro model An-225.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const M = window.AN225;
  const GDEF = [
    ['sp', 'Páteř', 0x7A5A32], ['rb', 'Trup – žebra', 0xD9B781], ['sw', 'Nosník – stojiny', 0x8A6438], ['wg', 'Křídla – žebra', 0xC29A60],
    ['en', 'Gondoly + pylony', 0x8E8A84], ['tl', 'Ocasní plochy', 0xA8784A], ['gr', 'Podvozek', 0x55524D], ['rf', 'Pásnice + výztuhy', 0x1D9E75], ['jn', 'Spoje', 0xE24B4A]];
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  const DEF = { L: 80, P: 15, CW: 14, T: 3, S: '2,2', B: '1000,650' };
  const state = Object.assign({}, DEF);
  const vis = {}; GDEF.forEach(g => vis[g[0]] = true);

  // stav z URL (#L=80&P=15...)
  for (const kv of location.hash.replace(/^#/, '').split('&')) {
    const [k, v] = kv.split('='); if (k in DEF && v) state[k] = k === 'S' || k === 'B' ? decodeURIComponent(v) : +v;
  }
  ['L', 'P', 'CW', 'T', 'S', 'B'].forEach(id => $(id).value = state[id]);
  const unit = { L: ' cm', P: ' mm', CW: ' mm', T: ' mm' };
  const showVals = () => ['L', 'P', 'CW', 'T'].forEach(id => $('o' + id).textContent = (+$(id).value).toString().replace('.', ',') + unit[id]);
  showVals();

  $('leg').innerHTML = GDEF.map(g => `<label><input type="checkbox" data-g="${g[0]}" checked><span class="sw" style="background:${hex(g[2])}"></span>${g[1]} <span id="c_${g[0]}" style="color:var(--muted)"></span></label>`).join('');

  // ---------- three.js ----------
  let R, SC, C, ROOT, GR = {}, ST, K = 1, Tm = 3, GEO, yaw = -0.45, pit = -0.22, dist = 1500;
  const tgt = new THREE.Vector3(), MAT = {};
  GDEF.forEach(g => MAT[g[0]] = new THREE.MeshLambertMaterial({ color: g[2] }));
  const EDGE = new THREE.LineBasicMaterial({ color: 0x3a2c1a, transparent: true, opacity: 0.25 });
  const t3 = v => new THREE.Vector3(v[0], v[2], v[1]);

  function addPart(g, pts, O, U, V, o) {
    o = o || {}; const k = K;
    const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0] * k, p[1] * k)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: Tm, bevelEnabled: false, curveSegments: 2 }); geo.translate(0, 0, -Tm / 2);
    const u = t3(U), v = t3(V), n = new THREE.Vector3().crossVectors(u, v), m = new THREE.Matrix4().makeBasis(u, v, n);
    m.setPosition((O[0] - 42) * k, O[2] * k, O[1] * k); geo.applyMatrix4(m);
    GR[g].add(new THREE.Mesh(geo, MAT[g]));
    GR[g].add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), EDGE));
    if (o.noCount) return;
    let w, h;
    if (o.dims) [w, h] = o.dims;
    else { let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const p of pts) { a0 = Math.min(a0, p[0]); a1 = Math.max(a1, p[0]); b0 = Math.min(b0, p[1]); b1 = Math.max(b1, p[1]); } w = (a1 - a0) * k; h = (b1 - b0) * k; }
    count(g, o.name, w, h, 1);
  }
  function count(g, name, w, h, n) {
    const L = Math.max(w, h), S = Math.min(w, h);
    ST.n += n; ST[g] = (ST[g] || 0) + n; ST.area += n * (w + 8) * (h + 8) * (name && name.startsWith('Pásnice') ? 0.3 : 1);
    if (L > ST.bed[0] - 20 || S > ST.bed[1] - 20) ST.over += n;
    if (L > ST.mx[0]) ST.mx = [L, S, name];
  }
  function addJoint(p, s) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), MAT.jn), q = Math.max(6, 4 * Tm) * (s || 1);
    m.scale.set(q, q, q); m.position.set((p[0] - 42) * K, p[2] * K, p[1] * K); GR.jn.add(m);
  }

  function build() {
    Object.assign(state, { L: +$('L').value, P: +$('P').value, CW: +$('CW').value, T: +$('T').value, S: $('S').value, B: $('B').value });
    history.replaceState(null, '', '#' + Object.entries(state).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&'));
    const [nS, nW] = state.S.split(',').map(Number), bed = state.B.split(',').map(Number);
    K = 10 * state.L / 84; Tm = state.T;
    if (ROOT) { SC.remove(ROOT); ROOT.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    ROOT = new THREE.Group(); SC.add(ROOT);
    GDEF.forEach(g => { GR[g[0]] = new THREE.Group(); GR[g[0]].visible = vis[g[0]]; ROOT.add(GR[g[0]]); });
    ST = { n: 0, area: 0, over: 0, mx: [0, 0, ''], bed };
    GEO = M.buildModel({ L: state.L, P: state.P, T: state.T, CW: state.CW, nS, nW, bed }, { part: addPart, joint: addJoint, count });
    const k = K;
    GDEF.forEach(g => $('c_' + g[0]).textContent = g[0] === 'jn' ? GR.jn.children.length : (ST[g[0]] || 0));
    $('sS').textContent = '1 : ' + Math.round(84000 / (state.L * 10));
    $('sD').textContent = Math.round(84 * k / 10) + ' × ' + Math.round(88.4 * k / 10) + ' × ' + Math.round(18.1 * k / 10) + ' cm';
    $('sN').textContent = ST.n + ' dílů · ~' + Math.ceil(ST.area / ((bed[0] - 20) * (bed[1] - 20) * 0.65)) + ' desek';
    $('sX').textContent = (ST.over ? 'Přes limit: ' + ST.over + ' · ' : 'Vše se vejde · ') + 'max ' + Math.round(ST.mx[0]) + '×' + Math.round(ST.mx[1]) + ' mm (' + ST.mx[2] + ')';
    silhouette(); draw();
  }

  function init() {
    const cv = $('cv');
    R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
    R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    SC = new THREE.Scene(); C = new THREE.PerspectiveCamera(32, 1, 1, 50000);
    SC.add(new THREE.AmbientLight(0xffffff, 0.55));
    const d = new THREE.DirectionalLight(0xffffff, 0.7); d.position.set(0.4, 1, 0.6); SC.add(d);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.3); d2.position.set(-0.5, -0.4, -0.8); SC.add(d2);
    new ResizeObserver(resize).observe($('wrap')); resize(); orbit(cv);
  }
  function resize() { const w = $('wrap').clientWidth, h = $('wrap').clientHeight; R.setSize(w, h, true); C.aspect = w / h; C.updateProjectionMatrix(); draw(); }
  function draw() {
    if (!R || !ROOT) return;
    C.position.set(tgt.x + dist * Math.cos(pit) * Math.sin(yaw), tgt.y + dist * Math.sin(pit), tgt.z + dist * Math.cos(pit) * Math.cos(yaw));
    C.lookAt(tgt); R.render(SC, C);
  }
  function orbit(el) {
    const pts = new Map(); let pd = 0;
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const a = [...pts.values()]; pd = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); } });
    el.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; const o = pts.get(e.pointerId);
      if (pts.size === 1) { yaw -= (e.clientX - o[0]) * 0.01; pit = Math.max(-1.55, Math.min(1.55, pit + (e.clientY - o[1]) * 0.01)); }
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const a = [...pts.values()], nd = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (pd && nd) dist *= pd / nd; pd = nd; }
      draw();
    });
    const up = e => { pts.delete(e.pointerId); pd = 0; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); dist *= e.deltaY > 0 ? 1.1 : 0.9; draw(); }, { passive: false });
  }
  function setVis(only) {
    GDEF.forEach(g => { const on = only ? only.includes(g[0]) : true; vis[g[0]] = on; if (GR[g[0]]) GR[g[0]].visible = on; const cb = document.querySelector(`[data-g="${g[0]}"]`); if (cb) cb.checked = on; });
  }
  function view(y, p, f, t) {
    yaw = y; pit = p; dist = f * 88 * K;
    if (t) tgt.set((t[0] - 42) * K, t[2] * K, t[1] * K); else new THREE.Box3().setFromObject(ROOT).getCenter(tgt);
    draw();
  }
  const VIEWS = {
    photo: () => { setVis(); view(-0.45, -0.22, 1.55); }, iso: () => { setVis(); view(-0.7, 0.4, 1.9); },
    side: () => { setVis(); view(0, 0.01, 1.9); }, top: () => { setVis(); view(0, 1.55, 2.0); }, front: () => { setVis(); view(-Math.PI / 2, 0.05, 1.9); },
    tail: () => { setVis(); view(-1.0, 0.35, 0.55, [78, 0, 11]); },
    root: () => { setVis(['sp', 'sw', 'wg', 'rf', 'jn', 'en']); view(-0.35, 0.55, 0.5, [34, 0, 9]); },
    spar: () => { setVis(['sp', 'sw', 'rf']); view(-0.5, 0.5, 1.2, [40, 0, 9]); },
  };
  window.AN225_VIEW = n => VIEWS[n]();

  // ---------- bokorys / půdorys ----------
  function silhouette() {
    const G = GEO, W = M.WING, S = M.STAB, st = 'fill="none" stroke="currentColor" stroke-width="0.8"', pp = a => a.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
    const s = 348 / 86, X = x => 6 + x * s, Z = z => 86 - z * s; let o = '';
    o += `<line x1="0" y1="${Z(0)}" x2="360" y2="${Z(0)}" stroke="currentColor" stroke-width="0.5" stroke-dasharray="3 3"/>`;
    const ft = [], fb = []; for (let x = 0; x <= 84; x += 0.4) { ft.push([X(x), Z(M.fTop(x))]); fb.push([X(x), Z(M.fBot(x))]); }
    o += `<polygon points="${pp(ft.concat(fb.reverse()))}" ${st}/>`;
    o += `<polygon points="${pp(G.kp.map(p => [X(p[0]), Z(p[1])]))}" ${st}/>`;
    o += `<polygon points="${pp(M.airfoil(W.le(0), W.c(0), W.z(0), G.wth(0), 0.02).map(p => [X(p[0]), Z(p[1])]))}" ${st}/>`;
    o += `<line x1="${X(S.le(0))}" y1="${Z(G.SZ)}" x2="${X(S.le(16.3) + S.c(16.3))}" y2="${Z(G.SZ + G.sdh * 16.3)}" stroke="currentColor"/>`;
    for (const n of G.EN.filter(n => n.e > 0)) { const t = [], b = []; for (let x = n.xa; x <= n.xb; x += 0.25) { t.push([X(x), Z(n.ze + n.r(x))]); b.push([X(x), Z(n.ze - n.r(x))]); } o += `<polygon points="${pp(t.concat(b.reverse()))}" ${st}/>`; }
    for (const c of G.wcx) o += `<circle cx="${X(c)}" cy="${Z(0.63)}" r="${0.63 * s}" ${st}/>`;
    for (const c of [-0.6, 0.6]) o += `<circle cx="${X(G.xn + c)}" cy="${Z(0.6)}" r="${0.6 * s}" ${st}/>`;
    $('sv1').innerHTML = o;
    const t = 3.15, PX = x => 10 + x * t, PY = y => 145 - y * t; o = '';
    const fu = [], fl = []; for (let x = 0; x <= 84; x += 0.5) { const w = M.fW(x) + M.SPW * M.spn(x); fu.push([PX(x), PY(w)]); fl.push([PX(x), PY(-w)]); }
    o += `<polygon points="${pp(fu.concat(fl.reverse()))}" ${st}/>`;
    for (const sg of [1, -1]) {
      const w = []; for (let a = 0; a <= 44.2; a += 2.21) w.push([PX(W.le(a)), PY(sg * a)]); for (let a = 44.2; a >= 0; a -= 2.21) w.push([PX(W.le(a) + W.c(a)), PY(sg * a)]);
      o += `<polygon points="${pp(w)}" ${st}/>`;
      const h = []; for (let a = 0; a <= 16.3; a += 1.63) h.push([PX(S.le(a)), PY(sg * a)]); for (let a = 16.3; a >= 0; a -= 1.63) h.push([PX(S.le(a) + S.c(a)), PY(sg * a)]);
      o += `<polygon points="${pp(h)}" ${st}/>`;
      o += `<line x1="${PX(Math.min(...G.kp.map(p => p[0])))}" y1="${PY(sg * 16.3)}" x2="${PX(Math.max(...G.kp.map(p => p[0])))}" y2="${PY(sg * 16.3)}" stroke="currentColor" stroke-width="2"/>`;
    }
    for (const n of G.EN) { const tt = [], b = []; for (let x = n.xa; x <= n.xb; x += 0.25) { tt.push([PX(x), PY(n.e + n.r(x))]); b.push([PX(x), PY(n.e - n.r(x))]); } o += `<polygon points="${pp(tt.concat(b.reverse()))}" ${st}/>`; }
    $('sv2').innerHTML = o;
  }

  // ---------- události ----------
  ['L', 'P', 'CW', 'T'].forEach(id => { $(id).addEventListener('input', showVals); $(id).addEventListener('change', build); });
  ['S', 'B'].forEach(id => $(id).addEventListener('change', build));
  $('leg').addEventListener('change', e => { const g = e.target.dataset.g; if (!g) return; vis[g] = e.target.checked; GR[g].visible = vis[g]; draw(); });
  document.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => VIEWS[b.dataset.v]()));
  $('copy').addEventListener('click', () => {
    const txt = location.href;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => $('copied').textContent = 'Odkaz zkopírován.', () => $('copied').textContent = txt);
  });

  init(); build(); VIEWS.photo();
  window.AN225_READY = true;
})();
