// Procedural fallbacks for every sound (spec §10). Each generator is (ctx, out, opts, audio) → handle,
// where handle = { stop(fade), set(param, value), update?(dt), done }.

import { config } from '../config.js';
import { rand } from '../math.js';

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
