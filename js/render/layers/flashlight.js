// Darkness overlay with a soft hole at the cursor, flicker, and isLit() (spec §6.5).

import { config } from '../../config.js';
import { state } from '../../state.js';
import { clamp, lerp, ramp } from '../../math.js';
import { pointer } from '../../input/pointer.js';

const MASK_SCALE = 0.5;   // the mask is soft, so half resolution is plenty
let mask;
let mctx;
let nextDip = 0;
let dipT = -1;

// Is a screen point inside the light? Everything counts as lit until the dark closes in.
export function isLit(x, y) {
  if (state.darkness < 0.35) return true;
  if (!state.light.on || state.light.intensity < 0.15) return false;
  return Math.hypot(x - pointer.x, y - pointer.y) < state.light.radius * 0.82;
}

export function flickerRate() {
  const l = config.light;
  if (state.light.battery < l.lowBattery) return l.maxDipsPerSecond;
  return lerp(l.dipRate[0], l.dipRate[1], ramp(state.depth, config.beats.flashlight, config.light.batteryEnd));
}

export function update(dt) {
  const l = config.light;
  const light = state.light;
  const low = light.battery < l.lowBattery;
  const radiusScale = low ? lerp(l.lowRadius, 1, light.battery / l.lowBattery) : 1;
  light.radius = l.radius * radiusScale + Math.sin(state.time * 3.1) * l.wobble * 0.5 + Math.sin(state.time * 7.3) * l.wobble * 0.3;

  if (!light.on) {
    light.intensity = 0;
    return;
  }
  const rate = flickerRate();
  if (state.reduceFlashing) {
    // No flicker at all: the light just dims as it would have flickered more.
    light.intensity = lerp(1, l.reducedDim, clamp(rate / l.maxDipsPerSecond, 0, 1));
    return;
  }
  // Dips in brightness, never brighter than steady and never more than 3 per second.
  if (dipT < 0 && state.time >= nextDip) {
    dipT = 0;
    nextDip = state.time + Math.max(1 / l.maxDipsPerSecond, -Math.log(1 - Math.random()) / rate);
  }
  let intensity = 1;
  if (dipT >= 0) {
    dipT += dt;
    const p = dipT / l.dipSeconds;
    intensity = 1 - l.dipDepth * Math.sin(Math.PI * clamp(p, 0, 1));
    if (p >= 1) dipT = -1;
  }
  light.intensity = low ? intensity * lerp(0.7, 1, light.battery / l.lowBattery) : intensity;
}

export function draw(ctx, view) {
  if (state.darkness <= 0.01) return;
  const w = Math.max(1, Math.round(view.w * MASK_SCALE));
  const h = Math.max(1, Math.round(view.h * MASK_SCALE));
  if (!mask) {
    mask = document.createElement('canvas');
    mctx = mask.getContext('2d');
  }
  if (mask.width !== w || mask.height !== h) {
    mask.width = w;
    mask.height = h;
  }

  mctx.globalCompositeOperation = 'source-over';
  mctx.clearRect(0, 0, w, h);
  mctx.fillStyle = `rgba(3, 7, 11, ${state.darkness})`;
  mctx.fillRect(0, 0, w, h);

  const light = state.light;
  if (light.on && light.intensity > 0) {
    const x = pointer.x * MASK_SCALE;
    const y = pointer.y * MASK_SCALE;
    const r = light.radius * MASK_SCALE;
    const g = mctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0, 0, 0, ${light.intensity})`);
    g.addColorStop(1 - config.light.feather, `rgba(0, 0, 0, ${light.intensity * 0.92})`);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    mctx.globalCompositeOperation = 'destination-out';
    mctx.fillStyle = g;
    mctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.drawImage(mask, 0, 0, view.w, view.h);
}
