// Procedural fallbacks for every sound (spec §10). Each generator is (ctx, out, opts, audio) → handle,
// where handle = { stop(fade), set(param, value), update?(dt), done }.

import { config } from '../config.js';
import { rand } from '../math.js';
import { setPosition, orbitPosition } from './spatial.js';

export const synth = {};

// --- helpers ----------------------------------------------------------------

function outGain(ctx, dest, gain) {
  const g = ctx.createGain();
  g.gain.value = gain;
  g.connect(dest);
  return g;
}

function fadeIn(ctx, g, target, seconds) {
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(target, t + Math.max(0.02, seconds));
}

function noise(ctx, audio, kind = 'white') {
  const s = ctx.createBufferSource();
  s.buffer = audio.noise[kind];
  s.loop = true;
  s.loopStart = 0;
  return s;
}

function filter(ctx, type, frequency, Q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = Q;
  return f;
}

function osc(ctx, type, frequency) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = frequency;
  return o;
}

// Loop handle: started now, runs until stop().
function loop(ctx, g, sources, extra = {}) {
  const t = ctx.currentTime;
  for (const s of sources) s.start(t, s.buffer ? Math.random() * s.buffer.duration * 0.9 : undefined);
  const h = {
    done: false,
    gain: g,
    set() {},
    ...extra,
    stop(fade = 0.1) {
      if (h.done) return;
      h.done = true;
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + fade);
      for (const s of sources) {
        try { s.stop(now + fade + 0.05); } catch { /* already stopped */ }
      }
    },
  };
  return h;
}

// One-shot handle: plays for `seconds`, then reports done.
function oneShot(ctx, g, sources, seconds, delay = 0) {
  const t = ctx.currentTime + delay;
  for (const s of sources) {
    s.start(t);
    s.stop(t + seconds);
  }
  const h = loopLikeStop(ctx, g, sources);
  sources[0].onended = () => { h.done = true; };
  return h;
}

function loopLikeStop(ctx, g, sources) {
  const h = {
    done: false,
    gain: g,
    set() {},
    stop(fade = 0.05) {
      if (h.done) return;
      h.done = true;
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + fade);
      for (const s of sources) {
        try { s.stop(now + fade + 0.02); } catch { /* already stopped */ }
      }
    },
  };
  return h;
}

function envelope(param, t, attack, peak, decay, floor = 0.0001) {
  param.setValueAtTime(floor, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(floor, t + attack + decay);
}

function distortionCurve(amount) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

export { distortionCurve };

// --- surface & Act 1 ----------------------------------------------------------

// Gentle waves: filtered noise with slow amplitude swells.
synth.waves = (ctx, dest, o, audio) => {
  const g = outGain(ctx, dest, 0);
  fadeIn(ctx, g, o.gain ?? config.audio.waves.gain, o.fadeIn ?? 2);

  const body = noise(ctx, audio, 'brown');
  const swell = ctx.createGain();
  swell.gain.value = 0.55;
  const lfo = osc(ctx, 'sine', 0.11);
  const lfoDepth = outGain(ctx, swell.gain, 0.45);
  lfo.connect(lfoDepth);
  body.connect(filter(ctx, 'lowpass', 700)).connect(swell).connect(g);

  const foam = noise(ctx, audio);
  const foamGain = ctx.createGain();
  foamGain.gain.value = 0.05;
  const lfo2 = osc(ctx, 'sine', 0.17);
  lfo2.connect(outGain(ctx, foamGain.gain, 0.045));
  foam.connect(filter(ctx, 'highpass', 2600)).connect(foamGain).connect(g);

  return loop(ctx, g, [body, lfo, foam, lfo2]);
};

// Big splash: noise burst with a quick lowpass sweep down, plus a low body thump.
synth.splash = (ctx, dest, o, audio) => {
  const t = ctx.currentTime;
  const g = outGain(ctx, dest, o.gain ?? 0.55);
  const src = noise(ctx, audio);
  const lp = filter(ctx, 'lowpass', 7000, 0.8);
  lp.frequency.setValueAtTime(7000, t);
  lp.frequency.exponentialRampToValueAtTime(220, t + 1.3);
  const env = ctx.createGain();
  envelope(env.gain, t, 0.015, 1, 1.4);
  src.connect(lp).connect(env).connect(g);

  const thump = osc(ctx, 'sine', 130);
  thump.frequency.setValueAtTime(130, t);
  thump.frequency.exponentialRampToValueAtTime(45, t + 0.35);
  const thumpEnv = ctx.createGain();
  envelope(thumpEnv.gain, t, 0.01, 0.7, 0.4);
  thump.connect(thumpEnv).connect(g);
  return oneShot(ctx, g, [src, thump], 1.6);
};

// Tiny pop: very short sine with a fast pitch rise.
synth.bubble_pop = (ctx, dest, o) => {
  const t = ctx.currentTime;
  const g = outGain(ctx, dest, o.gain ?? 0.16);
  const f = rand(420, 700);
  const s = osc(ctx, 'sine', f);
  s.frequency.setValueAtTime(f, t);
  s.frequency.exponentialRampToValueAtTime(f * 3, t + 0.045);
  const env = ctx.createGain();
  envelope(env.gain, t, 0.003, 1, 0.06);
  s.connect(env).connect(g);
  return oneShot(ctx, g, [s], 0.09);
};

// Cute rising "pwip". corruption 0 → 1 drops the pitch, distorts and stutters it.
synth.chirp = (ctx, dest, o) => {
  const c = o.corruption ?? 0;
  const t = ctx.currentTime;
  const len = 0.09 + c * 0.24;
  const g = outGain(ctx, dest, o.gain ?? 0.15);

  const s = osc(ctx, c > 0.5 ? 'triangle' : 'sine', 1200);
  const f0 = 1200 * (1 - 0.45 * c);
  const f1 = 1800 * (1 - 0.65 * c);
  s.frequency.setValueAtTime(f0, t);
  s.frequency.exponentialRampToValueAtTime(f1, t + 0.09);
  if (c > 0) s.frequency.exponentialRampToValueAtTime(Math.max(50, f1 * (1 - 0.85 * c)), t + len);

  const env = ctx.createGain();
  envelope(env.gain, t, 0.008, 1, len);
  const sources = [s];
  let node = s;
  if (c > 0.02) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve(10 + c * 260);
    const stutter = ctx.createGain();
    stutter.gain.value = 1 - c * 0.5;
    const lfo = osc(ctx, 'square', 35 + 220 * (1 - c));
    lfo.connect(outGain(ctx, stutter.gain, c * 0.5));
    node.connect(shaper).connect(stutter);
    node = stutter;
    sources.push(lfo);
  }
  node.connect(env).connect(g);
  return oneShot(ctx, g, sources, len + 0.05);
};

synth.chirp_corrupt = (ctx, dest, o, audio) => synth.chirp(ctx, dest, { corruption: 0.6, ...o }, audio);

// Distant gulls: short pitch-swept chirps.
synth.gulls = (ctx, dest, o) => {
  const t = ctx.currentTime;
  const g = outGain(ctx, dest, o.gain ?? 0.035);
  const sources = [];
  const calls = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < calls; i++) {
    const start = t + i * rand(0.22, 0.32);
    const f = rand(1250, 1500);
    const s = osc(ctx, 'triangle', f);
    s.frequency.setValueAtTime(f, start);
    s.frequency.exponentialRampToValueAtTime(f * 0.62, start + 0.22);
    const env = ctx.createGain();
    env.gain.value = 0;
    envelope(env.gain, start, 0.02, 1, 0.22);
    s.connect(env).connect(g);
    s.start(start);
    s.stop(start + 0.3);
    sources.push(s);
  }
  const h = loopLikeStop(ctx, g, sources);
  sources[sources.length - 1].onended = () => { h.done = true; };
  return h;
};

// Majestic call: slow sine glides with vibrato, mostly reverb.
synth.whale_call = (ctx, dest, o, audio) => {
  const t = ctx.currentTime;
  const len = 5;
  const g = outGain(ctx, dest, o.gain ?? 0.12);
  const send = outGain(ctx, audio.reverbIn, o.gain ?? 0.12);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(1, t + 0.9);
  env.gain.setValueAtTime(1, t + len - 1.6);
  env.gain.exponentialRampToValueAtTime(0.0001, t + len);
  env.connect(g);
  env.connect(send);

  const vib = osc(ctx, 'sine', 4);
  const sources = [vib];
  for (const [mult, level] of [[1, 1], [2, 0.3], [3.01, 0.08]]) {
    const s = osc(ctx, 'sine', 160 * mult);
    s.frequency.setValueAtTime(160 * mult, t);
    s.frequency.linearRampToValueAtTime(108 * mult, t + 2.2);
    s.frequency.linearRampToValueAtTime(150 * mult, t + len);
    vib.connect(outGain(ctx, s.frequency, 3 * mult));
    s.connect(outGain(ctx, env, level));
    sources.push(s);
  }
  return oneShot(ctx, g, sources, len);
};

// --- Act 2 ----------------------------------------------------------------------

// Fish rushing away: bandpass noise sweep.
synth.whoosh = (ctx, dest, o, audio) => {
  const t = ctx.currentTime;
  const g = outGain(ctx, dest, o.gain ?? 0.3);
  const src = noise(ctx, audio);
  const bp = filter(ctx, 'bandpass', 300, 1.4);
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(3200, t + 0.45);
  bp.frequency.exponentialRampToValueAtTime(220, t + 1.2);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(1, t + 0.35);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
  src.connect(bp).connect(env).connect(g);
  return oneShot(ctx, g, [src], 1.3);
};

// Deep constant drone: two detuned low sines.
synth.drone_low = (ctx, dest, o) => {
  const g = outGain(ctx, dest, 0);
  fadeIn(ctx, g, o.gain ?? config.audio.drone.gain, o.fadeIn ?? 4);
  const lp = filter(ctx, 'lowpass', 220);
  lp.connect(g);
  const sources = [];
  for (const [f, level] of [[45, 1], [47, 0.9], [90.5, 0.15]]) {
    const s = osc(ctx, 'sine', f);
    s.connect(outGain(ctx, lp, level));
    sources.push(s);
  }
  return loop(ctx, g, sources);
};

// Huge distant groan: low sawtooth glide, lowpassed, long reverb.
synth.groan = (ctx, dest, o, audio) => {
  const t = ctx.currentTime;
  const len = o.seconds ?? 3.6;
  const g = outGain(ctx, dest, o.gain ?? 0.22);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(1, t + 0.8);
  env.gain.exponentialRampToValueAtTime(0.0001, t + len);
  env.connect(g);
  env.connect(outGain(ctx, audio.reverbIn, 0.5));
  const s = osc(ctx, 'sawtooth', 72);
  s.frequency.setValueAtTime(72, t);
  s.frequency.exponentialRampToValueAtTime(36, t + len);
  const vib = osc(ctx, 'sine', 3.1);
  vib.connect(outGain(ctx, s.frequency, 1.6));
  s.connect(filter(ctx, 'lowpass', 260, 2)).connect(env);
  return oneShot(ctx, g, [s, vib], len + 0.1);
};

// --- Act 3 ----------------------------------------------------------------------

// Endless falling tone: Shepard–Risset glissando, octave-spaced sines gliding down under a bell curve.
synth.shepard_down = (ctx, dest, o) => {
  const voices = 8;
  const fmin = 40;
  const period = config.audio.shepard.seconds;
  const g = outGain(ctx, dest, 0);
  fadeIn(ctx, g, o.gain ?? config.audio.shepard.gain, o.fadeIn ?? 4);
  const lp = filter(ctx, 'lowpass', 2400);
  lp.connect(g);
  const parts = [];
  for (let i = 0; i < voices; i++) {
    const s = osc(ctx, 'sine', fmin);
    const level = ctx.createGain();
    level.gain.value = 0;
    s.connect(level).connect(lp);
    parts.push({ s, level });
  }
  let t = 0;
  const h = loop(ctx, g, parts.map((p) => p.s), {
    update(dt) {
      t += dt;
      const now = ctx.currentTime;
      parts.forEach((p, i) => {
        const pos = (((i / voices - t / period) % 1) + 1) % 1;
        p.s.frequency.setTargetAtTime(fmin * Math.pow(2, pos * voices), now, 0.03);
        p.level.gain.setTargetAtTime(0.5 - 0.5 * Math.cos(2 * Math.PI * pos), now, 0.03);
      });
    },
  });
  h.update(0);
  return h;
};

// Metal stress: resonant filtered noise with a shudder, plus low clicks.
synth.creak = (ctx, dest, o, audio) => {
  const t = ctx.currentTime;
  const len = rand(0.45, 0.8);
  const g = outGain(ctx, dest, o.gain ?? 0.12);
  const src = noise(ctx, audio);
  const f = rand(500, 900);
  const bp = filter(ctx, 'bandpass', f, 14);
  bp.frequency.setValueAtTime(f, t);
  bp.frequency.linearRampToValueAtTime(f * rand(0.8, 1.2), t + len);
  const shudder = ctx.createGain();
  shudder.gain.value = 0.5;
  const lfo = osc(ctx, 'square', rand(14, 24));
  lfo.connect(outGain(ctx, shudder.gain, 0.5));
  const env = ctx.createGain();
  envelope(env.gain, t, 0.05, 1, len);
  src.connect(bp).connect(shudder).connect(env).connect(g);
  for (let i = 0; i < 3; i++) {
    const at = t + rand(0, len);
    const click = osc(ctx, 'sine', rand(70, 110));
    const ce = ctx.createGain();
    envelope(ce.gain, at, 0.002, 0.6, 0.03);
    click.connect(ce).connect(g);
    click.start(at);
    click.stop(at + 0.06);
  }
  return oneShot(ctx, g, [src, lfo], len + 0.1);
};

// Breathing: filtered noise with an in/out envelope. set('rate', breaths per second), set('ragged', 0–1).
function breath(ctx, dest, o, audio, freq, rate) {
  const g = outGain(ctx, dest, 0);
  fadeIn(ctx, g, o.gain ?? config.audio.breath.gain, 1.5);
  const src = noise(ctx, audio);
  const bp = filter(ctx, 'bandpass', freq, 0.9);
  const env = ctx.createGain();
  env.gain.value = 0;
  src.connect(bp).connect(env).connect(g);
  const params = { rate, ragged: 0 };
  let phase = Math.random();
  return loop(ctx, g, [src], {
    set(name, value) { params[name] = value; },
    update(dt) {
      const jitter = 1 + (Math.random() - 0.5) * params.ragged * 1.6;
      phase = (phase + dt * params.rate * jitter) % 1;
      // inhale 0–0.4, pause, exhale 0.5–0.95
      let level = 0;
      if (phase < 0.4) level = Math.sin((phase / 0.4) * Math.PI) * 0.8;
      else if (phase > 0.5 && phase < 0.95) level = Math.sin(((phase - 0.5) / 0.45) * Math.PI);
      const now = ctx.currentTime;
      env.gain.setTargetAtTime(level * (1 + params.ragged * 0.4 * Math.random()), now, 0.04);
      bp.frequency.setTargetAtTime(phase < 0.45 ? freq * 1.3 : freq * 0.8, now, 0.08);
    },
  });
}

synth.breath_helmet = (ctx, dest, o, audio) => breath(ctx, dest, o, audio, 1100, o.rate ?? 0.25);
synth.breath_other = (ctx, dest, o, audio) => breath(ctx, dest, o, audio, 620, o.rate ?? 0.21);

// Thump-thump: two short low sine thumps. set('bpm', n).
synth.heartbeat = (ctx, dest, o) => {
  const g = outGain(ctx, dest, o.gain ?? config.audio.heartbeat.gain);
  const params = { bpm: o.bpm ?? 60 };
  const keepAlive = osc(ctx, 'sine', 1);
  keepAlive.connect(outGain(ctx, g, 0));
  let wait = 0.2;
  function thump(at, level) {
    const s = osc(ctx, 'sine', 62);
    s.frequency.setValueAtTime(62, at);
    s.frequency.exponentialRampToValueAtTime(38, at + 0.14);
    const e = ctx.createGain();
    envelope(e.gain, at, 0.008, level, 0.16);
    s.connect(e).connect(g);
    s.start(at);
    s.stop(at + 0.2);
  }
  return loop(ctx, g, [keepAlive], {
    set(name, value) { params[name] = value; },
    update(dt) {
      wait -= dt;
      if (wait > 0) return;
      wait += 60 / params.bpm;
      const at = ctx.currentTime + 0.02;
      thump(at, 1);
      thump(at + Math.min(0.16, 18 / params.bpm), 0.7);
    },
  });
};

// Ping with an echo tail. o.echoes adds extra returns (the sonar lies).
synth.sonar_ping = (ctx, dest, o) => {
  const t = ctx.currentTime;
  const g = outGain(ctx, dest, o.gain ?? 0.07);
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.32;
  const fb = outGain(ctx, delay, 0.42);
  delay.connect(filter(ctx, 'lowpass', 3000)).connect(fb);
  delay.connect(g);
  const pings = [[t, 1000, 1]];
  for (let i = 0; i < (o.echoes ?? 0); i++) pings.push([t + rand(0.15, 1.6), rand(880, 1120), rand(0.25, 0.6)]);
  const sources = [];
  for (const [at, f, level] of pings) {
    const s = osc(ctx, 'sine', f);
    const e = ctx.createGain();
    envelope(e.gain, at, 0.004, level, 0.28);
    s.connect(e);
    e.connect(g);
    e.connect(delay);
    s.start(at);
    s.stop(at + 0.35);
    sources.push(s);
  }
  const h = loopLikeStop(ctx, g, sources);
  setTimeout(() => { h.done = true; }, 3500);
  return h;
};

// Unintelligible whispers: bandpassed noise with fast random formants, orbiting the head (HRTF).
synth.whisper = (ctx, dest, o, audio) => {
  const len = o.seconds ?? 4;
  const g = outGain(ctx, dest, 0);
  fadeIn(ctx, g, o.gain ?? 0.22, 0.6);
  const src = noise(ctx, audio);
  const f1 = filter(ctx, 'bandpass', 1200, 9);
  const f2 = filter(ctx, 'bandpass', 2600, 11);
  const syllable = ctx.createGain();
  syllable.gain.value = 0;
  src.connect(f1).connect(syllable);
  src.connect(f2).connect(syllable);
  syllable.connect(g);
  let angle = Math.random() * Math.PI * 2;
  let age = 0;
  let nextSyllable = 0;
  const h = loop(ctx, g, [src], {
    update(dt) {
      age += dt;
      const now = ctx.currentTime;
      angle += dt * (o.orbit ?? 1.1);
      if (h.panner) setPosition(ctx, h.panner, orbitPosition(angle, 1.2, 0.1));
      nextSyllable -= dt;
      if (nextSyllable <= 0) {
        nextSyllable = rand(0.08, 0.22);
        syllable.gain.setTargetAtTime(Math.random() < 0.75 ? rand(0.5, 1) : 0, now, 0.02);
        f1.frequency.setTargetAtTime(rand(700, 1800), now, 0.03);
        f2.frequency.setTargetAtTime(rand(1900, 3400), now, 0.03);
      }
      if (age > len) h.stop(0.6);
    },
  });
  return h;
};

// Switch click.
synth.flashlight_click = (ctx, dest, o, audio) => {
  const t = ctx.currentTime;
  const g = outGain(ctx, dest, o.gain ?? 0.35);
  const src = noise(ctx, audio);
  const env = ctx.createGain();
  envelope(env.gain, t, 0.001, 1, 0.012);
  src.connect(filter(ctx, 'highpass', 1800)).connect(env).connect(g);
  const tick = osc(ctx, 'square', 3100);
  const te = ctx.createGain();
  envelope(te.gain, t, 0.001, 0.15, 0.008);
  tick.connect(te).connect(g);
  return oneShot(ctx, g, [src, tick], 0.05);
};
