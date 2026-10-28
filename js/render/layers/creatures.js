// Creatures, never fully shown (spec §6.8).

import { config } from '../../config.js';
import { state } from '../../state.js';
import { clamp, lerp, rand, randRange, rgba } from '../../math.js';
import { pxPerMeter } from '../renderer.js';
import { pointer } from '../../input/pointer.js';
import { isLit } from './flashlight.js';

// --- whale pass (B05): a moment of wonder ---------------------------------------

let whale = null;

export function startWhale() {
  whale = { t: 0, depth: state.depth, dir: Math.random() < 0.5 ? -1 : 1 };
}

function updateWhale(dt) {
  if (!whale) return;
  whale.t += dt;
  if (whale.t > config.creatures.whale.seconds) whale = null;
}

function drawWhale(ctx, view) {
  if (!whale) return;
  const w = config.creatures.whale;
  const p = whale.t / w.seconds;
  const L = Math.max(view.w, view.h) * 1.5;
  const H = L * 0.22;
  const travel = view.w + L * 1.2;
  const x = whale.dir < 0 ? view.w + L * 0.6 - p * travel : -L * 0.6 + p * travel;
  const y = view.h * 0.42 - (state.depth - whale.depth) * pxPerMeter() * 0.35 + Math.sin(whale.t * 0.4) * 10;
  const tail = Math.sin(whale.t * 0.9) * H * 0.18;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-whale.dir, 1);    // head leads in the direction of travel
  const g = ctx.createLinearGradient(0, -H / 2, 0, H / 2);
  g.addColorStop(0, rgba(w.color, 0.92));
  g.addColorStop(1, 'rgba(52, 102, 130, 0.85)');
  ctx.fillStyle = g;

  ctx.beginPath();
  ctx.moveTo(L / 2, H * 0.05);
  ctx.bezierCurveTo(L * 0.48, -H * 0.45, L * 0.1, -H * 0.55, -L * 0.2, -H * 0.3);
  ctx.bezierCurveTo(-L * 0.33, -H * 0.2, -L * 0.42, -H * 0.08 + tail * 0.3, -L * 0.46, tail * 0.5);
  ctx.quadraticCurveTo(-L * 0.52, -H * 0.3 + tail, -L * 0.58, -H * 0.32 + tail);
  ctx.quadraticCurveTo(-L * 0.53, tail * 0.8, -L * 0.58, H * 0.3 + tail);
  ctx.quadraticCurveTo(-L * 0.5, H * 0.2 + tail, -L * 0.46, H * 0.06 + tail * 0.5);
  ctx.bezierCurveTo(-L * 0.38, H * 0.15, -L * 0.1, H * 0.45, L * 0.2, H * 0.4);
  ctx.bezierCurveTo(L * 0.4, H * 0.36, L * 0.5, H * 0.25, L / 2, H * 0.05);
  ctx.fill();

  // Pectoral fin
  ctx.beginPath();
  ctx.moveTo(L * 0.18, H * 0.3);
  ctx.quadraticCurveTo(L * 0.1, H * 0.8, -L * 0.02, H * 0.85 + Math.sin(whale.t * 0.7) * H * 0.08);
  ctx.quadraticCurveTo(L * 0.08, H * 0.5, L * 0.08, H * 0.32);
  ctx.fill();

  // Throat grooves
  ctx.strokeStyle = 'rgba(160, 200, 215, 0.12)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(L * 0.44, H * (0.12 + i * 0.045));
    ctx.quadraticCurveTo(L * 0.3, H * (0.3 + i * 0.03), L * 0.12, H * (0.33 + i * 0.02));
    ctx.stroke();
  }

  // The eye blinks once, halfway across.
  const blink = 1 - clamp(1 - Math.abs(p - 0.5) / 0.03, 0, 1);
  const ex = L * 0.33;
  const ey = H * 0.06;
  ctx.fillStyle = 'rgba(200, 225, 230, 0.55)';
  ctx.beginPath();
  ctx.ellipse(ex, ey, H * 0.045, H * 0.03 * Math.max(0.08, blink), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(8, 18, 26, 0.95)';
  ctx.beginPath();
  ctx.ellipse(ex, ey, H * 0.022, H * 0.022 * Math.max(0.08, blink), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- edge silhouettes (B08): a huge dark shape at the screen edge, under 1.5 s ------

const silhouettes = [];

export function spawnSilhouette(index) {
  const scales = config.creatures.silhouette.scales;
  silhouettes.push({ t: 0, side: Math.random() < 0.5 ? -1 : 1, scale: scales[Math.min(index, scales.length - 1)], y: 0.3 + Math.random() * 0.4 });
}

export function drawFar(ctx, view) {
  const s = config.creatures.silhouette;
  for (const sil of silhouettes) {
    const p = sil.t / s.seconds;
    const env = Math.sin(Math.PI * Math.min(1, p));
    const R = view.h * 0.55 * sil.scale;
    // Closer appearances reach further into the screen and are darker.
    const reach = R * (0.12 + 0.22 * sil.scale) * env;
    const cx = sil.side < 0 ? -R + reach : view.w + R - reach;
    const cy = view.h * sil.y + (p - 0.5) * R * 0.25;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(-sil.side, 1);
    ctx.fillStyle = `rgba(2, 9, 16, ${(0.35 + 0.3 * sil.scale) * env})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, R, R * 0.42, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();     // dorsal fin breaking the curve
    ctx.moveTo(-R * 0.45, -R * 0.36);
    ctx.quadraticCurveTo(-R * 0.62, -R * 0.75, -R * 0.82, -R * 0.62);
    ctx.quadraticCurveTo(-R * 0.72, -R * 0.4, -R * 0.62, -R * 0.3);
    ctx.fill();
    ctx.restore();
  }
}

function updateSilhouettes(dt) {
  for (let i = silhouettes.length - 1; i >= 0; i--) {
    silhouettes[i].t += dt;
    if (silhouettes[i].t > config.creatures.silhouette.seconds) silhouettes.splice(i, 1);
  }
}

// --- glowing eyes (B15): fade when lit, come back closer, creep only while unlit -----

const eyes = [];
let eyesOn = false;
let lastDepth = 0;

export function setEyes(on) {
  eyesOn = on;
}

function placeEye(e) {
  const { w, h } = state.view;
  const c = config.creatures.eyes;
  const dist = lerp(440, 110, e.near) * rand(0.85, 1.15);
  const a = rand(0, Math.PI * 2);
  e.x = clamp(pointer.x + Math.cos(a) * dist, 30, w - 30);
  e.y = clamp(pointer.y + Math.sin(a) * dist, 30, h - 30);
  e.size = c.size * rand(0.8, 1.35);
  e.alpha = 0;
  e.mode = 'in';
  e.near = Math.min(0.85, e.near + c.approach);
}

function updateEyes(dt) {
  const c = config.creatures.eyes;
  const moved = (state.depth - lastDepth) * pxPerMeter() * 0.5;
  lastDepth = state.depth;
  while (eyesOn && eyes.length < c.max) eyes.push({ mode: 'wait', wait: randRange(c.respawn), near: 0, alpha: 0 });

  for (const e of eyes) {
    if (e.mode !== 'wait') e.y -= moved;
    if (!eyesOn && e.mode !== 'wait') e.mode = 'out';
    if (e.mode === 'wait') {
      e.wait -= dt;
      if (e.wait <= 0 && eyesOn) placeEye(e);
      continue;
    }
    if (e.mode === 'out') {
      e.alpha -= dt / c.fadeSeconds;
      if (e.alpha <= 0) {
        e.alpha = 0;
        e.mode = 'wait';
        e.wait = randRange(c.respawn);
      }
      continue;
    }
    if (isLit(e.x, e.y) || e.y < -20 || e.y > state.view.h + 20) {
      e.mode = 'out';
      continue;
    }
    if (e.mode === 'in') {
      e.alpha = Math.min(1, e.alpha + dt / 1.5);
      if (e.alpha >= 1) e.mode = 'on';
    }
    // Weeping-angel rule: only moves while nobody is looking.
    const dx = pointer.x - e.x;
    const dy = pointer.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * c.creep * dt;
    e.y += (dy / d) * c.creep * dt;
  }
}

function glowEyes(ctx) {
  const c = config.creatures.eyes;
  for (const e of eyes) {
    if (e.alpha <= 0) continue;
    const blink = Math.sin(state.time * 0.7 + e.near * 20) > 0.985 ? 0.15 : 1;
    for (const side of [-1, 1]) {
      const x = e.x + side * e.size * 3.4;
      const g = ctx.createRadialGradient(x, e.y, 0, x, e.y, e.size * 4);
      g.addColorStop(0, rgba(c.color, 0.9 * e.alpha));
      g.addColorStop(0.3, rgba(c.color, 0.25 * e.alpha));
      g.addColorStop(1, rgba(c.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - e.size * 4, e.y - e.size * 4, e.size * 8, e.size * 8);
      ctx.fillStyle = rgba(c.color, e.alpha);
      ctx.beginPath();
      ctx.ellipse(x, e.y, e.size, e.size * 0.7 * blink, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// --- tentacle (Act 3): slides past just outside the flashlight, never inside --------

let tentaclesOn = false;
let tentacle = null;
let nextTentacle = 0;

export function setTentacles(on) {
  tentaclesOn = on;
  if (on) nextTentacle = state.time + randRange(config.creatures.tentacle.interval) * 0.5;
}

function updateTentacle(dt) {
  const c = config.creatures.tentacle;
  if (tentacle) {
    tentacle.t += dt;
    if (tentacle.t > c.seconds) tentacle = null;
  } else if (tentaclesOn && state.light.on && state.time > nextTentacle) {
    tentacle = { t: 0, a0: rand(0, Math.PI * 2), dir: Math.random() < 0.5 ? -1 : 1 };
    nextTentacle = state.time + c.seconds + randRange(c.interval);
  }
}

function drawTentacle(ctx) {
  if (!tentacle || !state.light.on) return;
  const c = config.creatures.tentacle;
  const p = tentacle.t / c.seconds;
  const R = state.light.radius * 1.04;
  const head = tentacle.a0 + tentacle.dir * p * 2.4;
  const tail = head - tentacle.dir * 1.4;
  const n = 22;
  ctx.save();
  ctx.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const t0 = k / n;
    const t1 = (k + 1) / n;
    const pt = (t) => {
      const ang = lerp(tail, head, t);
      const r = R + 16 * (1 - t) + Math.sin(t * 7 + tentacle.t * 3) * 6;
      return [pointer.x + Math.cos(ang) * r, pointer.y + Math.sin(ang) * r];
    };
    const [x0, y0] = pt(t0);
    const [x1, y1] = pt(t1);
    ctx.strokeStyle = 'rgba(52, 60, 56, 0.96)';
    ctx.lineWidth = lerp(30, 3, t0);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    if (k % 3 === 1) {
      ctx.fillStyle = 'rgba(150, 150, 135, 0.5)';
      const inward = Math.atan2(pointer.y - y0, pointer.x - x0);
      ctx.beginPath();
      ctx.arc(x0 + Math.cos(inward) * lerp(9, 1, t0), y0 + Math.sin(inward) * lerp(9, 1, t0), lerp(3.2, 0.8, t0), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// --- layer ------------------------------------------------------------------------

export function update(dt) {
  updateWhale(dt);
  updateSilhouettes(dt);
  updateEyes(dt);
  updateTentacle(dt);
}

export function draw(ctx, view) {
  drawWhale(ctx, view);
  drawTentacle(ctx);
}

export function glow(ctx) {
  glowEyes(ctx);
}
