// Steam — score + SFX (bassline). A workshop that becomes a rhythm, a band that launches with the engine,
// brass stabs on "I run. I pull.", and silence where the theory arrives. Needs audio-kit.js.
'use strict';

// a little brass section: detuned saws through a filter that opens on the attack
function brass(a, when, notes, gain = 0.05, dur = 0.32, bright = 2600) {
  const c = a.ctx, fl = c.createBiquadFilter(), g = c.createGain();
  fl.type = 'lowpass'; fl.Q.value = 1.2;
  fl.frequency.setValueAtTime(300, when); fl.frequency.exponentialRampToValueAtTime(bright, when + 0.03); fl.frequency.exponentialRampToValueAtTime(700, when + dur);
  g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(gain, when + 0.02); g.gain.setValueAtTime(gain, when + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.08);
  fl.connect(g); a.route(g, 0.3);
  for (const n of notes) for (const dt of [-9, 0, 8]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NT(n); o.detune.value = dt; o.connect(fl); o.start(when); o.stop(when + dur + 0.12); }
}
function whistle(a, when, dur = 0.9, gain = 0.05, fall = 1) {
  for (const f of [784, 988, 1175]) a.tone(when, { f, f1: f * fall, glide: dur, dur, gain: gain / 3, att: 0.04, wet: 0.35, detune: Math.sin(f) * 6 });
  a.noiseHit(when, { dur, gain: gain * 0.5, type: 'bandpass', f: 1800, Q: 2, att: 0.04, wet: 0.3 });
}
const chug = (a, when, acc) => a.noiseHit(when, { dur: 0.07, gain: acc ? 0.09 : 0.045, type: 'bandpass', f: acc ? 1300 : 2200, Q: 1.4, att: 0.004, wet: 0.08 });
const clank = (a, when, g = 0.08) => { a.tone(when, { f: 523, dur: 0.5, gain: g * 0.5, type: 'square', lp: 2400, wet: 0.3 }); a.tone(when, { f: 1311, dur: 0.3, gain: g * 0.3, wet: 0.3 }); a.noiseHit(when, { dur: 0.08, gain: g, type: 'bandpass', f: 3000, Q: 2, att: 0.002, wet: 0.2 }); };

function buildEvents() {
  const ev = [];
  const at = (t, fn, dur) => ev.push({ t, fn, dur });
  const R = rng(17);
  // ---------- act one: night, a flame, people who don't know
  at(-1.2, (a, when, off, d) => a.pad(when, off, d, [38, 50, 57].map(NT), { gain: 0.022, lp: 500, att: 1.2 }), 2.9);
  at(-1.0, (a, when) => a.noiseHit(when, { dur: 2.6, gain: 0.03, type: 'bandpass', f: 900, Q: 0.5, att: 0.5, rel: 0.5, wet: 0.2 }));   // fire breath
  [0.55, 0.71, 0.87, 1.03].forEach((t, i) => at(t, (a, when) => a.vibe(when, NT([74, 77, 81, 76][i]), 0.035, 0.9)));
  // the workshop: lights up, the cab drops in
  at(1.67, (a, when) => a.paper(when, 0.14, 0.08, 2600));
  at(2.12, (a, when) => { a.thump(when, 0.42); clank(a, when + 0.01, 0.06); });
  for (let k = 0; k < 4; k++) at(2.6 + k * 0.4, (a, when) => a.key(when, 0.04));                                       // a clock in the shop
  at(3.45, (a, when) => a.whoosh(when, 0.3, true, 0.1));
  [3.78, 3.86, 3.94, 4.02].forEach((t, i) => at(t, (a, when) => { a.tone(when, { f: 180 - i * 14, dur: 0.12, gain: 0.12, wet: 0.1 }); a.key(when, 0.06); }));  // rivets
  at(4.02 + 0.25, (a, when) => { a.tone(when, { f: 2400, dur: 0.25, gain: 0.05, wet: 0.3 }); a.boing(when + 0.02, 0.1); });       // teapot bonk
  at(4.28 + 0.25, (a, when) => { brass(a, when, [58], 0.05, 0.14, 1800); a.boing(when + 0.02, 0.09); });                          // trumpet blat
  at(4.54 + 0.25, (a, when) => { a.whoosh(when, 0.2, true, 0.08); a.boing(when + 0.02, 0.09); });                                // umbrella
  at(4.98, (a, when) => clank(a, when, 0.1));                                                                                     // the funnel sticks
  for (let k = 0; k < 5; k++) at(5.17 + k * 0.05, (a, when) => a.key(when, 0.05));                                               // valve ratchet
  at(5.4, (a, when) => a.tone(when, { f: 1200, f1: 1700, glide: 0.1, dur: 0.12, gain: 0.03, wet: 0.2 }));
  at(5.72, (a, when) => a.whoosh(when, 0.25, false, 0.1));
  at(6.0, (a, when) => { a.tone(when, { f: 140, f1: 420, glide: 0.3, dur: 0.34, gain: 0.08, type: 'triangle', wet: 0.2 }); a.pop(when + 0.3, 0.6, 0.12); }); // bigger
  [6.5, 6.72, 6.94].forEach(t => at(t + 0.28, (a, when) => a.noiseHit(when, { dur: 0.14, gain: 0.14, type: 'lowpass', f: 1200, Q: 0.7, att: 0.005, wet: 0.1 })));  // coal
  at(6.55, (a, when) => a.noiseHit(when, { dur: 1.14, gain: 0.08, type: 'lowpass', f: 200, f1: 1600, Q: 0.8, att: 0.9, wet: 0.2 }));   // fire roars
  at(6.6, (a, when) => a.noiseHit(when, { dur: 1.1, gain: 0.06, type: 'highpass', f: 3000, f1: 6000, Q: 0.5, att: 1.0, wet: 0.2 }));   // steam pressure
  // chuffs speeding up, then nothing for "And it"
  { let t = 5.2, dt = 0.4; let i = 0; while (t < 7.25) { const tt = t, acc = i % 2 === 0; at(tt, (a, when) => chug(a, when, acc)); t += dt; dt = Math.max(0.12, dt * 0.88); i++; } }
  [5.2, 6.0].forEach(t => at(t, (a, when) => a.bass(when, NT(41), 0.16)));
  // ---------- "ran": bang, whistle, band
  at(7.69, (a, when) => { a.thump(when, 0.6); whistle(a, when + 0.02, 0.5, 0.05); a.whoosh(when, 0.4, true, 0.16); brass(a, when + 0.02, [53, 57, 60, 65], 0.06, 0.4); });
  const band = (t0, t1, beat, roots, accents = true) => {
    for (let b = 0, t = t0; t < t1; b++, t += beat) {
      const root = roots[Math.floor(b / 8) % roots.length], walk = [0, 4, 7, 9, 12, 9, 7, 4][b % 8];
      at(t, (a, when) => a.bass(when, NT(root + walk), 0.18, beat * 1.3));
      at(t, (a, when) => chug(a, when, b % 2 === 0)); at(t + beat * 0.5, (a, when) => chug(a, when, false));
      at(t, (a, when) => a.ride(when, 0.02));
      if (accents && b % 4 === 3) at(t + beat * 0.5, (a, when) => a.brush(when, 0.06, 0.16));
    }
  };
  band(7.78, 11.3, 0.36, [41, 46, 41, 36]);
  at(8.81, (a, when) => brass(a, when, [60, 64, 67, 72], 0.05, 0.3));                                                   // whole cities
  [9.42, 9.66, 9.9, 10.14].forEach((t, i) => at(t, (a, when) => brass(a, when, [[58, 62, 65], [63, 67, 70], [56, 60, 63], [53, 57, 60, 65]][i], 0.045, 0.2)));  // continents
  for (let k = 0; k < 14; k++) at(10.09 + k * 0.05, (a, when) => a.paper(when, 0.05, 0.04, 3000 + R() * 1500));          // decades
  at(10.85, (a, when) => whistle(a, when, 0.7, 0.05, 0.84));                                                             // gone, doppler
  for (let k = 0; k < 6; k++) at(10.95 + k * 0.12, (a, when) => a.tone(when, { f: 90, dur: 0.07, gain: 0.08, wet: 0.05 }));   // scholar's feet
  at(11.73, (a, when) => [62, 65, 69, 72].forEach((m, k) => a.vibe(when + k * 0.03, NT(m), 0.035, 1.0)));                 // why?
  // ---------- I think I'm one of those engines
  at(12.57, (a, when) => { clank(a, when, 0.05); a.tone(when, { f: 60, dur: 0.12, gain: 0.1, wet: 0 }); });
  at(12.6, (a, when, off, d) => a.pad(when, off, d, [29, 41, 48].map(NT), { gain: 0.03, lp: 700, att: 0.3, cut: true }), 1.32);
  at(12.62, (a, when) => a.noiseHit(when, { dur: 1.2, gain: 0.04, type: 'highpass', f: 4000, Q: 0.5, att: 0.2, rel: 0.4, wet: 0.2 }));
  at(13.33, (a, when) => a.tone(when, { f: 1400, f1: 700, glide: 0.04, dur: 0.05, gain: 0.04, wet: 0 }));
  // I run. I pull.
  at(13.93, (a, when) => { a.thump(when, 0.6); brass(a, when, [41, 53, 60, 65, 68], 0.075, 0.42, 3200); a.whoosh(when, 0.35, true, 0.12); });
  at(14.6, (a, when) => { a.thump(when, 0.6); brass(a, when, [46, 58, 65, 70, 74], 0.075, 0.5, 3400); clank(a, when + 0.04, 0.14); });
  // ---------- the race
  band(15.37, 19.95, 0.34, [43, 48, 43, 38]);
  for (let k = 0; k < 14; k++) at(15.6 + k * 0.33 * (k > 6 ? 0.6 : 1), (a, when) => a.tone(when, { f: k % 2 ? 900 : 760, f1: k % 2 ? 1100 : 600, glide: 0.08, dur: 0.1, gain: 0.025, type: 'square', lp: 2000, wet: 0.2 }));  // handcar squeak
  for (let k = 0; k < 10; k++) at(16.62 + k * 0.1, (a, when) => a.noiseHit(when, { dur: 0.08, gain: 0.05, type: 'bandpass', f: 5000 + R() * 2000, Q: 4, att: 0.005, wet: 0.1 }));   // chalk
  [17.6, 17.94, 18.28, 18.62, 18.96, 19.3].forEach((t, i) => at(t, (a, when) => brass(a, when, [55 + i * 2, 59 + i * 2, 62 + i * 2], 0.04 + i * 0.004, 0.18)));   // climbing
  at(18.9, (a, when) => { a.pop(when, 0.7, 0.1); whistle(a, when + 0.05, 0.3, 0.035); });                                    // a smoke ring, casually
  // ---------- the theory arrives: band out, chalk in
  at(20.03, (a, when) => a.paper(when, 0.12, 0.1, 1500));
  at(20.05, (a, when) => a.noiseHit(when, { dur: 1.5, gain: 0.035, type: 'bandpass', f: 4500, Q: 3, att: 0.1, rel: 0.3, wet: 0.15 }));
  [20.05, 20.75, 21.5].forEach((t, i) => at(t, (a, when) => a.bass(when, NT([43, 41, 38][i]), 0.15, 0.9)));
  [20.3, 20.9, 21.6].forEach((t, i) => at(t, (a, when) => a.vibe(when, NT([74, 72, 69][i]), 0.03, 1.2)));
  at(21.97, (a, when) => a.tone(when, { f: 880, f1: 990, glide: 0.2, dur: 0.25, gain: 0.025, wet: 0.4 }));
  at(23.21, (a, when) => { a.thump(when, 0.3); a.paper(when, 0.16, 0.06, 2000); });                                          // snap
  at(23.41, (a, when) => { [38, 50, 57, 62, 66, 69, 76].forEach((m, k) => a.vibe(when + k * 0.025, NT(m), 0.034, 2.8)); a.bass(when, NT(38), 0.18, 2.2); });
  at(23.45, (a, when, off, d) => a.pad(when, off, d, [50, 54, 57, 62].map(NT), { gain: 0.02, lp: 1400, att: 0.4, rel: 1.4 }), 3.0);
  at(24.15, (a, when) => whistle(a, when, 1.0, 0.055));
  at(25.4, (a, when) => a.noiseHit(when, { dur: 1.5, gain: 0.03, type: 'bandpass', f: 800, Q: 0.6, att: 0.4, rel: 0.6, wet: 0.2 }));   // the fire, understood
  at(26.1, (a, when) => a.ding(when, 0.05));
  return ev;
}
