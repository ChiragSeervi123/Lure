// The companion: a small glowing orb-fish that follows the cursor (spec §6.7).
// Modes: HIDDEN, CUTE, NERVOUS, MIMIC, PREEMPT, HAPPY, GONE, LURE.

import { config } from '../../config.js';
import { state } from '../../state.js';
import { approach, clamp, rand, ramp, randRange, smoothstep, rgba } from '../../math.js';
import { pointer } from '../../input/pointer.js';
import { play } from '../../audio/engine.js';
import { burst } from './particles.js';

export const companion = { mode: 'HIDDEN', x: 0, y: 0, scale: 1, facing: 1 };

let swimT = -1;
let loopT = -1;
let nextLoop = 0;
let lureT = 0;
let armed = false;
let lastPreempt = -99;
let lastChirp = -99;
const mimicQueue = [];

export function initCompanion() {
  pointer.onClick.push(onClick);
}

export function setMode(mode) {
  if (companion.mode === 'GONE' || companion.mode === 'HIDDEN' || companion.mode === 'LURE') return;
  companion.mode = mode;
}

export function swimIn() {
  companion.mode = 'CUTE';
  companion.x = state.view.w + 40;
  companion.y = state.view.h * 0.4;
  swimT = 0;
  nextLoop = state.time + config.companion.swimInSeconds;
}

// GONE: removed, a few bubbles rise from its last position.
export function vanish() {
  if (companion.mode === 'HIDDEN' || companion.mode === 'GONE') return;
  burst(companion.x, companion.y, config.particles.goneBurst, { spread: 6, rise: [30, 70], size: [1.5, 3.5], life: [3, 5] });
  companion.mode = 'GONE';
}

// LURE: a warm glow appears in the dark and drifts toward the camera.
export function startLure() {
  companion.mode = 'LURE';
  companion.x = state.view.w * 0.5 + rand(-80, 80);
  companion.y = state.view.h * 0.4;
  lureT = 0;
}

export function corruption() {
  return companion.mode === 'LURE' ? 0.3 + 0.7 * ramp(lureT, 0, config.companion.lureApproachSeconds) : ramp(state.depth, 250, 10000);
}

export function chirp() {
  if (state.time - lastChirp < config.companion.chirpCooldown) return;
  lastChirp = state.time;
  play('chirp', { corruption: corruption() });
}

function onClick() {
  const m = companion.mode;
  if (m === 'CUTE' || m === 'NERVOUS' || m === 'HAPPY') chirp();
  else if (m === 'MIMIC') mimicQueue.push(state.time + config.companion.mimicDelay);
}

export function update(dt) {
  const c = config.companion;
  const m = companion.mode;
  if (m === 'HIDDEN' || m === 'GONE') return;

  if (m === 'LURE') {
    lureT += dt;
    const p = smoothstep(lureT / c.lureApproachSeconds);
    companion.scale = 0.35 + p * 2.6;
    companion.x = approach(companion.x, state.view.w / 2, 0.3, dt);
    companion.y = approach(companion.y, state.view.h * 0.46, 0.3, dt);
    return;
  }

  // Follow the cursor with a soft lag.
  const t = state.time;
  const off = c.offset[m] ?? 60;
  let tx;
  let ty;
  if (m === 'HAPPY') {
    tx = pointer.x + Math.sin(t * 1.3) * off;
    ty = pointer.y + Math.sin(t * 2.6) * off * 0.45;
  } else {
    const a = t * 0.45;
    tx = pointer.x + Math.cos(a) * off;
    ty = pointer.y + Math.sin(a) * off * 0.5 - 12;
  }

  // Little loops while CUTE.
  if (m === 'CUTE' && swimT < 0 && loopT < 0 && t > nextLoop) loopT = 0;
  if (loopT >= 0) {
    loopT += dt;
    const p = loopT / c.loopSeconds;
    tx += Math.sin(p * Math.PI * 2) * 34;
    ty += (1 - Math.cos(p * Math.PI * 2)) * -22;
    if (p >= 1) {
      loopT = -1;
      nextLoop = t + randRange(c.loopInterval);
    }
  }

  let lag = c.lag[m] ?? 2;
  if (swimT >= 0) {
    swimT += dt;
    lag = 1.2;
    if (swimT > c.swimInSeconds) {
      swimT = -1;
      loopT = 0;
      chirp();
    }
  }

  const prevX = companion.x;
  companion.x = approach(companion.x, tx, lag, dt);
  companion.y = approach(companion.y, ty, lag, dt);
  const j = c.jitter[m] ?? 0;
  if (j) {
    companion.x += rand(-j, j);
    companion.y += rand(-j, j);
  }
  if (Math.abs(companion.x - prevX) > 0.2) companion.facing = companion.x > prevX ? 1 : -1;
  companion.scale = 1;

  // MIMIC: copies each click exactly, 0.8 s late.
  while (mimicQueue.length && mimicQueue[0] <= t) {
    mimicQueue.shift();
    chirp();
  }

  // PREEMPT: chirps when the cursor slows down, just before the click usually comes.
  if (m === 'PREEMPT') {
    if (pointer.speed > c.preemptFrom) armed = true;
    else if (armed && pointer.speed < c.preemptTo && t - lastPreempt > c.preemptCooldown) {
      armed = false;
      lastPreempt = t;
      chirp();
    }
  }
}

export function draw(ctx) {
  const m = companion.mode;
  if (m === 'HIDDEN' || m === 'GONE' || m === 'LURE') return;
  const c = config.companion;
  const r = c.radius;
  const y = companion.y + Math.sin(state.time * 2.1) * c.bob;
  ctx.save();
  ctx.translate(companion.x, y);
  ctx.scale(companion.facing, 1);
  const flick = Math.sin(state.time * (m === 'NERVOUS' ? 22 : 12)) * r * 0.45;
  ctx.fillStyle = '#f6d98a';
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, 0);
  ctx.lineTo(-r * 2.1, -r * 0.8 + flick);
  ctx.lineTo(-r * 2.1, r * 0.8 + flick);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = c.glow;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(40, 30, 10, 0.85)';
  ctx.beginPath();
  ctx.arc(r * 0.4, -r * 0.2, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function glow(ctx) {
  const m = companion.mode;
  if (m === 'HIDDEN' || m === 'GONE') return;
  const c = config.companion;
  const pulse = 1 + 0.18 * Math.sin(state.time * Math.PI * 2 * (c.pulse[m] ?? 1));
  const strength = m === 'HAPPY' ? 1 : m === 'LURE' ? 0.9 : 0.75;
  const radius = c.glowRadius * pulse * companion.scale;
  const y = companion.y + (m === 'LURE' ? Math.sin(state.time * 0.9) * 4 : Math.sin(state.time * 2.1) * c.bob);
  const g = ctx.createRadialGradient(companion.x, y, 0, companion.x, y, radius);
  g.addColorStop(0, rgba(c.glow, strength));
  g.addColorStop(0.2, rgba(c.glow, strength * 0.45));
  g.addColorStop(1, rgba(c.glow, 0));
  ctx.fillStyle = g;
  ctx.fillRect(companion.x - radius, y - radius, radius * 2, radius * 2);
  if (m === 'LURE') {
    ctx.fillStyle = rgba(c.glow, clamp(0.6 * companion.scale, 0, 1));
    ctx.beginPath();
    ctx.arc(companion.x, y, c.radius * 0.8 * companion.scale, 0, Math.PI * 2);
    ctx.fill();
  }
}
