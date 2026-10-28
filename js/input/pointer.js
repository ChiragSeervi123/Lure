// Pointer tracking, the custom cursor and the ghost cursor (spec §6.11).

import { config } from '../config.js';
import { state } from '../state.js';
import { clamp } from '../math.js';

export const pointer = {
  x: 0,
  y: 0,
  speed: 0,             // smoothed px/s
  lastMove: 0,          // state.time of the last movement
  seen: false,          // has the pointer been over the page yet
  onClick: [],          // callbacks (x, y)
};

const ghost = {
  phase: 0,             // 0 off, 1 mirroring, 2 holding / drifting, 3 gone
  x: 0,
  y: 0,
  phaseTime: 0,
  alpha: 0,
};
const history = [];     // recent { t, x, y } for the ghost's delayed replay
let vanishUntil = 0;

export function initPointer() {
  pointer.x = window.innerWidth / 2;
  pointer.y = window.innerHeight / 2;
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    onMove(e);
    if (!state.started || state.paused || e.target.closest?.('button')) return;
    for (const fn of pointer.onClick) fn(pointer.x, pointer.y);
  });
}

function onMove(e) {
  const dx = e.clientX - pointer.x;
  const dy = e.clientY - pointer.y;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.seen = true;
  pointer.lastMove = state.time;
  pointer.instant = Math.hypot(dx, dy);
}

export function updatePointer(dt) {
  // Speed from per-frame displacement, smoothed.
  const moved = pointer.instant || 0;
  pointer.instant = 0;
  const v = dt > 0 ? moved / dt : 0;
  pointer.speed += (v - pointer.speed) * clamp(dt * 10, 0, 1);

  history.push({ t: state.time, x: pointer.x, y: pointer.y });
  while (history.length && history[0].t < state.time - 2) history.shift();

  state.cursorHidden = state.time < vanishUntil;
  updateGhost(dt);
}

export function startGhost() {
  if (state.isMobile || ghost.phase) return;
  ghost.phase = 1;
  ghost.phaseTime = 0;
  ghost.x = pointer.x;
  ghost.y = pointer.y;
}

export function vanishCursor(seconds) {
  vanishUntil = state.time + seconds;
}

function updateGhost(dt) {
  if (!ghost.phase || ghost.phase === 3) return;
  const g = config.ghost;
  ghost.phaseTime += dt;
  ghost.alpha = Math.min(1, ghost.alpha + dt * 0.5);

  if (ghost.phase === 1) {
    const target = state.time - g.delay;
    const sample = history.find((h) => h.t >= target) ?? history[history.length - 1];
    if (sample) {
      ghost.x = sample.x;
      ghost.y = sample.y;
    }
    if (ghost.phaseTime > g.mirrorSeconds) {
      ghost.phase = 2;
      ghost.phaseTime = 0;
    }
  } else if (ghost.phaseTime > g.holdSeconds) {
    const dx = pointer.x - ghost.x;
    const dy = pointer.y - ghost.y;
    const d = Math.hypot(dx, dy);
    if (d < g.touchRadius) {
      ghost.phase = 3;
      return;
    }
    const step = Math.min(d, g.driftSpeed * dt);
    ghost.x += (dx / d) * step;
    ghost.y += (dy / d) * step;
  }
}

export function draw(ctx) {
  if (!state.started || state.isMobile || !pointer.seen) return;

  if (ghost.phase === 1 || ghost.phase === 2) drawRing(ctx, ghost.x, ghost.y, 0.28 * ghost.alpha);
  if (!state.cursorHidden) drawRing(ctx, pointer.x, pointer.y, 0.85);
}

function drawRing(ctx, x, y, alpha) {
  ctx.save();
  ctx.strokeStyle = `rgba(235, 245, 248, ${alpha})`;
  ctx.fillStyle = `rgba(235, 245, 248, ${alpha})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
