// Boot, start screen and main loop.

import { config } from './config.js';
import { state } from './state.js';
import { initScroll, updateScroll } from './input/scroll.js';
import { initPointer, updatePointer } from './input/pointer.js';
import { initRenderer, render } from './render/renderer.js';
import { initCompanion } from './render/layers/companion.js';
import { loadReduceFlashing, saveReduceFlashing, requestFullscreen } from './meta/browser.js';
import { update as updateAudio } from './audio/engine.js';
import { fire, updateDirector } from './beats/director.js';

let lastFrame = null;

state.isMobile = matchMedia('(pointer: coarse)').matches;
state.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

initRenderer(document.getElementById('stage'));
initScroll();
initPointer();
initCompanion();
initStartScreen();
requestAnimationFrame(frame);

function frame(now) {
  const dt = lastFrame === null ? 0 : Math.min((now - lastFrame) / 1000, config.render.maxFrameDt);
  lastFrame = now;

  if (state.started) {
    state.time += dt;
    updateDirector(dt);
  }
  updateScroll(dt);
  updatePointer(dt);
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

function begin(screen) {
  requestFullscreen();
  state.started = true;
  document.body.classList.add('playing');
  fire('B01');

  document.activeElement?.blur();
  screen.inert = true;
  screen.style.transitionDuration = `${config.start.fadeSeconds}s`;
  screen.classList.add('is-leaving');
  setTimeout(() => {
    screen.hidden = true;
  }, config.start.fadeSeconds * 1000);
}
