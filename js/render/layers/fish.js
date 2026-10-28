// Fish school (boids, spec §6.6) and the flee (B06).

import { config } from '../../config.js';
import { state } from '../../state.js';
import { clamp, pick, rand } from '../../math.js';
import { pxPerMeter } from '../renderer.js';
import { pointer } from '../../input/pointer.js';

const fish = [];
let active = false;
let fled = false;
let fleeDir = 1;
let lastDepth = 0;

export function spawnSchool() {
  if (active || fled) return;
  active = true;
  const f = config.fish;
  const n = Math.round((state.isMobile ? f.mobileCount : f.count) * state.quality);
  const { w, h } = state.view;
  const cx = rand(0.3, 0.7) * w;
  const cy = rand(0.35, 0.65) * h;
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    fish.push({
      x: cx + Math.cos(a) * rand(0, 140),
      y: cy + Math.sin(a) * rand(0, 90),
      vx: Math.cos(a) * f.minSpeed,
      vy: Math.sin(a) * f.minSpeed * 0.4,
      color: pick(f.colors),
      size: rand(3.5, 6.5),
      tail: rand(0, Math.PI * 2),
    });
  }
}

// Every fish rushes toward the same screen edge, then they're gone for good.
export function flee() {
  if (!active) return;
  fled = true;
  fleeDir = pointer.x < state.view.w / 2 ? 1 : -1;
}

export function update(dt) {
  if (!fish.length) {
    lastDepth = state.depth;
    return;
  }
  const f = config.fish;
  const { w, h } = state.view;
  const moved = (state.depth - lastDepth) * pxPerMeter() * 0.3;
  lastDepth = state.depth;

  if (fled) {
    for (let i = fish.length - 1; i >= 0; i--) {
      const p = fish[i];
      p.vx += (fleeDir * f.fleeSpeed - p.vx) * clamp(dt * 4, 0, 1);
      p.vy += (rand(-60, 60) - p.vy) * clamp(dt * 2, 0, 1);
      p.x += p.vx * dt;
      p.y += p.vy * dt - moved;
      p.tail += dt * 40;
      if (p.x < -60 || p.x > w + 60) fish.splice(i, 1);
    }
    return;
  }

  const scatter = pointer.speed > f.scatterCursorSpeed;
  for (const p of fish) {
    let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0;
    for (const q of fish) {
      if (q === p) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > f.neighborDist || d === 0) continue;
      n++;
      ax += q.vx;
      ay += q.vy;
      cx += q.x;
      cy += q.y;
      if (d < f.separationDist) {
        sx -= dx / d;
        sy -= dy / d;
      }
    }
    let fx = sx * f.separation * 60;
    let fy = sy * f.separation * 60;
    if (n) {
      fx += (ax / n - p.vx) * f.alignment + (cx / n - p.x) * f.cohesion;
      fy += (ay / n - p.vy) * f.alignment + (cy / n - p.y) * f.cohesion;
    }

    const dxp = pointer.x - p.x;
    const dyp = pointer.y - p.y;
    const dp = Math.hypot(dxp, dyp) || 1;
    if (scatter && dp < 180) {
      fx -= (dxp / dp) * f.scatterForce * 60;
      fy -= (dyp / dp) * f.scatterForce * 60;
    } else if (pointer.seen) {
      fx += (dxp / dp) * f.cursorAttract * 60;
      fy += (dyp / dp) * f.cursorAttract * 60;
    }

    const m = 60;
    if (p.x < m) fx += (m - p.x) * f.edgeForce;
    if (p.x > w - m) fx -= (p.x - (w - m)) * f.edgeForce;
    if (p.y < m) fy += (m - p.y) * f.edgeForce;
    if (p.y > h - m) fy -= (p.y - (h - m)) * f.edgeForce;

    p.vx += fx * dt;
    p.vy += fy * dt;
    const speed = Math.hypot(p.vx, p.vy) || 1;
    const max = scatter ? f.maxSpeed * 3 : f.maxSpeed;
    const target = clamp(speed, f.minSpeed, max);
    p.vx *= target / speed;
    p.vy *= target / speed;
  }
  for (const p of fish) {
    p.x += p.vx * dt;
    p.y += p.vy * dt - moved;
    p.tail += dt * (6 + Math.hypot(p.vx, p.vy) * 0.08);
  }
}

export function draw(ctx) {
  for (const p of fish) {
    const angle = Math.atan2(p.vy, p.vx);
    const s = p.size;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.6, s * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    const flick = Math.sin(p.tail) * s * 0.5;
    ctx.beginPath();
    ctx.moveTo(-s * 1.3, 0);
    ctx.lineTo(-s * 2.6, -s * 0.8 + flick);
    ctx.lineTo(-s * 2.6, s * 0.8 + flick);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(20, 30, 40, 0.8)';
    ctx.beginPath();
    ctx.arc(s * 0.8, -s * 0.15, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
