// Background colors by depth: linear blend between the keyframes in config.palette.
// A returning visitor sees the shallow water darker and grey.

import { config } from '../config.js';
import { state } from '../state.js';
import { hexToRgb, ramp } from '../math.js';

const keys = config.palette.map((k) => ({
  depth: k.depth,
  top: hexToRgb(k.top),
  bottom: hexToRgb(k.bottom),
}));

export function paletteAt(depth) {
  let i = 0;
  while (i < keys.length - 2 && depth > keys[i + 1].depth) i++;
  const a = keys[i];
  const b = keys[i + 1] ?? a;
  const span = b.depth - a.depth;
  const t = span > 0 ? Math.min(1, Math.max(0, (depth - a.depth) / span)) : 0;
  const grey = state.returning ? 1 - ramp(depth, 200, 1000) : 0;
  return { top: mix(a.top, b.top, t, grey), bottom: mix(a.bottom, b.bottom, t, grey) };
}

export function greyed(rgb, amount) {
  const r = config.returning;
  const lum = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
  return rgb.map((c) => (c + (lum - c) * r.grey * amount) * (1 - r.darken * amount));
}

function mix(a, b, t, grey) {
  let c = [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t);
  if (grey > 0) c = greyed(c, grey);
  return `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;
}
