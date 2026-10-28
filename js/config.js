// Every tunable number lives here. Systems read from this object and never hard-code values.

export const config = {
  depth: {
    min: 0,
    max: 11000,
  },

  // Acts by depth (spec §5). metersPerScrollUnit is how far one scroll unit
  // (about one pixel of wheel or drag) carries the player, so each act can feel longer or shorter.
  acts: [
    { id: 'paradise', start: 0,     end: 200,   metersPerScrollUnit: 0.02 },
    { id: 'off',      start: 200,   end: 1000,  metersPerScrollUnit: 0.13 },
    { id: 'dark',     start: 1000,  end: 3500,  metersPerScrollUnit: 0.28 },
    { id: 'relief',   start: 3500,  end: 4200,  metersPerScrollUnit: 0.15 },
    { id: 'trauma',   start: 4200,  end: 10900, metersPerScrollUnit: 0.55 },
    { id: 'ending',   start: 10900, end: 11000, metersPerScrollUnit: 0.02 },
  ],

  scroll: {
    damping: 1.8,             // 1/s, how quickly momentum dies away (lower = longer glide)
    maxUnitsPerSecond: 3000,  // speed cap, in scroll units per second
    actBlend: 0.15,           // final fraction of each act that eases metersPerScrollUnit into the next act's
    wheelLinePx: 33,          // scroll units per wheel "line" (Firefox reports lines, not pixels)
    arrowUnits: 60,           // per arrow key press
    pageUnits: 500,           // per Space / PageDown press, and per wheel "page"
    touchMultiplier: 2,       // scroll units per pixel of touch drag
    blockedUpNudgeUnits: 25,  // downward nudge when an upward scroll is refused
    blockedUpCooldown: 0.6,   // seconds between nudges
  },

  render: {
    maxDpr: 2,
    maxFrameDt: 0.1,          // seconds; longer frames (tab switches, hitches) are clamped to this
  },

  // Background colors by depth (spec §6.4), interpolated between keyframes.
  palette: [
    { depth: 0,    top: '#9fe1f2', bottom: '#3bb3d6' },
    { depth: 50,   top: '#3bb3d6', bottom: '#1f7fa8' },
    { depth: 200,  top: '#1f7fa8', bottom: '#0f3a5c' },
    { depth: 1000, top: '#0b2236', bottom: '#071623' },
    { depth: 3000, top: '#060c13', bottom: '#04080d' },
  ],

  start: {
    fadeSeconds: 1.5,         // start screen fade-out after the click
  },

  ui: {
    gauge: {
      margin: 20,             // px from the bottom-left corner
      fontSize: 15,
      color: 'rgba(225, 242, 248, 0.78)',
      shadowColor: 'rgba(0, 16, 30, 0.45)',
      shadowBlur: 6,
    },
  },
};
