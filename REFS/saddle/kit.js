// bassline kit — shared helpers for a cut-paper film. Load before film.js.
// Provides: math + easing, colour, the boil (rough paper edges that re-jitter 12×/s), arc-length paths,
// the caret character, paper grain, and the C10 eggshell caption box.
// film.js must define FILM, render(ctx, t) and initFilm(words), and call buildGrain() + buildCaptions()
// from initFilm after setting WORDS / WT. Every draw call goes through the global X (the 2D context).
'use strict';

const SIZE = 1080;

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


