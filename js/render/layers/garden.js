// Bioluminescent false-relief garden (B20) and its lights going out, far to near (B21).

import { config } from '../../config.js';
import { state } from '../../state.js';
import { pick, rand, rgba } from '../../math.js';
import { worldToScreen, inView } from '../renderer.js';
import { pointer } from '../../input/pointer.js';

const plants = [];

function grow() {
  const g = config.garden;
  for (let i = 0; i < g.plants; i++) {
    plants.push({
      depth: rand(g.start, g.end),
      x: rand(0.04, 0.96),
      color: pick(g.colors),
      height: rand(40, 130),
      bulbs: 3 + Math.floor(rand(0, 4)),
      sway: rand(0, Math.PI * 2),
      light: 1,          // 1 glowing → 0 out
      out: false,
    });
  }
}

function screenOf(p) {
  return worldToScreen(p.depth, p.x);
}

// Visible plants go out one by one from farthest to nearest the cursor; the last one right beside it.
export function lightsOut(gap, onEach, onDone) {
  if (!plants.length) grow();
  const visible = [];
  for (const p of plants) {
    const at = screenOf(p);
    if (at.y > -40 && at.y < state.view.h + 40) visible.push({ p, d: Math.hypot(at.x - pointer.x, at.y - pointer.y) });
    else p.out = true;
  }
  visible.sort((a, b) => b.d - a.d);
  let i = 0;
  const next = () => {
    if (i >= visible.length) return onDone();
    visible[i].p.out = true;
    onEach(i, visible.length);
    i++;
    gap(next);
  };
  next();
}

export function update(dt) {
  if (!plants.length && state.depth > config.garden.start - 400) grow();
  for (const p of plants) if (p.out) p.light = Math.max(0, p.light - dt * 3);
}

function stalkPoints(p, at) {
  const sway = Math.sin(state.time * 0.6 + p.sway) * 8;
  const pts = [];
  for (let k = 0; k <= p.bulbs; k++) {
    const t = k / p.bulbs;
    pts.push([at.x + sway * t * t + Math.sin(p.sway + t * 3) * 6, at.y - p.height * t]);
  }
  return pts;
}

export function draw(ctx) {
  ctx.strokeStyle = '#163235';
  ctx.lineWidth = 2;
  for (const p of plants) {
    const at = screenOf(p);
    if (!inView(at.y)) continue;
    const pts = stalkPoints(p, at);
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (const pt of pts.slice(1)) ctx.lineTo(...pt);
    ctx.stroke();
  }
}

export function glow(ctx) {
  for (const p of plants) {
    if (p.light <= 0) continue;
    const at = screenOf(p);
    if (!inView(at.y)) continue;
    const pulse = 0.85 + 0.15 * Math.sin(state.time * 1.3 + p.sway * 3);
    const pts = stalkPoints(p, at);
    for (const [i, [x, y]] of pts.slice(1).entries()) {
      const r = (6 + i * 1.5) * pulse;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      g.addColorStop(0, rgba(p.color, 0.85 * p.light));
      g.addColorStop(0.25, rgba(p.color, 0.3 * p.light));
      g.addColorStop(1, rgba(p.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    }
  }
}
