// Saddle — renderer. render(ctx, t) is a pure function of t (seconds of voice time). Needs kit.js.
// One line carries the film: a staircase ("downhill") that smooths into a framed valley, fans into a hand of cards
// (dimensions), turns sideways into a hill, becomes a horse saddle, then a contour map of a saddle whose trails are
// staircases again. The narrator is a blue ball with one eye: it rolls, so its eye rolls with it.
'use strict';

const FILM = { start: -1.2, end: 0 };   // end = voice length + ~2.5 s, set in initFilm
const POSTER_T = 14.75;
const LEATHER = '#a9612a', LEATHERDK = '#6b3612', STITCH = '#f6e2b4';

// ---------------------------------------------------------------- small helpers
function dens(pts, step = 22, closed = true) {
  const out = [], n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < k; j++) out.push([lerp(a[0], b[0], j / k), lerp(a[1], b[1], j / k)]);
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
function shadowPoly(pts, seed, amp, dx = 7, dy = 9, a = 0.42) {
  X.save(); X.translate(dx, dy); roughPoly(pts, seed + 101, amp); X.fillStyle = `rgba(0,0,0,${a})`; X.fill(); X.restore();
}
function cutPoly(pts, col, seed, amp = 2.2, sh = 1) {
  if (sh) shadowPoly(pts, seed, amp, 7 * sh, 9 * sh);
  roughPoly(pts, seed, amp); X.fillStyle = col; X.fill();
}
const rectPts = (x, y, wd, ht, step = 26) => dens([[x, y], [x + wd, y], [x + wd, y + ht], [x, y + ht]], step);
function cutRect(x, y, wd, ht, col, seed, amp = 2.2, sh = 1) { cutPoly(rectPts(x, y, wd, ht), col, seed, amp, sh); }
function capsulePts(x0, y0, x1, y1, wd, n = 6) {
  const a = Math.atan2(y1 - y0, x1 - x0), r = wd / 2, p = [];
  for (let k = 0; k <= n; k++) { const th = a - Math.PI / 2 + (Math.PI * k) / n; p.push([x1 + Math.cos(th) * r, y1 + Math.sin(th) * r]); }
  for (let k = 0; k <= n; k++) { const th = a + Math.PI / 2 + (Math.PI * k) / n; p.push([x0 + Math.cos(th) * r, y0 + Math.sin(th) * r]); }
  return dens(p, 18);
}
function xMark(x, y, s, seed, col = RED, sh = 1) {
  if (s < 1) return;
  const d = s * 0.5, wd = Math.max(3, s * 0.24), amp = Math.min(2, s * 0.03), o = Math.max(2, s * 0.09) * sh;
  const A = capsulePts(x - d, y - d, x + d, y + d, wd), B = capsulePts(x - d, y + d, x + d, y - d, wd);
  if (sh) { X.save(); X.translate(o, o * 1.25); roughPoly(A, seed + 101, amp); X.fillStyle = 'rgba(0,0,0,.42)'; X.fill(); roughPoly(B, seed + 110, amp); X.fill(); X.restore(); }
  roughPoly(A, seed, amp); X.fillStyle = col; X.fill();
  roughPoly(B, seed + 9, amp); X.fill();
}
function tick(x, y, s, seed, col) {
  const P = [[-0.5, -0.02], [-0.3, -0.2], [-0.1, 0.06], [0.42, -0.55], [0.6, -0.38], [-0.08, 0.42]].map(([a, b]) => [x + a * s, y + b * s]);
  cutPoly(dens(P, 14), col, seed, 1.6, 0.8);
}
// keyframed gaze: [[t, lx, ly], ...] -> eased look vector
function gaze(keys, t, dur = 0.09) {
  let lx = keys[0][1], ly = keys[0][2];
  for (let k = 1; k < keys.length; k++) {
    if (t < keys[k][0]) break;
    const u = E.out(seg(t, keys[k][0], keys[k][0] + dur));
    lx = lerp(lx, keys[k][1], u); ly = lerp(ly, keys[k][2], u);
  }
  return [lx, ly];
}
function jStroke(pts, seed, amp) {        // straight-segment polyline that boils
  X.beginPath();
  pts.forEach(([x, y], i) => { const ox = jit(seed + i) * amp, oy = jit(seed + i + 40) * amp; i ? X.lineTo(x + ox, y + oy) : X.moveTo(x + ox, y + oy); });
}
function pathUpTo(P, s1) {                // the points of a path up to arc length s1
  const out = [P.pts[0]];
  for (let i = 1; i < P.pts.length; i++) { if (P.cum[i] >= s1) break; out.push(P.pts[i]); }
  const e = pathAt(P, s1); out.push([e[0], e[1]]);
  return out;
}

// ---------------------------------------------------------------- the ball (me)
// a blue paper ball with one eye. (x, y) is the centre; the squash keeps the bottom on the ground.
// rot rolls the eye around the ball; lid (radians) opens the top half on a hinge at the left.
function ball(x, y, r, o = {}) {
  const { rot = 0, eye = 1, lx = 0, ly = 0, sq = 0, col = BLUE, a = 1, lid = 0, wide = 1, sh = 1, inside = null } = o;
  if (a <= 0.01 || r <= 0.5) return;
  const amp = clamp(r * 0.035, 0.5, 2.2), N = 26;
  const arc = (a0, a1, n) => { const p = []; for (let k = 0; k <= n; k++) { const th = lerp(a0, a1, k / n); p.push([Math.cos(th) * r, Math.sin(th) * r]); } return p; };
  X.save(); X.globalAlpha *= a; X.translate(x, y + r); X.scale(1 + sq * 0.55, 1 - sq * 0.5); X.translate(0, -r);
  const drawEye = (ex, ey) => {
    const er = r * 0.37 * wide;
    if (eye > 0.05) {
      X.save(); X.beginPath(); X.ellipse(ex, ey, er, Math.max(0.1, er * eye), 0, 0, TAU); X.fillStyle = FIBRE; X.fill(); X.clip();
      circle(ex + lx * er * 0.45, ey + ly * er * 0.45, er * 0.5); X.fillStyle = INK; X.fill(); X.restore();
    } else {
      X.beginPath(); X.moveTo(ex - er * 0.85, ey); X.quadraticCurveTo(ex, ey + er * 0.45, ex + er * 0.85, ey);
      X.strokeStyle = FIBRE; X.lineWidth = Math.max(1.2, r * 0.07); X.lineCap = 'round'; X.stroke();
    }
  };
  if (sh) shadowPoly(arc(0, TAU, N), 300, amp, r * 0.14, r * 0.2);
  if (lid <= 0.001) {
    X.save(); X.rotate(rot); roughPoly(arc(0, TAU, N), 300, amp); X.fillStyle = col; X.fill(); X.restore();
    drawEye(Math.sin(rot) * r * 0.28, -Math.cos(rot) * r * 0.28);
  } else {
    roughPoly(arc(0, Math.PI, 14), 310, amp); X.fillStyle = col; X.fill();                      // the bowl
    const op = clamp(lid / 0.6);
    X.beginPath(); X.ellipse(0, 0, r * 0.96, Math.max(0.1, r * 0.24 * op), 0, 0, TAU); X.fillStyle = mixHex(col, INK, 0.62); X.fill();
    if (inside) inside(r);
    X.save(); X.translate(-r, 0); X.rotate(-lid); X.translate(r, 0);                              // the lid
    roughPoly(arc(Math.PI, TAU, 14), 320, amp); X.fillStyle = col; X.fill();
    X.beginPath(); X.ellipse(0, 0, r * 0.96, Math.max(0.1, r * 0.2 * op), 0, 0, Math.PI); X.fillStyle = mixHex(col, INK, 0.35); X.fill();
    drawEye(0, -r * 0.42);
    X.restore();
  }
  X.restore();
}
// the lid's pinch point (top right of the top half), in screen space, for a ball at (x, y) radius r and lid angle
function lidPoint(x, y, r, lid) {
  const px = Math.cos(-0.5) * r, py = Math.sin(-0.5) * r;              // a point on the top half
  const c = Math.cos(-lid), s = Math.sin(-lid);
  const qx = (px + r) * c - py * s - r, qy = (px + r) * s + py * c;
  return [x + qx, y + qy];
}

// ---------------------------------------------------------------- act one: the staircase (ink)
const DG = { x0: -20, y0: 300, x1: 1100, y1: 960 };
const BR1 = 34;
function nTeeth(t) { return t < w(7) ? 7 : t < w(8) ? 14 : t < w(9) ? 28 : t < w(9) + 0.33 ? 56 : 112; }
function prevTeethT(t) { return [w(7), w(8), w(9), w(9) + 0.33].filter(c => c <= t).pop() ?? -99; }
function stairDims(n) { return [(DG.x1 - DG.x0) / n, (DG.y1 - DG.y0) / n]; }
function stairTop(x, n) { const [sw, sh] = stairDims(n); return DG.y0 + clamp(Math.floor((x - DG.x0) / sw), 0, n - 1) * sh; }
function stairSurf(n) {
  const [sw, sh] = stairDims(n), p = [];
  for (let k = 0; k < n; k++) { p.push([DG.x0 + k * sw, DG.y0 + k * sh]); p.push([DG.x0 + (k + 1) * sw, DG.y0 + k * sh]); }
  return p;
}
// where a ball of radius r rests on the stairs: flat contact, or balanced on a step's corner
function contactY(bx, n, r) {
  const [sw, sh] = stairDims(n);
  let cy = stairTop(bx, n) - r;
  const k0 = Math.floor((bx - r - DG.x0) / sw) - 1, k1 = Math.ceil((bx + r - DG.x0) / sw) + 1;
  for (let k = k0; k <= k1; k++) {
    const cx = DG.x0 + (k + 1) * sw, top = DG.y0 + clamp(k, 0, n - 1) * sh;
    const dx = cx - bx; if (Math.abs(dx) >= r) continue;
    cy = Math.min(cy, top - Math.sqrt(r * r - dx * dx));
  }
  return cy;
}
const HOPS = () => [[w(4), 220, 380], [w(5), 380, 540], [w(5) + 0.36, 540, 700]];
const GLIDE = () => [1.95, 4.68, 700, 960];
function ball1(t) {         // x, y, rot, squash for act one
  const H = HOPS(), [g0, g1, gx0, gx1] = GLIDE();
  let bx = 220, hop = 0, sq = 0, from = null;
  for (const [th, a, b] of H) {
    if (t >= th) { bx = b; from = null; }
    if (t >= th && t < th + 0.26) { const u = (t - th) / 0.26; bx = lerp(a, b, E.sine(u)); hop = Math.sin(Math.PI * u) * 46; from = [a, b, u]; }
    sq = Math.max(sq, 0.35 * bump(t, th + 0.29, 0.09));
  }
  if (t > g0) bx = lerp(gx0, gx1, E.sine(seg(t, g0, g1)) * 0.25 + seg(t, g0, g1) * 0.75);
  const n = nTeeth(t);
  let by;
  if (from) by = lerp(contactY(from[0], 7, BR1), contactY(from[1], 7, BR1), E.in(from[2])) - hop;
  else {
    by = contactY(bx, n, BR1);
    const tc = prevTeethT(t);
    if (t - tc < 0.14) { const nPrev = n / 2; by = lerp(contactY(bx, nPrev, BR1), by, E.in((t - tc) / 0.14)); }
  }
  const rot = t > g0 ? (bx - gx0) / BR1 : 0;
  return [bx, by, rot, sq];
}
const XS = () => [[w(10), 74], [w(11), 56], [w(12), 42], [w(13), 30], [w(14), 19], [w(15), 9]];

// the morph: fine stairs -> framed valley (both resampled to the same N points by arc length)
const NM = 220;
let STAIR_R = null, VAL_R = null;
function buildMorph() {
  STAIR_R = resample(mkPath(stairSurf(112).concat([[1100, DG.y1]])), NM);
  const v = []; for (let x = -20; x <= 1100; x += 5) v.push([x, landY('U', x)]);
  VAL_R = resample(mkPath(v), NM);
}
function morphSurf(u) {
  return STAIR_R.map((p, i) => { const k = E.inOut(clamp(u * 1.35 - (i / NM) * 0.35)); return [lerp(p[0], VAL_R[i][0], k), lerp(p[1], VAL_R[i][1], k)]; });
}
function surfYAt(pts, x) {
  for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) { const a = pts[i - 1], b = pts[i]; return lerp(a[1], b[1], clamp((x - a[0]) / Math.max(1e-6, b[0] - a[0]))); }
  return pts[pts.length - 1][1];
}

function drawActOne(t) {
  X.fillStyle = INK; X.fillRect(0, 0, SIZE, SIZE);
  const m0 = 4.74, m1 = w(16) - 0.02, mu = seg(t, m0, m1);
  let surf, b0, b1;
  if (t < m0) { surf = stairSurf(nTeeth(t)); b0 = [1100, 1100]; b1 = [-20, 1100]; }
  else { surf = morphSurf(mu); b0 = [1100, 1100]; b1 = [-20, 1100]; }
  const n = nTeeth(t), [sw] = stairDims(n);
  const amp = t < m0 ? Math.min(2.2, sw * 0.08) : 1.4;
  const poly = t < m0 ? dens(surf.concat([[1100, DG.y1], b0, b1, [-20, DG.y0]]), 40) : surf.concat([b0, b1]);
  cutPoly(poly, CREAM, 21, amp, 1);
  // red X marks, each a little less wrong
  const xa = 1 - seg(t, m0, m0 + 0.2);
  if (xa > 0) {
    X.save(); X.globalAlpha = xa;
    XS().forEach(([tx, s], i) => {
      if (t < tx) return;
      const bx = 330 + i * 112, yy = stairTop(bx, 112) + s * 0.75 + 44;
      const pop = 1 + 0.5 * (1 - E.out(seg(t, tx, tx + 0.07)));
      xMark(bx, yy, s * pop, 400 + i * 13);
    });
    X.restore();
  }
  // the ball
  if (t < m0) {
    const [bx, by, rot, sq] = ball1(t);
    const eye = t < w(0) - 0.05 ? 0 : E.outBack(seg(t, w(0) - 0.05, w(0) + 0.15));
    const [lx, ly] = gaze([[-9, 0, 0.2], [0.35, 0.8, 0.5], [w(4) - 0.1, 0.9, 0.4], [1.9, 0.7, 0.5], [w(10) - 0.05, -0.2, 0.7], [w(15), 0.2, 0.1]], t);
    ball(bx, by, BR1, { rot, eye, lx, ly, sq });
  } else {
    const k = E.inOut(mu), bx = lerp(960, 852, k);
    const by = surfYAt(surf, bx) - BR1 - Math.sin(Math.PI * k) * 30;
    ball(bx, by, BR1, { rot: (960 - 700) / BR1 + k * 1.2, lx: -0.5, ly: 0.3 });
  }
}

// ---------------------------------------------------------------- the framed valley + the hand of cards (ochre)
function landY(kind, x) {
  const u = (x - 540) / 300;
  if (kind === 'U') return Math.abs(u) <= 1 ? 780 - 320 * u * u : 460;
  if (kind[0] === 'H') {     // the hills on the backs of the cards, peaked on the side of the card that shows
    const v = (x - 540 - (kind === 'H1' ? 230 : -230)) / 210;
    return Math.abs(v) <= 1 ? 330 + 450 * v * v : 780;
  }
  return Math.abs(u) <= 1 ? 470 + 300 * u * u : 770;
}
function landPts(kind) { const p = []; for (let x = 190; x <= 890; x += 10) p.push([x, landY(kind, x)]); p.push([890, 840], [190, 840]); return p; }
function onLand(kind, x, r) {
  const f = landY(kind, x), d = (landY(kind, x + 1) - landY(kind, x - 1)) / 2, L = Math.hypot(d, 1);
  return [x + (r * d) / L, f - r / L];
}
const PAL_FRONT = [{ bg: SKY, land: CREAM, mat: PINK }, { bg: PINK, land: CREAM, mat: CREAM }, { bg: TEAL, land: CREAM, mat: OCHRE },
  { bg: CREAM, land: BLUE, mat: SKY }, { bg: VIOLET, land: CREAM, mat: PINK }, { bg: '#f2c14e', land: TEAL, mat: CREAM }];
const PAL_BACK = { bg: RED, land: INK, mat: CREAM };
// a framed picture, drawn in frame coords (interior 200..880 × 250..830)
function framedPicture(kind, pal, seed, ballFn) {
  cutRect(164, 214, 752, 652, INK, seed, 2.4, 1);
  cutRect(184, 234, 712, 612, pal.mat, seed + 1, 1.6, 0);
  X.save(); X.beginPath(); X.rect(200, 250, 680, 580); X.clip();
  X.fillStyle = pal.bg; X.fillRect(200, 250, 680, 580);
  cutPoly(dens(landPts(kind)), pal.land, seed + 2, 2.2, 1);
  if (ballFn) ballFn();
  X.restore();
}
function pictureXf(cx, cy, s, rot = 0, sx = 1) { X.translate(cx, cy); X.rotate(rot); X.scale(s * sx, s); X.translate(-540, -540); }

function ball2(t) {          // the ball inside the centre picture
  const t0 = w(19);
  let bx = 852;
  if (t > t0) { const u = t - t0; bx = 540 + 312 * Math.exp(-2.3 * u) * Math.cos(6.54 * u); }
  const [cx, cy] = onLand('U', bx, BR1);
  const rot = (bx - 852) / BR1;
  let eye = 1;
  if (t > w(23)) eye = 1 - E.inOut(seg(t, w(23), w(23) + 0.25));                    // dozes off at the bottom
  if (t > w(25) - 0.05) eye = E.outBack(seg(t, w(25) - 0.05, w(25) + 0.12));         // "But"
  if (t > w(39)) eye = 1 - E.inOut(seg(t, w(39), w(39) + 0.2));                      // "feels" like the bottom
  if (t > w(44) - 0.05) eye = E.outBack(seg(t, w(44) - 0.05, w(44) + 0.12));       // "really": eyes open, looks down
  const flipping = FLIPS().find(([i, tf]) => t >= tf - 0.05 && t < tf + 0.2);
  const keys = [[-9, -0.5, 0.3], [w(19) + 0.3, 0.3, 0.2], [w(23), 0, 0.3], [w(28), -0.8, -0.3], [w(29) + 0.2, 0.8, -0.3], [w(32) - 0.15, 0, -0.4]];
  let [lx, ly] = gaze(keys, t);
  if (flipping) { lx = Math.sign(flipping[0]) * 0.9; ly = -0.5; }
  if (t > w(34) + 0.1 && t < w(35)) { lx = 0; ly = 0.25; }
  if (t > w(44)) { lx = 0.15 * Math.sin((t - w(44)) * 18); ly = 0.95; }
  let sq = 0.3 * bump(t, w(42) + 0.05, 0.12);
  sq += 0.2 * bump(t, w(21) + 0.05, 0.08);
  return () => ball(cx, cy, BR1, { rot, eye, lx, ly, sq });
}
// the fan: 11 cards pivoting about a point below the frame
const NCARD = 5, FAN_DEG = 8.5, PIV = [540, 1060];
let FLIP_ORDER = null;
function FLIPS() {
  const t0 = w(32) - 0.1, t1 = w(34) + 0.25, out = [];
  FLIP_ORDER.forEach((i, k) => out.push([i, lerp(t0, t1, k / (FLIP_ORDER.length - 1))]));
  return out;
}
function cardState(i, t) {
  const sU = E.inOut(seg(t, 7.85, 8.35));
  let s = lerp(1 + 0.05 * E.out(seg(t, w(25), w(25) + 0.2)), 0.5, sU);
  const fan = E.outBack(seg(t, w(28) + Math.abs(i) * 0.035, w(28) + 0.45 + Math.abs(i) * 0.035));
  const fold = E.in(seg(t, w(35) + (NCARD - Math.abs(i)) * 0.02, w(35) + 0.32 + (NCARD - Math.abs(i)) * 0.02));
  const grow = E.inOut(seg(t, w(35) + 0.4, w(35) + 1.0));
  s = lerp(s, 1, grow);
  const th = (i * FAN_DEG * Math.PI) / 180 * fan * (1 - fold);
  const yc = lerp(lerp(540, 560, sU), 540, grow);
  const R = PIV[1] - yc;
  const cx = PIV[0] + Math.sin(th) * R, cy = PIV[1] - Math.cos(th) * R;
  let sx = 1, face = 'U';
  const fl = FLIPS().find(f => f[0] === i);
  if (fl) { const u = seg(t, fl[1], fl[1] + 0.18); sx = Math.abs(Math.cos(Math.PI * u)); face = u < 0.5 ? 'U' : (i > 0 ? 'H1' : 'H0'); }
  return { cx, cy, s, th, sx, face, lift: 0.05 * E.out(seg(t, w(25), w(25) + 0.2)) * (1 - sU) };
}
function heads(t) {
  const HX = [150, 390, 700, 940];
  HX.forEach((x, i) => {
    const u = E.outBack(seg(t, w(16) + i * 0.07, w(16) + i * 0.07 + 0.3));
    const v = E.in(seg(t, w(25) + i * 0.04, w(25) + 0.32 + i * 0.04));
    const dy = (1 - u) * 320 + v * 380 + 4 * bump(t, w(17) + i * 0.05, 0.1);
    if (dy > 330) return;
    const tilt = i === 2 ? 0.18 * E.inOut(seg(t, w(24), w(24) + 0.3)) : 0;
    X.save(); X.translate(x, 960 + dy); X.rotate(tilt);
    cutPoly(capsulePts(-70, 120, 70, 120, 170), INK, 600 + i * 7, 2.2, 0.8);
    cutPoly(dens((() => { const p = []; for (let k = 0; k < 20; k++) p.push([Math.cos(k / 20 * TAU) * 60, Math.sin(k / 20 * TAU) * 66]); return p; })(), 20), INK, 610 + i * 7, 2.2, 0.8);
    X.restore();
  });
}
function drawActTwo(t) {
  X.fillStyle = OCHRE; X.fillRect(0, 0, SIZE, SIZE);
  // nail + string, until the picture lifts off the wall
  const sA = 1 - seg(t, w(25), w(25) + 0.15);
  if (sA > 0) {
    X.save(); X.globalAlpha = sA;
    smoothLine([[240, 230], [540, 168], [840, 230]], 5, 1.5); X.strokeStyle = INK; X.lineWidth = 3; X.stroke();
    circle(540, 166, 7); X.fillStyle = INK; X.fill();
    X.restore();
  }
  const slam = t < w(17) ? 1.1 : 1 + 0.1 * (1 - E.out(seg(t, w(17), w(17) + 0.1)));
  const bF = ball2(t);
  const cards = [];
  for (let i = -NCARD; i <= NCARD; i++) cards.push(i);
  cards.sort((a, b) => Math.abs(b) - Math.abs(a));                         // centre card on top
  const showFan = t > w(28) && t < w(35) + 0.45;
  for (const i of cards) {
    if (i !== 0 && !showFan) continue;
    const st = cardState(i, t);
    X.save();
    pictureXf(st.cx, st.cy, st.s * (i === 0 ? slam : 1) * (1 + st.lift), st.th, st.sx);
    const pal = st.face[0] === 'H' ? PAL_BACK : PAL_FRONT[((i % 6) + 6) % 6];
    framedPicture(st.face, pal, 700 + (i + 6) * 11, i === 0 ? bF : null);
    X.restore();
  }
  heads(t);
}

// ---------------------------------------------------------------- the saddle (red, then cream)
// side view: the seat IS the valley's U. front view: the same saddle is a hump, falling away on both sides.
const BR3 = 38;
const SEAT = [540, 780 - BR3], TOPV = [540, 470 - BR3];
function stirrup(ax, ay, phi, seed, L = 120) {
  const ex = ax + Math.sin(phi) * L, ey = ay + Math.cos(phi) * L;
  smoothLine([[ax, ay], [(ax + ex) / 2, (ay + ey) / 2], [ex, ey]], seed, 1.2); X.strokeStyle = LEATHERDK; X.lineWidth = 13; X.lineCap = 'round'; X.stroke();
  X.save(); X.translate(ex, ey); X.rotate(-phi);
  const S = [[-13, 0], [13, 0], [36, 64], [-36, 64]];
  X.save(); X.translate(6, 8); jStroke(dens(S, 14), seed + 3, 1.4); X.closePath(); X.strokeStyle = 'rgba(0,0,0,.4)'; X.lineWidth = 10; X.stroke(); X.restore();
  jStroke(dens(S, 14), seed + 3, 1.4); X.closePath(); X.strokeStyle = INK; X.lineWidth = 10; X.lineJoin = 'round'; X.stroke();
  X.restore();
}
function blanket(x, y, wd, ht, seed) {
  cutRect(x, y, wd, ht, TEAL, seed, 2.2, 1);
  for (const [dy, col, hh] of [[ht - 46, CREAM, 10], [ht - 30, INK, 8], [ht - 18, CREAM, 6]]) { roughRect(x + 6, y + dy, wd - 12, hh, seed + dy, 1.2, 30); X.fillStyle = col; X.fill(); }
}
const sway = (t, tStamp) => Math.exp(-2.2 * Math.max(0, t - tStamp)) * 0.35 * Math.sin((t - tStamp) * 7) + 0.03 * Math.sin(t * 2.1);
// the seat: the valley's U, settling into a shallow saddle seat (settle 0 -> 1)
function seatY(x, k) { const u = (x - 540) / 300; return Math.abs(u) <= 1 ? 780 - lerp(320, 170, k) * u * u : lerp(460, 610, k); }
function sideSaddle(t, tStamp, seed = 800, k = 1) {
  const lip = lerp(460, 610, k);
  blanket(180, 730, 740, 192, seed + 90);
  // fender + stirrup hang from under the seat
  const sw = sway(t, tStamp) * 0.6;
  X.save(); X.translate(545, 820); X.rotate(sw * 0.3); X.translate(-545, -820);
  cutPoly(dens([[470, 800], [622, 800], [604, 960], [494, 966]], 18), LEATHERDK, seed + 5, 2, 1);
  stirrup(549, 950, sw, seed + 30, 30);
  X.restore();
  // the tree: the seat follows the valley, a horn in front, a cantle behind
  const p = [[205, Math.max(lip + 60, 680)], [210, lip + 14], [230, lip - 24]];
  for (let x = 240; x <= 840; x += 14) p.push([x, seatY(x, k)]);
  p.push([858, lip - 36], [884, lip - 62], [904, lip - 50], [884, lip + 10], [886, Math.max(lip + 120, 700)], [872, 856], [822, 888], [258, 888], [210, 858]);
  cutPoly(dens(p, 20), LEATHER, seed, 2.2, 1.2);
  roughPoly(dens([[212, 826], [886, 826], [874, 852], [824, 884], [258, 884], [212, 854]], 22), seed + 7, 1.6); X.fillStyle = LEATHERDK; X.fill();
  cutPoly(capsulePts(236, lip - 14, 226, lip - 84, 34), LEATHERDK, seed + 8, 1.6, 0.8);                           // horn neck
  roughPoly(dens((() => { const q = []; for (let j = 0; j < 16; j++) q.push([224 + Math.cos(j / 16 * TAU) * 40, lip - 92 + Math.sin(j / 16 * TAU) * 14]); return q; })(), 12), seed + 9, 1.2); X.fillStyle = LEATHERDK; X.fill();
  const st = []; for (let x = 262; x <= 818; x += 18) st.push([x, seatY(x, k) + 24]);
  smoothLine(st, seed + 50, 1.6); X.strokeStyle = STITCH; X.lineWidth = 3.5; X.setLineDash([12, 9]); X.stroke();
  smoothLine([[232, 842], [540, 846], [866, 842]], seed + 51, 1.6); X.stroke(); X.setLineDash([]);
}
const GULLET = (() => { const p = []; for (let k = 0; k <= 12; k++) { const th = (k / 12) * Math.PI; p.push([540 + 160 * Math.cos(th), 800 - 160 * Math.sin(th)]); } return p; })();
function saddlePts() {
  const p = [];
  for (let x = 270; x <= 810; x += 15) p.push([x, landY('N', x)]);
  p.push([830, 760], [815, 850], [745, 872], [700, 800]);
  for (const q of GULLET) p.push(q);
  p.push([335, 872], [265, 850], [250, 760]);
  return dens(p, 20);
}
const TEAR = (() => { const p = []; for (let k = 0; k <= 40; k++) p.push([622 + (hash(k * 1.9) - 0.5) * 18 + Math.sin(k * 0.9) * 4, 380 + k * 17]); return p; })();
function frontSaddle(t, tStamp, seed = 800) {
  const sw = sway(t, tStamp);
  blanket(232, 650, 616, 250, seed + 95);
  stirrup(335, 815, sw, seed + 30);
  stirrup(745, 815, -sw * 0.9, seed + 40);
  cutPoly(saddlePts(), LEATHER, seed, 2.2, 1.2);
  const top = []; for (let x = 300; x <= 780; x += 20) top.push([x, landY('N', x) + 22]);
  smoothLine(top, seed + 50, 1.6); X.strokeStyle = STITCH; X.lineWidth = 3.5; X.setLineDash([12, 9]); X.stroke(); X.setLineDash([]);
  const flapL = dens([[268, 770], [290, 838], [340, 846], [372, 790], [330, 750]], 16), flapR = flapL.map(([x, y]) => [1080 - x, y]);
  roughPoly(flapL, seed + 60, 1.6); X.fillStyle = LEATHERDK; X.fill();
  roughPoly(flapR, seed + 70, 1.6); X.fillStyle = LEATHERDK; X.fill();
}
const CHK = () => [[w(49) + 0.03, 370, 650, -1, -0.1], [w(50) + 0.03, 710, 650, 1, -0.1], [w(50) + 0.27, 440, 530, -0.6, -0.8], [w(52), 640, 530, 0.6, -0.8]];
function drawActThree(t) {
  X.fillStyle = RED; X.fillRect(0, 0, SIZE, SIZE);
  const t0 = w(46), tT = w(54), tf = w(56);
  const slam = 1 + 0.09 * (1 - E.out(seg(t, t0, t0 + 0.09)));
  X.save(); X.translate(540, 650); X.scale(slam, slam); X.translate(-540, -650);
  if (t < tT + 0.16) {                       // side view, then it turns side-on on "falling"
    const sx = 1 - E.in(seg(t, tT, tT + 0.16));
    X.save(); X.translate(540, 0); X.scale(Math.max(0.02, sx), 1); X.translate(-540, 0); sideSaddle(t, t0, 800, E.out(seg(t, t0 + 0.04, t0 + 0.3))); X.restore();
  } else if (t < tf) {                        // ...and comes round as the front view
    const sx = E.out(seg(t, tT + 0.16, tT + 0.32));
    X.save(); X.translate(540, 0); X.scale(Math.max(0.02, sx), 1); X.translate(-540, 0); frontSaddle(t, tT + 0.3); X.restore();
  } else {                                   // the far side tears off and drops
    const u = t - tf;
    X.save(); X.beginPath(); X.moveTo(-50, -50); TEAR.forEach(p => X.lineTo(p[0], p[1])); X.lineTo(622, 1200); X.lineTo(-50, 1200); X.closePath(); X.clip();
    frontSaddle(t, tT + 0.3);
    jStroke(TEAR.filter(p => p[1] > 440 && p[1] < 905), 900, 1.5); X.strokeStyle = FIBRE; X.lineWidth = 6; X.stroke();
    X.restore();
    if (u < 1.4) {
      X.save(); X.translate(60 * u, 1500 * u * u); X.translate(622, 700); X.rotate(0.35 * u + 0.9 * u * u); X.translate(-622, -700);
      X.beginPath(); X.moveTo(1200, -50); TEAR.forEach(p => X.lineTo(p[0], p[1])); X.lineTo(622, 1200); X.lineTo(1200, 1200); X.closePath(); X.clip();
      frontSaddle(t, tT + 0.3);
      jStroke(TEAR.filter(p => p[1] > 440 && p[1] < 905), 910, 1.5); X.strokeStyle = FIBRE; X.lineWidth = 6; X.stroke();
      X.restore();
    }
  }
  X.restore();
  // a tick in every direction it checks
  const ca = 1 - seg(t, w(53), w(53) + 0.2);
  if (ca > 0) {
    X.save(); X.globalAlpha = ca;
    CHK().forEach(([tc, x, y], k) => { if (t < tc) return; const s = 70 * (1 + 0.45 * (1 - E.out(seg(t, tc, tc + 0.08)))); tick(x, y, s, 950 + k * 7, FIBRE); });
    X.restore();
  }
  // the FIN card that tries to end things
  const tF = w(64), drop = seg(t, tF, tF + 0.12), tP = tF + 0.42;
  const by0 = TOPV[1] + BR3, d2 = 2 * BR3;              // ball bottom on the hump, ball diameter
  let sq = 0.9 * (seg(t, w(47), w(47) + 0.06) - seg(t, w(47) + 0.2, w(47) + 0.42));       // "flat"
  let cardBottom = null;
  if (t >= tF) {
    const press = E.out(seg(t, tF + 0.12, tF + 0.22));
    if (t < tP) { sq = 0.55 * press; cardBottom = t < tF + 0.12 ? lerp(-80, by0 - d2, E.in(drop)) : by0 - d2 * (1 - 0.5 * sq); }
    else {
      const u = t - tP;
      sq = lerp(0.55, -0.3, E.out(seg(t, tP, tP + 0.08))) * (1 - seg(t, tP + 0.08, tP + 0.45)) + (t > tP + 0.08 ? -0.08 * Math.sin((t - tP) * 30) * Math.exp(-(t - tP) * 6) : 0);
      cardBottom = by0 - d2 * 0.725 - 900 * u - 3600 * u * u;
    }
  }
  // the ball: in the seat, carried up onto the hump by the turn
  const ride = E.inOut(seg(t, tT, tT + 0.32));
  const bx = 540, byC = lerp(SEAT[1], TOPV[1], ride) - Math.sin(Math.PI * ride) * 40;
  const hop = t > w(59) ? 26 * Math.sin(Math.PI * seg(t, w(59), w(59) + 0.22)) : 0;
  const keys = [[-9, 0, 0.9], [t0 + 0.15, 0, -0.1], [w(47) + 0.4, 0, 0.2]].concat(CHK().map(([tc, , , lx, ly]) => [tc - 0.07, lx, ly]),
    [[w(52) + 0.2, 0, -0.2], [tT + 0.3, -1, 0.1], [w(59), 1, 0.2], [w(60), 0.3, -0.6], [tF - 0.05, 0, -1], [tP + 0.1, 0.2, -0.8], [tP + 0.5, 0, 0]]);
  const [lx, ly] = gaze(keys, t);
  let eye = 1 - 0.6 * clamp(sq * 2), wide = 1;
  if (t > w(59)) wide = 1 + 0.35 * (1 - seg(t, w(59) + 0.3, w(60)));
  if (t > tF + 0.12 && t < tP) eye = 0.25;
  const wob = t > w(59) ? 0.12 * Math.sin((t - w(59)) * 16) * Math.exp(-(t - w(59)) * 3) : 0;
  X.save(); X.translate(bx, byC + BR3); X.rotate(wob); X.translate(-bx, -byC - BR3);
  ball(bx, byC - hop, BR3, { eye, lx, ly, sq, wide });
  X.restore();
  if (cardBottom !== null && cardBottom > -40) {
    const cw = 560, ch = 300, cx = 540, cy = cardBottom - ch / 2;
    cutRect(cx - cw / 2, cy - ch / 2, cw, ch, CREAM, 1000, 2.4, 1.3);
    X.save(); X.translate(cx, cy);
    const L = (x, y, a, b, s) => { roughRect(x, y, a, b, s, 1.6, 20); X.fillStyle = INK; X.fill(); };
    L(-205, -100, 52, 200, 1010); L(-205, -100, 150, 46, 1011); L(-205, -22, 122, 42, 1012);
    L(-26, -100, 52, 200, 1013);
    L(102, -100, 48, 200, 1014); L(207, -100, 48, 200, 1015);
    roughPoly(dens([[102, -100], [150, -100], [255, 100], [207, 100]], 18), 1016, 1.6); X.fillStyle = INK; X.fill();
    X.restore();
  }
}

// ---------------------------------------------------------------- parked; opened; the map (cream)
const BALL_SCR = [500, 650];
function camFour(t) {          // world -> screen zoom onto the ball
  const u = E.inOut(seg(t, w(71), w(71) + 0.6));
  const S = Math.exp(lerp(0, Math.log(4.2), u));
  const ax = lerp(SEAT[0], BALL_SCR[0], u), ay = lerp(SEAT[1], BALL_SCR[1], u);
  return { S, ax, ay };
}
const MAP = { cx: 545, cy: 600, wd: 720, ht: 540, unit: 250 };
let TRAILS = null;
function buildTrails() {
  const R = rng(77); TRAILS = [];
  for (let j = 0; j < 8; j++) {
    const dy = j < 4 ? -1 : 1, lane = (j % 4) - 1.5, sx = Math.sign(lane);
    const p = [[0, 0]]; let x = 0, y = 0, k = 0;
    while (Math.abs(y) < 205 && k < 30) {
      if (k % 2 === 0) x += sx * (6 + R() * 14) * (Math.abs(lane) + 0.3); else y += dy * (16 + R() * 12);
      x = clamp(x, -320, 320); p.push([x, y]); k++;
    }
    TRAILS.push(mkPath(p));
  }
}
const TRAIL_T = () => TRAILS.map((_, j) => w(81) + [0, 0.25, 0.1, 0.35, 0.05, 0.3, 0.15, 0.4][j]);
function mapContent(t) {         // map coords: origin at map centre
  const U = MAP.unit;
  X.fillStyle = FIBRE; X.fillRect(-MAP.wd / 2, -MAP.ht / 2, MAP.wd, MAP.ht);
  X.save(); X.beginPath(); X.rect(-MAP.wd / 2 + 10, -MAP.ht / 2 + 10, MAP.wd - 20, MAP.ht - 20); X.clip();
  // faint grid
  X.strokeStyle = 'rgba(35,64,196,0.12)'; X.lineWidth = 1.5;
  for (let x = -MAP.wd / 2; x <= MAP.wd / 2; x += 45) { X.beginPath(); X.moveTo(x, -MAP.ht / 2); X.lineTo(x, MAP.ht / 2); X.stroke(); }
  for (let y = -MAP.ht / 2; y <= MAP.ht / 2; y += 45) { X.beginPath(); X.moveTo(-MAP.wd / 2, y); X.lineTo(MAP.wd / 2, y); X.stroke(); }
  // contours of a saddle: high ground left and right (leather), low ground above and below (blue)
  [0.07, 0.25, 0.55, 0.95].forEach((c, k) => {
    for (const s of [-1, 1]) {
      const hi = [], lo = [];
      for (let q = -1.15; q <= 1.15001; q += 0.05) { hi.push([s * Math.sqrt(c + q * q) * U, q * U]); lo.push([q * 1.3 * U, s * Math.sqrt(c + q * q * 1.69) * U]); }
      smoothLine(hi, 1100 + k * 10 + s, 1.6); X.strokeStyle = LEATHER; X.lineWidth = 4; X.stroke();
      smoothLine(lo, 1200 + k * 10 + s, 1.6); X.strokeStyle = BLUE; X.lineWidth = 4; X.stroke();
    }
  });
  // trails: every way downhill, drawn as little staircases
  TRAILS.forEach((P, j) => {
    const ts = TRAIL_T()[j], u = E.out(seg(t, ts, ts + 0.5));
    if (u <= 0) return;
    const pts = pathUpTo(P, P.len * u);
    X.save(); X.translate(3, 4); jStroke(pts, 1300 + j * 20, 1.2); X.strokeStyle = 'rgba(0,0,0,.28)'; X.lineWidth = 7; X.lineJoin = 'miter'; X.stroke(); X.restore();
    jStroke(pts, 1300 + j * 20, 1.2); X.strokeStyle = RED; X.lineWidth = 7; X.lineJoin = 'miter'; X.stroke();
    const ah = E.outBack(seg(t, w(83) + j * 0.03, w(83) + 0.2 + j * 0.03));
    if (ah > 0) {
      const n = P.pts.length, a = P.pts[n - 2], b = P.pts[n - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      X.save(); X.translate(b[0], b[1]); X.rotate(ang); X.scale(ah, ah);
      roughPoly([[16, 0], [-10, -13], [-10, 13]], 1400 + j, 1); X.fillStyle = RED; X.fill(); X.restore();
    }
  });
  X.restore();
  // fold creases
  X.strokeStyle = 'rgba(80,60,30,0.16)'; X.lineWidth = 2;
  for (const x of [-180, 0, 180]) { X.beginPath(); X.moveTo(x, -MAP.ht / 2); X.lineTo(x, MAP.ht / 2); X.stroke(); }
  for (const y of [-90, 90]) { X.beginPath(); X.moveTo(-MAP.wd / 2, y); X.lineTo(MAP.wd / 2, y); X.stroke(); }
  // you are here (until the ball itself appears there)
  const tb = w(84);
  const dotA = 1 - seg(t, tb, tb + 0.1);
  if (dotA > 0) { circle(0, 0, 11 * (1 + 0.3 * bump(t, w(79), 0.12))); X.fillStyle = hexA(RED, dotA); X.fill(); }
  if (t > tb) {
    const keys = [[-9, 0, 0], [tb + 0.2, 0, -1], [tb + 0.5, 0.2, 1], [tb + 0.8, -0.7, -0.7], [tb + 1.1, 0.7, -0.7]];
    const [lx, ly] = gaze(keys, t);
    ball(0, 0, 20 * E.outBack(seg(t, tb, tb + 0.18)), { lx, ly, sh: 0.6 });
  }
}
function drawMap(t) {
  const t0 = w(77);
  if (t < t0) return;
  const pop = E.out(seg(t, t0, t0 + 0.2));
  const ux = E.inOut(seg(t, t0 + 0.18, t0 + 0.48)), uy = E.inOut(seg(t, t0 + 0.48, w(79)));
  const wd = lerp(MAP.wd / 4, MAP.wd, ux), ht = lerp(MAP.ht / 3, MAP.ht, uy);
  const cx = lerp(BALL_SCR[0], MAP.cx, pop), cy = lerp(BALL_SCR[1] - 40, MAP.cy, pop), s = lerp(0.5, 1, pop);
  X.save(); X.translate(cx, cy); X.scale(s, s);
  cutRect(-wd / 2, -ht / 2, wd, ht, FIBRE, 1500, 2.2, 1.2);
  X.save(); X.beginPath(); X.rect(-wd / 2, -ht / 2, wd, ht); X.clip();
  X.scale(wd / MAP.wd, ht / MAP.ht); mapContent(t);
  X.restore();
  // accordion shading while it unfolds: alternate panels dark / light
  const cols = 4, rows = 3;
  for (let c = 0; c < cols; c++) {
    const a = (1 - ux) * 0.35; if (a < 0.01) break;
    X.fillStyle = c % 2 ? `rgba(40,25,10,${a})` : `rgba(255,250,235,${a * 0.6})`;
    X.fillRect(-wd / 2 + (c * wd) / cols, -ht / 2, wd / cols, ht);
  }
  for (let r = 0; r < rows; r++) {
    const a = (1 - uy) * 0.3; if (a < 0.01) break;
    X.fillStyle = r % 2 ? `rgba(40,25,10,${a})` : `rgba(255,250,235,${a * 0.6})`;
    X.fillRect(-wd / 2, -ht / 2 + (r * ht) / rows, wd, ht / rows);
  }
  X.restore();
  return [cx + (wd * s) / 2, cy + 20];
}
// someone's hand: a Bass-style ink silhouette; (px, py) is the pinch between finger and thumb
function hand(px, py, s, ang = 0, pinch = 1) {
  X.save(); X.translate(px, py); X.rotate(ang); X.scale(s, s);
  cutPoly(capsulePts(150, 8, 800, 40, 120), RED, 1600, 2, 1);           // sleeve
  cutPoly(capsulePts(120, 6, 150, 10, 136, 4), FIBRE, 1601, 1.5, 0);     // cuff
  const g = 6 + 10 * (1 - pinch);
  cutPoly(dens([[40, -50], [120, -62], [130, 64], [60, 70], [30, 40]], 16), INK, 1602, 2, 1);      // palm
  cutPoly(capsulePts(70, -40, 4, -g - 8, 30), INK, 1603, 1.8, 0.8);      // index finger
  cutPoly(capsulePts(70, -14, 14, -g + 20, 26), INK, 1604, 1.8, 0.6);    // middle finger, curled
  cutPoly(capsulePts(70, 46, 6, g + 8, 30), INK, 1605, 1.8, 0.8);        // thumb
  X.restore();
}
function drawActFour(t) {
  X.fillStyle = CREAM; X.fillRect(0, 0, SIZE, SIZE);
  const C = camFour(t);
  X.save(); X.translate(C.ax, C.ay); X.scale(C.S, C.S); X.translate(-SEAT[0], -SEAT[1]);
  sideSaddle(t, w(67), 1700);
  // the parking sign
  const st = 1 + 0.15 * (1 - E.out(seg(t, w(67), w(67) + 0.09)));
  X.save(); X.translate(985, 990); X.scale(st, st);
  cutPoly(capsulePts(0, 0, 0, -400, 16), INK, 1750, 1.2, 1);
  const flash = bump(t, w(70) + 0.05, 0.07) + bump(t, w(70) + 0.25, 0.07);
  cutRect(-78, -560, 156, 156, mixHex(BLUE, SKY, flash * 0.7), 1751, 2, 1);
  roughRect(-44, -530, 26, 96, 1752, 1.2, 16); X.fillStyle = FIBRE; X.fill();
  const bowl = []; for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + (k / 10) * Math.PI; bowl.push([-22 + 16 + Math.cos(a) * 30, -500 + Math.sin(a) * 26]); }
  smoothLine([[-30, -526]].concat(bowl, [[-30, -474]]), 1753, 1.2); X.strokeStyle = FIBRE; X.lineWidth = 20; X.lineCap = 'butt'; X.stroke();
  X.restore();
  X.restore();
  // the ball, in screen space so its edge stays crisp when we zoom in
  const bx = C.ax, by = C.ay, r = BR3 * C.S;
  const tO = w(74), lid = 1.95 * E.inOut(seg(t, tO, w(76) + 0.1)) * (1 - E.inOut(seg(t, w(77) + 0.3, w(77) + 0.6)));
  let eye = 0.45;
  for (const tb of [w(70) + 0.02, w(70) + 0.22]) if (t > tb && t < tb + 0.08) eye = 0;
  if (t > w(72)) eye = lerp(0.45, 1, E.outBack(seg(t, w(72) + 0.1, w(72) + 0.25)));
  const [lx, ly] = gaze([[-9, 0.2, 0.3], [w(72) + 0.1, 1, -0.2], [tO + 0.2, 0.6, 0.6]], t);
  const inside = rr => { if (t < w(77)) { roughRect(-rr * 0.45, -rr * 0.5, rr * 0.9, rr * 0.55, 1780, 1, 14); X.fillStyle = FIBRE; X.fill(); } };
  ball(bx, by, r, { eye, lx, ly, lid, wide: t > w(72) ? 1.15 : 1, inside });
  // the map, and the hand that opens me and then reads it
  const edge = drawMap(t);
  const tH = w(72);
  if (t > tH) {
    const lp = lidPoint(bx, by, r, lid);
    let px = lp[0] + 4, py = lp[1];
    const come = E.out(seg(t, tH, tH + 0.35));
    px = lerp(1350, px, come); py = lerp(lp[1] - 120, py, come);
    let ang = -0.5 * (1 - seg(t, tO, w(76))) - lid * 0.25;
    if (edge) { const u = E.inOut(seg(t, w(77) + 0.05, w(77) + 0.45)); px = lerp(px, edge[0] - 6, u); py = lerp(py, edge[1], u); ang = lerp(ang, 0.05, u); }
    hand(px, py, 1.7, ang, t < tH + 0.3 ? 0.3 : 1);
  }
}
const ZOOM5 = () => w(86) + 0.55;
const CUT5 = () => ZOOM5() + 0.5;

// ---------------------------------------------------------------- tail: a staircase hill, many ways down (ink)
const ZIG = (() => {
  const y = k => 440 + 90 * k, hw = k => 80 + 120 * k, p = [[540 - hw(6), 1100]];
  for (let k = 6; k >= 1; k--) { p.push([540 - hw(k), y(k)]); p.push([540 - hw(k - 1), y(k)]); }
  p.push([540 - hw(0), y(0)], [540 + hw(0), y(0)]);
  for (let k = 1; k <= 6; k++) { p.push([540 + hw(k - 1), y(k)]); p.push([540 + hw(k), y(k)]); }
  p.push([540 + hw(6), 1100]);
  return dens(p, 30);
})();
function drawActFive(t) {
  X.fillStyle = INK; X.fillRect(0, 0, SIZE, SIZE);
  cutPoly(ZIG, CREAM, 1900, 2.2, 1);
  const t0 = CUT5();
  const land = t0 + 0.2;
  const hops = [[t0 + 0.85, 540, 680, 440, 530], [t0 + 1.1, 680, 800, 530, 620], [t0 + 1.35, 800, 920, 620, 710]];
  let bx = 540, by = 440 - BR1, sq = 0;
  if (t < land) by = lerp(-80, 440 - BR1, E.in(seg(t, t0, land)));
  sq = 0.45 * bump(t, land + 0.05, 0.1);
  for (const [th, a, b, ya, yb] of hops) {
    if (t >= th) { bx = b; by = yb - BR1; }
    if (t >= th && t < th + 0.26) { const u = (t - th) / 0.26; bx = lerp(a, b, E.sine(u)); by = lerp(ya, yb, E.in(u)) - BR1 - Math.sin(Math.PI * u) * 44; }
    sq = Math.max(sq, 0.35 * bump(t, th + 0.29, 0.09));
  }
  // the route it took: little red dashes behind it
  const [lx, ly] = gaze([[-9, 0, 0.6], [land + 0.15, -0.9, 0.4], [land + 0.45, 0.9, 0.4], [t0 + 0.8, 0.8, 0.6]], t);
  ball(bx, by, BR1, { lx, ly, sq, eye: E.outBack(seg(t, land - 0.05, land + 0.1)) });
}

// ---------------------------------------------------------------- frame
function render(ctx, t) {
  X = ctx; BF = Math.floor(t * 12);
  X.save();
  X.setTransform(ctx.__scale || 1, 0, 0, ctx.__scale || 1, 0, 0);
  if (t < w(16)) drawActOne(t);
  else if (t < w(46)) drawActTwo(t);
  else if (t < w(67)) drawActThree(t);
  else if (t < CUT5()) {
    const z = E.in(seg(t, ZOOM5(), CUT5()));
    if (z > 0) {             // push into the top-left trail's first step
      const P = TRAILS[0], a = P.pts[P.pts.length - 4];
      const fx = MAP.cx + a[0], fy = MAP.cy + a[1];
      const S = Math.exp(lerp(0, Math.log(14), z));
      X.save(); X.translate(lerp(fx, 540, z), lerp(fy, 470, z)); X.scale(S, S); X.translate(-fx, -fy);
      drawActFour(t); X.restore();
    } else drawActFour(t);
  } else drawActFive(t);
  X.save(); X.globalAlpha = 0.5; const o = (BF % 3) * 37; X.drawImage(GRAIN, -o, -o, SIZE * 1.2, SIZE * 1.2); X.restore();
  if (t >= -0.2) drawCaptions(t);
  const fade = Math.max(1 - seg(t, FILM.start, FILM.start + 0.6), seg(t, FILM.end - 0.7, FILM.end));
  if (fade > 0) { X.fillStyle = `rgba(10,8,6,${fade})`; X.fillRect(0, 0, SIZE, SIZE); }
  X.restore();
}

function initFilm(words) {
  WORDS = words.words; WT = WORDS.map(x => x.t0);
  FILM.end = Math.ceil((words.dur + 2.5) * 10) / 10;
  const R = rng(19), ord = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];
  for (let i = ord.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
  FLIP_ORDER = ord;
  buildMorph(); buildTrails();
  buildGrain(); buildCaptions();
}
