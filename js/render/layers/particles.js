// Bubbles (pop on hover in Act 1), marine snow, and bubble bursts.

import { config } from '../../config.js';
import { state } from '../../state.js';
import { rand, ramp } from '../../math.js';
import { pxPerMeter } from '../renderer.js';
import { pointer } from '../../input/pointer.js';
import { play } from '../../audio/engine.js';

const snow = [];
const bubbles = [];
const bursts = [];
let lastDepth = 0;
let lastPop = 0;

function count(n) {
  return Math.round(n * state.quality * (state.isMobile ? 0.5 : 1));
}

function newSnow(view, anywhere) {
  return {
    x: Math.random() * view.w,
    y: anywhere ? Math.random() * view.h : view.h + 5,
    z: rand(0.3, 1),
    r: rand(0.6, 1.8),
    sway: rand(0, Math.PI * 2),
  };
}

function newBubble(view, anywhere) {
  return {
    x: Math.random() * view.w,
    y: anywhere ? rand(view.h * 0.2, view.h) : view.h + rand(10, 120),
    r: rand(3, 9),
    rise: rand(...config.particles.bubbleRise),
    wobble: rand(0, Math.PI * 2),
  };
}

// Small rising bubbles from a point (dive splash, the companion's last breath).
export function burst(x, y, n, { spread = 40, rise = [60, 160], size = [1.5, 5], life = [1.5, 3.5] } = {}) {
  for (let i = 0; i < count(n); i++) {
    bursts.push({
      x: x + rand(-spread, spread),
      y: y + rand(-spread, spread) * 0.5,
      vx: rand(-25, 25),
      rise: rand(...rise),
      r: rand(...size),
      life: rand(...life),
      age: 0,
    });
  }
}

export function update(dt) {
  const view = state.view;
  const p = config.particles;
  const moved = (state.depth - lastDepth) * pxPerMeter();
  lastDepth = state.depth;

  // Marine snow drifts down slowly; the camera's descent makes it rise past.
  const snowTarget = state.dived ? count(p.snow) : 0;
  while (snow.length < snowTarget) snow.push(newSnow(view, true));
  snow.length = Math.min(snow.length, snowTarget);
  for (const s of snow) {
    s.y += (6 * s.z) * dt - moved * s.z;
    s.x += Math.sin(state.time * 0.5 + s.sway) * 4 * dt;
    // Wrap by position so fast descents keep the flakes evenly spread.
    const span = view.h + 12;
    if (s.y < -6 || s.y > view.h + 6) {
      s.y = ((((s.y + 6) % span) + span) % span) - 6;
      s.x = Math.random() * view.w;
    }
  }

  // Act 1 bubbles
  const bubbleTarget = state.dived && state.depth < p.bubbleMaxDepth ? count(p.bubbles) : 0;
  while (bubbles.length < bubbleTarget) bubbles.push(newBubble(view, bubbles.length < bubbleTarget / 2));
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.y -= b.rise * dt + moved;
    b.wobble += dt * 2;
    const bx = b.x + Math.sin(b.wobble) * 4;
    if (Math.hypot(bx - pointer.x, b.y - pointer.y) < p.popRadius + b.r && pointer.seen) {
      pop(bx, b.y);
      bubbles.splice(i, 1);
    } else if (b.y < -20) {
      if (bubbles.length > bubbleTarget) bubbles.splice(i, 1);
      else Object.assign(b, newBubble(view, false), { y: view.h + 20 + ((-20 - b.y) % (view.h * 0.8)) });
    }
  }

  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.age += dt;
    b.y -= b.rise * dt + moved;
    b.x += b.vx * dt;
    b.vx *= 0.98;
    if (b.age > b.life) bursts.splice(i, 1);
  }
}

function pop(x, y) {
  bursts.push({ x, y, vx: 0, rise: 0, r: 0, life: 0.25, age: 0, ring: true });
  if (state.time - lastPop > 0.05) {
    lastPop = state.time;
    play('bubble_pop');
  }
}

export function draw(ctx) {
  const snowAlpha = 0.55 * ramp(state.depth, config.particles.snowFromDepth, 300);
  if (snowAlpha > 0) {
    ctx.fillStyle = `rgba(220, 232, 236, ${snowAlpha})`;
    for (const s of snow) {
      ctx.globalAlpha = s.z;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.lineWidth = 1;
  for (const b of bubbles) drawBubble(ctx, b.x + Math.sin(b.wobble) * 4, b.y, b.r, 0.55);
  for (const b of bursts) {
    const fade = 1 - b.age / b.life;
    if (b.ring) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${fade * 0.7})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4 + (1 - fade) * 14, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      drawBubble(ctx, b.x, b.y, b.r, 0.6 * fade);
    }
  }
}

// Faint snow and burst bubbles still show through the darkness, so the deep is never flat black.
export function glow(ctx) {
  const a = config.particles.snowGlowAlpha * state.darkness;
  if (a <= 0.01) return;
  ctx.fillStyle = `rgba(150, 170, 175, ${a})`;
  for (let i = 0; i < snow.length; i += 2) {
    const s = snow[i];
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  for (const b of bursts) {
    if (b.ring) continue;
    ctx.strokeStyle = `rgba(255, 233, 168, ${0.5 * (1 - b.age / b.life) * state.darkness})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBubble(ctx, x, y, r, alpha) {
  ctx.strokeStyle = `rgba(235, 250, 255, ${alpha})`;
  ctx.fillStyle = `rgba(235, 250, 255, ${alpha * 0.12})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}
