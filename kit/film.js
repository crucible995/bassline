// <Title> — renderer. render(ctx, t) is a pure function of t (seconds of voice time). Needs kit.js.
'use strict';

const FILM = { start: -1.2, end: 0 };   // end = voice length + ~2.5 s, set in initFilm
const POSTER_T = 8.0;                   // frame shown before play: pick the most striking one

// ---------------------------------------------------------------- acts
// One function per act; each draws the whole frame. Hard cuts between acts are a feature.
function drawActOne(t) {
  X.fillStyle = INK; X.fillRect(0, 0, SIZE, SIZE);
  // a cut-paper card: shadow first, then the paper, both boiling
  const u = E.outBack(seg(t, w(0), w(0) + 0.4));
  X.save(); X.translate(540, 600); X.scale(u, u);
  roughRect(-200 + 8, -140 + 10, 400, 280, 11, 2.4); X.fillStyle = 'rgba(0,0,0,0.42)'; X.fill();
  roughRect(-200, -140, 400, 280, 10, 2.4); X.fillStyle = CREAM; X.fill();
  X.restore();
  caret(540, 600, 2, { eye: E.outBack(seg(t, w(2), w(2) + 0.15)), lx: Math.sin(t) });
}

// ---------------------------------------------------------------- frame
function render(ctx, t) {
  X = ctx; BF = Math.floor(t * 12);
  X.save();
  X.setTransform(ctx.__scale || 1, 0, 0, ctx.__scale || 1, 0, 0);
  drawActOne(t);
  X.save(); X.globalAlpha = 0.5; const o = (BF % 3) * 37; X.drawImage(GRAIN, -o, -o, SIZE * 1.2, SIZE * 1.2); X.restore();
  if (t >= -0.2) drawCaptions(t);
  const fade = Math.max(1 - seg(t, FILM.start, FILM.start + 0.6), seg(t, FILM.end - 0.7, FILM.end));
  if (fade > 0) { X.fillStyle = `rgba(10,8,6,${fade})`; X.fillRect(0, 0, SIZE, SIZE); }
  X.restore();
}

function initFilm(words) {
  WORDS = words.words; WT = WORDS.map(x => x.t0);
  FILM.end = Math.ceil((words.dur + 2.5) * 10) / 10;
  buildGrain(); buildCaptions();
}
