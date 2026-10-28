// Browser meta: persistence and fullscreen.

const KEY_REDUCE_FLASHING = 'lure.reduceFlashing';

export function loadReduceFlashing() {
  return read(KEY_REDUCE_FLASHING) === 'true';
}

export function saveReduceFlashing(on) {
  write(KEY_REDUCE_FLASHING, String(on));
}

// Requested on the start click. A refusal is ignored and the experience carries on windowed.
export function requestFullscreen() {
  const el = document.documentElement;
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!request) return;
  try {
    const result = request.call(el);
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {
    // not allowed here
  }
}

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked (private mode, disabled site data)
  }
}
