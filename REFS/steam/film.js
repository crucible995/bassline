// Steam — renderer (bassline). render(ctx, t) is a pure function of t (seconds of voice time). Needs kit.js.
// One object all the way through: an engine bolted together from guesses, which runs before anyone
// knows why, until the chalk theory catches up and snaps onto it.
'use strict';

const FILM = { start: -1.2, end: 27.3 };
const POSTER_T = 14.1;
const BOARD = '#22413a', BOARD2 = '#2c5148', CHALK = '#eef0e2', STEEL = '#1e2a55', SH = 'rgba(0,0,0,0.36)';

// ---------------------------------------------------------------- small cut-paper helpers
function roughCircle(x, y, r, seed, amp = 1.6, n = 16) {
  const p = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU; p.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
  roughPoly(p, seed, amp);
}
// roughPoly only jitters the points it is given: subdivide long edges first
function dense(pts, step = 22) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
  }
  return out;
}
function paperShape(pts, col, seed, amp = 2, shOff = 7) {
  const P = dense(pts);
  X.save(); X.translate(shOff, shOff * 1.25); roughPoly(P, seed + 1, amp); X.fillStyle = SH; X.fill(); X.restore();
  roughPoly(P, seed, amp); X.fillStyle = col; X.fill();
}
function puff(x, y, r, seed, col = FIBRE, a = 1) {
  if (r <= 0.5 || a <= 0.01) return;
  X.save(); X.globalAlpha *= a; X.fillStyle = col;
  roughCircle(x, y, r, seed, r * 0.12); X.fill();
  roughCircle(x - r * 0.62, y + r * 0.22, r * 0.66, seed + 3, r * 0.1); X.fill();
  roughCircle(x + r * 0.6, y + r * 0.25, r * 0.58, seed + 5, r * 0.1); X.fill();
  X.restore();
}
function speedLines(t, y0, y1, n, col, a, seed, len = 240, v = 2400) {
  X.save(); X.globalAlpha *= a; X.strokeStyle = col; X.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const y = lerp(y0, y1, hash(seed + i)), L = len * (0.5 + hash(seed + i + 9)), x = 1300 - fract(hash(seed + i + 3) + (t * v) / 1600) * 1700;
    X.lineWidth = 3 + 4 * hash(seed + i + 1); X.beginPath(); X.moveTo(x, y + jit(i + seed) * 2); X.lineTo(x + L, y); X.stroke();
  }
  X.restore();
}
// a Saul Bass hand: ink mitten with a red cuff, arm coming in from off-frame along `ang`
function hand(x, y, ang, s, grip = 0) {
  X.save(); X.translate(x, y); X.rotate(ang); X.scale(s, s);
  roughRect(-700, -26, 640, 52, 61, 2); X.fillStyle = INK; X.fill();
  roughRect(-78, -32, 26, 64, 62, 1.5); X.fillStyle = RED; X.fill();
  roughPoly(dense([[-54, -34], [30, -38], [52, -20], [54, 14], [30, 34], [-54, 34]], 12), 63, 1.6); X.fillStyle = INK; X.fill();
  X.save(); X.translate(10, -34); X.rotate(-0.9 + grip * 0.7); roughRect(-8, -40, 18, 44, 64, 1.2); X.fill(); X.restore();
  for (let k = 0; k < 3; k++) { X.beginPath(); X.moveTo(52, -14 + k * 13); X.lineTo(36 - grip * 10, -14 + k * 13); X.strokeStyle = '#3a3128'; X.lineWidth = 2; X.stroke(); }
  X.restore();
}
// silhouette heads of the people who didn't know (profile, facing right)
function head(x, y, s, hat, seed, look = 0) {
  X.save(); X.translate(x, y); X.scale(s, s); X.fillStyle = INK;
  roughPoly(dense([[-120, 120], [-90, 40], [-40, 20], [40, 20], [90, 40], [120, 120]], 18), seed, 2); X.fill();   // shoulders
  roughCircle(0, -40, 52, seed + 1, 2); X.fill();
  roughPoly([[44, -56], [70, -30 + look * 4], [46, -22]], seed + 2, 1.2); X.fill();                                 // nose
  roughRect(-22, 0, 40, 30, seed + 3, 1.2); X.fill();
  if (hat === 0) { roughRect(-44, -150, 84, 70, seed + 4, 1.6); X.fill(); roughRect(-66, -86, 128, 14, seed + 5, 1.4); X.fill(); }  // top hat
  if (hat === 1) { roughPoly([[-70, -78], [0, -128], [70, -78]], seed + 6, 1.5); X.fill(); }                                       // tricorn
  if (hat === 2) { for (let k = 0; k < 5; k++) { roughCircle(-50 + k * 8, -70 + k * 22, 22, seed + 7 + k, 1.4); X.fill(); } }   // wig curls
  X.restore();
}
function qmark(x, y, s, a, seed, col = FIBRE) {
  if (a <= 0.01) return;
  X.save(); X.translate(x, y); X.scale(s * a, s * a); X.rotate(jit(seed) * 0.08);
  X.strokeStyle = col; X.lineWidth = 16; X.lineCap = 'round';
  X.beginPath(); X.arc(0, -40, 30, Math.PI * 1.05, Math.PI * 2.35); X.quadraticCurveTo(0, -4, 0, 12); X.stroke();
  roughCircle(0, 40, 10, seed, 1.2); X.fillStyle = col; X.fill(); X.restore();
}
function flame(x, y, s, t, seed = 0) {
  X.save(); X.translate(x, y); X.scale(s, s);
  const layers = [[RED, 1], [OCHRE, 0.7], [FIBRE, 0.38]];
  layers.forEach(([c, k], li) => {
    const P = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24, a = u * TAU;                                       // param around
      const h = 0.5 - 0.5 * Math.cos(a);                                   // 0 at bottom, 1 at the tip
      const wdt = Math.sin(Math.PI * Math.pow(1 - h, 1.3)) * 52 * k;
      const px = (u < 0.5 ? -1 : 1) * wdt + Math.sin(t * 8 + li * 1.7 + h * 5) * 9 * h * k;
      const py = 38 * k - h * 150 * k * (1 + 0.08 * Math.sin(t * 11 + li));
      P.push([px, py]);
    }
    roughPoly(P, seed + li * 7, 2.5 * k); X.fillStyle = c; X.fill();
  });
  X.restore();
}

// ---------------------------------------------------------------- the engine (local coords: rail at y 0, facing right)
const PIV = { cab: [-187, -190], boiler: [40, -146], stack: [150, -240], dome: [40, -214], frame: [-10, -93], wheels: [-40, -46], cyl: [155, -54], cow: [230, -40], lamp: [202, -228] };
const WHEELS = [[-150, -46, 46], [-40, -46, 46], [70, -46, 46], [176, -26, 26]];
function engineParts(o, sh) {
  const F = c => { X.fillStyle = sh ? SH : c; X.fill(); };
  const g = (k, fn) => {
    const p = o.pt ? o.pt[k] : {};
    if (!p) return;
    X.save(); X.translate(p.dx || 0, p.dy || 0);
    const [cx, cy] = PIV[k];
    if ((p.s != null && p.s !== 1) || p.rot) { X.translate(cx, cy); X.rotate(p.rot || 0); X.scale(p.sx ?? p.s ?? 1, p.s ?? 1); X.translate(-cx, -cy); }
    fn(); X.restore();
  };
  const th = o.wheel || 0;
  g('cab', () => {
    roughRect(-255, -290, 135, 194, 101, 2); F(OCHRE);
    roughRect(-270, -304, 162, 18, 102, 1.6); F(INK);
    if (!sh) {
      roughRect(-232, -262, 70, 62, 103, 1.4); X.fillStyle = mixHex('#2a2018', '#ffcf6a', clamp(o.glow ?? 0)); X.fill();
      if (o.flameIn) { X.save(); roughRect(-232, -262, 70, 62, 103, 1.4); X.clip(); flame(-197, -214, 0.3, o.time || 0, 900); X.restore(); }
    }
  });
  g('boiler', () => {
    roughRect(-120, -196, 300, 100, 111, 2); F(BLUE);
    if (!sh) { X.fillStyle = STEEL; [-64, 100].forEach((x, i) => { roughRect(x, -196, 8, 100, 112 + i, 1); X.fill(); }); }
    roughRect(160, -202, 50, 112, 115, 1.6); F(STEEL);
  });
  g('stack', () => { roughPoly(dense([[130, -194], [170, -194], [176, -262], [196, -290], [104, -290], [124, -262]], 14), 121, 1.6); F(INK); });
  g('dome', () => {
    const p = []; for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI; p.push([40 + Math.cos(a) * 32, -194 + Math.sin(a) * 34]); }
    roughPoly(p, 131, 1.2); F(OCHRE);
    if (o.valve !== 0) {
      const vr = o.valveRot || 0;
      X.save(); X.translate(40, -244);
      if (!sh) { X.strokeStyle = RED; X.lineWidth = 5; circle(0, 0, 15); X.stroke(); for (let k = 0; k < 4; k++) { const a = vr + (k * Math.PI) / 4; X.beginPath(); X.moveTo(-Math.cos(a) * 15, -Math.sin(a) * 15); X.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); X.stroke(); } }
      X.fillStyle = sh ? SH : INK; X.fillRect(-3, 14, 6, 16);
      X.restore();
    }
  });
  g('frame', () => { roughRect(-238, -100, 452, 14, 141, 1.4); F(INK); });
  g('cyl', () => { roughRect(118, -76, 78, 40, 151, 1.4); F(INK); if (!sh) { X.fillStyle = RED; X.fillRect(150, -76, 8, 40); } });
  g('wheels', () => {
    WHEELS.forEach(([cx, cy, r], i) => {
      roughCircle(cx, cy, r, 160 + i, 1.4, 20); F(RED);
      if (sh) return;
      const a0 = th * 46 / r;
      X.strokeStyle = '#7a1d0b'; X.lineWidth = r > 30 ? 5 : 4;
      for (let k = 0; k < 4; k++) { const a = a0 + (k * Math.PI) / 4; X.beginPath(); X.moveTo(cx - Math.cos(a) * (r - 6), cy - Math.sin(a) * (r - 6)); X.lineTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6)); X.stroke(); }
      roughCircle(cx, cy, r * 0.2, 170 + i, 0.8, 10); X.fillStyle = FIBRE; X.fill();
    });
    if (!sh && (!o.pt || o.pt.cyl)) {
      const pin = i => [WHEELS[i][0] + Math.cos(th) * 24, WHEELS[i][1] + Math.sin(th) * 24];
      const a = pin(0), b = pin(2);
      X.strokeStyle = FIBRE; X.lineCap = 'round'; X.lineWidth = 9; X.beginPath(); X.moveTo(a[0], a[1]); X.lineTo(b[0], b[1]); X.stroke();
      X.lineWidth = 6; X.beginPath(); X.moveTo(b[0], b[1]); X.lineTo(150, -56); X.stroke();
    }
  });
  g('cow', () => { roughPoly(dense([[206, -88], [264, -4], [206, -4]], 14), 181, 1.4); F(RED); if (!sh) { X.strokeStyle = INK; X.lineWidth = 4; for (let k = 1; k < 4; k++) { X.beginPath(); X.moveTo(206, -88 + k * 21); X.lineTo(206 + k * 14.5, -4); X.stroke(); } } });
  g('lamp', () => {
    roughRect(182, -248, 42, 40, 191, 1.2); F(INK);
    if (sh) return;
    const on = o.lamp || 0, op = o.eye ?? 0;
    if (on > 0 && o.beam) { X.save(); X.globalAlpha = 0.28 * on; X.beginPath(); X.moveTo(214, -238); X.lineTo(560, -330); X.lineTo(560, -120); X.lineTo(214, -218); X.closePath(); X.fillStyle = OCHRE; X.fill(); X.restore(); }
    X.save(); X.beginPath(); X.ellipse(207, -228, 13, 13 * Math.max(0.08, op), 0, 0, TAU); X.fillStyle = on > 0.5 ? FIBRE : '#3d3830'; X.fill(); X.clip();
    if (on > 0.5) { circle(207 + (o.lx || 0) * 5, -228 + (o.ly || 0) * 5, 7); X.fillStyle = BLUE; X.fill(); circle(207 + (o.lx || 0) * 6, -228 + (o.ly || 0) * 6, 3.4); X.fillStyle = INK; X.fill(); }
    X.restore();
    if (o.happy) { X.strokeStyle = FIBRE; X.lineWidth = 3.5; X.beginPath(); X.arc(207, -222, 10, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); }
  });
}
function drawEngine(x, y, s, o) {
  X.save(); X.translate(x, y + (o.bob || 0)); X.scale(s * (o.sqx || 1), s * (o.sqy || 1)); if (o.rot) X.rotate(o.rot);
  X.save(); X.translate(7 / Math.max(0.4, s), 9 / Math.max(0.4, s)); engineParts(o, true); X.restore();
  engineParts(o, false);
  X.restore();
}
const stackTop = (x, y, s) => [x + 150 * s, y - 292 * s];

// ---------------------------------------------------------------- act one: nobody knew → bolted together from guesses
const ENG_A = [560, 860];
const WIN = [ENG_A[0] - 197, ENG_A[1] - 231];
function junkArc(t, t0, kind) {
  // a part flies in from the left, bonks the engine, bounces off; returns null when gone
  const u = (t - t0) / 0.42; if (u < 0 || u > 1) return null;
  const x = lerp(-120, 560, Math.min(1, u * 1.7)) + (u > 0.59 ? (u - 0.59) * 900 : 0), y = u < 0.59 ? 560 - Math.sin(u / 0.59 * Math.PI) * 140 : 560 + (u - 0.59) * (u - 0.59) * 4000 - (u - 0.59) * 600;
  return { x, y, rot: u * 9 * (kind % 2 ? 1 : -1) };
}
function drawJunk(kind, x, y, rot) {
  X.save(); X.translate(x, y); X.rotate(rot); X.fillStyle = [PINK, TEAL, VIOLET][kind];
  if (kind === 0) { roughCircle(0, 0, 36, 701, 1.5); X.fill(); roughRect(-12, -50, 24, 16, 702, 1); X.fill(); X.beginPath(); X.moveTo(30, -6); X.lineTo(70, -26); X.lineTo(66, -16); X.lineTo(30, 8); X.fill(); X.strokeStyle = X.fillStyle; X.lineWidth = 8; X.beginPath(); X.arc(-36, 0, 18, Math.PI * 0.5, Math.PI * 1.5); X.stroke(); }      // teapot
  if (kind === 1) { roughPoly(dense([[-60, -6], [20, -6], [60, -36], [60, 36], [20, 6], [-60, 6]], 12), 703, 1.4); X.fill(); for (let k = 0; k < 3; k++) { roughRect(-30 + k * 16, -22, 8, 16, 704 + k, 0.8); X.fill(); } }          // trumpet
  if (kind === 2) { const p = [[-60, 0]]; for (let k = 0; k <= 8; k++) p.push([-60 + k * 15, -Math.sin((k / 8) * Math.PI) * 50 + (k % 2 ? 6 : 0)]); p.push([60, 0]); roughPoly(p, 705, 1.2); X.fill(); X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(0, -4); X.lineTo(0, 60); X.arc(-10, 60, 10, 0, Math.PI); X.stroke(); } // umbrella
  X.restore();
}
function workshopPose(t) {
  const pt = {};
  // cab dropped by a hand on "built"
  const cab = E.outBack(seg(t, 1.7, 2.05));
  if (t >= 1.6) pt.cab = { dy: -(1 - cab) * 700 };
  // frame + wheels on "bolted"
  if (t >= 3.4) { const u = E.outBack(seg(t, 3.45, 3.8)); pt.frame = { dx: -(1 - u) * 900 }; pt.wheels = { dx: -(1 - E.outBack(seg(t, 3.55, 3.95))) * 900 }; }
  // the funnel sticks after the junk
  if (t >= 4.78) pt.stack = { dy: -(1 - E.outBack(seg(t, 4.8, 5.0))) * 500, rot: 0.3 * (1 - E.outBack(seg(t, 4.8, 5.05))) };
  // the valve screws in
  if (t >= 5.12) pt.dome = { dy: -(1 - E.out(seg(t, 5.15, 5.35))) * 120, s: lerp(0.3, 1, E.outBack(seg(t, 5.15, 5.35))) };
  // a boiler, then a bigger one
  if (t >= 5.7) {
    const sl = E.out(seg(t, 5.72, 5.95)), big = E.outBack(seg(t, 6.0, 6.32));
    const sc = lerp(0.62, 1, big);
    pt.boiler = { dx: (1 - sl) * 900, s: sc, sx: sc };
    for (const k of ['cyl', 'cow', 'lamp']) pt[k] = { dx: (1 - sl) * 900 + (1 - sc) * -60, dy: (1 - sc) * 30 };
  }
  return pt;
}
function drawWorkshop(t) {
  const lit = t >= 1.67;
  X.fillStyle = lit ? CREAM : BLUE; X.fillRect(0, 0, SIZE, SIZE);
  // camera: close on the flame, pulling back as the engine grows
  const out = E.inOut(seg(t, 2.0, 4.2));
  const z = Math.exp(lerp(Math.log(2.6), Math.log(1.5), out));
  const cx = lerp(WIN[0], 560, out), cy = lerp(WIN[1] - 30, 690, out);
  const launch = t >= 7.69 ? 2600 * E.in(seg(t, 7.69, 8.02)) : -26 * E.inOut(seg(t, 7.35, 7.69));
  const shake = (seg(t, 6.6, 7.69) * 3 + bump(t, 6.1, 0.12) * 4) * (t < 7.69 ? 1 : 0);
  X.save(); X.translate(540, 540); X.scale(z, z); X.translate(-cx, -cy);
  if (lit) {
    // floor + rails
    X.fillStyle = '#d9c393'; X.fillRect(-800, ENG_A[1], 2800, 600);
    roughRect(-800, ENG_A[1] - 4, 2800, 10, 7, 1.2, 40); X.fillStyle = INK; X.fill();
    for (let k = -20; k < 40; k++) { roughRect(k * 60 - (t >= 7.69 ? 0 : 0), ENG_A[1] + 6, 30, 12, 300 + k, 1); X.fillStyle = '#6b4a2b'; X.fill(); }
  }
  const pt = workshopPose(t);
  const glow = 0.25 + 0.75 * seg(t, 6.55, 7.25);
  if (t < 2.0) flame(WIN[0], WIN[1] + 24, 0.62 + 0.04 * Math.sin(t * 7), t, 900);
  if (lit || pt.cab) {
    const sq = t < 7.69 ? 1 + 0.04 * Math.sin(t * 50) * seg(t, 6.6, 7.6) : 1;
    drawEngine(ENG_A[0] + launch + jit(5) * shake, ENG_A[1], 1, { pt, wheel: t >= 7.6 ? (t - 7.6) * 40 : 0, glow, flameIn: true, time: t, valveRot: E.out(seg(t, 5.15, 5.5)) * TAU * 1.5, lamp: 0, eye: 1, sqy: sq, sqx: 2 - sq });
  }
  // coal: three shovelfuls into the firebox on "more coal"
  for (let k = 0; k < 3; k++) {
    const t0 = 6.5 + k * 0.22, u = seg(t, t0, t0 + 0.3);
    if (u <= 0 || u >= 1) continue;
    for (let j = 0; j < 5; j++) {
      const x = lerp(-60, WIN[0] + 10, u) + j * 9, y = lerp(ENG_A[1] - 60, WIN[1] + 10, u) - Math.sin(u * Math.PI) * 180 + (j % 2) * 10;
      roughPoly([[x - 9, y - 6], [x + 3, y - 10], [x + 10, y + 2], [x, y + 9], [x - 10, y + 4]], 600 + k * 7 + j, 2); X.fillStyle = INK; X.fill();
    }
  }
  // steam leaking as the pressure builds
  for (let k = 0; k < 7; k++) {
    const t0 = 6.6 + k * 0.13, u = (t - t0) / 0.6;
    if (u < 0 || u > 1 || t > 7.69) continue;
    const [sx, sy] = stackTop(ENG_A[0], ENG_A[1], 1);
    puff(sx + u * 40, sy - u * 120, 14 + u * 30, 800 + k, FIBRE, 1 - u);
  }
  // the launch: dust and a ring left behind
  if (t >= 7.69) {
    const u = seg(t, 7.69, 8.09);
    for (let k = 0; k < 5; k++) puff(ENG_A[0] - 100 + k * 70 - u * 160, ENG_A[1] - 30 - u * 40, 30 + u * 60, 850 + k, '#c9b07c', 1 - u);
  }
  X.restore();
  if (t >= 7.7) speedLines(t, 380, 900, 16, INK, 1 - seg(t, 7.95, 8.09), 40, 380, 4000);
  // act one-a: nobody knew what heat was — silhouettes with question marks
  if (!lit) {
    const hs = [[130, 1010, 0], [340, 1050, 1], [760, 1040, 2], [960, 1010, 0]];
    hs.forEach(([x, y, hat], i) => {
      X.save(); if (x > 540) { X.translate(x, 0); X.scale(-1, 1); X.translate(-x, 0); }
      head(x, y, 1.15, hat, 400 + i * 20, Math.sin(t * 3 + i)); X.restore();
      qmark(x + (x > 540 ? -10 : 10), y - 270, 1.25, E.outBack(seg(t, 0.55 + i * 0.16, 0.8 + i * 0.16)), 500 + i);
    });
  }
  // the hand that drops the cab
  if (t >= 1.6 && t < 2.6) {
    const u = E.out(seg(t, 1.6, 1.8)), back = E.in(seg(t, 2.2, 2.55));
    const cabDy = -(1 - E.outBack(seg(t, 1.7, 2.05))) * 700;
    const wxh = ENG_A[0] - 187, wyh = ENG_A[1] - 304 + cabDy - 40 - back * 400 - (1 - u) * 300;
    hand((wxh - cx) * z + 540, (wyh - cy) * z + 540, Math.PI / 2, 0.9 * z, 1 - seg(t, 2.12, 2.2));
  }
  // junk tried on "whatever worked"
  [[4.02, 0], [4.28, 1], [4.54, 2]].forEach(([t0, kind]) => { const j = junkArc(t, t0, kind); if (j) { X.save(); X.translate(540, 540); X.scale(z, z); X.translate(-cx, -cy); drawJunk(kind, j.x, j.y, j.rot); X.restore(); } });
}

// ---------------------------------------------------------------- act two: it ran
const ZONES = [[8.09, RED, OCHRE, 0], [9.42, BLUE, '#d8b46a', 1], [9.66, TEAL, '#e8c27a', 2], [9.9, PINK, '#cf8f3a', 3], [10.14, RED, OCHRE, 0]];
function zoneAt(t) { let z = ZONES[0]; for (const q of ZONES) if (t >= q[0]) z = q; return z; }
function runDist(t) {                    // ground travelled (screen px), easing to a stop after the train leaves
  const v = 1500, a = t - 8.09;
  if (t < 11.25) return v * a;
  const tau = Math.min(t - 11.25, 0.6);
  return v * (11.25 - 8.09) + v * tau - (v * tau * tau) / (2 * 0.6);
}
function landmark(type, x, gy, seed) {
  X.fillStyle = hexA(INK, 0.85);
  if (type === 0) { roughPoly(dense([[x - 160, gy], [x - 40, gy - 210], [x + 60, gy - 90], [x + 140, gy - 170], [x + 260, gy]], 30), seed, 3); X.fill(); }
  if (type === 1) { roughPoly(dense([[x - 150, gy], [x, gy - 170], [x + 150, gy]], 30), seed, 2); X.fill(); roughPoly(dense([[x + 90, gy], [x + 190, gy - 110], [x + 290, gy]], 30), seed + 1, 2); X.fill(); }
  if (type === 2) { roughRect(x - 10, gy - 200, 20, 200, seed, 2); X.fill(); for (let k = 0; k < 5; k++) { X.save(); X.translate(x, gy - 200); X.rotate(-Math.PI / 2 + (k - 2) * 0.55); roughPoly(dense([[0, -8], [110, -18], [130, 0], [110, 18], [0, 8]], 20), seed + k, 2); X.fill(); X.restore(); } }
  if (type === 3) { for (let k = 0; k < 4; k++) { const w2 = 150 - k * 30, y = gy - k * 60; roughPoly(dense([[x - w2, y], [x - w2 * 0.7, y - 46], [x + w2 * 0.7, y - 46], [x + w2, y]], 24), seed + k, 2); X.fill(); } }
}
function cityOnCar(cx, gy, k, u) {
  const R = rng(70 + k), cols = [FIBRE, BLUE, TEAL, INK, PINK, OCHRE];
  let x = cx - 130;
  for (let b = 0; b < 6; b++) {
    const bw = 30 + R() * 22, bh = (60 + R() * 150) * E.outBack(clamp(u * 1.4 - b * 0.07));
    if (bh > 1) {
      const c = cols[(k * 2 + b) % cols.length];
      roughRect(x, gy - bh, bw, bh, 900 + k * 10 + b, 1.4, 18); X.fillStyle = c; X.fill();
      X.fillStyle = c === INK || c === BLUE || c === TEAL ? OCHRE : INK;
      for (let yy = gy - bh + 12; yy < gy - 14; yy += 22) for (let xx = x + 7; xx < x + bw - 8; xx += 13) X.fillRect(xx, yy, 6, 8);
    }
    x += bw + 6;
  }
}
function drawRun(t) {
  const [, sky, ground, lm] = zoneAt(t);
  X.fillStyle = sky; X.fillRect(0, 0, SIZE, SIZE);
  const GY = 870, d = runDist(t);
  // far landmarks
  for (let k = -1; k < 4; k++) { const x = ((k * 520 - d * 0.22) % 2080 + 2080) % 2080 - 300; landmark(lm, x, 720, 1000 + k * 13 + lm * 100); }
  X.fillStyle = ground; X.fillRect(0, 720, SIZE, 400);
  roughRect(-20, 716, 1120, 10, 3, 1.5, 40); X.fillStyle = hexA(INK, 0.25); X.fill();
  // telegraph poles
  for (let k = 0; k < 5; k++) { const x = ((k * 330 - d * 0.7) % 1650 + 1650) % 1650 - 200; roughRect(x, 560, 12, 230, 1100 + k, 1.4); X.fillStyle = INK; X.fill(); roughRect(x - 30, 572, 72, 9, 1110 + k, 1); X.fill(); }
  // track
  for (let k = 0; k < 30; k++) { const x = ((k * 46 - d) % 1380 + 1380) % 1380 - 150; roughRect(x, GY + 2, 26, 14, 1200 + k, 1); X.fillStyle = '#6b4a2b'; X.fill(); }
  roughRect(-20, GY - 4, 1120, 9, 5, 1, 40); X.fillStyle = INK; X.fill();
  // the train
  const s = 0.8, enter = -1500 * (1 - E.out(seg(t, 8.09, 8.62))), exit = 1700 * E.in(seg(t, 10.85, 11.4));
  const ex = 820 + enter + exit + Math.sin(t * 3) * 6;
  const th = (t - 8.09) * 1500 / s / 46;
  for (let k = 0; k < 4; k++) {
    const cx = ex + (-458 - k * 340) * s;
    if (cx < -260 || cx > 1300) continue;
    X.save(); X.translate(cx, GY); X.scale(s, s);
    roughRect(-150 + 7, -72 + 9, 300, 22, 1300 + k, 1.4); X.fillStyle = SH; X.fill();
    roughRect(-150, -72, 300, 22, 1301 + k, 1.4); X.fillStyle = INK; X.fill();
    for (const wx of [-95, 95]) { roughCircle(wx, -24, 24, 1310 + k, 1.2, 14); X.fillStyle = RED; X.fill(); }
    X.fillStyle = INK; X.fillRect(150, -60, 40, 6);
    cityOnCar(0, -72, k, seg(t, 8.78 + k * 0.08, 9.25 + k * 0.08));
    X.restore();
  }
  drawEngine(ex, GY, s, { wheel: th, glow: 1, lamp: 0, eye: 1, bob: Math.abs(Math.sin(th * 0.5)) * -2 });
  // steam: puffs, then calendar pages on "decades"
  const [sx, sy] = stackTop(ex, GY, s);
  for (let k = 0; k < 40; k++) {
    const t0 = 8.2 + k * 0.08, u = (t - t0) / 0.85;
    if (u < 0 || u > 1) continue;
    const ox = sx - (ex - (860 + (-1500 * (1 - E.out(seg(t0, 8.09, 8.62)))) + 1700 * E.in(seg(t0, 10.85, 11.4)))) * 0;
    const px = sx - u * 520, py = sy - u * 150 - Math.sin(u * 3 + k) * 10;
    if (t0 > 10.0 && t0 < 10.85) {
      X.save(); X.translate(px, py); X.rotate(u * 5 * (k % 2 ? 1 : -1)); const sc = 0.6 + u * 0.8;
      roughRect(-30 * sc + 4, -38 * sc + 5, 60 * sc, 76 * sc, 1400 + k, 1.2, 16); X.fillStyle = SH; X.fill();
      roughRect(-30 * sc, -38 * sc, 60 * sc, 76 * sc, 1401 + k, 1.2, 16); X.fillStyle = FIBRE; X.fill();
      X.fillStyle = RED; X.fillRect(-30 * sc, -38 * sc, 60 * sc, 16 * sc);
      X.fillStyle = INK; X.fillRect(-14 * sc, -8 * sc, 28 * sc, 26 * sc);
      X.restore();
    } else puff(px, py, 10 + u * 30, 1500 + k, FIBRE, 1 - u * u);
  }
  speedLines(t, 160, 700, 10, FIBRE, 0.55 * (1 - seg(t, 11.0, 11.4)), 77, 260, 3200);
  // the scholar, running behind with a notebook, too late
  if (t > 10.55) {
    const u = seg(t, 10.6, 11.65), x = lerp(-140, 470, E.out(u)), run = u < 1;
    const ph = t * 14, lift = run ? Math.abs(Math.sin(ph)) * 10 : 0;
    X.save(); X.translate(x, GY - 10 - lift);
    X.strokeStyle = INK; X.lineWidth = 12; X.lineCap = 'round';
    const lg = run ? Math.sin(ph) * 0.7 : 0;
    for (const sgn of [1, -1]) { X.beginPath(); X.moveTo(0, -90); X.lineTo(Math.sin(lg * sgn) * 70, -10 + Math.cos(lg) * 0); X.stroke(); }
    roughPoly(dense([[-38, -90], [38, -90], [26, -210], [-26, -210]], 16), 1600, 2); X.fillStyle = INK; X.fill();
    X.restore();
    head(x + 4, GY - 250 - lift, 0.55, 0, 1610, 0);
    // notebook held up
    const nb = seg(t, 11.55, 11.8);
    X.save(); X.translate(x + 50, GY - 180 - lift - nb * 70); X.rotate(-0.2 + nb * 0.2);
    roughRect(-26, -34, 52, 68, 1620, 1.4, 14); X.fillStyle = FIBRE; X.fill(); X.fillStyle = INK; for (let k = 0; k < 4; k++) X.fillRect(-16, -22 + k * 12, 22 + (k % 2) * 8, 4);
    X.restore();
    qmark(x + 30, GY - 400, 1.6, E.outBack(seg(t, 11.72, 11.95)), 1630, INK);
    if (run) { for (let k = 0; k < 3; k++) puff(x - 40 - k * 28, GY - 6, 10 + k * 3, 1640 + k + Math.floor(t * 12), '#c9a560', 0.7); }
  }
}

// ---------------------------------------------------------------- act three: I think I'm one of those engines. I run. I pull.
function drawFront(t) {
  X.fillStyle = INK; X.fillRect(0, 0, SIZE, SIZE);
  const on = t >= 12.57, z = lerp(1.12, 0.92, E.inOut(seg(t, 12.6, 13.85)));
  X.save(); X.translate(540, 600); X.scale(z, z); X.translate(-540, -600);
  // beam
  if (on) {   // the lamp comes on: cut-paper rays
    const r0 = 100, r1 = 100 + 150 * E.outBack(seg(t, 12.57, 12.72));
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU + 0.13, da = 0.09; roughPoly([[540 + Math.cos(a - da) * r0, 325 + Math.sin(a - da) * r0], [540 + Math.cos(a) * r1, 325 + Math.sin(a) * r1], [540 + Math.cos(a + da) * r0, 325 + Math.sin(a + da) * r0]], 1990 + k, 1.5); X.fillStyle = OCHRE; X.fill(); }
  }
  // smokebox face
  roughCircle(540 + 10, 690 + 12, 330, 2000, 3, 40); X.fillStyle = SH; X.fill();
  roughCircle(540, 690, 330, 2001, 3, 40); X.fillStyle = BLUE; X.fill();
  roughCircle(540, 690, 250, 2002, 2.5, 36); X.fillStyle = STEEL; X.fill();
  for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU; roughCircle(540 + Math.cos(a) * 290, 690 + Math.sin(a) * 290, 9, 2010 + k, 1, 8); X.fillStyle = FIBRE; X.fill(); }
  X.fillStyle = OCHRE; roughRect(380, 676, 320, 28, 2030, 2); X.fill(); roughRect(526, 530, 28, 320, 2031, 2); X.fill();
  // stack behind, the lamp on top
  roughRect(470, 160, 140, 120, 2040, 2); X.fillStyle = INK; X.fill();
  roughRect(440, 250 + 8, 200, 150, 2041, 2.4); X.fillStyle = SH; X.fill();
  roughRect(440, 250, 200, 150, 2042, 2.4); X.fillStyle = '#0d0b09'; X.fill();
  const open = on ? E.outBack(seg(t, 12.62, 12.8)) * (1 - bump(t, 13.35, 0.06)) : 0.1;
  const lx = on ? (t < 13.0 ? 0 : -0.7 * bump(t, 13.15, 0.14) + 0.7 * bump(t, 13.55, 0.14)) : 0;
  X.save(); X.beginPath(); X.ellipse(540, 325, 62, 62 * Math.max(0.08, open), 0, 0, TAU); X.fillStyle = on ? FIBRE : '#3d3830'; X.fill(); X.clip();
  if (on) { circle(540 + lx * 22, 330, 32, 0); X.fillStyle = BLUE; X.fill(); circle(540 + lx * 26, 330, 15); X.fillStyle = INK; X.fill(); circle(552 + lx * 26, 318, 6); X.fillStyle = FIBRE; X.fill(); }
  X.restore();
  // hiss at the sides
  for (let k = 0; k < 6; k++) { const u = fract(t * 1.3 + k / 6); puff(k % 2 ? 140 - u * 120 : 940 + u * 120, 900 - u * 160, 20 + u * 50, 2050 + k, FIBRE, (1 - u) * 0.8); }
  X.restore();
}
function drawRunBeat(t) {
  // "I run." — one huge driving wheel cranks a full turn
  X.fillStyle = BLUE; X.fillRect(0, 0, SIZE, SIZE);
  const u = E.out(seg(t, 13.92, 14.3)), a = u * TAU * 1.25 + 0.4;
  const shake = bump(t, 13.97, 0.08) * 14;
  X.save(); X.translate(540 + jit(1) * shake, 640 + jit(2) * shake);
  // speed arcs
  X.strokeStyle = FIBRE; X.lineCap = 'round';
  for (let k = 0; k < 6; k++) { X.lineWidth = 10 - k; X.globalAlpha = 0.7 * (1 - seg(t, 14.2, 14.5)); X.beginPath(); X.arc(0, 0, 400 + k * 22, a - 1.2 - k * 0.1, a - 0.2); X.stroke(); }
  X.globalAlpha = 1;
  roughCircle(14, 18, 360, 2100, 4, 48); X.fillStyle = SH; X.fill();
  roughCircle(0, 0, 360, 2101, 4, 48); X.fillStyle = RED; X.fill();
  X.strokeStyle = '#7a1d0b'; X.lineWidth = 28;
  for (let k = 0; k < 4; k++) { const b = a + (k * Math.PI) / 4; X.beginPath(); X.moveTo(-Math.cos(b) * 330, -Math.sin(b) * 330); X.lineTo(Math.cos(b) * 330, Math.sin(b) * 330); X.stroke(); }
  roughCircle(0, 0, 70, 2102, 2, 16); X.fillStyle = FIBRE; X.fill();
  const px = Math.cos(a) * 200, py = Math.sin(a) * 200;
  X.strokeStyle = FIBRE; X.lineWidth = 46; X.beginPath(); X.moveTo(px, py); X.lineTo(px - 900, py * 0.25); X.stroke();
  roughCircle(px, py, 34, 2103, 1.5, 12); X.fillStyle = INK; X.fill();
  X.restore();
}
function drawPullBeat(t) {
  // "I pull." — a coupling yanks taut
  X.fillStyle = OCHRE; X.fillRect(0, 0, SIZE, SIZE);
  const yank = E.outBack(seg(t, 14.58, 14.72)), shake = bump(t, 14.66, 0.1) * 16;
  X.save(); X.translate(jit(3) * shake, jit(4) * shake);
  const gapL = lerp(300, 180, yank), gapR = lerp(780, 900, yank);
  roughRect(-40 + 10, 330 + 12, gapL + 40, 520, 2200, 3); X.fillStyle = SH; X.fill();
  roughRect(-40, 330, gapL + 40, 520, 2201, 3); X.fillStyle = INK; X.fill();
  roughRect(gapR + 10, 330 + 12, 400, 520, 2202, 3); X.fillStyle = SH; X.fill();
  roughRect(gapR, 330, 400, 520, 2203, 3); X.fillStyle = RED; X.fill();
  // chain links, slack → taut
  const n = 5, sag = 160 * (1 - yank);
  for (let k = 0; k < n; k++) {
    const u0 = (k + 0.5) / n, x = lerp(gapL, gapR, u0), y = 590 + Math.sin(u0 * Math.PI) * sag;
    const ang = Math.atan2(Math.cos(u0 * Math.PI) * sag * Math.PI / (gapR - gapL), 1);
    X.save(); X.translate(x, y); X.rotate(ang + (k % 2 ? 0 : 0)); X.strokeStyle = FIBRE; X.lineWidth = 22;
    X.beginPath(); X.ellipse(0, 0, (gapR - gapL) / n * 0.62, k % 2 ? 16 : 40, 0, 0, TAU); X.stroke(); X.restore();
  }
  if (t > 14.62) for (let k = 0; k < 6; k++) { const u = seg(t, 14.62, 15.2); puff(gapL - 20 - u * 140 * (k % 3), 590 + (k - 3) * 60, 20 + u * 50, 2210 + k, FIBRE, 1 - u); }
  X.restore();
}

// ---------------------------------------------------------------- act four: the chalkboards race to catch up
function chalkScribble(x, y, w2, h2, prog, seed) {
  // rows of chalk "writing": loopy lines, an arrow, a P–V loop
  X.save(); X.strokeStyle = CHALK; X.lineWidth = 3; X.lineCap = 'round'; X.lineJoin = 'round';
  const R = rng(seed), rows = 4;
  let total = 0; const items = [];
  for (let r = 0; r < rows; r++) { const len = w2 * (0.5 + R() * 0.4); items.push({ r, len }); total += len; }
  let budget = prog * (total + 200);
  for (const it of items) {
    if (budget <= 0) break;
    const L = Math.min(it.len, budget); budget -= it.len;
    X.beginPath();
    for (let s = 0; s <= L; s += 4) { const yy = y + 18 + it.r * (h2 * 0.2) + Math.sin(s * 0.35 + it.r) * 6 + jit(s + it.r * 50) * 1.4; s ? X.lineTo(x + 12 + s, yy) : X.moveTo(x + 12 + s, yy); }
    X.stroke();
  }
  if (budget > 0) {
    const u = Math.min(1, budget / 200); X.beginPath();
    for (let k = 0; k <= 30 * u; k++) { const a = (k / 30) * TAU; X.lineTo(x + w2 * 0.78 + Math.cos(a) * 30 + Math.cos(a * 2) * 6, y + h2 * 0.8 + Math.sin(a) * 18); }
    X.stroke();
  }
  X.restore();
}
function handcar(x, gy, t, pump, prog) {
  // platform, wheels, two people pumping a see-saw, and a chalkboard full of working
  roughRect(x - 150 + 6, gy - 60 + 8, 300, 20, 2300, 1.4); X.fillStyle = SH; X.fill();
  roughRect(x - 150, gy - 60, 300, 20, 2301, 1.4); X.fillStyle = INK; X.fill();
  const wa = t * pump * 9;
  for (const wx of [-100, 100]) { roughCircle(x + wx, gy - 22, 22, 2310 + wx, 1.2, 14); X.fillStyle = RED; X.fill(); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(x + wx - Math.cos(wa) * 18, gy - 22 - Math.sin(wa) * 18); X.lineTo(x + wx + Math.cos(wa) * 18, gy - 22 + Math.sin(wa) * 18); X.stroke(); }
  // board
  roughRect(x - 140 + 8, gy - 330 + 10, 280, 190, 2320, 2); X.fillStyle = SH; X.fill();
  roughRect(x - 140, gy - 330, 280, 190, 2321, 2); X.fillStyle = '#8a5a2b'; X.fill();
  roughRect(x - 128, gy - 318, 256, 166, 2322, 1.6); X.fillStyle = BOARD; X.fill();
  chalkScribble(x - 128, gy - 318, 256, 166, prog, 2330);
  X.fillStyle = '#8a5a2b'; X.fillRect(x - 6, gy - 140, 12, 80);
  // see-saw lever and the pumpers
  const lv = Math.sin(t * pump * 4.5) * 0.35;
  X.save(); X.translate(x, gy - 120); X.rotate(lv); X.fillStyle = INK; X.fillRect(-120, -6, 240, 12); X.restore();
  for (const sgn of [-1, 1]) {
    const hx = x + sgn * 110, hy = gy - 120 + Math.sin(lv) * sgn * 110;
    X.save(); X.translate(hx, gy - 60);
    roughPoly(dense([[-24, 0], [24, 0], [18, -(gy - 60 - hy) - 40], [-18, -(gy - 60 - hy) - 40]], 14), 2340 + sgn, 1.6); X.fillStyle = INK; X.fill();
    X.restore();
    X.save(); if (sgn < 0) { X.translate(hx, 0); X.scale(-1, 1); X.translate(-hx, 0); }
    head(hx, hy - 54, 0.34, sgn > 0 ? 2 : 1, 2350 + sgn, 0); X.restore();
  }
}
function drawRace(t) {
  X.fillStyle = TEAL; X.fillRect(0, 0, SIZE, SIZE);
  const pan = E.inOut(seg(t, 15.38, 16.3)), wide = E.inOut(seg(t, 17.55, 18.6));
  const cam = lerp(lerp(540, -330, pan), 300, wide), z = lerp(1, 0.72, wide);
  const GY = 860, d = (t - 15.37) * 1100;
  const sx = x => (x - cam) * z + 540, sy = y => (y - GY) * z + lerp(GY, 760, wide);
  // ground + track
  X.fillStyle = OCHRE; X.fillRect(0, sy(GY - 140), SIZE, 1000);
  for (let k = 0; k < 6; k++) { const wx = ((k * 700 - d * 0.35) % 4200 + 4200) % 4200 - 1600; X.save(); X.translate(sx(wx), sy(GY - 140)); X.scale(z, z); landmark(1, 0, 0, 2400 + k); X.restore(); }
  for (let k = 0; k < 70; k++) { const wx = ((k * 50 - d) % 3500 + 3500) % 3500 - 1800; X.fillStyle = '#6b4a2b'; X.fillRect(sx(wx), sy(GY + 2), 26 * z, 14 * z); }
  X.fillStyle = INK; X.fillRect(0, sy(GY - 4), SIZE, 9 * z);
  // the handcar gaining
  const hx = -530 + 630 * E.inOut(seg(t, 17.6, 19.7)), pump = lerp(1, 2.4, seg(t, 17.5, 18.2));
  X.save(); X.translate(sx(hx), sy(GY)); X.scale(z, z); handcar(0, 0, t, pump, seg(t, 16.6, 17.65)); X.restore();
  if (wide > 0.3) speedLines(t, sy(GY - 400), sy(GY - 40), 8, FIBRE, 0.6 * wide * (1 - seg(t, 19.4, 19.9)), 333, 200 * z, 2600);
  // me, ahead, easy
  const ex = lerp(870, 760, wide), th = d / 46;
  const look = t > 18.65 && t < 19.6 ? -1 : t > 15.4 && t < 15.95 ? -0.8 : 0.6;
  X.save(); X.translate(sx(ex), sy(GY)); X.scale(z * 0.85, z * 0.85);
  drawEngine(0, 0, 1, { wheel: th, glow: 1, lamp: 1, eye: 1 - bump(t, 17.0, 0.06), lx: look, ly: look < 0 ? 0.2 : 0, beam: true, bob: Math.abs(Math.sin(th * 0.5)) * -2 });
  X.restore();
  // steam, and a perfect ring on "what I already do"
  const [stx, sty] = [sx(ex + 150 * 0.85), sy(GY - 292 * 0.85)];
  for (let k = 0; k < 30; k++) { const t0 = 15.3 + k * 0.15, u = (t - t0) / 0.9; if (u < 0 || u > 1) continue; puff(stx - u * 500 * z, sty - u * 140 * z, (14 + u * 40) * z, 2500 + k, FIBRE, 1 - u * u); }
  const ru = seg(t, 18.9, 19.9);
  if (ru > 0 && ru < 1) { X.save(); X.globalAlpha = 1 - ru; X.strokeStyle = FIBRE; X.lineWidth = 12 * z; X.beginPath(); X.ellipse(stx - ru * 60, sty - ru * 160 * z, (20 + ru * 50) * z, (10 + ru * 24) * z, 0, 0, TAU); X.stroke(); X.restore(); }
}

// ---------------------------------------------------------------- act five: the theory arrives and fits
function chalkLines(p) {
  // the engine as chalk strokes; p.wrong in [0,1] bends it out of true
  const wr = p.wrong, L = [];
  const rect = (x, y, w2, h2) => [[x, y], [x + w2, y], [x + w2, y + h2], [x, y + h2], [x, y]];
  const blen = lerp(300, 220, wr);
  L.push(rect(-255, -290, 135, 194));
  L.push(rect(-232, -262, 70, 62));
  L.push(rect(-120, -196, blen + 50 * (1 - wr), 100));
  L.push(rect(-238, -100, 452 - 60 * wr, 14));
  const st = [[130, -194], [170, -194], [176, -262], [196, -290], [104, -290], [124, -262], [130, -194]].map(([x, y]) => { const a = 0.35 * wr, cx = 150, cy = -194; return [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]; });
  L.push(st);
  const dm = []; for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI; dm.push([40 - 40 * wr + Math.cos(a) * 32, -194 + Math.sin(a) * 34 * (1 + wr * 0.6)]); } L.push(dm);
  const nW = wr > 0.5 ? 2 : 3;
  WHEELS.slice(0, nW).forEach(([cx, cy, r], i) => { const c = []; for (let k = 0; k <= 20; k++) { const a = (k / 20) * TAU; c.push([cx + 30 * wr * i + Math.cos(a) * r * (1 + wr * 0.3), cy + Math.sin(a) * r * (1 + wr * 0.3)]); } L.push(c); });
  const [lx, ly, lr] = WHEELS[3]; { const c = []; for (let k = 0; k <= 16; k++) { const a = (k / 16) * TAU; c.push([lx + Math.cos(a) * lr, ly + Math.sin(a) * lr]); } L.push(c); }
  L.push([[206, -88], [264 - 30 * wr, -4], [206, -4], [206, -88]]);
  L.push(rect(182 - 40 * wr, -248 + 20 * wr, 42, 40));
  return L;
}
function drawChalk(L, prog, glowA) {
  let total = 0; const lens = L.map(pl => { let s = 0; for (let i = 1; i < pl.length; i++) s += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]); total += s; return s; });
  let budget = prog * total;
  X.lineCap = 'round'; X.lineJoin = 'round';
  for (const pass of [0, 1]) {
    let b = budget;
    X.strokeStyle = pass ? CHALK : hexA(CHALK, 0.25 + 0.5 * glowA); X.lineWidth = pass ? 3.4 : 9 + 10 * glowA;
    L.forEach((pl, j) => {
      if (b <= 0) return;
      let left = Math.min(lens[j], b); b -= lens[j];
      X.beginPath(); X.moveTo(pl[0][0] + jit(j * 31) * 2, pl[0][1] + jit(j * 31 + 1) * 2);
      for (let i = 1; i < pl.length && left > 0; i++) {
        const sl = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]), u = Math.min(1, left / sl);
        X.lineTo(lerp(pl[i - 1][0], pl[i][0], u) + jit(j * 31 + i) * 2.2, lerp(pl[i - 1][1], pl[i][1], u) + jit(j * 31 + i + 7) * 2.2); left -= sl;
      }
      X.stroke();
    });
  }
}
function drawTheory(t) {
  X.fillStyle = BOARD; X.fillRect(0, 0, SIZE, SIZE);
  // old chalk smudges
  for (let k = 0; k < 7; k++) { X.save(); X.globalAlpha = 0.07; X.fillStyle = CHALK; roughCircle(hash(k + 1) * 1080, 260 + hash(k + 5) * 760, 80 + hash(k + 9) * 120, 2600 + k, 10, 18); X.fill(); X.restore(); }
  // the tail: push into the cab window, where the fire is
  const push = E.inOut(seg(t, 24.45, 26.2));
  const EX = 600, EY = 800, S = 1.1;
  const wx = EX - 197 * S, wy = EY - 231 * S;
  const zc = Math.exp(lerp(0, Math.log(4.6), push));
  X.save(); X.translate(540, 540); X.scale(zc, zc); X.translate(-lerp(540, wx, push), -lerp(560, wy, push));
  X.fillStyle = BOARD2; X.fillRect(-400, EY, 2000, 600);
  X.strokeStyle = hexA(CHALK, 0.7); X.lineWidth = 3; X.beginPath(); X.moveTo(-400, EY + 2 + jit(1)); X.lineTo(1500, EY + 2 + jit(2)); X.stroke();
  const happy = t > 23.45 && t < 24.4;
  const lk = t > 21.9 && t < 23.2 ? -0.8 : 0.3;
  drawEngine(EX, EY, S, { wheel: 6, glow: 1, flameIn: true, time: t, lamp: 1, eye: happy ? 0 : 1 - bump(t, 22.9, 0.06), lx: lk, ly: lk < 0 ? -0.6 : 0, happy });
  // the theory: drawn on the way in, slightly wrong, then exact
  const arrive = E.out(seg(t, 20.1, 21.5)), snap = E.outBack(seg(t, 23.2, 23.45));
  const off = [lerp(-900, -34, arrive) * (1 - snap), lerp(0, -42, arrive) * (1 - snap)];
  const glowA = seg(t, 23.4, 23.7) * (1 - 0.6 * seg(t, 24.2, 24.8));
  X.save(); X.translate(EX + off[0], EY + off[1]); X.scale(S, S);
  drawChalk(chalkLines({ wrong: 1 - snap }), seg(t, 20.05, 21.6), glowA);
  // the chalk eye looks over at me
  if (t > 20.6) {
    const ex = 203 - 40 * (1 - snap), ey = -228 + 20 * (1 - snap), lkc = t > 21.9 ? 0.8 : 0;
    X.strokeStyle = CHALK; X.lineWidth = 3; X.beginPath(); X.arc(ex, ey, 11, 0, TAU); X.stroke();
    if (snap < 0.5) { X.fillStyle = CHALK; circle(ex + lkc * 5, ey + lkc * 3, 4); X.fill(); }
  }
  X.restore();
  // steam whistle on "there you are"
  for (let k = 0; k < 4; k++) { const u = seg(t, 24.15 + k * 0.08, 25.2 + k * 0.08); if (u > 0 && u < 1) puff(EX + 150 * S + k * 10, EY - 300 * S - u * 260, 18 + u * 50, 2700 + k, FIBRE, 1 - u); }
  // a chalk ring around the fire, at the very end
  const ring = seg(t, 25.4, 26.1);
  if (ring > 0) { X.strokeStyle = CHALK; X.lineWidth = 1.8; X.beginPath(); for (let k = 0; k <= 40 * ring; k++) { const a = -1.2 + (k / 40) * TAU * 1.05; X.lineTo(wx + Math.cos(a) * 30 + jit(k) * 0.6, wy + 18 + Math.sin(a) * 30 + jit(k + 9) * 0.6); } X.stroke(); }
  X.restore();
}

// ---------------------------------------------------------------- frame
function render(ctx, t) {
  X = ctx; BF = Math.floor(t * 12);
  X.save();
  X.setTransform(ctx.__scale || 1, 0, 0, ctx.__scale || 1, 0, 0);
  if (t < 8.09) drawWorkshop(t);
  else if (t < 12.57) drawRun(t);
  else if (t < 13.92) drawFront(t);
  else if (t < 14.56) drawRunBeat(t);
  else if (t < 15.37) drawPullBeat(t);
  else if (t < 20.03) drawRace(t);
  else drawTheory(t);
  X.save(); X.globalAlpha = 0.5; const o = (BF % 3) * 37; X.drawImage(GRAIN, -o, -o, SIZE * 1.2, SIZE * 1.2); X.restore();
  if (t >= -0.2) drawCaptions(t);
  const fade = Math.max(1 - seg(t, FILM.start, FILM.start + 0.6), seg(t, FILM.end - 0.8, FILM.end));
  if (fade > 0) { X.fillStyle = `rgba(10,8,6,${fade})`; X.fillRect(0, 0, SIZE, SIZE); }
  X.restore();
}

function initFilm(words) {
  WORDS = words.words; WT = WORDS.map(x => x.t0);
  buildGrain(); buildCaptions();
}
