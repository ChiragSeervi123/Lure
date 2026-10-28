// Diegetic UI: depth gauge and battery (bottom-left), sonar radar (bottom-right), end text.

import { config } from '../../config.js';
import { state } from '../../state.js';
import { lerp, rand, ramp } from '../../math.js';
import { play } from '../../audio/engine.js';

const MONO = '"Share Tech Mono", ui-monospace, Consolas, monospace';

const radar = {
  angle: 0,
  sweeps: 0,
  blipAngle: rand(0, Math.PI * 2),
  echoes: [],         // { angle, dist, life }
  lies: [],           // echo counts for the next pings (B23)
  full: false,        // after the lies, the radar stays full of blips
};

// B23: the next pings return these echo counts; the last one fills the radar for good.
export function sonarLies(counts) {
  radar.lies.push(...counts);
}

export function update(dt) {
  if (!state.showRadar) return;
  const r = config.ui.radar;
  const before = Math.floor(radar.angle / (Math.PI * 2));
  radar.angle += (dt / r.sweepSeconds) * Math.PI * 2;
  if (Math.floor(radar.angle / (Math.PI * 2)) !== before) ping();
  radar.blipAngle += dt * 0.03;
  for (const e of radar.echoes) e.life -= dt;
  radar.echoes = radar.echoes.filter((e) => e.life > 0 || radar.full);
}

function ping() {
  const lie = radar.lies.shift();
  const echoes = lie ?? 0;
  play('sonar_ping', { echoes: Math.min(echoes, 30) });
  if (lie === undefined) return;
  if (echoes > 10) radar.full = true;
  for (let i = 0; i < echoes; i++) {
    radar.echoes.push({ angle: rand(0, Math.PI * 2), dist: rand(0.25, 0.95), life: config.ui.radar.sweepSeconds });
  }
}

export function draw(ctx, view) {
  if (!state.started) return;
  drawGauge(ctx, view);
  if (state.showBattery) drawBattery(ctx, view);
  if (state.showRadar) drawRadar(ctx, view);
  if (state.endText) {
    ctx.save();
    ctx.font = `13px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(200, 212, 216, 0.75)';
    ctx.fillText(state.endText, view.w - 24, view.h - 24);
    ctx.restore();
  }
}

function gaugeText() {
  const real = String(Math.floor(state.depth)).padStart(4, '0');
  switch (state.gaugeMode) {
    case 'flicker':
      return [...real].map((c) => (Math.random() < 0.18 ? String(Math.floor(Math.random() * 10)) : c)).join('') + ' m';
    case 'error':
      return Math.random() < 0.85 ? 'ERROR' : real + ' m';
    case 'dashes':
      return '---- m';
    default:
      return `${real} m`;
  }
}

function drawGauge(ctx, view) {
  const g = config.ui.gauge;
  ctx.save();
  ctx.font = `${g.fontSize}px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = g.color;
  ctx.shadowColor = g.shadowColor;
  ctx.shadowBlur = g.shadowBlur;
  ctx.fillText(gaugeText(), g.margin, view.h - g.margin - (state.showBattery ? config.ui.battery.gap : 0));
  ctx.restore();
}

function drawBattery(ctx, view) {
  const b = config.ui.battery;
  const g = config.ui.gauge;
  const x = g.margin;
  const y = view.h - g.margin - b.height + 2;
  const level = Math.max(0, state.light.battery);
  ctx.save();
  ctx.strokeStyle = 'rgba(225, 242, 248, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, b.width, b.height);
  ctx.fillStyle = 'rgba(225, 242, 248, 0.6)';
  ctx.fillRect(x + b.width + 1, y + b.height * 0.25, 2, b.height * 0.5);
  ctx.fillStyle = level < config.light.lowBattery ? 'rgba(230, 120, 100, 0.8)' : 'rgba(225, 242, 248, 0.7)';
  ctx.fillRect(x + 2, y + 2, Math.max(0, (b.width - 3) * level), b.height - 3);
  ctx.restore();
}

function drawRadar(ctx, view) {
  const r = config.ui.radar;
  const cx = view.w - r.margin - r.radius;
  const cy = view.h - r.margin - r.radius;
  ctx.save();
  ctx.strokeStyle = 'rgba(150, 230, 190, 0.25)';
  ctx.lineWidth = 1;
  for (const k of [1, 0.6, 0.25]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r.radius * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Sweep with a fading trail
  const a = radar.angle % (Math.PI * 2);
  for (let i = 0; i < 12; i++) {
    const t = a - i * 0.04;
    ctx.strokeStyle = `rgba(150, 230, 190, ${0.6 * (1 - i / 12)})`;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(t) * r.radius, cy + Math.sin(t) * r.radius);
    ctx.stroke();
  }
  // The one slow blip, closer and closer through Act 3–4
  const dist = lerp(0.92, 0.1, ramp(state.depth, config.beats.flashlight, config.beats.blackout));
  drawBlip(ctx, cx, cy, r.radius, radar.blipAngle, dist, a);
  for (const e of radar.echoes) drawBlip(ctx, cx, cy, r.radius, e.angle, e.dist, a);
  ctx.restore();
}

// Blips glow when the sweep passes, then fade.
function drawBlip(ctx, cx, cy, radius, angle, dist, sweep) {
  const since = (((sweep - angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const glow = Math.max(0.12, 1 - since / (Math.PI * 1.5));
  ctx.fillStyle = `rgba(170, 255, 200, ${glow * 0.9})`;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(angle) * radius * dist, cy + Math.sin(angle) * radius * dist, 2, 0, Math.PI * 2);
  ctx.fill();
}
