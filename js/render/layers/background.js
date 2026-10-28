// Depth gradient behind everything.

import { state } from '../../state.js';
import { paletteAt } from '../palette.js';

export function draw(ctx, view) {
  const { top, bottom } = paletteAt(state.depth);
  const gradient = ctx.createLinearGradient(0, 0, 0, view.h);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, view.w, view.h);
}
