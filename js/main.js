// Boot, start screen and main loop.

import { config } from './config.js';
import { state } from './state.js';
import { initScroll, updateScroll } from './input/scroll.js';
import { initRenderer, render } from './render/renderer.js';
import { loadReduceFlashing, saveReduceFlashing, requestFullscreen } from './meta/browser.js';
import { initAudio, preload, play, update as updateAudio } from './audio/engine.js';
import { Lullaby } from './audio/music.js';

const SOUNDS = ['waves', 'splash', 'bubble_pop', 'chirp', 'chirp_corrupt'];

let lastFrame = null;

initRenderer(document.getElementById('stage'));
initScroll();
initStartScreen();
requestAnimationFrame(frame);

function frame(now) {
  const dt = lastFrame === null ? 0 : Math.min((now - lastFrame) / 1000, config.render.maxFrameDt);
  lastFrame = now;

  if (state.started) state.time += dt;
  updateScroll(dt);
  updateAudio(dt);
  render(dt);

  requestAnimationFrame(frame);
}

// B00: start screen with the reduce-flashing toggle.
function initStartScreen() {
  const screen = document.getElementById('start');
  const toggle = document.getElementById('reduce-flashing');

  state.reduceFlashing = loadReduceFlashing();
  toggle.setAttribute('aria-pressed', String(state.reduceFlashing));

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    state.reduceFlashing = !state.reduceFlashing;
    toggle.setAttribute('aria-pressed', String(state.reduceFlashing));
    saveReduceFlashing(state.reduceFlashing);
  });

  screen.addEventListener('click', () => begin(screen), { once: true });
}

// B01: audio context, fullscreen, fade in the surface.
function begin(screen) {
  initAudio();
  preload(SOUNDS);
  requestFullscreen();
  state.started = true;

  play('waves', { bus: 'ambience', loop: true });
  new Lullaby().start();
  window.addEventListener('pointerdown', () => play('chirp'));

  document.activeElement?.blur();
  screen.inert = true;
  screen.style.transitionDuration = `${config.start.fadeSeconds}s`;
  screen.classList.add('is-leaving');
  setTimeout(() => {
    screen.hidden = true;
  }, config.start.fadeSeconds * 1000);
}
