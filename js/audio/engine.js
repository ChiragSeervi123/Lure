// Audio engine (spec §9): context, buses, master chain, loader, duck and silence.
//
// sources → buses → underwaterFilter → dry + reverb (convolver) → master → mute → limiter → destination

import { config } from '../config.js';
import { state } from '../state.js';
import { lerp, ramp } from '../math.js';
import { synth } from './synth.js';
import { createPanner } from './spatial.js';

export const audio = {
  ctx: null,
  buses: {},
  reverbIn: null,       // extra send straight into the reverb, for huge distant sounds
  noise: null,          // shared { white, brown } AudioBuffers
};

const buffers = new Map();   // name → AudioBuffer, or null when the synth fallback is used
const live = new Set();      // handles currently playing
const suspendReasons = new Set();
let master;
let mute;
let filter;
let wet;

export function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || audio.ctx) return;
  const ctx = new AC();
  audio.ctx = ctx;
  const a = config.audio;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = a.limiter.threshold;
  limiter.ratio.value = a.limiter.ratio;
  limiter.attack.value = a.limiter.attack;
  limiter.release.value = a.limiter.release;
  limiter.knee.value = a.limiter.knee;
  limiter.connect(ctx.destination);

  mute = ctx.createGain();
  mute.connect(limiter);
  master = ctx.createGain();
  master.gain.value = a.masterGain;
  master.connect(mute);

  filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = a.cutoff.air;
  filter.Q.value = 0.6;

  const dry = ctx.createGain();
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse(ctx, a.reverb.seconds, a.reverb.decay);
  wet = ctx.createGain();
  wet.gain.value = a.reverb.wetMin;
  filter.connect(dry).connect(master);
  filter.connect(convolver);
  convolver.connect(wet).connect(master);

  audio.reverbIn = ctx.createGain();
  audio.reverbIn.connect(convolver);

  for (const [name, gain] of Object.entries(a.buses)) {
    const bus = ctx.createGain();
    bus.gain.value = gain;
    bus.connect(filter);
    audio.buses[name] = bus;
  }

  audio.noise = { white: noiseBuffer(ctx, 2, false), brown: noiseBuffer(ctx, 4, true) };
}

// Try assets/audio/{name}.mp3; a missing or broken file leaves the synth fallback in place.
export async function load(name) {
  if (!audio.ctx || buffers.has(name)) return;
  buffers.set(name, null);
  try {
    const res = await fetch(`assets/audio/${name}.mp3`);
    if (!res.ok) return;
    const data = await res.arrayBuffer();
    buffers.set(name, await audio.ctx.decodeAudioData(data));
  } catch {
    // no file: keep the fallback
  }
}

export function preload(names) {
  for (const name of names) load(name);
}

// Play a sound by name. opts: bus, gain, loop, position (spatial) plus any synth parameters.
// Returns a handle: { stop(fade), set(param, value), done }.
export function play(name, opts = {}) {
  if (!audio.ctx) return silentHandle();
  const ctx = audio.ctx;
  const bus = audio.buses[opts.bus ?? 'sfx'];
  const out = opts.position ? createPanner(ctx, opts.position, audio.buses.spatial) : bus;

  const buffer = buffers.get(name);
  let h;
  if (buffer) h = playBuffer(ctx, buffer, out, opts);
  else if (synth[name]) h = synth[name](ctx, out, opts, audio);
  else return silentHandle();

  h.panner = opts.position ? out : null;
  live.add(h);
  return h;
}

export function playFrom(name, position, opts = {}) {
  return play(name, { ...opts, position });
}

// Smoothly move a bus to a fraction of its normal level.
export function duck(busName, toGain, seconds) {
  const bus = audio.buses[busName];
  if (!bus) return;
  const t = audio.ctx.currentTime;
  const target = config.audio.buses[busName] * toGain;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(bus.gain.value, t);
  bus.gain.linearRampToValueAtTime(target, t + Math.max(0.02, seconds));
}

// Total silence: master to 0 and the context frozen. stopAll also ends every playing sound.
export function absoluteSilence(seconds, { stopAll = false } = {}) {
  if (!audio.ctx) return Promise.resolve();
  const t = audio.ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(0, t);
  if (stopAll) {
    for (const h of live) h.stop(0);
    live.clear();
  }
  suspend('silence');
  return new Promise((resolve) => {
    setTimeout(() => {
      resume('silence');
      const now = audio.ctx.currentTime;
      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(config.audio.masterGain, now + 0.05);
      resolve();
    }, seconds * 1000);
  });
}

export function setMuted(on) {
  if (!audio.ctx) return;
  mute.gain.setTargetAtTime(on ? 0 : 1, audio.ctx.currentTime, 0.05);
}

export function suspend(reason) {
  suspendReasons.add(reason);
  audio.ctx?.suspend();
}

export function resume(reason) {
  suspendReasons.delete(reason);
  if (!suspendReasons.size) audio.ctx?.resume();
}

export function isSilenced() {
  return !audio.ctx || suspendReasons.size > 0;
}

export function update(dt) {
  if (!audio.ctx) return;
  const a = config.audio;
  const t = audio.ctx.currentTime;

  const cutoff = state.dived ? lerp(a.cutoff.dive, a.cutoff.deep, ramp(state.depth, 200, a.cutoff.deepAt)) : a.cutoff.air;
  filter.frequency.setTargetAtTime(cutoff, t, state.dived ? 0.35 : 0.1);
  wet.gain.setTargetAtTime(lerp(a.reverb.wetMin, a.reverb.wetMax, ramp(state.depth, 0, 6000)), t, 0.5);

  const running = !isSilenced();
  for (const h of live) {
    if (h.done) live.delete(h);
    else if (running && h.update) h.update(dt);
  }
}

function playBuffer(ctx, buffer, out, opts) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = !!opts.loop;
  const g = ctx.createGain();
  g.gain.value = opts.gain ?? 1;
  src.connect(g).connect(out);
  src.start();
  const h = {
    done: false,
    gain: g,
    set() {},
    stop(fade = 0.05) {
      if (h.done) return;
      h.done = true;
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + fade);
      src.stop(t + fade + 0.02);
    },
  };
  src.onended = () => { h.done = true; };
  return h;
}

function silentHandle() {
  return { done: true, stop() {}, set() {} };
}

function impulse(ctx, seconds, decay) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return ir;
}

function noiseBuffer(ctx, seconds, brown) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}
