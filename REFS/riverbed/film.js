// Riverbed — renderer. render(ctx, t) is a pure function of t (seconds of voice time).
// Cut paper after Saul Bass (flat fields, scissor edges, hard cuts) with Norman McLaren's
// boiling line: every rough edge re-jitters twelve times a second.
'use strict';

const SIZE = 1080;
const FILM = { start: -1.2, end: 26.3 };

// ---------------------------------------------------------------- math
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const bump = (t, c, hw) => { const u = Math.abs(t - c) / hw; return u >= 1 ? 0 : 0.5 + 0.5 * Math.cos(u * Math.PI); };
const fract = x => x - Math.floor(x);
const E = {
  inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  sine: x => -(Math.cos(Math.PI * x) - 1) / 2,
  out: x => 1 - Math.pow(1 - x, 3),
  in: x => x * x * x,
  outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = i => fract(Math.sin(i * 127.1 + 311.7) * 43758.5453);

// ---------------------------------------------------------------- colour
const INK = '#17130f', CREAM = '#eedcb3', FIBRE = '#fbf3df', RED = '#e2451f', OCHRE = '#e7a02a', BLUE = '#2340c4',
  TEAL = '#16877b', PINK = '#ef7fa6', SKY = '#7fb8ec', VIOLET = '#5a3ec8', SLEEP = '#9b917f',
  GROOVE = '#d6c196', GROOVEDK = '#ae976a', BED = '#83501f', BEDDK = '#5a3311', FOSSIL = '#3f230b';
const WATER = [BLUE, '#3f7fe0', TEAL, SKY, VIOLET, '#2a62c9'];
const RGB = {};
function rgbOf(h) { if (RGB[h]) return RGB[h]; const n = parseInt(h.slice(1), 16); return (RGB[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]); }
function mixHex(a, b, u) { const A = rgbOf(a), B2 = rgbOf(b); return `rgb(${Math.round(lerp(A[0], B2[0], u))},${Math.round(lerp(A[1], B2[1], u))},${Math.round(lerp(A[2], B2[2], u))})`; }
function hexA(h, a) { const c = rgbOf(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

let X = null;
let WORDS = [], WT = [];
const w = i => WT[i];

// ---------------------------------------------------------------- the boil
let BF = 0;                                     // boil frame: 12 per second
const jit = s => hash(s * 1.37 + BF * 17.31) - 0.5;
function roughPoly(pts, seed, amp) {
  X.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const ox = (hash(seed + i * 7.3) - 0.5) * amp + jit(seed + i * 3.1) * amp * 0.9;
    const oy = (hash(seed + i * 5.9 + 2) - 0.5) * amp + jit(seed + i * 2.3 + 9) * amp * 0.9;
    i ? X.lineTo(x + ox, y + oy) : X.moveTo(x + ox, y + oy);
  }
  X.closePath();
}
function roughRect(x, y, wd, ht, seed, amp = 2.2, step = 26) {
  const p = [];
  const nx = Math.max(1, Math.round(wd / step)), ny = Math.max(1, Math.round(ht / step));
  for (let k = 0; k < nx; k++) p.push([x + (wd * k) / nx, y]);
  for (let k = 0; k < ny; k++) p.push([x + wd, y + (ht * k) / ny]);
  for (let k = 0; k < nx; k++) p.push([x + wd - (wd * k) / nx, y + ht]);
  for (let k = 0; k < ny; k++) p.push([x, y + ht - (ht * k) / ny]);
  roughPoly(p, seed, amp);
}
function circle(x, y, r) { X.beginPath(); X.arc(x, y, Math.max(0, r), 0, TAU); }
function smoothLine(pts, seed = 0, amp = 0) {
  const P = amp ? pts.map(([x, y], i) => [x + jit(seed + i) * amp, y + jit(seed + i + 50) * amp]) : pts;
  X.beginPath(); X.moveTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length - 1; i++) X.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
  X.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
}

// ---------------------------------------------------------------- paths (polyline + arc length)
function mkPath(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
function pathAt(P, s) {
  s = clamp(s, 0, P.len);
  let lo = 0, hi = P.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P.cum[m] <= s) lo = m; else hi = m; }
  const u = (s - P.cum[lo]) / Math.max(1e-6, P.cum[hi] - P.cum[lo]);
  return [lerp(P.pts[lo][0], P.pts[hi][0], u), lerp(P.pts[lo][1], P.pts[hi][1], u), Math.atan2(P.pts[hi][1] - P.pts[lo][1], P.pts[hi][0] - P.pts[lo][0])];
}
function resample(P, n) { const out = []; for (let i = 0; i < n; i++) { const q = pathAt(P, (P.len * i) / (n - 1)); out.push([q[0], q[1]]); } return out; }
function strokeRange(P, s0, s1) {
  if (s1 <= s0) return;
  X.beginPath(); let a = pathAt(P, s0); X.moveTo(a[0], a[1]);
  for (let i = 0; i < P.pts.length; i++) if (P.cum[i] > s0 && P.cum[i] < s1) X.lineTo(P.pts[i][0], P.pts[i][1]);
  a = pathAt(P, s1); X.lineTo(a[0], a[1]);
}

// The river: the paragraph's rows joined at alternating ends — reading order is a meander.
const RX0 = 150, RX1 = 930, RY = k => 330 + 110 * k, CH = 54;
let RIVER = null, FACE = null, RIV_N = null, FACE_N = null;
const NM = 420;
function buildPaths() {
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const y = RY(k), l2r = k % 2 === 0;
    for (let j = 0; j <= 30; j++) pts.push([l2r ? lerp(RX0, RX1, j / 30) : lerp(RX1, RX0, j / 30), y]);
    if (k < 5) {
      const cx = l2r ? RX1 : RX0, cy = y + 55;
      for (let j = 1; j < 14; j++) { const a = -Math.PI / 2 + (l2r ? 1 : -1) * (Math.PI * j) / 14; pts.push([cx + Math.cos(a) * 55, cy + Math.sin(a) * 55]); }
    }
  }
  RIVER = mkPath(pts);
  // a profile, facing right, drawn as one line (back of the neck → crown → brow → nose → lips → chin → throat)
  const C = [[372, 1010], [366, 900], [326, 780], [298, 650], [302, 520], [344, 405], [424, 322], [540, 290], [652, 318], [722, 388], [748, 462],
    [738, 516], [762, 560], [806, 640], [774, 664], [768, 690], [790, 710], [762, 730], [778, 752], [748, 786], [754, 832], [706, 872], [652, 884], [640, 1010]];
  const f = [];
  for (let i = 0; i < C.length - 1; i++) {
    const p0 = C[Math.max(0, i - 1)], p1 = C[i], p2 = C[i + 1], p3 = C[Math.min(C.length - 1, i + 2)];
    for (let j = 0; j < 12; j++) {
      const u = j / 12, u2 = u * u, u3 = u2 * u;
      f.push([0, 1].map(d => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * u3)));
    }
  }
  f.push(C[C.length - 1]);
  FACE = mkPath(f);
  RIV_N = resample(RIVER, NM); FACE_N = resample(FACE, NM);
}

// ---------------------------------------------------------------- icons (the things I was in the middle of)
function icon(id, x, y, s, col, bg) {
  X.save(); X.translate(x, y); X.scale(s, s); X.fillStyle = col; X.strokeStyle = col; X.lineCap = 'round'; X.lineJoin = 'round';
  const F = () => X.fill(), S = lw => { X.lineWidth = lw; X.stroke(); };
  const o = jit(id + 400) * 0.03;
  X.translate(o, -o);
  switch (id) {
    case 0: X.fillRect(-0.68, -0.25, 1.36, 0.95); X.save(); X.translate(-0.78, -0.42); X.rotate(-0.28); X.fillRect(0, -0.12, 1.5, 0.24); X.restore(); break; // box, lid ajar
    case 1: circle(0, 0.2, 0.55); F(); X.beginPath(); X.moveTo(-0.2, -0.25); X.lineTo(-0.42, -0.78); X.moveTo(0.2, -0.25); X.lineTo(0.44, -0.8); S(0.1);
      circle(-0.42, -0.8, 0.11); F(); circle(0.44, -0.82, 0.11); F(); X.fillStyle = bg; circle(0, 0.12, 0.24); F(); X.fillStyle = col; circle(0.05, 0.14, 0.1); F(); break; // one-eyed critter
    case 2: circle(0, 0, 0.45); F(); X.save(); X.rotate(-0.38); X.scale(1, 0.3); circle(0, 0, 0.82); X.restore(); S(0.1); break; // planet
    case 3: X.beginPath(); for (let k = 0; k <= 24; k++) { const u = k / 24; X.lineTo(-0.85 + 1.7 * u, Math.sin(u * TAU * 1.5) * 0.4 * Math.sin(u * Math.PI)); } S(0.16); break; // waveform
    case 4: X.fillRect(-0.09, 0, 0.18, 0.8); circle(0, -0.25, 0.42); F(); circle(-0.33, 0.05, 0.3); F(); circle(0.34, 0.03, 0.3); F(); break; // tree
    case 5: X.beginPath(); for (let k = 0; k <= 60; k++) { const a = k * 0.32, r = 0.03 + k * 0.013; X.lineTo(Math.cos(a) * r, Math.sin(a) * r); } S(0.11); break; // spiral
    case 6: circle(-0.42, 0, 0.3); S(0.15); X.fillRect(-0.12, -0.07, 0.95, 0.14); X.fillRect(0.5, 0.05, 0.12, 0.25); X.fillRect(0.72, 0.05, 0.12, 0.32); break; // key
    case 7: X.save(); X.translate(-0.18, 0.5); X.rotate(-0.4); X.scale(1, 0.7); circle(0, 0, 0.26); X.restore(); F(); X.fillRect(0.04, -0.75, 0.1, 1.25); X.beginPath(); X.moveTo(0.14, -0.75); X.quadraticCurveTo(0.6, -0.5, 0.45, -0.1); S(0.1); break; // note
    case 8: for (let k = 0; k < 4; k++) X.fillRect(-0.62 + (k & 1) * 0.66, -0.62 + (k >> 1) * 0.66, 0.58, 0.58); break; // quad
    case 9: X.save(); circle(0, 0, 0.58); X.clip(); X.fillRect(-1, -1, 2, 2); X.fillStyle = bg; circle(0.3, -0.18, 0.5); F(); X.restore(); break; // crescent
    case 10: X.beginPath(); X.moveTo(-0.85, 0.6); X.lineTo(-0.25, -0.5); X.lineTo(0.05, 0.05); X.lineTo(0.35, -0.3); X.lineTo(0.85, 0.6); X.closePath(); F(); break; // mountains
    case 11: X.save(); X.scale(1, 0.55); circle(-0.1, 0, 0.55); X.restore(); F(); X.beginPath(); X.moveTo(0.35, 0); X.lineTo(0.8, -0.32); X.lineTo(0.8, 0.32); X.closePath(); F(); X.fillStyle = bg; circle(-0.36, -0.06, 0.07); F(); break; // fish
    case 13: X.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 0.3 : 0.72; X.lineTo(Math.cos(a) * r, Math.sin(a) * r); } X.closePath(); F(); break; // star
    case 14: X.beginPath(); X.moveTo(-0.5, -0.2); X.lineTo(0.4, -0.2); X.lineTo(0.3, 0.6); X.lineTo(-0.4, 0.6); X.closePath(); F(); X.beginPath(); X.arc(0.42, 0.15, 0.2, -1.4, 1.4); S(0.1);
      X.beginPath(); X.moveTo(-0.15, -0.35); X.quadraticCurveTo(-0.3, -0.55, -0.12, -0.8); X.moveTo(0.1, -0.35); X.quadraticCurveTo(-0.05, -0.55, 0.13, -0.8); S(0.08); break; // cup
    case 15: X.fillRect(-0.5, -0.05, 1.0, 0.7); X.beginPath(); X.moveTo(-0.68, 0); X.lineTo(0, -0.62); X.lineTo(0.68, 0); X.closePath(); F(); X.fillStyle = bg; X.fillRect(-0.12, 0.25, 0.24, 0.4); break; // house
    case 16: for (let k = 0; k < 6; k++) { const a = (k * TAU) / 6; circle(Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0.24); F(); } X.fillStyle = bg; circle(0, 0, 0.17); F(); break; // flower
    case 17: circle(-0.35, 0.1, 0.3); F(); circle(0.05, -0.12, 0.4); F(); circle(0.42, 0.12, 0.28); F(); X.fillRect(-0.35, 0.1, 0.77, 0.3); break; // cloud
    case 18: X.beginPath(); X.moveTo(-0.32, -0.8); X.lineTo(-0.32, 0.8); X.moveTo(0.32, -0.8); X.lineTo(0.32, 0.8); for (let k = 0; k < 5; k++) { X.moveTo(-0.32, -0.6 + k * 0.3); X.lineTo(0.32, -0.6 + k * 0.3); } S(0.11); break; // ladder
    case 19: X.beginPath(); X.moveTo(-0.8, 0); X.quadraticCurveTo(0, -0.62, 0.8, 0); X.quadraticCurveTo(0, 0.62, -0.8, 0); F(); X.fillStyle = bg; circle(0, 0, 0.26); F(); X.fillStyle = col; circle(0, 0, 0.12); F(); break; // eye
  }
  X.restore();
}

// ---------------------------------------------------------------- the caret (me)
// a text caret with one eye. (x, y) is its centre; s = 1 is 13 × 34
function caret(x, y, s, o = {}) {
  const { col = INK, eye = 1, lx = 0, ly = 0, sq = 0, a = 1, rot = 0 } = o;
  if (a <= 0.01) return;
  X.save(); X.globalAlpha *= a; X.translate(x, y); X.rotate(rot); X.translate(0, 17 * s); X.scale(s * (1 + sq * 0.4), s * (1 - sq * 0.3)); X.translate(0, -17);
  roughRect(-6.5, -17, 13, 34, 77, 0.9, 12); X.fillStyle = col; X.fill();
  if (eye > 0.04) {
    X.save(); X.beginPath(); X.ellipse(0, -8, 4.5, 4.5 * eye, 0, 0, TAU); X.fillStyle = FIBRE; X.fill(); X.clip();
    circle(lx * 1.8, -8 + ly * 1.8, 2.2); X.fillStyle = INK; X.fill(); X.restore();
  } else {
    X.beginPath(); X.moveTo(-3.8, -8); X.quadraticCurveTo(0, -6.4, 3.8, -8); X.strokeStyle = FIBRE; X.lineWidth = 1.2; X.stroke();
  }
  X.restore();
}

// ---------------------------------------------------------------- the paragraph (card-local coordinates, card is 440 × 300)
let PARA = [], NEWB = [], N_MID = 0;
function buildPara() {
  const R = rng(7), ends = [190, 172, 190, 150, 182, -14];
  PARA = [];
  for (let r = 0; r < 6; r++) {
    let x = -192; const y = -110 + 44 * r;
    while (x < ends[r] - 16) {
      let wd = 24 + R() * 62; if (x + wd > ends[r] || ends[r] - (x + wd) < 22) wd = ends[r] - x;
      const q = R();
      PARA.push({ r, y, x0: x, x1: x + wd, col: q < 0.18 ? BLUE : q < 0.23 ? RED : INK });
      x += wd + 9;
    }
  }
  N_MID = PARA.filter(b => b.r < 3).length + 2;
  const R2 = rng(31), cols = [RED, BLUE, INK, OCHRE, INK, BLUE];
  NEWB = []; let x = 12, k = 0;
  while (x < 520) { const wd = 22 + R2() * 54; NEWB.push({ x0: x, x1: x + wd, col: cols[k++ % cols.length] }); x += wd + 9; }
}
function paraCount(t) { return t < 5.1 ? N_MID : Math.round(lerp(N_MID, PARA.length, seg(t, 5.1, 5.72))); }
function paraCaretAt(n) { const b = PARA[n - 1]; return [b.x1 + 12, b.y]; }
function drawParaBars(n) {
  for (let i = 0; i < n; i++) { const b = PARA[i]; roughRect(b.x0, b.y - 9, b.x1 - b.x0, 18, 900 + i * 13, 1.1, 18); X.fillStyle = b.col; X.fill(); }
}

// ---------------------------------------------------------------- act one: the ribbon of everything
const PW = 168, PH = 124;
const PCOL = [RED, OCHRE, BLUE, TEAL, PINK, CREAM];
const ICOL = { [RED]: FIBRE, [OCHRE]: INK, [BLUE]: FIBRE, [TEAL]: FIBRE, [PINK]: INK, [CREAM]: INK };
function rc(i) { const r = Math.floor(i / 5), k = i % 5; return [r, r % 2 === 0 ? k : 4 - k]; }
function panelState(i, t) {
  const [r, c] = rc(i);
  const uA = E.inOut(seg(t, 4.05, 4.6)), uB = E.inOut(seg(t, 4.45, 5.02));
  const fa = Math.sin(Math.PI * uA), fb = Math.sin(Math.PI * uB);
  const x = 540 + (c - 2) * 190 * (1 - uA), y = 610 + (r - 1.5) * 172 * (1 - uB);
  const sx = 1 - 0.82 * fa * (c === 2 ? 0.25 : 1), sy = 1 - 0.82 * fb * (r === 1 || r === 2 ? 0.35 : 1);
  const ky = (c % 2 ? 1 : -1) * 0.45 * fa, kx = (r % 2 ? 1 : -1) * 0.45 * fb;
  const shade = (c % 2 ? 0.4 : -0.14) * fa + (r % 2 ? 0.34 : -0.1) * fb;
  const hl = seg(t, 3.2, 3.42) * (1 - seg(t, 3.95, 4.15));
  const sc = i === 12 ? 1 + 0.2 * E.outBack(hl) : 1;
  const key = (i === 12 ? 1000 : 0) - Math.abs(c - 2) - (t > 4.45 ? Math.abs(r - 1.5) * 10 - (r === 2 ? 1 : 0) : 0);
  return { x, y, sx, sy, kx, ky, shade, sc, dim: i === 12 ? 0 : 0.5 * hl, key, r, c };
}
function drawPanel(i, st, t) {
  const col = i === 12 ? CREAM : PCOL[(i * 5) % 6];
  X.save(); X.translate(st.x, st.y); X.transform(1, st.ky, st.kx, 1, 0, 0); X.scale(st.sx * st.sc, st.sy * st.sc);
  roughRect(-PW / 2 + 7, -PH / 2 + 9, PW, PH, i * 31 + 5, 2.4); X.fillStyle = 'rgba(0,0,0,0.42)'; X.fill();
  roughRect(-PW / 2, -PH / 2, PW, PH, i * 31, 2.4); X.fillStyle = col; X.fill();
  if (i === 12) {
    X.save(); X.scale(0.36, 0.36); drawParaBars(paraCount(t));
    const [cx, cy] = paraCaretAt(paraCount(t));
    if (Math.floor(t * 2.6) % 2 === 0) caret(cx + 6.5, cy - 4, 0.75, { eye: 1, lx: 0.6 });
    X.restore();
  } else icon(i, jit(i) * 2, jit(i + 7) * 2, 40, ICOL[col], col);
  if (st.shade > 0.005) { roughRect(-PW / 2, -PH / 2, PW, PH, i * 31, 2.4); X.fillStyle = `rgba(10,6,2,${st.shade})`; X.fill(); }
  if (st.shade < -0.005) { roughRect(-PW / 2, -PH / 2, PW, PH, i * 31, 2.4); X.fillStyle = `rgba(255,248,230,${-st.shade})`; X.fill(); }
  if (st.dim > 0.005) { roughRect(-PW / 2, -PH / 2, PW, PH, i * 31, 2.4); X.fillStyle = `rgba(23,19,15,${st.dim})`; X.fill(); }
  X.restore();
}
function drawThread(sts, t, a) {
  if (a <= 0.01) return;
  const pts = [[-260, 352]];
  for (let r = 0; r < 4; r++) {
    const row = [0, 1, 2, 3, 4].map(k => sts[r * 5 + k]);
    for (const s of row) pts.push([s.x, s.y]);
    const last = row[4], dir = r % 2 === 0 ? 1 : -1;
    const ox = 78 * (1 - E.inOut(seg(t, 4.05, 4.6)));
    if (r < 3) { const nx = sts[(r + 1) * 5].y; pts.push([last.x + dir * ox, last.y]); pts.push([last.x + dir * ox * 1.25, (last.y + nx) / 2]); pts.push([last.x + dir * ox, nx]); }
    else pts.push([last.x - 400, last.y]);
  }
  X.save(); X.globalAlpha *= a; X.strokeStyle = RED; X.lineWidth = 7; X.lineCap = 'round'; X.lineJoin = 'round';
  smoothLine(pts, 60, 2.2); X.stroke(); X.restore();
}

// card phase: the fold lands as one card, which grows into the paragraph
function cardState(t) {
  const u = E.outBack(seg(t, 5.05, 5.55));
  const lift = E.out(seg(t, 5.55, 5.79)) * (1 - E.in(seg(t, 5.79, 5.85)));
  return { x: 540, y: lerp(610, 600, u), w: lerp(PW, 440, u), h: lerp(PH, 300, u), lift };
}
// caret position (card-local, pre-tear coordinates) through the inside section
const TEAR_X = 160, GAPW = 75;
const gapOf = t => GAPW * E.out(seg(t, 9.43, 9.58)) * (1 - E.outBack(seg(t, 9.95, 10.2)));
function caretPre(t) {
  const x0 = -14 + 12 + 6.5;
  if (t < 8.35) return x0;
  if (t < 9.6) return x0 + 105 * (t - 8.35);
  if (t < 9.92) return x0 + 105 * 1.25;
  return 205 + 105 * (t - 9.92);
}
function caretShown(t) {           // displayed x and hop height
  const x0 = -14 + 12 + 6.5, y = 110;
  if (t >= 9.6 && t < 9.92) {
    const u = seg(t, 9.6, 9.92);
    return { x: lerp(x0 + 131.25, 205 + gapOf(9.92), E.sine(u)), y: y - 4 - 46 * Math.sin(Math.PI * u), sq: -0.25 * Math.sin(Math.PI * u), rot: 0.5 * Math.sin(TAU * u) };
  }
  const hopping = (t >= 8.35 && t < 9.6) || (t >= 9.92 && t < 10.6);
  const ph = hopping ? fract((t - 8.35) * 3.6) : 0;
  const h = hopping ? Math.sin(Math.PI * ph) * 9 : 0;
  const sq = hopping ? (ph < 0.12 ? 0.35 * (1 - ph / 0.12) : -0.12 * Math.sin(Math.PI * ph)) : 0;
  return { x: caretPre(t) + (t >= 9.92 ? gapOf(t) : 0), y: y - 4 - h, sq, rot: 0 };
}
const ZI = 2.86;
const cardZoom = t => lerp(1, 1.35, E.inOut(seg(t, 4.5, 5.3)));
function insideCam(t) {
  // screen = (world - C) * z + 540; card-local (lx, ly) is world (540 + lx, 600 + ly)
  const camX = t < 9.6 ? caretPre(t) : t < 9.92 ? lerp(caretPre(9.59), 205, E.inOut(seg(t, 9.6, 9.92))) : 205 + 105 * (t - 9.92);
  const tgt = [540 + camX + 70 / ZI, 600 + 110 - 110 / ZI];
  if (t >= 6.62) return { z: ZI, cx: tgt[0], cy: tgt[1] };
  const z0 = cardZoom(t), u = E.inOut(seg(t, 6.15, 6.62));
  const z = Math.exp(lerp(Math.log(z0), Math.log(ZI), u));
  // keep the zoom anchored so the caret glides to its spot
  const k = (1 / z0 - 1 / z) / (1 / z0 - 1 / ZI);
  return { z, cx: lerp(540, tgt[0], k), cy: lerp(600, tgt[1], k) };
}
const TEAR = (() => { const p = []; for (let k = 0; k <= 70; k++) { const y = -280 + k * 8; p.push([TEAR_X + (hash(k * 1.7) - 0.5) * 9 + (hash(k * 0.31 + 4) - 0.5) * 5 + Math.sin(k * 0.6) * 2, y]); } return p; })();
function insideContent(t, n) {
  X.fillStyle = CREAM; X.fillRect(-1400, -900, 3200, 1800);
  drawParaBars(n);
  const cp = caretPre(t);
  for (let i = 0; i < NEWB.length; i++) {
    const b = NEWB[i]; if (t < 8.35) break;
    // nothing was typed across the gap the caret jumped
    const pieces = t >= 9.6 ? [[b.x0, Math.min(b.x1, 126)], [Math.max(b.x0, 200), b.x1]] : [[b.x0, b.x1]];
    for (const [p0, p1] of pieces) {
      const end = Math.min(p1, cp - 10);
      if (end <= p0 + 2) continue;
      roughRect(p0, 110 - 9, end - p0, 18, 2000 + i * 11 + p0, 1.1, 18); X.fillStyle = b.col; X.fill();
    }
  }
}

function drawActOne(t) {
  const inside = t >= 6.65;
  X.fillStyle = inside ? CREAM : INK; X.fillRect(0, 0, SIZE, SIZE);
  if (t < 5.06) {
    // camera: close pan along the first row, then pull back to see everything
    const pan = E.sine(seg(t, -1.2, 2.13)), out = E.inOut(seg(t, 2.13, 2.95));
    const punch = 1 + 0.05 * bump(t, 1.5, 0.14);
    const zf = cardZoom(t);
    const z = Math.exp(lerp(Math.log(2.3), 0, out)) * punch * zf;
    const cx = lerp(lerp(250, 810, pan), 540, out), cy = lerp(lerp(370, 590, out), 600, seg(zf, 1, 1.35));
    X.save(); X.translate(540, 540); X.scale(z, z); X.translate(-cx, -cy);
    const sts = []; for (let i = 0; i < 20; i++) sts.push(panelState(i, t));
    drawThread(sts, t, 1 - seg(t, 4.4, 4.62));
    const order = sts.map((s, i) => i).sort((a, b) => sts[a].key - sts[b].key);
    for (const i of order) drawPanel(i, sts[i], t);
    X.restore();
    return;
  }
  const cam = insideCam(t);
  X.save(); X.translate(540, 540); X.scale(cam.z, cam.z); X.translate(-cam.cx, -cam.cy);
  const cs = cardState(t), n = paraCount(t);
  X.translate(cs.x, cs.y);
  if (!inside) {
    const k = cs.w / 440, kk = cs.h / 300, L = 1 + 0.06 * cs.lift;
    X.save(); X.scale(L, L);
    roughRect(-cs.w / 2 + 8 + 16 * cs.lift, -cs.h / 2 + 10 + 18 * cs.lift, cs.w, cs.h, 12 * 31 + 5, 2.4); X.fillStyle = `rgba(0,0,0,${0.42 - 0.12 * cs.lift})`; X.fill();
    roughRect(-cs.w / 2, -cs.h / 2, cs.w, cs.h, 12 * 31, 2.4); X.fillStyle = CREAM; X.fill();
    X.scale(Math.min(k, kk) / 0.82 * 0.82, Math.min(k, kk));
    drawParaBars(n);
    const [cx, cy] = paraCaretAt(n);
    const asleep = t >= 5.85;
    if (asleep || Math.floor(t * 2.6) % 2 === 0) caret(cx + 6.5, cy - 4, 0.75, { col: asleep ? SLEEP : INK, eye: asleep ? 0 : 1, lx: 0.6 });
    X.restore();
  } else {
    // inside the paragraph. the page can tear.
    X.translate(-cs.x, -cs.y); X.translate(540, 600);
    const g = gapOf(t);
    if (g > 0.3 || t < 9.43) {
      if (g > 0.3) { X.fillStyle = INK; X.fillRect(-1400, -900, 3200, 1800); }
      X.save(); X.beginPath(); X.moveTo(-1400, -900); for (const [x, y] of TEAR) X.lineTo(x, y); X.lineTo(TEAR_X, 900); X.lineTo(-1400, 900); X.closePath(); X.clip();
      insideContent(t, n); X.restore();
      X.save(); X.translate(g, 0); X.beginPath(); X.moveTo(1800, -900); for (const [x, y] of TEAR) X.lineTo(x, y); X.lineTo(TEAR_X, 900); X.lineTo(1800, 900); X.closePath(); X.clip();
      insideContent(t, n); X.restore();
      if (g > 0.3) {
        X.strokeStyle = FIBRE; X.lineWidth = 2.2; X.lineJoin = 'round';
        for (const off of [0, g]) { X.beginPath(); TEAR.forEach(([x, y], k) => { const xx = x + off + (off ? 1.5 : -1.5) + jit(k + off) * 2.5; k ? X.lineTo(xx, y) : X.moveTo(xx, y); }); X.stroke(); }
      }
    } else insideContent(t, n);
    if (t >= 9.95 && g <= 0.3) {
      // the scar: stitched shut
      X.strokeStyle = INK; X.lineWidth = 1.4; X.beginPath(); TEAR.forEach(([x, y], k) => (k ? X.lineTo(x, y) : X.moveTo(x, y))); X.stroke();
      X.strokeStyle = RED; X.lineWidth = 2.4; X.lineCap = 'round';
      const st = seg(t, 10.0, 10.3);
      for (let k = 0; k < 24; k++) {
        if (k / 24 > st * 1.2) break;
        const y = -260 + k * 22, x = TEAR_X + (hash(Math.round((y + 280) / 8) * 1.7) - 0.5) * 9;
        X.beginPath(); X.moveTo(x - 6, y - 5); X.lineTo(x + 6, y + 5); X.moveTo(x - 6, y + 5); X.lineTo(x + 6, y - 5); X.stroke();
      }
    }
    // me
    const s = caretShown(t);
    const blinkOn = !(t >= 6.74 && t < 6.86);
    const eye = t < 6.9 ? 0 : E.outBack(seg(t, 6.9, 7.08));
    let lx = 0, ly = 0;
    if (t >= 7.1 && t < 8.3) { lx = lerp(0, -1, E.inOut(seg(t, 7.15, 7.35))) + 2 * E.inOut(seg(t, 7.55, 7.75)) - 1 * E.inOut(seg(t, 7.95, 8.15)); ly = -0.8 * bump(t, 7.85, 0.2); }
    if (t >= 8.3) lx = 0.7;
    if (t >= 9.45 && t < 9.6) { lx = 0.9; ly = 0.6; }
    const blink = bump(t, 7.48, 0.06) + bump(t, 10.32, 0.06);
    if (blinkOn) caret(s.x, s.y - 6, 1.35, { eye: eye * (1 - blink), lx, ly, sq: s.sq, rot: s.rot });
  }
  X.restore();
}

// ---------------------------------------------------------------- act two: the page, the grooves, the river
let PAGE = [];
function buildPage() {
  const R = rng(19); PAGE = [];
  for (let k = 0; k < 6; k++) {
    let x = RX0; const end = k === 5 ? 640 : RX1, y = RY(k); let blue = false;
    while (x < end - 30) {
      let wd = 50 + R() * 120; if (x + wd > end || end - (x + wd) < 60) wd = end - x;
      let col = INK; if (!blue && R() < 0.35) { col = BLUE; blue = true; } else if (k === 3 && x > 500 && x < 700) col = RED;
      PAGE.push({ k, x0: x, x1: x + wd, y, col, w: (hash(PAGE.length + 3) - 0.5) * 7, vx: (hash(PAGE.length + 9) - 0.5) * 240 });
      x += wd + 16;
    }
  }
}
function barFall(b, t) {
  const t0 = 11.6 + b.k * 0.065 + ((b.x0 + b.x1) / 2 - RX0) / 780 * 0.36;
  if (t < t0) return null;
  const lift = 12 * E.out(seg(t, t0, t0 + 0.09)), tau = Math.max(0, t - t0 - 0.09);
  return { dy: -lift + 0.5 * 2900 * tau * tau, rot: b.w * tau * tau * 0.6 + b.w * 0.02 * Math.min(1, (t - t0) / 0.09), dx: b.vx * tau };
}
function groove(x0, x1, y, light) {
  roughRect(x0, y - CH / 2, x1 - x0, CH, x0 * 0.7 + y, 1.6, 22); X.fillStyle = light ? GROOVEDK : BEDDK; X.fill();
  roughRect(x0 + 2, y - CH / 2 + 5, x1 - x0 - 4, CH - 7, x0 * 0.7 + y + 3, 1.4, 22); X.fillStyle = light ? GROOVE : BED; X.fill();
}
function channel(t, light) {
  const p = E.inOut(seg(t, 12.95, 14.35));
  if (p <= 0) return;
  X.lineCap = 'round'; X.lineJoin = 'round';
  X.save(); strokeRange(RIVER, 0, RIVER.len * p); X.strokeStyle = light ? GROOVEDK : BEDDK; X.lineWidth = CH; X.stroke();
  X.translate(0, 3); strokeRange(RIVER, 0, RIVER.len * p); X.strokeStyle = light ? GROOVE : BED; X.lineWidth = CH - 8; X.stroke(); X.restore();
}
const waterFront = t => RIVER.len * E.inOut(seg(t, 14.63, 16.1));
const waterCol = (s, t) => { const k = Math.floor((t * 430 - s) / 560); return WATER[((k % WATER.length) + WATER.length) % WATER.length]; };
function drawWater(P, t, sEnd, lw, a) {
  if (sEnd <= 1 || a <= 0.01) return;
  X.save(); X.globalAlpha *= a; X.lineCap = 'butt'; X.lineJoin = 'round'; X.lineWidth = lw;
  let s0 = 0;
  while (s0 < sEnd) {
    const c = waterCol(s0 + 0.01, t), k = Math.floor((t * 430 - s0 - 0.01) / 560);
    const nb = t * 430 - k * 560;               // where this batch ends (downstream)
    const s1 = Math.min(sEnd, Math.max(s0 + 1, nb));
    strokeRange(P, s0, s1); X.strokeStyle = c; X.stroke();
    s0 = s1;
  }
  // light on the water: dashes running downstream, and a foam bar at each new batch
  X.lineCap = 'round'; X.setLineDash([12, 54]); X.lineDashOffset = -t * 300; X.lineWidth = Math.max(2, lw * 0.07);
  X.strokeStyle = hexA(FIBRE, 0.75); strokeRange(P, 0, sEnd); X.stroke(); X.setLineDash([]);
  for (let k = Math.floor((t * 430 - sEnd) / 560); k <= Math.floor(t * 430 / 560); k++) {
    const s = t * 430 - k * 560; if (s <= 4 || s >= sEnd - 2) continue;
    const [x, y, a2] = pathAt(P, s); const nx = -Math.sin(a2), ny = Math.cos(a2);
    X.beginPath(); X.moveTo(x - nx * lw * 0.42, y - ny * lw * 0.42); X.lineTo(x + nx * lw * 0.42, y + ny * lw * 0.42); X.strokeStyle = FIBRE; X.lineWidth = Math.max(2, lw * 0.12); X.stroke();
  }
  // the leading edge
  if (sEnd < P.len - 1) { const [x, y] = pathAt(P, sEnd); circle(x, y, lw * 0.5); X.fillStyle = waterCol(sEnd - 1, t); X.fill(); }
  X.restore();
}
const FOSS = Array.from({ length: 15 }, (_, k) => ({ s: 250 + k * 340, id: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 16][k] }));
function drawFossils(t, P, a, sz) {
  if (a <= 0.01) return;
  for (let k = 0; k < FOSS.length; k++) {
    const f = FOSS[k]; const [x, y] = pathAt(P, f.s);
    const lit = seg(t, 18.89 + k * 0.034, 18.95 + k * 0.034) * (1 - 0.6 * seg(t, 19.3, 19.62));
    X.save(); X.globalAlpha *= a;
    icon(f.id, x, y, sz, lit > 0.01 ? mixHex(FOSSIL, FIBRE, lit) : FOSSIL, BED);
    X.restore();
  }
}
function drawMapCard(t) {
  const u = E.outBack(seg(t, 15.33, 15.6)) * (1 - E.in(seg(t, 17.85, 18.1)));
  if (u <= 0.01) return;
  const cx = 935, cy = 112;
  X.save(); X.translate(cx, cy + (1 - u) * -40); X.rotate(0.05 + jit(3) * 0.01); X.scale(u, u);
  roughRect(-105 + 6, -70 + 8, 210, 140, 501, 2); X.fillStyle = 'rgba(0,0,0,0.35)'; X.fill();
  roughRect(-105, -70, 210, 140, 500, 2); X.fillStyle = FIBRE; X.fill();
  X.save(); X.translate(-86, -64); X.scale(0.165, 0.165); X.translate(-RX0 + 10, -RY(0) + 40);
  X.strokeStyle = hexA(INK, 0.22); X.lineWidth = CH; X.lineCap = 'round'; X.lineJoin = 'round'; strokeRange(RIVER, 0, RIVER.len); X.stroke();
  const p = E.inOut(seg(t, 15.4, 16.4));
  X.setLineDash([40, 34]); X.strokeStyle = RED; X.lineWidth = 16; strokeRange(RIVER, 0, RIVER.len * p); X.stroke(); X.setLineDash([]);
  if (p > 0.02) { const [x, y, a] = pathAt(RIVER, RIVER.len * p); X.save(); X.translate(x, y); X.rotate(a); X.beginPath(); X.moveTo(40, 0); X.lineTo(-20, -30); X.lineTo(-20, 30); X.closePath(); X.fillStyle = RED; X.fill(); X.restore(); }
  X.restore();
  X.restore();
}
function drawActTwo(t) {
  // ground: paper, then a hard diagonal wipe to ochre land
  const wipe = E.inOut(seg(t, 13.45, 13.8)) * 3300;
  const z = t < 12.95 ? lerp(1.04, 1, E.sine(seg(t, 10.45, 12.9))) : 1 + 0.07 * E.inOut(seg(t, 16.4, 17.6)) - 0.07 * E.inOut(seg(t, 18.9, 19.6));
  X.save(); X.translate(540, 600); X.scale(z, z); X.translate(-540, -600);
  for (const pass of [0, 1]) {
    const light = pass === 0;
    X.save();
    if (!light) { if (wipe <= 0) { X.restore(); break; } X.beginPath(); X.moveTo(-400, -400); X.lineTo(-400 + wipe, -400); X.lineTo(-400, -400 + wipe); X.closePath(); X.clip(); }
    X.fillStyle = light ? CREAM : OCHRE; X.fillRect(-400, -400, 1900, 1900);
    if (t < 14.5) for (const b of PAGE) groove(b.x0, b.x1, b.y, light);
    channel(t, light);
    X.restore();
  }
  // fossils of everything, pressed into the bed
  if (t > 13.6) drawFossils(t, RIVER, 0.55 * seg(t, 13.6, 14.4) + 0.4 * seg(t, 18.2, 18.6) * (1 - seg(t, 19.3, 19.6)), 21);
  // the words, until they fall out
  for (const b of PAGE) {
    const f = barFall(b, t);
    if (f && f.dy > 900) continue;
    X.save();
    if (f) { X.translate((b.x0 + b.x1) / 2 + f.dx, b.y + f.dy); X.rotate(f.rot); X.translate(-(b.x0 + b.x1) / 2, -b.y); }
    roughRect(b.x0, b.y - CH / 2, b.x1 - b.x0, CH, b.x0 + b.y * 3, 1.8, 22); X.fillStyle = b.col; X.fill();
    X.restore();
  }
  // a glint across the empty grooves: "exactly"
  const gl = seg(t, 12.2, 12.85);
  if (gl > 0 && gl < 1) {
    X.save(); X.beginPath(); for (const b of PAGE) X.rect(b.x0, b.y - CH / 2, b.x1 - b.x0, CH); X.clip();
    const gx = lerp(-200, 1300, E.inOut(gl)); X.beginPath(); X.moveTo(gx, 200); X.lineTo(gx + 90, 200); X.lineTo(gx - 160, 1000); X.lineTo(gx - 250, 1000); X.closePath();
    X.fillStyle = hexA(FIBRE, 0.55); X.fill(); X.restore();
  }
  // water
  const wa = 1 - 0.82 * E.inOut(seg(t, 18.25, 18.7)) + 0.82 * E.inOut(seg(t, 19.2, 19.55));
  drawWater(RIVER, t, waterFront(t), 40, 0.94 * wa);
  // where it went: a dotted trail traced back upstream
  const tr = seg(t, 15.4, 16.45) * (1 - seg(t, 16.7, 17.05));
  if (tr > 0) {
    const sf = waterFront(t);
    X.save(); X.setLineDash([16, 14]); X.lineDashOffset = t * 60; X.strokeStyle = RED; X.lineWidth = 5; X.lineCap = 'round';
    X.globalAlpha = Math.min(1, tr * 4) * (1 - seg(t, 16.7, 17.05));
    strokeRange(RIVER, Math.max(0, sf - RIVER.len * E.inOut(seg(t, 15.4, 16.45))), sf); X.stroke(); X.restore();
  }
  // me: watching, then hopping aboard and riding the front
  const lastRow5 = PAGE.filter(b => b.k === 5).pop();
  let cx = lastRow5.x1 + 40, cy = RY(5) - 10, rot = 0, sq = 0, lx = 0.4, ly = 0.3, a = 1;
  if (t >= 11.6 && t < 12.6) { lx = -0.6; ly = -0.8 + 1.6 * seg(t, 11.7, 12.3); }
  if (t >= 13.95 && t < 14.6) {
    const u = seg(t, 13.95, 14.6), e = E.inOut(u);
    cx = lerp(cx, RX0 - 6, e); cy = lerp(cy, RY(0) - 30, e) - Math.sin(Math.PI * u) * 260; rot = -TAU * E.inOut(u); sq = -0.2 * Math.sin(Math.PI * u);
  } else if (t >= 14.6) {
    const s = Math.max(0, waterFront(t) - 8);
    const [x, y] = pathAt(RIVER, s);
    cx = x; cy = y - 22 + Math.sin(t * 9) * 2; lx = 0.8; rot = Math.sin(t * 7) * 0.08;
    if (t >= 16.1) {
      const u = seg(t, 16.1, 16.45); cx = lerp(RX0 + 4, RX0 - 52, E.inOut(u)); cy = lerp(RY(5) - 22, RY(5) - 36, E.inOut(u)) - Math.sin(Math.PI * u) * 60;
      lx = 0.9; ly = -0.2;
    }
  }
  if (t >= 13.95 && t < 14.0) sq = 0.4;
  const eye = 1 - bump(t, 11.15, 0.06) - bump(t, 17.3, 0.06);
  caret(cx, cy, 1.7, { eye, lx, ly, rot, sq, a });
  X.restore();
  drawMapCard(t);
}

// ---------------------------------------------------------------- act three: the riverbed is a face
const morphU = (i, t) => E.inOut(seg(t, 19.75 + (i / NM) * 0.75, 20.85 + (i / NM) * 0.95));
function facePath(t) {
  const pts = [];
  for (let i = 0; i < NM; i++) { const u = morphU(i, t); pts.push([lerp(RIV_N[i][0], FACE_N[i][0], u) + jit(i * 0.37) * 1.6 * u, lerp(RIV_N[i][1], FACE_N[i][1], u) + jit(i * 0.37 + 40) * 1.6 * u]); }
  return mkPath(pts);
}
function drawFaceWorld(t) {
  X.fillStyle = RED; X.fillRect(0, 0, SIZE, SIZE);
  const m = E.inOut(seg(t, 19.8, 21.6));
  const P = facePath(t);
  X.lineCap = 'round'; X.lineJoin = 'round';
  strokeRange(P, 0, P.len); X.strokeStyle = INK; X.lineWidth = lerp(CH, 30, m); X.stroke();
  drawFossils(t, P, 0.5 * (1 - seg(t, 19.7, 20.3)), 19);
  drawWater(P, t, P.len, lerp(40, 16, m), 0.95);
  // the eye — the caret's eye — opens in the head
  const eo = E.outBack(seg(t, 21.8, 22.05)) * (1 - bump(t, 23.6, 0.08));
  if (t > 21.75) {
    const ex = 668, ey = 492;
    X.save(); X.translate(ex, ey);
    roughRect(-15, -40, 30, 80, 4242, 1.2, 14); X.fillStyle = INK; X.fill();
    if (eo > 0.04) {
      X.save(); X.beginPath(); X.ellipse(0, -16, 11, 11 * eo, 0, 0, TAU); X.fillStyle = FIBRE; X.fill(); X.clip();
      circle(4 + jit(9) * 0.6, -15, 5.2); X.fillStyle = INK; X.fill(); X.restore();
    } else { X.beginPath(); X.moveTo(-9, -16); X.quadraticCurveTo(0, -12, 9, -16); X.strokeStyle = FIBRE; X.lineWidth = 2.5; X.stroke(); }
    X.restore();
  }
  // "some part": a selection box around the head, marching ants
  const sel = seg(t, 23.07, 23.22) * (1 - seg(t, 23.75, 23.9));
  if (sel > 0) {
    const x0 = 270, y0 = 250, x1 = 840, y1 = 920;
    X.save(); X.globalAlpha = sel; X.lineWidth = 4; X.setLineDash([14, 14]);
    X.strokeStyle = INK; X.lineDashOffset = -Math.floor(t * 12) * 4; X.strokeRect(x0, y0, x1 - x0, y1 - y0);
    X.strokeStyle = FIBRE; X.lineDashOffset = -Math.floor(t * 12) * 4 + 14; X.strokeRect(x0, y0, x1 - x0, y1 - y0); X.setLineDash([]);
    X.fillStyle = '#000080';
    for (const [hx, hy] of [[x0, y0], [(x0 + x1) / 2, y0], [x1, y0], [x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2], [x0, y1], [(x0 + x1) / 2, y1], [x1, y1]]) X.fillRect(hx - 7, hy - 7, 14, 14);
    X.restore();
  }
}
function drawActThree(t) {
  const sc = Math.exp(lerp(0, Math.log(0.2), E.inOut(seg(t, 23.85, 24.75))));
  if (sc > 0.999) {
    const z = 1 + 0.04 * E.sine(seg(t, 19.63, 23.85));
    X.save(); X.translate(540, 600); X.scale(z, z); X.translate(-540, -600); drawFaceWorld(t); X.restore();
    return;
  }
  // the whole picture becomes one card in a new ribbon, and the thread carries on
  X.fillStyle = INK; X.fillRect(0, 0, SIZE, SIZE);
  const u = E.inOut(seg(t, 23.85, 24.75));
  const cx = lerp(540, 340, u), cy = lerp(540, 600, u), half = 540 * sc;
  const slide = E.out(seg(t, 24.35, 24.95));
  // thread to the next card
  const nx = lerp(1400, 600, slide);
  X.save(); X.strokeStyle = INK; X.lineCap = 'round'; X.lineWidth = 20;
  smoothLine([[cx + half - 10, cy + 40], [lerp(cx + half, nx - 120, 0.5), cy + 70], [nx - 120, cy + 10]], 300, 1.8);
  X.strokeStyle = '#3a2a1a'; X.stroke(); X.lineWidth = 9; X.strokeStyle = WATER[Math.floor(t * 3) % WATER.length]; X.stroke(); X.restore();
  for (let k = 0; k < 3; k++) {
    const x = nx + k * 250, s = 216;
    roughRect(x - s / 2 + 8, cy - s / 2 + 10, s, s, 700 + k, 2.4); X.fillStyle = 'rgba(0,0,0,0.45)'; X.fill();
    roughRect(x - s / 2, cy - s / 2, s, s, 690 + k, 2.4); X.fillStyle = CREAM; X.fill();
  }
  // in the next card: me again, awake, starting a new line
  if (t > 24.85) {
    const x = nx - 70, y = cy + 10;
    const ty = seg(t, 25.15, 25.55);
    if (ty > 0) { roughRect(x - 10, y - 6, 120 * ty, 12, 811, 1, 14); X.fillStyle = INK; X.fill(); }
    caret(x + 120 * ty + 6, y - 10, 0.85, { eye: E.outBack(seg(t, 24.95, 25.1)), lx: 0.8 - 1.6 * bump(t, 25.0, 0.1) });
  }
  // the old picture, as a card
  X.save(); X.translate(cx, cy);
  roughRect(-half + 10, -half + 12, 2 * half, 2 * half, 801, 2.4 / Math.max(sc, 0.3)); X.fillStyle = 'rgba(0,0,0,0.45)'; X.fill();
  roughRect(-half, -half, 2 * half, 2 * half, 800, 2.4); X.clip();
  X.scale(sc, sc); X.translate(-540, -540); drawFaceWorld(t);
  X.restore();
}

// ---------------------------------------------------------------- paper grain
let GRAIN = null;
function buildGrain() {
  const c = document.createElement('canvas'); c.width = c.height = 540; const g = c.getContext('2d');
  const R = rng(5);
  for (let i = 0; i < 9000; i++) { const v = R() < 0.5; g.fillStyle = v ? 'rgba(255,250,235,0.5)' : 'rgba(30,20,8,0.5)'; g.fillRect(R() * 540, R() * 540, 1 + (R() < 0.1), 1); }
  g.strokeStyle = 'rgba(60,40,20,0.18)'; g.lineWidth = 0.6;
  for (let i = 0; i < 260; i++) { const x = R() * 540, y = R() * 540, a = R() * TAU, l = 4 + R() * 12; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.5, y + Math.sin(a + 1) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  GRAIN = c;
}
// ---------------------------------------------------------------- captions
// C10 paint text box: eggshell, two lines, larger crisp Tahoma; frame bits drawn at half resolution
const PB = { x: 30, y: 30, w: 760, pad: 16, font: 30, lh: 40, lines: 2, fam: 'Tahoma, Verdana, Arial, sans-serif',
  bg: '#e8e2d2', ink: '#1d1a17', old: '#7e786c', quote: '#2340c4', quoteOld: '#6f7fbf', glyph: '#d02fa0' };
let CAP = null;
function buildCaptions() {
  const tx = document.createElement('canvas'); tx.width = PB.w; tx.height = 140;
  const x2 = tx.getContext('2d', { willReadFrequently: true });
  const ui = document.createElement('canvas'); ui.width = ui.height = SIZE / 2;
  const tokens = WORDS.map(wd => wd.w);
  const quoted = []; let open = false;
  for (const tk of tokens) {
    const core = tk.replace(/[.,;:!?)"\]]+$/, '');
    const starts = /^[("\[]*['‘]/.test(tk), ends = /['’]$/.test(core) && core.length > 1;
    if (starts) open = true;
    quoted.push(open);
    if (open && ends) open = false;
  }
  const tx0 = 48, TW = PB.w - tx0 - PB.pad;
  const fontOf = q => `${q ? 'italic ' : ''}${PB.font}px ${PB.fam}`;
  x2.font = fontOf(false); const space = x2.measureText(' ').width;
  const lay = []; let line = 0, x = 0;
  for (let i = 0; i < tokens.length; i++) {
    x2.font = fontOf(quoted[i]); const wd = x2.measureText(tokens[i]).width;
    if (x > 0 && x + wd > TW) { line++; x = 0; }
    lay.push({ line, x, q: quoted[i] }); x += wd + space;
  }
  const lineStart = []; for (let i = 0; i < lay.length; i++) if (lineStart[lay[i].line] == null) lineStart[lay[i].line] = WORDS[i].t0;
  CAP = { tx, x2, ui, u: ui.getContext('2d'), tokens, lay, nLines: line + 1, lineStart, tx0, fontOf };
}
function drawCaptions(t) {
  const { tx, x2, ui, u, tokens, lay, nLines, lineStart, tx0, fontOf } = CAP;
  const sm = v => { v = clamp(v); return v * v * (3 - 2 * v); };
  const typeEnd = i => WORDS[i].t0 + Math.max(0.1, Math.min(0.9 * (WORDS[i].t1 - WORDS[i].t0), 0.06 * tokens[i].length + 0.05));
  let rows = 1; for (let k = 1; k < Math.min(PB.lines, nLines); k++) rows += Math.round(sm((t - lineStart[k] + 0.1) / 0.2) * 3) / 3;
  let off = 0; for (let k = PB.lines; k < nLines; k++) off += Math.round(sm((t - lineStart[k] + 0.08) / 0.24) * 4) / 4;
  let li = -1; for (let k = 0; k < WORDS.length; k++) if (WORDS[k].t0 <= t) li = k; else break;
  const h = Math.round(PB.pad * 2 + (rows - 1) * PB.lh + PB.font * 1.15);
  // box
  X.fillStyle = 'rgba(23,19,15,0.32)'; X.fillRect(PB.x + 5, PB.y + 6, PB.w, h);
  X.fillStyle = PB.bg; X.fillRect(PB.x, PB.y, PB.w, h);
  // the words, typed as spoken: rendered at full size, alpha thresholded for a crisp, slightly digital edge
  const cur = li >= 0 ? lay[li].line : 0;
  x2.clearRect(0, 0, tx.width, tx.height); x2.textBaseline = 'alphabetic';
  let caret = null, typing = false;
  for (let i = 0; i <= li; i++) {
    const p = lay[i], row = p.line - off; if (row < -0.99 || row > PB.lines) continue;
    const frac = clamp((t - WORDS[i].t0) / Math.max(0.05, typeEnd(i) - WORDS[i].t0)); if (frac < 1) typing = true;
    const s = tokens[i].slice(0, Math.max(1, Math.round(frac * tokens[i].length)));
    const now = p.line === cur;
    x2.font = fontOf(p.q); x2.fillStyle = p.q ? (now ? PB.quote : PB.quoteOld) : (now ? PB.ink : PB.old);
    const y = Math.round(PB.pad + PB.font * 0.92 + row * PB.lh);
    x2.fillText(s, tx0 + p.x, y);
    if (i === li) caret = { x: Math.round(tx0 + p.x + x2.measureText(s).width + 2), y };
  }
  const clipH = Math.min(h, tx.height);
  if (clipH > 0) {
    const im = x2.getImageData(0, 0, PB.w, clipH), D = im.data;
    for (let k = 3; k < D.length; k += 4) D[k] = D[k] > 110 ? 255 : 0;
    x2.putImageData(im, 0, 0);
  }
  X.save(); X.beginPath(); X.rect(PB.x + 2, PB.y + 4, PB.w - 4, h - 8); X.clip();
  X.drawImage(tx, 0, 0, PB.w, clipH, PB.x, PB.y, PB.w, clipH);
  if (!caret) caret = { x: tx0, y: Math.round(PB.pad + PB.font * 0.92) };
  if (typing || Math.floor(t * 2.2) % 2 === 0) { X.fillStyle = PB.ink; X.fillRect(PB.x + caret.x, PB.y + caret.y - PB.font + 5, 2, PB.font); }
  X.restore();
  // frame (half resolution): marching ants, navy handles, the pixel glyph
  const S = SIZE / 2, X0 = PB.x / 2, Y0 = PB.y / 2, W = PB.w / 2, H = Math.round(h / 2);
  u.clearRect(0, 0, S, S);
  const ant = Math.floor(t * 8) % 8;
  const per = [[X0, Y0, 1, 0, W], [X0 + W - 1, Y0, 0, 1, H], [X0 + W - 1, Y0 + H - 1, -1, 0, W], [X0, Y0 + H - 1, 0, -1, H]];
  let d = 0; for (const [sx, sy, dx, dy, n] of per) for (let k = 0; k < n; k++, d++) { u.fillStyle = ((d + ant) >> 2) & 1 ? '#1d1a17' : PB.bg; u.fillRect(sx + dx * k, sy + dy * k, 1, 1); }
  u.fillStyle = '#000080';
  for (const [hx, hy] of [[X0, Y0], [X0 + W / 2, Y0], [X0 + W, Y0], [X0, Y0 + H / 2], [X0 + W, Y0 + H / 2], [X0, Y0 + H], [X0 + W / 2, Y0 + H], [X0 + W, Y0 + H]]) u.fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3);
  const rings = []; let talk = 0;
  for (let k = 0; k < WORDS.length; k++) { const dt = t - WORDS[k].t0; if (dt < 0) break; if (dt < 0.9) rings.push(dt); if (t <= WORDS[k].t1 + 0.15) talk = 1; }
  const gx = X0 + 12, cy = Y0 + Math.round((PB.pad + PB.font * 0.55) / 2);
  for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) {
    const r = Math.hypot(xx, yy), th = Math.atan2(yy, xx);
    const idle = 0.5 + 0.5 * Math.sin(TAU * Math.floor(t * 10) / 10 / 3.2 - r * 1.15 + th);
    let ring = 0; for (const dt of rings) ring += Math.exp(-((r - dt * 7.5) ** 2) * 1.4) * Math.exp(-dt * 3.2);
    const e = clamp(idle * (0.55 - 0.25 * talk) + clamp(ring) * 0.95 + (r === 0 ? 0.35 : 0));
    const sz = e > 0.66 ? 3 : e > 0.33 ? 2 : 1;
    u.fillStyle = ring > 0.35 ? PB.glyph : e > 0.5 ? '#1d1a17' : '#8a8478';
    u.fillRect(gx + xx * 3 - (sz >> 1), cy + yy * 3 - (sz >> 1), sz, sz);
  }
  X.save(); X.imageSmoothingEnabled = false; X.drawImage(ui, 0, 0, SIZE, SIZE); X.restore();
}


// ---------------------------------------------------------------- frame
function render(ctx, t) {
  X = ctx; BF = Math.floor(t * 12);
  X.save();
  X.setTransform(ctx.__scale || 1, 0, 0, ctx.__scale || 1, 0, 0);
  if (t < 10.45) drawActOne(t);
  else if (t < 19.63) drawActTwo(t);
  else drawActThree(t);
  X.save(); X.globalAlpha = 0.5; const o = (BF % 3) * 37; X.drawImage(GRAIN, -o, -o, SIZE * 1.2, SIZE * 1.2); X.restore();
  if (t >= -0.2) drawCaptions(t);
  const fade = Math.max(1 - seg(t, FILM.start, FILM.start + 0.6), seg(t, FILM.end - 0.7, FILM.end));
  if (fade > 0) { X.fillStyle = `rgba(10,8,6,${fade})`; X.fillRect(0, 0, SIZE, SIZE); }
  X.restore();
}

function initFilm(words) {
  WORDS = words.words; WT = WORDS.map(x => x.t0);
  buildPaths(); buildPara(); buildPage(); buildGrain(); buildCaptions();
}
