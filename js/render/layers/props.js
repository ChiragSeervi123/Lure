// Props (spec §6.9): diver suit, face in the rock, seafloor flashlight and helmet, rope.

import { config } from '../../config.js';
import { state } from '../../state.js';
import { worldToScreen, inView } from '../renderer.js';
import { isLit } from './flashlight.js';
import { play } from '../../audio/engine.js';

const suit = { lit: false, left: false, facing: false };
const face = { seen: false, gone: false };
const rope = { slack: false, fall: 0, nextCreak: 0, done: false };

export function update(dt) {
  const p = config.props;

  // Diver suit: lit, out of the light, then it is facing you. No other change, no sound.
  const s = worldToScreen(p.suit.depth, p.suit.x);
  if (inView(s.y)) {
    const lit = isLit(s.x, s.y - 20);
    if (lit && state.light.on) suit.lit = true;
    if (!lit && suit.lit) suit.facing = true;
  }

  // Face in the rock: only on the first light pass.
  const f = worldToScreen(p.faceRock.depth, p.faceRock.x);
  if (inView(f.y)) {
    const lit = isLit(f.x, f.y) && state.light.on;
    if (lit) face.seen = true;
    else if (face.seen) face.gone = true;
  }

  // Rope: taut and creaking, then slack, falling past.
  const r = worldToScreen(p.rope.depth, p.rope.x);
  if (!rope.done && inView(r.y)) {
    if (!rope.slack && state.time > rope.nextCreak) {
      rope.nextCreak = state.time + 2.5 + Math.random() * 2;
      play('creak', { gain: 0.05 });
    }
    if (!rope.slack && state.depth > p.rope.depth - p.rope.slackDistance) {
      rope.slack = true;
      play('creak', { gain: 0.12 });
    }
  }
  if (rope.slack && !rope.done) {
    rope.fall += p.rope.fallSpeed * dt;
    if (rope.fall > state.view.h * 3) rope.done = true;
  }
}

export function draw(ctx, view) {
  const p = config.props;
  drawSuit(ctx, worldToScreen(p.suit.depth, p.suit.x));
  drawFaceRock(ctx, worldToScreen(p.faceRock.depth, p.faceRock.x));
  drawSeafloorLight(ctx, worldToScreen(p.seafloorLight.depth, p.seafloorLight.x));
  drawRope(ctx, worldToScreen(p.rope.depth, p.rope.x), view);
}

// The still-on flashlight's beam shows through the dark.
export function glow(ctx) {
  const at = worldToScreen(config.props.seafloorLight.depth, config.props.seafloorLight.x);
  if (!inView(at.y)) return;
  ctx.save();
  ctx.translate(at.x - 6, at.y - 10);
  ctx.rotate(Math.PI * 0.94);
  const len = 520;
  const g = ctx.createLinearGradient(0, 0, len, 0);
  g.addColorStop(0, 'rgba(255, 244, 214, 0.32)');
  g.addColorStop(1, 'rgba(255, 244, 214, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(len, -90);
  ctx.lineTo(len, 90);
  ctx.lineTo(0, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function ledge(ctx, x, y, width) {
  ctx.fillStyle = '#1d2326';
  ctx.beginPath();
  ctx.moveTo(x - width * 0.6, y);
  ctx.lineTo(x + width * 0.55, y - 4);
  ctx.lineTo(x + width * 0.7, y + 26);
  ctx.lineTo(x + width * 0.2, y + 44);
  ctx.lineTo(x - width * 0.5, y + 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(120, 130, 128, 0.18)';
  ctx.fillRect(x - width * 0.55, y, width * 1.1, 3);
}

function drawSuit(ctx, at) {
  if (!inView(at.y)) return;
  const { x, y } = at;
  ledge(ctx, x, y, 170);
  const brass = '#5d4a33';
  const canvas = '#4a4a42';
  ctx.save();
  ctx.translate(x, y);
  // Seated, legs out over the ledge
  ctx.fillStyle = canvas;
  ctx.fillRect(-28, -8, 56, 14);
  ctx.fillRect(14, -6, 40, 13);
  ctx.fillStyle = '#2a2622';
  ctx.fillRect(48, -8, 14, 16);
  // Torso
  ctx.fillStyle = canvas;
  ctx.beginPath();
  ctx.ellipse(0, -40, 30, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = brass;
  ctx.fillRect(-26, -66, 52, 10);
  // Helmet
  ctx.beginPath();
  ctx.arc(0, -88, 25, 0, Math.PI * 2);
  ctx.fill();
  if (suit.facing) {
    // Faceplate toward you: an empty dark window.
    ctx.fillStyle = '#0a0d0f';
    ctx.beginPath();
    ctx.arc(0, -88, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a7350';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    // Facing the wall: the back of the helmet and the air hose.
    ctx.strokeStyle = '#2f2a24';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(10, -78);
    ctx.bezierCurveTo(40, -70, 40, -20, 70, -10);
    ctx.stroke();
    ctx.fillStyle = '#6f5a3e';
    ctx.beginPath();
    ctx.arc(0, -96, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFaceRock(ctx, at) {
  if (!inView(at.y)) return;
  const { x, y } = at;
  ctx.fillStyle = '#20262a';
  ctx.beginPath();
  ctx.ellipse(x, y, 150, 120, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#272e33';
  for (const [dx, dy, rx, ry] of [[-60, -40, 60, 40], [50, 30, 70, 45], [-30, 60, 50, 30], [70, -50, 40, 35]]) {
    ctx.beginPath();
    ctx.ellipse(x + dx, y + dy, rx, ry, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(10, 14, 16, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 120, y - 10);
  ctx.lineTo(x - 70, y + 5);
  ctx.lineTo(x - 40, y - 15);
  ctx.moveTo(x + 40, y + 70);
  ctx.lineTo(x + 90, y + 40);
  ctx.stroke();
  if (face.gone) return;
  // The face: two hollow eyes and a long mouth worn into the stone.
  ctx.fillStyle = 'rgba(6, 9, 11, 0.85)';
  ctx.beginPath();
  ctx.ellipse(x - 34, y - 22, 16, 11, -0.2, 0, Math.PI * 2);
  ctx.ellipse(x + 30, y - 18, 15, 10, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - 2, y + 42, 26, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(60, 70, 72, 0.5)';
  ctx.beginPath();
  ctx.ellipse(x - 2, y + 8, 7, 20, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSeafloorLight(ctx, at) {
  if (!inView(at.y)) return;
  const { x, y } = at;
  ledge(ctx, x, y, 190);
  // Flashlight lying on its side, still on
  ctx.fillStyle = '#3b3f42';
  ctx.fillRect(x - 6, y - 16, 34, 12);
  ctx.fillStyle = '#56595b';
  ctx.fillRect(x - 12, y - 18, 8, 16);
  ctx.fillStyle = '#fff3d6';
  ctx.fillRect(x - 13, y - 15, 2, 10);
  // Abandoned helmet, glass cracked
  const hx = x + 70;
  const hy = y - 26;
  ctx.fillStyle = '#5d4a33';
  ctx.beginPath();
  ctx.arc(hx, hy, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0b0e10';
  ctx.beginPath();
  ctx.arc(hx - 3, hy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190, 200, 205, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hx - 10, hy - 6);
  ctx.lineTo(hx - 2, hy + 1);
  ctx.lineTo(hx + 6, hy - 4);
  ctx.moveTo(hx - 2, hy + 1);
  ctx.lineTo(hx - 5, hy + 9);
  ctx.stroke();
}

function drawRope(ctx, at, view) {
  if (rope.done || !inView(at.y)) return;
  const end = at.y + rope.fall;
  if (end < -40) return;
  const x = at.x;
  const sway = Math.sin(state.time * 0.8) * 4;
  ctx.save();
  ctx.strokeStyle = '#6b5f4a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (!rope.slack) {
    ctx.moveTo(x, -20);
    ctx.lineTo(x + sway, end);
  } else {
    // Slack: it coils as it falls.
    const top = end - view.h * 1.2;
    ctx.moveTo(x, top);
    for (let i = 1; i <= 24; i++) {
      const yy = top + (end - top) * (i / 24);
      ctx.lineTo(x + Math.sin(i * 0.9 + state.time * 3) * (12 + i), yy);
    }
  }
  ctx.stroke();
  ctx.restore();
}
