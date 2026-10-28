// Canvas setup, resize, layer order and world → screen.

import { config } from '../config.js';
import { state } from '../state.js';
import { metersPerUnitAt } from '../input/scroll.js';
import * as background from './layers/background.js';
import * as surface from './layers/surface.js';
import * as particles from './layers/particles.js';
import * as fish from './layers/fish.js';
import * as creatures from './layers/creatures.js';
import * as companion from './layers/companion.js';
import * as ui from './layers/ui.js';
import * as pointer from '../input/pointer.js';

// Back to front (spec §6.3). World layers draw, then everything that glows through the dark.
const world = [background, surface, particles, fish, creatures, companion];
const overlay = [ui, pointer];

let canvas;
let ctx;

export function initRenderer(el) {
  canvas = el;
  ctx = canvas.getContext('2d', { alpha: false });
  resize();
  window.addEventListener('resize', resize);
}

// Screen pixels per meter at the camera depth: one scroll unit always moves the world the same distance on screen.
export function pxPerMeter() {
  return config.render.pxPerScrollUnit / metersPerUnitAt(state.depth);
}

export function worldToScreen(depth, x, layer = 1) {
  return {
    x: x * state.view.w,
    y: (depth - state.depth) * pxPerMeter() * layer + state.view.h / 2,
  };
}

// Objects more than one screen height outside the view are skipped.
export function inView(y, extra = 0) {
  return y > -state.view.h - extra && y < state.view.h * 2 + extra;
}

export function render(dt) {
  for (const layer of world) layer.update?.(dt);
  for (const layer of overlay) layer.update?.(dt);

  const { dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save();
  if (state.shake > 0 && !state.reducedMotion) {
    ctx.translate((Math.random() * 2 - 1) * state.shake, (Math.random() * 2 - 1) * state.shake);
  }

  background.draw(ctx, state.view);
  creatures.drawFar?.(ctx, state.view);
  for (const layer of world) if (layer !== background) layer.draw?.(ctx, state.view);

  ctx.globalCompositeOperation = 'lighter';
  for (const layer of world) layer.glow?.(ctx, state.view);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  for (const layer of overlay) layer.draw(ctx, state.view);
  state.shake = Math.max(0, state.shake - dt * config.effects.shakeDecay * Math.max(1, state.shake));
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
