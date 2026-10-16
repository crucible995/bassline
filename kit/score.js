// <Title> — score + SFX. Every event is scheduled from t, so scrubbing replays exactly. Needs audio-kit.js.
'use strict';

function buildEvents() {
  const ev = [];
  const at = (t, fn, dur) => ev.push({ t, fn, dur });   // dur: long events (pads, streams) resume mid-way on seek
  const R = rng(41);
  // the band: a walking bass on the beat, ride on swung eighths. Leave holes where the picture breaks.
  const BEAT = 0.6, ROOTS = [41, 46, 39, 37];
  for (let b = 0, t = -0.9; t < FILM.end - 1.5; b++, t += BEAT) {
    const root = ROOTS[Math.floor(b / 8) % ROOTS.length];
    at(t, (a, when) => a.bass(when, NT(root + [0, 3, 7, 10][b % 4]), 0.2));
    at(t, (a, when) => a.ride(when, 0.022)); at(t + BEAT * 0.66, (a, when) => a.ride(when, 0.014));
  }
  // SFX on words: at(w(i), ...)
  at(w(0), (a, when) => { a.paper(when, 0.14, 0.08, 2200); a.thump(when, 0.3); });
  return ev;
}
