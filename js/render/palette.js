// Background colors by depth: linear blend between the keyframes in config.palette.

import { config } from '../config.js';

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
  return { top: mix(a.top, b.top, t), bottom: mix(a.bottom, b.bottom, t) };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
