// UI + 3D render (three.js r128) pro model An-225.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const M = window.AN225;
  const GDEF = [
    ['sp', 'Páteř', 0x7A5A32], ['rb', 'Trup – žebra', 0xD9B781], ['sw', 'Nosník – stojiny', 0x8A6438], ['wg', 'Křídla – žebra', 0xC29A60],
    ['en', 'Gondoly + pylony', 0x8E8A84], ['tl', 'Ocasní plochy', 0xA8784A], ['gr', 'Podvozek', 0x55524D], ['rf', 'Pásnice + výztuhy', 0x1D9E75]];
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  const DEF = { L: 80, P: 15, CW: 20, T: 3, S: '2,2', B: '1000,650', SM: 'groups', UL: 1 };
  const STRK = ['S', 'B', 'SM'];
  const state = Object.assign({}, DEF);
  const vis = {}; GDEF.forEach(g => vis[g[0]] = true);

  // stav z URL (#L=80&P=15...)
  for (const kv of location.hash.replace(/^#/, '').split('&')) {
    const [k, v] = kv.split('='); if (k in DEF && v) state[k] = STRK.includes(k) ? decodeURIComponent(v) : +v;
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
    for (const h of o.holes || []) sh.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0] * k, p[1] * k))));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: Tm, bevelEnabled: false, curveSegments: 2 }); geo.translate(0, 0, -Tm / 2);
    if (o.fold) {   // ohnutý díl (pásnice): plochý obrys → prostor po vrcholech, jedna síť bez čar v ohybu
      const pa = geo.attributes.position;
      for (let i = 0; i < pa.count; i++) { const q = o.fold(pa.getX(i) / k, pa.getY(i) / k, pa.getZ(i) / k); pa.setXYZ(i, (q[0] - 42) * k, q[2] * k, q[1] * k); }
      geo.computeVertexNormals();
    } else {
      const u = t3(U), v = t3(V), n = new THREE.Vector3().crossVectors(u, v), m = new THREE.Matrix4().makeBasis(u, v, n);
      m.setPosition((O[0] - 42) * k, O[2] * k, O[1] * k); geo.applyMatrix4(m);
    }
    const me = new THREE.Mesh(geo, MAT[g]); me.userData = { g, name: o.name || '' }; GR[g].add(me);
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
  function addJoint() {} // spoje se nevykreslují – díly se vejdou na stůl frézy, nenapojují se (jen laminují)


  function saveHash() { history.replaceState(null, '', '#' + Object.entries(state).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&')); }
  function build() {
    Object.assign(state, { L: +$('L').value, P: +$('P').value, CW: +$('CW').value, T: +$('T').value, S: $('S').value, B: $('B').value });
    saveHash();
    const [nS, nW] = state.S.split(',').map(Number), bed = state.B.split(',').map(Number);
    K = 10 * state.L / 84; Tm = state.T;
    if (ROOT) { SC.remove(ROOT); ROOT.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    ROOT = new THREE.Group(); SC.add(ROOT);
    GDEF.forEach(g => { GR[g[0]] = new THREE.Group(); GR[g[0]].visible = vis[g[0]]; ROOT.add(GR[g[0]]); });
    ST = { n: 0, area: 0, over: 0, mx: [0, 0, ''], bed };
    GEO = M.buildModel({ L: state.L, P: state.P, T: state.T, CW: state.CW, nS, nW, bed }, { part: addPart, joint: addJoint, count });
    const k = K;
    GDEF.forEach(g => $('c_' + g[0]).textContent = ST[g[0]] || 0);
    $('sS').textContent = '1 : ' + Math.round(84000 / (state.L * 10));
    $('sD').textContent = Math.round(84 * k / 10) + ' × ' + Math.round(88.4 * k / 10) + ' × ' + Math.round(18.1 * k / 10) + ' cm';
    $('sN').textContent = ST.n + ' dílů · ~' + Math.ceil(ST.area / ((bed[0] - 20) * (bed[1] - 20) * 0.65)) + ' desek';
    $('sX').textContent = (ST.over ? 'Přes limit: ' + ST.over + ' · ' : 'Vše se vejde · ') + 'max ' + Math.round(ST.mx[0]) + '×' + Math.round(ST.mx[1]) + ' mm (' + ST.mx[2] + ')';
    silhouette(); applyStress();
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
    root: () => { setVis(['sp', 'sw', 'wg', 'rf', 'en']); view(-0.35, 0.55, 0.5, [31, 6, 8.5]); },
    spar: () => { setVis(['sp', 'sw', 'rf']); view(-0.5, 0.5, 1.2, [38, 0, 8]); },
    tip: () => { setVis(); view(-0.55, 0.6, 0.16, [49, 41.5, 7.0]); },
    eng: () => { setVis(); view(-1.0, -0.25, 0.3, [38.5, 25.5, 6.0]); },
  };
  window.AN225_VIEW = (n, ...a) => n === 'custom' ? (setVis(a[4]), view(...a)) : VIEWS[n](); // custom: (yaw, pitch, zoom, [x,y,z], skupiny)

  // ---------- mapa namáhání ----------
  const SA = window.AN225_STRESS, GRAY = [0.78, 0.77, 0.74], VMAT = new THREE.MeshLambertMaterial({ vertexColors: true });
  $('SM').innerHTML = '<option value="groups">Vypnuto – barvy skupin</option>' + SA.LC.map(l => `<option value="${l.id}">${l.name}</option>`).join('') + '<option value="env">Obálka – maximum ze všech stavů</option>';
  $('SM').value = state.SM;
  function applyStress() {
    const mode = state.SM, STR = mode === 'groups' ? null : mode === 'env' ? SA.envelope(GEO.struct) : SA.analyze(GEO.struct, mode);
    ROOT.traverse(o => {
      const ud = o.userData; if (!o.isMesh || !ud || !ud.g) return;
      if (!STR) { o.material = MAT[ud.g]; return; }
      const pos = o.geometry.attributes.position, n = pos.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = STR.field(ud.g, ud.name, [pos.getX(i) / K + 42, pos.getZ(i) / K, pos.getY(i) / K]);
        col.set(u == null ? GRAY : SA.color(u), i * 3);
      }
      o.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); o.material = VMAT;
    });
    $('smBox').hidden = !STR;
    if (STR) $('smTab').innerHTML = '<tr><th>Místo</th><th>σ</th><th>Využití</th></tr>' + STR.crit.map(c => {
      const pc = Math.round(c.u * 100), col = SA.color(c.u).map(v => Math.round(v * 255)).join(',');
      return `<tr title="${c.what}"><td>${c.label}</td><td>${c.s.toFixed(1).replace('.', ',')} MPa</td><td><span class="pill" style="background:rgb(${col})">${pc} %</span></td></tr>`;
    }).join('');
    draw();
  }

  // ---------- výkres jako podklad (načítá se ze zdroje, není součástí repozitáře) ----------
  const DRAW_URL = 'https://drawingdatabase.com/wp-content/uploads/2014/03/An-225-3.jpg';
  function underlay(view) {
    if (!state.UL) return '';
    // kalibrace viz js/an225-ref.js: bokorys 19,83 px/m, příď u=162, země v=425; půdorys 20,04/20,25 px/m, příď v=283, osa u=1922
    // ořez (px výkresu): jen daný pohled, bez sousedních pohledů a detailů
    let tr, clip;
    if (view === 'side') { const q = (348 / 86) / 19.83; tr = `translate(${6 - 162 * q} ${86 - 425 * q}) scale(${q})`; clip = ['100,30 1880,30 1880,440 100,440']; }
    else {
      tr = `matrix(0 ${-3.15 / 20.25} ${3.15 / 20.04} 0 ${10 - 3.15 * 283 / 20.04} ${145 + 3.15 * 1922 / 20.25})`;
      clip = ['1880,272 1965,272 2015,420 2015,1995 1835,1995 1835,420',                       // trup
        '1842,650 1350,950 1300,1070 1030,1232 1030,1350 1700,1160 2144,1160 2815,1350 2815,1232 2540,1090 2500,976 2002,650', // křídla + gondoly
        '1870,1590 1600,1790 1600,1995 2250,1995 2250,1790 1975,1590'];                        // ocasní plochy
    }
    return `<defs><clipPath id="cl_${view}" clipPathUnits="userSpaceOnUse">${clip.map(p => `<polygon points="${p}"/>`).join('')}</clipPath></defs>` +
      `<g transform="${tr}" class="ul"><image href="${DRAW_URL}" width="2862" height="1983" clip-path="url(#cl_${view})" preserveAspectRatio="none"/></g>`;
  }

  // ---------- bokorys / půdorys ----------
  function silhouette() {
    const G = GEO, W = M.WING, S = M.STAB, st = 'fill="none" stroke="currentColor" stroke-width="0.8"', pp = a => a.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
    const s = 348 / 86, X = x => 6 + x * s, Z = z => 86 - z * s; let o = '';
    o += `<line x1="0" y1="${Z(0)}" x2="360" y2="${Z(0)}" stroke="currentColor" stroke-width="0.5" stroke-dasharray="3 3"/>`;
    const ft = [], fb = []; for (let x = 0; x <= M.XE + 1e-6; x += 0.25) { ft.push([X(x), Z(G.top(x))]); fb.push([X(x), Z(M.fBot(x))]); }
    o += `<polygon points="${pp(ft.concat(fb.reverse()))}" ${st}/>`;
    o += `<polygon points="${pp(G.kp.map(p => [X(p[0]), Z(p[1])]))}" ${st}/>`;
    o += `<polygon points="${pp(G.foil(0).map(p => [X(p[0]), Z(p[1])]))}" ${st}/>`;
    o += `<rect x="${X(S.le(0))}" y="${Z(G.SZ + G.tS / 2)}" width="${(S.te(S.semi) - S.le(0)) * s}" height="${G.tS * s}" ${st}/>`;
    for (const n of G.EN.filter(n => n.e > 0)) { const t = [], b = []; for (let x = n.xa; x <= n.xb; x += 0.25) { t.push([X(x), Z(n.ze + n.r(x))]); b.push([X(x), Z(n.ze - n.r(x))]); } o += `<polygon points="${pp(t.concat(b.reverse()))}" ${st}/>`; }
    for (const c of G.wcx) o += `<circle cx="${X(c)}" cy="${Z(G.wr)}" r="${G.wr * s}" ${st}/>`;
    for (const c of [-0.6, 0.6]) o += `<circle cx="${X(G.xn + c)}" cy="${Z(G.nr)}" r="${G.nr * s}" ${st}/>`;
    $('sv1').innerHTML = underlay('side') + o;
    const t = 3.15, PX = x => 10 + x * t, PY = y => 145 - y * t; o = '';
    const fu = [], fl = []; for (let x = 0; x <= M.XE + 1e-6; x += 0.25) { const w = M.fW(x); fu.push([PX(x), PY(w)]); fl.push([PX(x), PY(-w)]); }
    o += `<polygon points="${pp(fu.concat(fl.reverse()))}" ${st}/>`;
    const ys = []; for (let a = 0; a < W.semi - 1.6; a += 1.0) ys.push(a); for (let a = W.semi - 1.6; a <= W.semi + 1e-6; a += 0.1) ys.push(a);
    for (const sg of [1, -1]) {
      const w = ys.map(a => [PX(W.le(a)), PY(sg * a)]).concat(ys.slice().reverse().map(a => [PX(W.te(a)), PY(sg * a)]));
      o += `<polygon points="${pp(w)}" ${st}/>`;
      const h = [[PX(S.le(0)), PY(0)], [PX(S.le(S.semi)), PY(sg * S.semi)], [PX(S.te(S.semi)), PY(sg * S.semi)], [PX(S.te(0)), PY(0)]];
      o += `<polygon points="${pp(h)}" ${st}/>`;
      o += `<line x1="${PX(Math.min(...G.kp.map(p => p[0])))}" y1="${PY(sg * S.semi)}" x2="${PX(Math.max(...G.kp.map(p => p[0])))}" y2="${PY(sg * S.semi)}" stroke="currentColor" stroke-width="2"/>`;
    }
    for (const n of G.EN) { const tt = [], b = []; for (let x = n.xa; x <= n.xb; x += 0.25) { tt.push([PX(x), PY(n.e + n.r(x))]); b.push([PX(x), PY(n.e - n.r(x))]); } o += `<polygon points="${pp(tt.concat(b.reverse()))}" ${st}/>`; }
    $('sv2').innerHTML = underlay('plan') + o;
  }

  // ---------- události ----------
  ['L', 'P', 'CW', 'T'].forEach(id => { $(id).addEventListener('input', showVals); $(id).addEventListener('change', build); });
  ['S', 'B'].forEach(id => $(id).addEventListener('change', build));
  $('SM').addEventListener('change', () => { state.SM = $('SM').value; saveHash(); applyStress(); });
  $('UL').checked = !!state.UL; $('UL').addEventListener('change', () => { state.UL = $('UL').checked ? 1 : 0; saveHash(); silhouette(); });
  $('leg').addEventListener('change', e => { const g = e.target.dataset.g; if (!g) return; vis[g] = e.target.checked; GR[g].visible = vis[g]; draw(); });
  document.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => VIEWS[b.dataset.v]()));
  $('copy').addEventListener('click', () => {
    const txt = location.href;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => $('copied').textContent = 'Odkaz zkopírován.', () => $('copied').textContent = txt);
  });

  init(); build(); VIEWS.photo();
  window.AN225_READY = true;
})();
