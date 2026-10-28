// Creatures, never fully shown (spec §6.8).

import { config } from '../../config.js';
import { state } from '../../state.js';
import { clamp, rgba } from '../../math.js';
import { pxPerMeter } from '../renderer.js';

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

// --- layer ------------------------------------------------------------------------

export function update(dt) {
  updateWhale(dt);
}

export function draw(ctx, view) {
  drawWhale(ctx, view);
}
