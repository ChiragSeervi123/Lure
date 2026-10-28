// Diegetic UI: depth gauge (bottom-left).

import { config } from '../../config.js';
import { state } from '../../state.js';

export function draw(ctx, view) {
  const g = config.ui.gauge;
  const text = `${String(Math.floor(state.depth)).padStart(4, '0')} m`;

  ctx.save();
  ctx.font = `${g.fontSize}px "Share Tech Mono", ui-monospace, Consolas, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = g.color;
  ctx.shadowColor = g.shadowColor;
  ctx.shadowBlur = g.shadowBlur;
  ctx.fillText(text, g.margin, view.h - g.margin);
  ctx.restore();
}
