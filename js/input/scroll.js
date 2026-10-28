// Virtual scroll (spec §6.1). Native page scroll is off. Wheel, touch drag and keys push
// scroll.velocity, which glides with inertia and carries state.depth down (or up).

import { config } from '../config.js';
import { state } from '../state.js';

export const scroll = {
  velocity: 0,        // m/s from player input
  allowUp: true,
  resistance: 0,      // 0–1; input is scaled by (1 - resistance)
  autoDrift: 0,       // m/s; positive pulls the player down on its own
  locked: false,      // ignore all input during cinematic beats
  idleTime: 0,        // seconds since the last input
  scrollSpeed: 0,     // 0–1, how fast the camera is moving as a fraction of the speed cap
  onBlockedUp: null,  // called when an upward scroll is refused
};

let nudgeCooldown = 0;
let touchY = null;

export function initScroll() {
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });
}

export function updateScroll(dt) {
  scroll.idleTime += dt;
  nudgeCooldown = Math.max(0, nudgeCooldown - dt);

  const maxSpeed = config.scroll.maxUnitsPerSecond * metersPerUnitAt(state.depth);
  scroll.velocity = clamp(scroll.velocity, scroll.allowUp ? -maxSpeed : 0, maxSpeed);

  let rate = scroll.velocity + scroll.autoDrift;
  if (!scroll.allowUp) rate = Math.max(0, rate);

  const before = state.depth;
  state.depth += rate * dt;
  scroll.velocity *= Math.exp(-config.scroll.damping * dt);

  const { min, max } = config.depth;
  if (state.depth <= min) {
    state.depth = min;
    scroll.velocity = Math.max(0, scroll.velocity);
  } else if (state.depth >= max) {
    state.depth = max;
    scroll.velocity = Math.min(0, scroll.velocity);
  }

  scroll.scrollSpeed = dt > 0 ? Math.min(1, Math.abs(state.depth - before) / dt / maxSpeed) : 0;
}

function push(units) {
  if (!state.started) return;
  scroll.idleTime = 0;
  if (scroll.locked || units === 0) return;
  if (units < 0 && !scroll.allowUp) {
    refuseUp();
    return;
  }
  // An impulse of units × m/unit × damping travels exactly units × m/unit meters as it decays.
  scroll.velocity += units * metersPerUnitAt(state.depth) * (1 - scroll.resistance) * config.scroll.damping;
}

function refuseUp() {
  if (nudgeCooldown > 0) return;
  nudgeCooldown = config.scroll.blockedUpCooldown;
  scroll.velocity += config.scroll.blockedUpNudgeUnits * metersPerUnitAt(state.depth) * config.scroll.damping;
  scroll.onBlockedUp?.();
}

// Each act's metersPerScrollUnit, eased into the next act's over the act's final stretch
// so the feel of a scroll never jumps at a boundary.
function metersPerUnitAt(depth) {
  const acts = config.acts;
  let i = acts.findIndex((a) => depth < a.end);
  if (i === -1) i = acts.length - 1;
  const act = acts[i];
  const next = acts[i + 1];
  if (!next) return act.metersPerScrollUnit;

  const blendStart = act.end - (act.end - act.start) * config.scroll.actBlend;
  if (depth <= blendStart) return act.metersPerScrollUnit;
  const t = smoothstep((depth - blendStart) / (act.end - blendStart));
  return act.metersPerScrollUnit * Math.pow(next.metersPerScrollUnit / act.metersPerScrollUnit, t);
}

function onWheel(e) {
  if (e.ctrlKey) return; // leave pinch / ctrl+wheel zoom to the browser
  e.preventDefault();
  let units = e.deltaY;
  if (e.deltaMode === 1) units *= config.scroll.wheelLinePx;
  else if (e.deltaMode === 2) units *= config.scroll.pageUnits;
  push(units);
}

function onKey(e) {
  if (!state.started || e.altKey || e.ctrlKey || e.metaKey) return;
  let units;
  switch (e.key) {
    case 'ArrowDown': units = config.scroll.arrowUnits; break;
    case 'ArrowUp': units = -config.scroll.arrowUnits; break;
    case 'PageDown':
    case ' ': units = config.scroll.pageUnits; break;
    default: return;
  }
  e.preventDefault();
  push(units);
}

function onTouchStart(e) {
  touchY = e.touches[0].clientY;
}

function onTouchMove(e) {
  if (touchY === null) return;
  if (state.started) e.preventDefault();
  const y = e.touches[0].clientY;
  push((touchY - y) * config.scroll.touchMultiplier);
  touchY = y;
}

function onTouchEnd(e) {
  touchY = e.touches.length ? e.touches[0].clientY : null;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function smoothstep(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}
