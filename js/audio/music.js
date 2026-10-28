// Music box lullaby (spec §9.3): 8 bars in C major, music-box or hummed voice.

import { config } from '../config.js';
import { audio } from './engine.js';
import { createPanner, setPosition } from './spatial.js';

const FREQ = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5 };
const MELODY = ('C5 E5 G5 E5 F5 A5 G5 - E5 G5 C6 B5 A5 G5 E5 - ' +
                'D5 F5 A5 F5 E5 G5 C5 - D5 E5 F5 D5 C5 - - -').split(' ');

const LOOKAHEAD = 0.25;   // seconds of notes scheduled ahead
const TICK_MS = 50;

export class Lullaby {
  constructor({ hummed = false, bus = 'music', position = null, gain = config.audio.lullaby.gain } = {}) {
    this.hummed = hummed;
    this.tempo = 1;       // multiplier on the base bpm
    this.detune = 0;      // max random cents per note
    this.dropout = 0;     // chance a note is skipped
    this.playing = false;
    const ctx = audio.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.targetGain = gain;
    this.panner = position ? createPanner(ctx, position, audio.buses.spatial) : null;
    this.out.connect(this.panner ?? audio.buses[bus]);
  }

  start(fadeSeconds = 2) {
    const ctx = audio.ctx;
    this.playing = true;
    this.step = 0;
    this.next = ctx.currentTime + 0.1;
    this.setGain(this.targetGain, fadeSeconds);
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(fadeSeconds = 1) {
    if (!this.playing) return;
    this.playing = false;
    this.setGain(0, fadeSeconds);
    clearInterval(this.timer);
  }

  setGain(gain, seconds = 0.5) {
    const g = this.out.gain;
    const t = audio.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(gain, t + Math.max(0.02, seconds));
  }

  setPosition(position) {
    if (this.panner) setPosition(audio.ctx, this.panner, position);
  }

  // Tempo slides toward zero note by note; the last note sustains and fades.
  windDown(onDone) {
    this.winding = true;
    this.onWound = onDone;
  }

  tick() {
    if (!this.playing) return;
    const now = audio.ctx.currentTime;
    while (this.playing && this.next < now + LOOKAHEAD) this.scheduleStep();
  }

  scheduleStep() {
    let beats = 1;
    while (MELODY[(this.step + beats) % MELODY.length] === '-' && beats < 4) beats++;
    const symbol = MELODY[this.step];
    const beat = 60 / (config.audio.lullaby.bpm * Math.max(0.05, this.tempo));
    const duration = beats * beat;
    const freq = FREQ[symbol] * Math.pow(2, ((Math.random() * 2 - 1) * this.detune) / 1200);

    if (this.winding) {
      this.tempo *= 0.8;
      if (this.tempo < 0.22) {
        this.note(freq, this.next, 5, true);
        this.playing = false;
        clearInterval(this.timer);
        setTimeout(() => this.onWound?.(), 5000);
        return;
      }
    }
    if (Math.random() >= this.dropout) this.note(freq, this.next, duration, false);
    this.next += duration;
    this.step = (this.step + beats) % MELODY.length;
  }

  note(freq, t, duration, last) {
    if (this.hummed) this.hum(freq / 2, t, duration);
    else this.musicBox(freq, t, last ? duration : Math.min(1.8, duration + 0.9));
  }

  // Sine + quiet triangle partial, fast decay, slight shimmer.
  musicBox(freq, t, ring) {
    const ctx = audio.ctx;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(1, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + ring);
    env.connect(this.out);

    const parts = [['sine', freq, 0.7], ['sine', freq * 1.004, 0.25], ['triangle', freq * 2, 0.08]];
    for (const [type, f, level] of parts) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g).connect(env);
      o.start(t);
      o.stop(t + ring + 0.05);
    }
  }

  // Human-like hum: sawtooth through two formant bandpass filters, with vibrato.
  hum(freq, t, duration) {
    const ctx = audio.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vibDepth = ctx.createGain();
    vibDepth.gain.value = freq * 0.008;
    vib.connect(vibDepth).connect(o.frequency);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.12);
    env.gain.setValueAtTime(0.5, t + duration * 0.85);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.15);
    env.connect(this.out);

    for (const [f, q, level] of [[620, 5, 1], [1150, 7, 0.45]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(bp).connect(g).connect(env);
    }
    o.start(t);
    vib.start(t);
    o.stop(t + duration + 0.2);
    vib.stop(t + duration + 0.2);
  }
}
