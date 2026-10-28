// Beat definitions (spec §7). Each fires once: by depth, by a `when()` check, or by fire(id).

import { config } from '../config.js';
import { state } from '../state.js';
import { approach, clamp, lerp, rand, ramp, randRange } from '../math.js';
import { scroll, actIndexAt } from '../input/scroll.js';
import { audio, initAudio, preload, play, absoluteSilence, duck } from '../audio/engine.js';
import { Lullaby } from '../audio/music.js';
import { fire, isFired, after, resist, heldResistance } from './director.js';
import { startDive, surfaceVisible } from '../render/layers/surface.js';
import { burst } from '../render/layers/particles.js';
import { spawnSchool, flee } from '../render/layers/fish.js';
import { swimIn, setMode } from '../render/layers/companion.js';
import { startWhale, spawnSilhouette, setEyes, setTentacles } from '../render/layers/creatures.js';

const B = config.beats;

export const SOUND_NAMES = [
  'waves', 'gulls', 'splash', 'bubble_pop', 'chirp', 'chirp_corrupt', 'whale_call', 'whoosh', 'drone_low', 'groan',
  'shepard_down', 'creak', 'breath_helmet', 'breath_other', 'heartbeat', 'sonar_ping', 'whisper', 'warm_pad', 'chime',
  'thud', 'knock', 'glass_crack', 'radio_static', 'flashlight_click', 'growl', 'scream', 'sub_boom', 'rumble',
];

// Long-running sounds shared between beats.
export const sounds = {
  waves: null,
  lullaby: null,
  drone: null,
};

let nextGull = 0;

export const beats = [
  // B01: start click
  {
    id: 'B01',
    run() {
      initAudio();
      preload(SOUND_NAMES);
      sounds.waves = play('waves', { bus: 'ambience', loop: true, fadeIn: config.surface.fadeInSeconds });
      sounds.lullaby = new Lullaby();
      if (state.returning) sounds.lullaby.detune = config.audio.lullaby.detuneMax;
      sounds.lullaby.start(config.surface.fadeInSeconds);
      nextGull = state.time + 2;
      scroll.locked = true;
      scroll.onInput = (units) => {
        if (units > 0 && !isFired('B02')) fire('B02');
      };
    },
  },

  // B02: first scroll, the dive
  {
    id: 'B02',
    run() {
      startDive({
        onSplash() {
          state.dived = true;
          play('splash');
          const { w, h } = state.view;
          for (let i = 0; i < 9; i++) burst(rand(0, w), rand(h * 0.45, h * 1.05), config.particles.diveBurst / 9, { spread: 70, rise: [120, 320], size: [2, 7], life: [1, 2.6] });
          sounds.waves?.stop(1.5);
          sounds.waves = play('waves', { bus: 'ambience', loop: true, gain: config.audio.waves.gain * 0.4, fadeIn: 2 });
        },
        onDone() {
          scroll.locked = false;
          spawnSchool();
        },
      });
    },
  },

  // B03: the companion swims in
  {
    id: 'B03',
    depth: B.companionIn,
    run() {
      if (!state.returning) swimIn();
    },
  },

  // B05: whale pass
  {
    id: 'B05',
    depth: B.whale,
    run() {
      startWhale();
      resist(config.creatures.whale.resistance, config.creatures.whale.resistSeconds);
      play('whale_call', { bus: 'ambience' });
    },
  },

  // B06: fish flee, then 2 s of total silence, then everything carries on as if nothing happened
  {
    id: 'B06',
    depth: B.fishFlee,
    run() {
      flee();
      play('whoosh');
      after(0.8, () => absoluteSilence(config.audio.silenceSeconds.fishFlee));
      setMode('NERVOUS');
    },
  },

  // B07: low drone fades in while the lullaby detunes (mapped in ongoing)
  {
    id: 'B07',
    depth: B.detuneFrom,
    run() {
      sounds.drone = play('drone_low', { bus: 'ambience', gain: 0, fadeIn: 0.1 });
    },
  },

  // B08: edge silhouettes, each bigger and closer
  ...B.silhouettes.map((depth, i) => ({
    id: `B08.${i + 1}`,
    depth,
    run() {
      spawnSilhouette(i);
      play('groan', { bus: 'ambience', gain: 0.16 + i * 0.06 });
    },
  })),

  // B09: darkness; the flashlight clicks on, the Shepard tone starts, the radar appears
  {
    id: 'B09',
    depth: B.flashlight,
    run() {
      play('flashlight_click');
      state.light.on = true;
      state.showRadar = true;
      sounds.shepard = play('shepard_down', { bus: 'ambience' });
      sounds.breath = play('breath_helmet', { bus: 'sfx' });
      nextWhisper = state.time + randRange(config.audio.whisperInterval);
    },
  },

  // B12: no more scrolling up. Trying creaks the hull and nudges you down.
  {
    id: 'B12',
    depth: B.noUp,
    run() {
      scroll.allowUp = false;
      scroll.onBlockedUp = () => play('creak', { gain: 0.07 });
    },
  },

  // B15: eyes and the tentacle begin
  {
    id: 'B15',
    depth: B.eyes,
    run() {
      setEyes(true);
      setTentacles(true);
    },
  },

  // B16: someone humming the lullaby, very faint and far below
  {
    id: 'B16',
    depth: B.hum,
    run() {
      const h = config.audio.hum;
      sounds.hum = new Lullaby({ hummed: true, position: [0, -h.far, -0.5], gain: h.gain * 0.3 });
      sounds.hum.tempo = config.audio.lullaby.tempoMin;
      sounds.hum.start(8);
    },
  },

  // Heartbeat, faint at first (ramps up in Act 4)
  {
    id: 'B31.0',
    depth: 2500,
    run() {
      sounds.heart = play('heartbeat', { bus: 'sfx', gain: config.audio.heartbeat.gain * 0.4, bpm: config.audio.heartbeat.from });
    },
  },

  { id: 'B18', depth: B.mimic, run: () => setMode('MIMIC') },
  { id: 'B19', depth: B.preempt, run: () => setMode('PREEMPT') },
];

// --- continuous behavior between beats -------------------------------------------

let actIndex = -1;
let actEnter = 0;
let pace = 0;
let lullabyGain = config.audio.lullaby.gain;

export function ongoing(dt) {
  if (!state.started) return;

  if (surfaceVisible() && state.time > nextGull) {
    nextGull = state.time + randRange(config.surface.gullInterval);
    play('gulls', { bus: 'ambience' });
  }

  updatePacing(dt);
  updateMusic();
  updateDark(dt);
  updateBody();
  updateIdle();
}

let nextWhisper = Infinity;
let idle = false;
const busLevel = { ambience: 1, music: 1, sfx: 1 };

function setBus(name, level, seconds) {
  if (Math.abs(busLevel[name] - level) < 0.01) return;
  busLevel[name] = level;
  duck(name, level, seconds);
}

// Darkness closes in toward 1,000 m; the battery drains through Act 4.
function updateDark(dt) {
  const l = config.light;
  let target = l.darkness * ramp(state.depth, l.darkFrom, B.flashlight);
  if (darknessOverride !== null) target = darknessOverride;
  state.darkness = approach(state.darkness, target, 1.5, dt);
  state.light.battery = state.light.batteryOverride ?? 1 - ramp(state.depth, l.batteryStart, l.batteryEnd);
}

// Breathing follows scroll speed and the heart; whispers circle the head now and then.
function updateBody() {
  const a = config.audio;
  const fear = ramp(state.depth, B.trauma, B.blackout);
  if (sounds.breath) {
    sounds.breath.set('rate', lerp(a.breath.rate[0], a.breath.rate[1], Math.max(scroll.scrollSpeed, fear * 0.8)));
    sounds.breath.set('ragged', ramp(state.depth, 6000, B.blackout));
  }
  if (sounds.heart) sounds.heart.set('bpm', lerp(a.heartbeat.from, a.heartbeat.to, fear));
  if (sounds.hum) {
    const near = ramp(state.depth, B.hum, B.blackout);
    sounds.hum.setPosition([0, -lerp(a.hum.far, a.hum.near, near), -0.4]);
  }
  if (state.light.on && state.time > nextWhisper) {
    nextWhisper = state.time + randRange(a.whisperInterval);
    play('whisper', { position: 'left', seconds: rand(3, 5), gain: 0.18 });
  }
}

// B13: in the dark, stop scrolling for 3 s and everything goes quiet except breathing, close by.
function updateIdle() {
  if (state.depth < B.flashlight || scroll.locked) return;
  const wantIdle = scroll.idleTime > config.audio.idleAfter;
  if (wantIdle && !idle) {
    idle = true;
    sounds.idleBreath = play('breath_other', { position: 'close', gain: 0.07 });
  } else if (!wantIdle && idle) {
    idle = false;
    sounds.idleBreath?.stop(0.4);
  }
  const quiet = idle || nearSilence;
  setBus('ambience', quiet ? 0 : 1, quiet ? 1.2 : 0.6);
  setBus('music', quiet ? 0 : 1, quiet ? 1.2 : 0.6);
  setBus('sfx', quiet ? 0.12 : 1, quiet ? 1.2 : 0.6);
}

let darknessOverride = null;
let nearSilence = false;

// Each act has a minimum duration: running ahead of it raises resistance (spec §5).
function updatePacing(dt) {
  if (!state.dived) return;
  const i = actIndexAt(state.depth);
  if (i > actIndex) {
    actIndex = i;
    actEnter = state.time;
  }
  const act = config.acts[i];
  const p = config.pacing;
  let target = 0;
  if (act.minActDuration > 0) {
    const progress = (state.depth - act.start) / (act.end - act.start);
    const elapsed = (state.time - actEnter) / act.minActDuration;
    target = clamp((progress - elapsed - p.slack) * p.gain, 0, p.max);
  }
  pace = approach(pace, target, p.smoothing, dt);
  scroll.resistance = Math.max(heldResistance(), act.baseResistance, pace);
  scroll.autoDrift = scroll.locked ? 0 : act.autoDrift;
}

function updateMusic() {
  const a = config.audio;
  const d = state.depth;
  const box = sounds.lullaby;
  if (box) {
    const base = state.returning ? a.lullaby.detuneMax : 0;
    box.tempo = lerp(1, a.lullaby.tempoMin, ramp(d, B.detuneFrom, B.detuneTo));
    box.detune = Math.max(base, lerp(0, a.lullaby.detuneMax, ramp(d, B.detuneFrom, B.detuneTo)));
    box.dropout = lerp(0, a.lullaby.dropoutMax, ramp(d, 600, B.detuneTo));
    const gain = a.lullaby.gain * (1 - ramp(d, B.flashlight, 1500));
    if (Math.abs(gain - lullabyGain) > 0.004) {
      lullabyGain = gain;
      box.setGain(gain, 0.4);
    }
  }
  if (sounds.drone && audio.ctx) {
    sounds.drone.gain.gain.setTargetAtTime(a.drone.gain * ramp(d, B.detuneFrom, B.detuneTo), audio.ctx.currentTime, 0.5);
  }
}
