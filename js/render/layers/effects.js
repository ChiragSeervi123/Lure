// Post FX (spec §6.13): grain, vignette, chromatic aberration, cracks, glitch, static.

import { config } from '../../config.js';
import { state } from '../../state.js';
import { lerp, rand, randRange, ramp } from '../../math.js';
import { play } from '../../audio/engine.js';

const NOISE_SIZE = 256;
const noiseFrames = [];
let glitchUntil = 0;
let staticUntil = 0;
let cracks = null;
let cracksShown = 0;
let lastCrackSound = 0;
let tint;
let tctx;

function makeNoise() {
  for (let n = 0; n < 4; n++) {
    const c = document.createElement('canvas');
    c.width = c.height = NOISE_SIZE;
    const g = c.getContext('2d');
    const img = g.createImageData(NOISE_SIZE, NOISE_SIZE);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    noiseFrames.push(c);
  }
}

export function glitch(seconds) {
  glitchUntil = Math.max(glitchUntil, state.time + seconds);
}

export function staticFor(seconds) {
  staticUntil = Math.max(staticUntil, state.time + seconds);
}

// Branching cracks from the screen edges, stored in growth order (normalized coordinates).
function makeCracks() {
  const segments = [];
  const branches = [];
  for (let b = 0; b < config.effects.cracks.branches; b++) {
    const edge = b % 4;
    const t = rand(0.1, 0.9);
    const start = [[t, 0], [1, t], [t, 1], [0, t]][edge];
    const inward = [Math.PI / 2, Math.PI, -Math.PI / 2, 0][edge] + rand(-0.5, 0.5);
    branches.push({ x: start[0], y: start[1], a: inward, left: Math.floor(rand(10, 18)) });
  }
  while (branches.some((b) => b.left > 0)) {
    for (const b of branches) {
      if (b.left <= 0) continue;
      b.a += rand(-0.45, 0.45);
      const len = rand(0.015, 0.035);
      const x2 = b.x + Math.cos(b.a) * len;
      const y2 = b.y + Math.sin(b.a) * len * 1.4;
      segments.push([b.x, b.y, x2, y2]);
      b.x = x2;
      b.y = y2;
      b.left--;
      if (Math.random() < 0.18 && branches.length < 40) {
        branches.push({ x: b.x, y: b.y, a: b.a + rand(0.6, 1.1) * (Math.random() < 0.5 ? -1 : 1), left: Math.floor(rand(3, 8)) });
      }
    }
  }
  return segments;
}

export function aberration() {
  const a = config.effects.aberration;
  return a.max * ramp(state.depth, a.from, config.beats.blackout);
}

// Draws the glow layer again in red and cyan, offset a few pixels.
export function drawAberration(ctx, glowCanvas, offset) {
  if (!tint || tint.width !== glowCanvas.width || tint.height !== glowCanvas.height) {
    tint = document.createElement('canvas');
    tint.width = glowCanvas.width;
    tint.height = glowCanvas.height;
    tctx = tint.getContext('2d');
  }
  const px = offset * state.view.dpr;
  for (const [color, dx] of [['rgb(255, 40, 40)', -px], ['rgb(40, 230, 255)', px]]) {
    tctx.globalCompositeOperation = 'copy';
    tctx.drawImage(glowCanvas, 0, 0);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = color;
    tctx.fillRect(0, 0, tint.width, tint.height);
    ctx.globalAlpha = 0.35;
    ctx.drawImage(tint, dx, 0);
  }
  ctx.globalAlpha = 1;
}

export function update(dt) {
  if (!noiseFrames.length) makeNoise();
  const c = config.effects;

  // Random glitches deeper in Act 4
  const chance = c.glitch.chance * ramp(state.depth, c.glitch.from, config.beats.blackout) * (state.reducedMotion ? 0.3 : 1);
  if (state.started && Math.random() < chance * dt) glitch(randRange(c.glitch.seconds));

  // Cracks grow progressively, each new segment with a crack sound
  const p = ramp(state.depth, c.cracks.start, c.cracks.end);
  if (p > 0 && !cracks) cracks = makeCracks();
  if (cracks) {
    const target = Math.floor(p * cracks.length);
    if (target > cracksShown && state.time - lastCrackSound > 0.18) {
      lastCrackSound = state.time;
      play('glass_crack', { gain: 0.12 + Math.random() * 0.1 });
    }
    cracksShown = target;
  }
}

export function draw(ctx, view) {
  const c = config.effects;
  const depthT = ramp(state.depth, 0, 9000);

  // Vignette tightens with depth ("pressure")
  const v = lerp(c.vignette.surface, c.vignette.deep, depthT);
  const R = Math.hypot(view.w, view.h) / 2;
  const g = ctx.createRadialGradient(view.w / 2, view.h / 2, R * lerp(0.6, 0.25, depthT), view.w / 2, view.h / 2, R);
  g.addColorStop(0, 'rgba(2, 5, 8, 0)');
  g.addColorStop(1, `rgba(2, 5, 8, ${v})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);

  // Cracks in the helmet glass
  if (cracks && cracksShown > 0) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const [pass, style, width] of [[0, 'rgba(0, 0, 0, 0.45)', 2.2], [1, 'rgba(215, 232, 238, 0.6)', 1]]) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i < cracksShown; i++) {
        const [x1, y1, x2, y2] = cracks[i];
        ctx.moveTo(x1 * view.w + pass, y1 * view.h + pass);
        ctx.lineTo(x2 * view.w + pass, y2 * view.h + pass);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Glitch: horizontal slices shoved sideways
  if (state.time < glitchUntil) {
    const canvas = ctx.canvas;
    const slices = state.reducedMotion ? 2 : 6;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < slices; i++) {
      const y = Math.random() * canvas.height;
      const h = rand(4, 40) * state.view.dpr;
      const dx = rand(-30, 30) * state.view.dpr * (state.reducedMotion ? 0.3 : 1);
      ctx.drawImage(canvas, 0, y, canvas.width, h, dx, y, canvas.width, h);
    }
    ctx.restore();
  }

  // Film grain: always on, stronger with depth
  if (noiseFrames.length) {
    const frame = noiseFrames[Math.floor(Math.random() * noiseFrames.length)];
    const pattern = ctx.createPattern(frame, 'repeat');
    ctx.save();
    ctx.globalAlpha = lerp(c.grain.surface, c.grain.deep, depthT);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pattern;
    ctx.translate(Math.random() * NOISE_SIZE, Math.random() * NOISE_SIZE);
    ctx.fillRect(-NOISE_SIZE, -NOISE_SIZE, view.w + NOISE_SIZE, view.h + NOISE_SIZE);
    // In the dark, overlay barely registers: a faint screen pass keeps the deep grainy, never flat black.
    if (state.darkness > 0.3) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = c.grain.deep * 0.22 * state.darkness;
      ctx.fillRect(-NOISE_SIZE, -NOISE_SIZE, view.w + NOISE_SIZE, view.h + NOISE_SIZE);
    }
    ctx.restore();
  }

  // Static: signal loss, grey noise (never a white flash)
  if (state.time < staticUntil && noiseFrames.length) {
    ctx.save();
    ctx.globalAlpha = c.staticAlpha * (state.reduceFlashing ? 0.5 : 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(noiseFrames[Math.floor(Math.random() * noiseFrames.length)], 0, 0, view.w, view.h);
    ctx.restore();
  }
}
