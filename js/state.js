// Global state shared by every system.

export const state = {
  started: false,       // true once the start screen is clicked
  paused: false,
  time: 0,              // seconds since the start click (stops while paused)
  depth: 0,             // camera depth in meters
  reduceFlashing: false,
  reducedMotion: false,
  isMobile: false,
  quality: 1,           // 0–1, particle and fish counts scale with this
  returning: false,     // came back after finishing: grey surface, no companion
  dived: false,
  view: { w: 0, h: 0, dpr: 1 },  // canvas size in CSS pixels

  darkness: 0,          // 0–1 strength of the darkness overlay
  light: {
    on: false,
    battery: 1,
    batteryOverride: null,  // fixed battery level after the blackout
    intensity: 1,         // 0–1 after flicker
    radius: 170,
    dead: false,          // ending: the flashlight never comes back
  },

  cursorHidden: false,
  gaugeMode: 'normal',  // normal | flicker | error | dashes
  showBattery: false,
  showRadar: false,
  shake: 0,
  fade: 0,              // 0–1 full-screen fade to the deep color (ending)
  endText: null,
};
