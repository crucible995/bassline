// bassline audio kit — FilmAudio plays voice.wav plus every event from buildEvents() (defined in the film's score.js)
// on one AudioContext clock, so seeking replays exactly. Instruments: tone, noiseHit, pop, plink, bell, pluck, thump,
// whoosh, boing, scratch, pad, bass, brush, ride, vibe, paper, key, ding, stream.
'use strict';

class FilmAudio {
  async init(voiceUrl) {
    const c = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const buf = await fetch(voiceUrl).then(r => r.arrayBuffer());
    this.voice = await c.decodeAudioData(buf);
    this.master = c.createDynamicsCompressor();
    this.master.threshold.value = -14; this.master.ratio.value = 3; this.master.attack.value = 0.004; this.master.release.value = 0.2;
    const mg = c.createGain(); mg.gain.value = 0.95;
    this.master.connect(mg); mg.connect(c.destination);
    this.conv = c.createConvolver(); this.conv.buffer = this._impulse(2.8);
    const rg = c.createGain(); rg.gain.value = 0.55; this.conv.connect(rg); rg.connect(this.master);
    const n = c.sampleRate * 2; this.noise = c.createBuffer(1, n, c.sampleRate);
    const d = this.noise.getChannelData(0); let s = 1;
    for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    this.events = buildEvents();
  }
  _impulse(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    return b;
  }
  get now() { return this.ctx.currentTime; }
  play(T0) {
    const c = this.ctx;
    this.stop();
    this.out = c.createGain(); this.out.connect(this.master);
    this.send = c.createGain(); this.send.connect(this.conv);
    this.base = c.currentTime + 0.08; this.T0 = T0;
    const at = T => this.base + (T - T0);
    // voice
    const v = c.createBufferSource(); v.buffer = this.voice;
    const vg = c.createGain(); vg.gain.value = 1.0; v.connect(vg); vg.connect(this.out);
    const vs = c.createGain(); vs.gain.value = 0.06; vg.connect(vs); vs.connect(this.send);
    if (T0 < 0) v.start(at(0)); else if (T0 < this.voice.duration) v.start(this.base, T0);
    this.voiceSrc = v;
    for (const e of this.events) {
      const dur = e.dur || 0;
      if (e.t >= T0) e.fn(this, at(e.t), 0, dur);
      else if (dur && e.t + dur > T0 + 0.1) e.fn(this, this.base, T0 - e.t, dur);
    }
  }
  stop() {
    if (!this.out) return;
    const c = this.ctx, o = this.out, s = this.send;
    o.gain.setTargetAtTime(0, c.currentTime, 0.03); s.gain.setTargetAtTime(0, c.currentTime, 0.03);
    setTimeout(() => { o.disconnect(); s.disconnect(); }, 300);
    try { this.voiceSrc.stop(c.currentTime + 0.1); } catch (e) {}
    this.out = null;
  }
  time() { return this.T0 + (this.ctx.currentTime - this.base) - (this.ctx.outputLatency || 0); }

  // ---------------- primitives
  route(node, wet = 0.2) {
    node.connect(this.out);
    if (wet > 0) { const g = this.ctx.createGain(); g.gain.value = wet; node.connect(g); g.connect(this.send); }
  }
  tone(when, o) {
    const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
    const { f = 440, f1 = null, type = 'sine', dur = 0.3, gain = 0.2, att = 0.005, wet = 0.2, lp = null, detune = 0 } = o;
    osc.type = type; osc.detune.value = detune;
    osc.frequency.setValueAtTime(f, when);
    if (f1) osc.frequency.exponentialRampToValueAtTime(f1, when + (o.glide || dur));
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + att);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    let n = osc;
    if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; osc.connect(fl); n = fl; }
    n.connect(g); this.route(g, wet);
    osc.start(when); osc.stop(when + dur + 0.05);
  }
  noiseHit(when, o) {
    const c = this.ctx, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    const { dur = 0.3, gain = 0.2, type = 'bandpass', f = 1000, f1 = null, Q = 1, att = 0.01, wet = 0.2, rel = null } = o;
    src.buffer = this.noise; src.loop = true;
    fl.type = type; fl.Q.value = Q; fl.frequency.setValueAtTime(f, when);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + att);
    if (rel) { g.gain.setValueAtTime(gain, when + dur - rel); g.gain.linearRampToValueAtTime(0.0001, when + dur); }
    else g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(fl); fl.connect(g); this.route(g, wet);
    src.start(when, Math.random() * 1.5); src.stop(when + dur + 0.05);
  }
  // ---------------- instruments
  pop(when, p = 1, gain = 0.22) {
    this.tone(when, { f: 420 * p, f1: 980 * p, glide: 0.07, dur: 0.14, gain, wet: 0.15 });
    this.tone(when, { f: 1800 * p, dur: 0.04, gain: gain * 0.3, type: 'triangle', wet: 0 });
  }
  plink(when, f, gain = 0.12, wet = 0.3) {
    this.tone(when, { f, dur: 0.55, gain, wet });
    this.tone(when, { f: f * 4.01, dur: 0.12, gain: gain * 0.35, wet });
    this.tone(when, { f: f * 2, dur: 0.3, gain: gain * 0.3, type: 'triangle', wet });
  }
  bell(when, f, gain = 0.12, dur = 2.2) {
    [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]].forEach(([m, g]) => this.tone(when, { f: f * m, dur: dur / Math.sqrt(m), gain: gain * g, wet: 0.5, att: 0.003 }));
  }
  pluck(when, f, gain = 0.05) {
    this.tone(when, { f, dur: 0.7, gain, type: 'triangle', lp: 2200, wet: 0.45 });
    this.tone(when, { f: f * 2, dur: 0.25, gain: gain * 0.4, wet: 0.45 });
  }
  thump(when, gain = 0.5) {
    this.tone(when, { f: 140, f1: 42, glide: 0.22, dur: 0.4, gain, wet: 0.1 });
    this.noiseHit(when, { dur: 0.25, gain: gain * 0.4, type: 'lowpass', f: 600, f1: 120, wet: 0.1 });
  }
  whoosh(when, dur, up = true, gain = 0.12) {
    this.noiseHit(when, { dur, gain, f: up ? 300 : 2600, f1: up ? 2800 : 260, Q: 1.4, att: dur * 0.6, wet: 0.35 });
  }
  boing(when, gain = 0.16) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    const curve = new Float32Array(64);
    for (let i = 0; i < 64; i++) { const u = i / 63; curve[i] = 260 + 160 * u + Math.sin(u * 40) * 70 * (1 - u); }
    o.frequency.setValueCurveAtTime(curve, when, 0.38);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(gain, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.42);
    o.connect(g); this.route(g, 0.2); o.start(when); o.stop(when + 0.45);
  }
  scratch(when) {
    const c = this.ctx, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise; src.loop = true;
    fl.type = 'bandpass'; fl.Q.value = 6;
    fl.frequency.setValueAtTime(700, when);
    fl.frequency.exponentialRampToValueAtTime(3200, when + 0.09);
    fl.frequency.exponentialRampToValueAtTime(500, when + 0.22);
    fl.frequency.exponentialRampToValueAtTime(2400, when + 0.3);
    fl.frequency.exponentialRampToValueAtTime(300, when + 0.42);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.5, when + 0.02);
    g.gain.setValueAtTime(0.5, when + 0.32); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.46);
    src.connect(fl); fl.connect(g); this.route(g, 0.1); src.start(when); src.stop(when + 0.5);
    this.tone(when, { f: 520, f1: 90, glide: 0.4, dur: 0.42, gain: 0.08, type: 'sawtooth', lp: 1400, wet: 0.05 });
  }
  pad(when, off, dur, notes, { gain = 0.035, lp = 1100, att = 1.4, rel = 1.6, type = 'sawtooth', cut = false } = {}) {
    const c = this.ctx;
    const end = when + (dur - off);
    if (end <= when + 0.05) return;
    const g = c.createGain(), fl = c.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = 0.6;
    const a = off > 0 ? 0.08 : att;
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(gain, when + a);
    if (cut) { g.gain.setValueAtTime(gain, end - 0.03); g.gain.linearRampToValueAtTime(0.0001, end); }
    else { g.gain.setValueAtTime(gain, Math.max(when + a, end - rel)); g.gain.linearRampToValueAtTime(0.0001, end); }
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.18; lg.gain.value = lp * 0.25;
    lfo.connect(lg); lg.connect(fl.frequency); lfo.start(when); lfo.stop(end + 0.1);
    fl.connect(g); this.route(g, 0.55);
    for (const f of notes) for (const dt of [-7, 6]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = dt;
      o.connect(fl); o.start(when); o.stop(end + 0.1);
    }
  }
  rain(when, off, dur) {
    const d = dur - off; if (d < 0.2) return;
    this.noiseHit(when, { dur: d, gain: 0.05, type: 'highpass', f: 2500, Q: 0.4, att: off > 0 ? 0.1 : 0.6, rel: 0.6, wet: 0.3 });
    this.noiseHit(when, { dur: d, gain: 0.05, type: 'lowpass', f: 300, Q: 0.4, att: off > 0 ? 0.1 : 1.0, rel: 0.8, wet: 0.2 });
  }
  bass(when, f, gain = 0.2, dur = 0.55) {
    this.tone(when, { f, dur, gain, type: 'triangle', lp: 650, att: 0.006, wet: 0.08 });
    this.tone(when, { f: f / 2, dur: dur * 0.9, gain: gain * 0.7, att: 0.01, wet: 0.02 });
    this.noiseHit(when, { dur: 0.04, gain: gain * 0.25, type: 'bandpass', f: 900, Q: 3, att: 0.002, wet: 0 });
  }
  brush(when, gain = 0.05, dur = 0.22) { this.noiseHit(when, { dur, gain, type: 'bandpass', f: 4200, f1: 2600, Q: 0.7, att: dur * 0.35, wet: 0.12 }); }
  ride(when, gain = 0.03) {
    this.noiseHit(when, { dur: 0.18, gain, type: 'highpass', f: 7000, Q: 0.6, att: 0.002, wet: 0.2 });
    this.tone(when, { f: 5200, dur: 0.25, gain: gain * 0.25, type: 'square', lp: 9000, wet: 0.2 });
  }
  vibe(when, f, gain = 0.05, dur = 1.6) {
    const c = this.ctx, g = c.createGain(), trem = c.createOscillator(), tg = c.createGain();
    trem.frequency.value = 5.5; tg.gain.value = 0.35; trem.connect(tg); tg.connect(g.gain);
    g.gain.value = 0.65; this.route(g, 0.45);
    for (const [m, a] of [[1, 1], [4, 0.18], [10.1, 0.05]]) {
      const o = c.createOscillator(), e = c.createGain(); o.frequency.value = f * m;
      e.gain.setValueAtTime(0.0001, when); e.gain.linearRampToValueAtTime(gain * a, when + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, when + dur / m ** 0.3);
      o.connect(e); e.connect(g); o.start(when); o.stop(when + dur + 0.1);
    }
    trem.start(when); trem.stop(when + dur + 0.1);
  }
  paper(when, gain = 0.1, dur = 0.12, f = 2400) { this.noiseHit(when, { dur, gain, type: 'bandpass', f, f1: f * 0.5, Q: 1.2, att: 0.004, wet: 0.08 }); }
  key(when, gain = 0.06) {
    this.noiseHit(when, { dur: 0.03, gain, type: 'highpass', f: 2500, Q: 0.8, att: 0.001, wet: 0.05 });
    this.tone(when, { f: 1900 + Math.random() * 500, dur: 0.025, gain: gain * 0.4, type: 'square', lp: 4000, wet: 0.02 });
  }
  ding(when, gain = 0.07) { this.bell(when, 2093, gain, 1.6); }
  stream(when, off, dur, gain = 0.035) {
    const d = dur - off; if (d < 0.2) return;
    this.noiseHit(when, { dur: d, gain, type: 'bandpass', f: 700, Q: 0.7, att: off > 0 ? 0.1 : 0.5, rel: 0.4, wet: 0.25 });
    this.noiseHit(when, { dur: d, gain: gain * 0.6, type: 'bandpass', f: 2400, Q: 2.5, att: off > 0 ? 0.1 : 0.5, rel: 0.4, wet: 0.3 });
  }
}

const NT = n => 440 * Math.pow(2, (n - 69) / 12); // midi -> Hz
