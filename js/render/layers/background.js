// Depth gradient and god rays.

import { config } from '../../config.js';
import { state } from '../../state.js';
import { ramp } from '../../math.js';
import { paletteAt } from '../palette.js';
import { worldToScreen } from '../renderer.js';

export function draw(ctx, view) {
  const { top, bottom } = paletteAt(state.depth);
  const gradient = ctx.createLinearGradient(0, 0, 0, view.h);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, view.w, view.h);

  drawRays(ctx, view);
}

// Soft diagonal light shafts that sway: full to 80 m, gone by 400 m.
function drawRays(ctx, view) {
  const r = config.godRays;
  const strength = 1 - ramp(state.depth, r.fullUntil, r.goneAt);
  if (strength <= 0) return;
  const surfaceY = Math.max(0, worldToScreen(0, 0).y);
  if (surfaceY >= view.h) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const length = view.h * 1.6;
  for (let i = 0; i < r.count; i++) {
    const x = view.w * ((i + 0.5) / r.count) + Math.sin(i * 12.9) * view.w * 0.06;
    const width = view.w * (0.05 + 0.04 * ((i * 7) % 3));
    const angle = 0.32 + Math.sin(state.time * r.swaySpeed + i * 1.7) * r.sway;
    const alpha = r.alpha * strength * (0.6 + 0.4 * Math.sin(state.time * 0.4 + i * 2.3));

    ctx.save();
    ctx.translate(x, surfaceY);
    ctx.rotate(angle);
    // Nested shafts with falling alpha give the soft, feathered edge.
    for (const spread of [1, 0.66, 0.33]) {
      const g = ctx.createLinearGradient(0, 0, 0, length);
      g.addColorStop(0, `rgba(235, 252, 255, ${alpha / 3})`);
      g.addColorStop(1, 'rgba(235, 252, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-width * 0.3 * spread, 0);
      ctx.lineTo(width * 0.3 * spread, 0);
      ctx.lineTo(width * spread, length);
      ctx.lineTo(-width * spread, length);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}
