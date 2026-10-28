// Messages carved into rock (spec §6.10): low contrast, jittered letters, readable only in the light.

import { config } from '../../config.js';
import { worldToScreen, inView } from '../renderer.js';
import { timeOfDayLine } from '../../meta/browser.js';

const FONT = '"Special Elite", "Courier New", monospace';

// Fixed per-letter jitter so the carving doesn't swim.
function seeded(i, k) {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

export function draw(ctx) {
  const s = config.scratchStyle;
  for (const [index, m] of config.scratches.entries()) {
    const at = worldToScreen(m.depth, m.x);
    if (!inView(at.y)) continue;
    const text = m.text === '{timeOfDay}' ? timeOfDayLine() : m.text;

    ctx.save();
    ctx.font = `${s.size}px ${FONT}`;
    const width = ctx.measureText(text).width;
    // Rock face
    ctx.fillStyle = '#1e2427';
    ctx.beginPath();
    ctx.ellipse(at.x, at.y, width * 0.75 + 40, 60, seeded(index, 9) * 0.1, 0, Math.PI * 2);
    ctx.fill();

    let x = at.x - width / 2;
    for (const [i, ch] of [...text].entries()) {
      const w = ctx.measureText(ch).width;
      ctx.save();
      ctx.translate(x + w / 2 + seeded(i, index) * s.jitter, at.y + seeded(i + 50, index) * s.jitter * 1.5);
      ctx.rotate(seeded(i + 99, index) * 0.09);
      // A dark groove under a pale scratch reads as carved.
      ctx.fillStyle = 'rgba(5, 8, 10, 0.7)';
      ctx.fillText(ch, -w / 2 + 1, 1.5);
      ctx.fillStyle = s.color;
      ctx.fillText(ch, -w / 2, 0);
      ctx.restore();
      x += w;
    }
    ctx.strokeStyle = 'rgba(190, 196, 192, 0.18)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(at.x - width / 2 + seeded(k, index + 3) * 30, at.y - 18 + k * 9);
      ctx.lineTo(at.x - width / 2 + 30 + seeded(k + 7, index) * 40, at.y - 10 + k * 9);
      ctx.stroke();
    }
    ctx.restore();
  }
}
