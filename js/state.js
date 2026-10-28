// Global state shared by every system.

export const state = {
  started: false,       // true once the start screen is clicked
  time: 0,              // seconds since the start click
  depth: 0,             // camera depth in meters
  reduceFlashing: false,
  view: { w: 0, h: 0, dpr: 1 },  // canvas size in CSS pixels
};
