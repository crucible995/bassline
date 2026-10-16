// Saddle — score + SFX. Every event is scheduled from t, so scrubbing replays exactly. Needs audio-kit.js.
// A small jazz band that walks downhill; it drops out when the saddle tears, fakes an ending on "finished",
// and comes back in on "parked".
'use strict';

function buildEvents() {
  const ev = [];
  const at = (t, fn, dur) => ev.push({ t, fn, dur });
  const R = rng(41);
  const BEAT = 0.6;
  // chords: [root, walk tones, vibes voicing], two bars each. The walk mostly steps down.
  const CH = [
    [41, [53, 51, 48, 44], [56, 60, 63, 67]],   // Fm9
    [46, [58, 56, 53, 50], [56, 62, 65, 67]],   // Bb13
    [39, [51, 50, 46, 43], [55, 58, 62, 65]],   // Ebmaj9
    [37, [49, 48, 44, 41], [53, 55, 60, 63]],   // Dbmaj7#11
    [36, [48, 46, 43, 40], [52, 56, 58, 63]],   // C7alt
  ];
  const tTurn = w(54), tTear = w(56), tFin = w(64), tBack = w(67);
  const band = t => t < tTear - 0.05 || (t > tBack - 0.05 && t < FILM.end - 1.4);
  for (let b = 0; ; b++) {
    const t = -0.9 + b * BEAT; if (t > FILM.end - 1.4) break;
    if (!band(t)) continue;
    const ci = Math.floor(b / 8) % CH.length, [root, tones, vib] = CH[ci], pos = b % 8;
    const n = pos === 0 ? root + 12 : tones[pos % 4] - (pos >= 4 ? 12 : 0);
    at(t, (a, when) => a.bass(when, NT(n), 0.2));
    if (t > -0.3) {
      if (b % 2 === 1) at(t, (a, when) => a.brush(when, 0.045));
      at(t, (a, when) => a.ride(when, 0.02));
      at(t + BEAT * 0.66, (a, when) => a.ride(when, 0.013));
    }
    if (pos === 0 || (pos === 3 && R() < 0.7)) at(t + (pos === 3 ? BEAT * 0.66 : 0), (a, when) => vib.forEach((m, k) => a.vibe(when + k * 0.008, NT(m), 0.02, 1.3)));
  }

  // ---------- act one: downhill
  at(w(0), (a, when) => a.pop(when, 1.1, 0.1));                                                         // eye opens
  HOPS().forEach(([th], k) => {
    at(th, (a, when) => a.tone(when, { f: 700 - k * 90, f1: 1100 - k * 120, glide: 0.12, dur: 0.16, gain: 0.04, wet: 0.2 }));
    at(th + 0.27, (a, when) => { a.paper(when, 0.13, 0.06, 1800 - k * 200); a.plink(when, NT(76 - k * 2), 0.05); });
  });
  [w(7), w(8), w(9), w(9) + 0.33].forEach((tc, k) => {                                                 // snip: the steps split
    at(tc, (a, when) => { a.noiseHit(when, { dur: 0.05, gain: 0.16, type: 'highpass', f: 3500 + k * 600, Q: 1, att: 0.002, wet: 0.05 }); a.noiseHit(when + 0.06, { dur: 0.04, gain: 0.12, type: 'highpass', f: 4200 + k * 600, Q: 1, att: 0.002, wet: 0.05 }); });
  });
  // the roll down the fine steps: a tick per step edge it rolls over
  { const [g0, g1] = GLIDE(); let last = null;
    for (let t = g0; t < g1; t += 1 / 120) {
      const n = nTeeth(t), [sw] = stairDims(n), k = Math.floor((ball1(t)[0] - DG.x0) / sw) + n * 1000;
      if (last !== null && k !== last) at(t, (a, when) => a.key(when, 0.025 + 0.25 / n));
      last = k;
    } }
  XS().forEach(([tx], k) => at(tx, (a, when) => { a.thump(when, 0.42 - k * 0.065); a.paper(when, 0.1 - k * 0.012, 0.07, 900 + k * 300); }));  // each a little less wrong
  at(4.74, (a, when) => a.whoosh(when, 0.45, true, 0.07));                                               // stairs smooth into a valley
  // ---------- act two: the picture and the cards
  for (let k = 0; k < 4; k++) at(w(16) + k * 0.07 + 0.12, (a, when) => a.pop(when, 0.7 + k * 0.08, 0.08));   // people
  at(w(17), (a, when) => { a.thump(when, 0.32); a.key(when, 0.08); });                                       // picture frame lands
  at(w(19), (a, when) => a.noiseHit(when, { dur: 0.9, gain: 0.04, type: 'lowpass', f: 500, att: 0.1, wet: 0.2 }));  // rolling
  at(w(21) + 0.02, (a, when) => a.tone(when, { f: 220, f1: 140, glide: 0.2, dur: 0.25, gain: 0.07, wet: 0.2 }));
  at(w(23) + 0.1, (a, when) => [79, 74].forEach((m, k) => a.vibe(when + k * 0.2, NT(m), 0.025, 1.2)));        // dozes
  at(w(25), (a, when) => a.paper(when, 0.12, 0.12, 1400));                                                    // lifts off the wall
  for (let k = 0; k <= 5; k++) at(w(28) + k * 0.05, (a, when) => a.paper(when, 0.12, 0.06, 2200 + k * 250));  // the fan opens
  FLIPS().forEach(([, tf], k) => at(tf + 0.05, (a, when) => { a.paper(when, 0.11, 0.05, 3000 - k * 120); a.plink(when, NT(69 - k), 0.03, 0.25); }));  // flips to hills
  for (let k = 0; k < 6; k++) at(w(35) + k * 0.05, (a, when) => a.paper(when, 0.1, 0.05, 1800 - k * 100));  // fan closes
  at(w(35) + 0.42, (a, when) => a.whoosh(when, 0.55, true, 0.06));
  at(w(42) + 0.03, (a, when) => a.pop(when, 0.6, 0.07));
  at(w(44), (a, when) => a.tone(when, { f: 600, f1: 380, glide: 0.3, dur: 0.32, gain: 0.04, type: 'triangle', wet: 0.3 }));   // hm?
  // ---------- act three: the saddle
  at(w(46), (a, when) => { a.thump(when, 0.5); a.noiseHit(when, { dur: 0.35, gain: 0.08, type: 'lowpass', f: 300, f1: 120, wet: 0.2 }); [60, 63, 67, 70, 74].forEach((m, k) => a.vibe(when + k * 0.02, NT(m), 0.03, 1.8)); });
  at(w(47), (a, when) => { a.tone(when, { f: 260, f1: 90, glide: 0.1, dur: 0.15, gain: 0.12, wet: 0.1 }); a.noiseHit(when, { dur: 0.08, gain: 0.12, type: 'lowpass', f: 900, wet: 0 }); });  // flat
  at(w(47) + 0.3, (a, when) => a.boing(when, 0.06));
  CHK().forEach(([tc], k) => at(tc, (a, when) => { a.noiseHit(when, { dur: 0.06, gain: 0.12, type: 'bandpass', f: 3000, f1: 5000, Q: 2, att: 0.003, wet: 0.05 }); a.plink(when + 0.02, NT(79 + k * 2), 0.04); }));  // ticks
  at(tTurn, (a, when) => { a.whoosh(when, 0.32, false, 0.1); a.paper(when + 0.16, 0.12, 0.1, 1300); });          // turns: front view
  at(tTear, (a, when) => { a.noiseHit(when, { dur: 0.22, gain: 0.32, type: 'bandpass', f: 1000, f1: 4200, Q: 1.4, att: 0.003, wet: 0.15 }); a.scratch(when + 0.03); });  // rip; band out
  at(tTear + 0.1, (a, when) => a.tone(when, { f: 1300, f1: 160, glide: 1.0, dur: 1.05, gain: 0.05, wet: 0.35 }));   // falling whistle
  at(tTear + 1.25, (a, when) => a.thump(when, 0.16));                                                          // far below
  at(w(59), (a, when) => { a.plink(when, NT(88), 0.06); a.plink(when + 0.06, NT(91), 0.05); });               // looks: !
  at(w(60), (a, when) => a.bass(when, NT(36), 0.14, 1.4));
  at(tFin + 0.12, (a, when) => { a.thump(when, 0.45); a.paper(when, 0.16, 0.1, 900); });                      // FIN slams
  at(tFin + 0.12, (a, when) => { a.bass(when, NT(29), 0.22, 1.6); [53, 56, 60, 63, 67].forEach((m, k) => a.vibe(when + k * 0.03, NT(m), 0.035, 2.4)); a.ride(when, 0.05); });  // a fake ending
  at(tFin + 0.42, (a, when) => { a.boing(when, 0.14); a.whoosh(when, 0.35, true, 0.08); });                   // nope
  // ---------- act four: parked, opened, the map
  at(tBack, (a, when) => { a.thump(when, 0.38); a.paper(when, 0.12, 0.08, 1500); });                          // P
  for (const dt of [0.02, 0.22]) at(w(70) + dt, (a, when) => a.tone(when, { f: 1760, dur: 0.07, gain: 0.05, type: 'square', lp: 4000, wet: 0.1 }));  // beep beep
  at(w(71), (a, when) => a.whoosh(when, 0.55, true, 0.07));                                                   // zoom
  at(w(72), (a, when) => a.noiseHit(when, { dur: 0.35, gain: 0.05, type: 'bandpass', f: 900, Q: 0.8, att: 0.15, wet: 0.2 }));  // hand slides in
  at(w(74), (a, when) => a.tone(when, { f: 180, f1: 420, glide: 0.45, dur: 0.5, gain: 0.05, type: 'sawtooth', lp: 900, wet: 0.2 }));  // hinge creak
  at(w(76) + 0.05, (a, when) => a.pop(when, 0.8, 0.12));
  at(w(77), (a, when) => a.pop(when, 1.2, 0.08));                                                             // map pops out
  for (let k = 0; k < 4; k++) at(w(77) + 0.2 + k * 0.08, (a, when) => a.paper(when, 0.13, 0.06, 2400 - k * 150));  // unfold columns
  for (let k = 0; k < 3; k++) at(w(77) + 0.5 + k * 0.1, (a, when) => a.paper(when, 0.13, 0.07, 1700 - k * 150));   // unfold rows
  TRAIL_T().forEach((ts, j) => at(ts, (a, when) => a.plink(when, NT(84 - j * 2), 0.035, 0.35)));             // every way
  at(w(83), (a, when) => [84, 79, 76, 72, 67, 64].forEach((m, k) => a.vibe(when + k * 0.07, NT(m), 0.03, 1.2)));  // downhill
  at(w(84), (a, when) => a.pop(when, 1.3, 0.08));                                                             // me, on the map
  at(ZOOM5(), (a, when) => a.whoosh(when, 0.5, true, 0.1));
  // ---------- tail
  at(CUT5() + 0.2, (a, when) => { a.thump(when, 0.35); a.paper(when, 0.12, 0.06, 1500); });
  [0.85, 1.1, 1.35].forEach((dt, k) => at(CUT5() + dt + 0.27, (a, when) => { a.paper(when, 0.12, 0.05, 1700 - k * 200); a.plink(when, NT(72 - k * 3), 0.05); }));
  at(CUT5() + 1.65, (a, when) => { a.ding(when, 0.07); [60, 63, 67, 70, 74].forEach((m, k) => a.vibe(when + k * 0.03, NT(m), 0.03, 2.2)); a.bass(when, NT(29), 0.18, 1.6); });
  return ev;
}
