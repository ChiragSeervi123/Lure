// Small math helpers shared by every system.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const randRange = ([lo, hi]) => rand(lo, hi);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function smoothstep(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

// 0 at `from`, 1 at `to` (either order), clamped.
export function ramp(v, from, to) {
  return clamp((v - from) / (to - from), 0, 1);
}

// Frame-rate independent approach of `current` toward `target`.
export function approach(current, target, rate, dt) {
  return target + (current - target) * Math.exp(-rate * dt);
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
