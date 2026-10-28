// Canvas setup, resize and layer order.

import { config } from '../config.js';
import { state } from '../state.js';
import * as background from './layers/background.js';
import * as ui from './layers/ui.js';

// Back to front (spec §6.3).
const layers = [background, ui];

let canvas;
let ctx;

export function initRenderer(el) {
  canvas = el;
  ctx = canvas.getContext('2d', { alpha: false });
  resize();
  window.addEventListener('resize', resize);
}

export function render(dt) {
  for (const layer of layers) layer.update?.(dt);

  const { dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const layer of layers) layer.draw(ctx, state.view);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, config.render.maxDpr);
  const w = window.innerWidth;
  const h = window.innerHeight;
  state.view.w = w;
  state.view.h = h;
  state.view.dpr = dpr;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
}
