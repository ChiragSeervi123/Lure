// Beat definitions (spec §7). Each fires once: by depth, by a `when()` check, or by fire(id).

import { config } from '../config.js';
import { state } from '../state.js';
import { rand, randRange } from '../math.js';
import { scroll } from '../input/scroll.js';
import { initAudio, preload, play } from '../audio/engine.js';
import { Lullaby } from '../audio/music.js';
import { fire, isFired, resist, heldResistance } from './director.js';
import { startDive, surfaceVisible } from '../render/layers/surface.js';
import { burst } from '../render/layers/particles.js';
import { spawnSchool } from '../render/layers/fish.js';
import { swimIn } from '../render/layers/companion.js';
import { startWhale } from '../render/layers/creatures.js';

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
];

// Continuous behavior between beats.
export function ongoing() {
  if (!state.started) return;

  if (surfaceVisible() && state.time > nextGull) {
    nextGull = state.time + randRange(config.surface.gullInterval);
    play('gulls', { bus: 'ambience' });
  }

  scroll.resistance = heldResistance();
}
