// Sky, sun, waves and gulls above the waterline, and the dive through it (B02).

import { config } from '../../config.js';
import { state } from '../../state.js';
import { clamp, rand } from '../../math.js';
import { worldToScreen } from '../renderer.js';

const dive = { active: false, t: 0, splashed: false, onSplash: null, onDone: null };
const gulls = Array.from({ length: 3 }, (_, i) => ({ x: rand(0.1, 0.9), y: 0.18 + i * 0.07, speed: rand(0.008, 0.016), flap: rand(0, 6) }));

export function startDive({ onSplash, onDone }) {
  Object.assign(dive, { active: true, t: 0, splashed: false, onSplash, onDone });
}

export function surfaceVisible() {
  return worldToScreen(0, 0).y > -60;
}

export function update(dt) {
  for (const g of gulls) {
    g.x += g.speed * dt;
    if (g.x > 1.1) g.x = -0.1;
    g.flap += dt * 2.2;
  }
  if (!dive.active) return;

  dive.t += dt;
  const p = clamp(dive.t / config.surface.diveSeconds, 0, 1);
  const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  state.depth = eased * config.surface.diveDepth;
  if (!dive.splashed && state.depth > 0.9) {
    dive.splashed = true;
    dive.onSplash?.();
  }
  if (p >= 1) {
    dive.active = false;
    dive.onDone?.();
  }
}

export function draw(ctx, view) {
  const s = config.surface;
  const waterY = worldToScreen(0, 0).y;
  if (waterY < -60) return;

  const offset = waterY - view.h / 2;   // everything above the water rises with it
  const sky = state.returning ? s.returningSky : s.sky;
  const t = state.time * s.waveSpeed;
  const amp = s.waveAmp;
  const waveAt = (x) => waterY + Math.sin(x * 0.011 + t) * amp + Math.sin(x * 0.029 - t * 1.4) * amp * 0.45;

  // Sky down to the wave line
  const g = ctx.createLinearGradient(0, Math.min(0, offset), 0, waterY);
  g.addColorStop(0, sky[0]);
  g.addColorStop(1, sky[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(view.w, -10);
  for (let x = view.w; x >= -10; x -= 10) ctx.lineTo(x, waveAt(x));
  ctx.closePath();
  ctx.fill();

  // Sun
  if (!state.returning) {
    const sx = view.w * s.sunX;
    const sy = view.h * s.sunY + offset;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.sunRadius * 4);
    glow.addColorStop(0, 'rgba(255, 252, 232, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 246, 210, 0.55)');
    glow.addColorStop(1, 'rgba(255, 246, 210, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - s.sunRadius * 4, sy - s.sunRadius * 4, s.sunRadius * 8, s.sunRadius * 8);
  }

  // Gulls
  ctx.strokeStyle = state.returning ? 'rgba(40, 44, 48, 0.6)' : 'rgba(60, 80, 95, 0.55)';
  ctx.lineWidth = 1.6;
  for (const gull of gulls) {
    const gx = gull.x * view.w;
    const gy = gull.y * view.h + offset + Math.sin(gull.flap * 0.5) * 6;
    const wing = 7 + Math.sin(gull.flap) * 3;
    ctx.beginPath();
    ctx.moveTo(gx - 9, gy - wing * 0.4);
    ctx.quadraticCurveTo(gx - 4, gy - wing, gx, gy);
    ctx.quadraticCurveTo(gx + 4, gy - wing, gx + 9, gy - wing * 0.4);
    ctx.stroke();
  }

  // Foam along the wave line
  ctx.strokeStyle = state.returning ? 'rgba(200, 205, 208, 0.35)' : 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -10; x <= view.w + 10; x += 10) {
    const y = waveAt(x);
    if (x === -10) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.beginPath();
  for (let x = -10; x <= view.w + 10; x += 10) {
    const y = waveAt(x + 40) + 14;
    if (x === -10) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
