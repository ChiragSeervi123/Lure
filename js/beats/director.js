// Watches depth, time and flags; fires each beat once and runs timed sequences.

import { state } from '../state.js';
import { beats, ongoing } from './beats.js';

const fired = new Set();
const timers = [];
const holds = [];        // temporary resistance: { value, until }

export function fire(id) {
  if (fired.has(id)) return;
  const beat = beats.find((b) => b.id === id);
  if (!beat) return;
  fired.add(id);
  beat.run();
}

export function isFired(id) {
  return fired.has(id);
}

// Run fn after `seconds` of experience time (pauses with the pause menu).
export function after(seconds, fn) {
  timers.push({ at: state.time + seconds, fn });
}

// Hold resistance at least at `value` for `seconds`.
export function resist(value, seconds) {
  holds.push({ value, until: state.time + seconds });
}

export function heldResistance() {
  let r = 0;
  for (const h of holds) if (h.until > state.time) r = Math.max(r, h.value);
  return r;
}

export function updateDirector(dt) {
  for (let i = timers.length - 1; i >= 0; i--) {
    if (timers[i].at <= state.time) {
      const { fn } = timers[i];
      timers.splice(i, 1);
      fn();
    }
  }
  for (let i = holds.length - 1; i >= 0; i--) if (holds[i].until <= state.time) holds.splice(i, 1);

  for (const beat of beats) {
    if (fired.has(beat.id)) continue;
    const due = beat.when ? beat.when() : beat.depth !== undefined && state.depth >= beat.depth;
    if (due) {
      fired.add(beat.id);
      beat.run();
    }
  }

  ongoing(dt);
}
