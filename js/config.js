// Every tunable number lives here. Systems read from this object and never hard-code values.

export const config = {
  depth: {
    min: 0,
    max: 11000,
  },

  // Acts by depth (spec §5). metersPerScrollUnit is how far one scroll unit
  // (about one pixel of wheel or drag) carries the player, so each act can feel longer or shorter.
  // minActDuration: scrolling faster than this raises resistance. baseResistance/autoDrift apply all act long.
  acts: [
    { id: 'paradise', start: 0,     end: 200,   metersPerScrollUnit: 0.02, minActDuration: 75,  baseResistance: 0,    autoDrift: 0 },
    { id: 'off',      start: 200,   end: 1000,  metersPerScrollUnit: 0.13, minActDuration: 50,  baseResistance: 0,    autoDrift: 0 },
    { id: 'dark',     start: 1000,  end: 3500,  metersPerScrollUnit: 0.28, minActDuration: 80,  baseResistance: 0.1,  autoDrift: 0 },
    { id: 'relief',   start: 3500,  end: 4200,  metersPerScrollUnit: 0.15, minActDuration: 40,  baseResistance: 0.55, autoDrift: 0 },
    { id: 'trauma',   start: 4200,  end: 10900, metersPerScrollUnit: 0.55, minActDuration: 110, baseResistance: 0.55, autoDrift: 22 },
    { id: 'ending',   start: 10900, end: 11000, metersPerScrollUnit: 0.02, minActDuration: 0,   baseResistance: 0,    autoDrift: 0 },
  ],

  pacing: {
    slack: 0.06,              // how far (fraction of the act) depth may run ahead of time before resisting
    gain: 5,                  // resistance added per unit of overshoot
    max: 0.93,
    smoothing: 2,             // 1/s, how quickly pacing resistance follows its target
  },

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
    pxPerScrollUnit: 0.8,     // screen pixels the world moves per scroll unit (pxPerMeter = this / metersPerScrollUnit)
    lowFps: 42,               // below this for lowFpsSeconds, particle counts are reduced
    lowFpsSeconds: 3,
    lowQuality: 0.55,
  },

  // Background colors by depth (spec §6.4), interpolated between keyframes.
  palette: [
    { depth: 0,    top: '#9fe1f2', bottom: '#3bb3d6' },
    { depth: 50,   top: '#3bb3d6', bottom: '#1f7fa8' },
    { depth: 200,  top: '#1f7fa8', bottom: '#0f3a5c' },
    { depth: 1000, top: '#0b2236', bottom: '#071623' },
    { depth: 3000, top: '#060c13', bottom: '#04080d' },
  ],
  returning: {
    grey: 0.75,               // how much the returning visitor's shallow colors are desaturated
    darken: 0.45,
  },

  start: {
    fadeSeconds: 1.5,         // start screen fade-out after the click
    cameBackSeconds: 3,       // how long "you came back." holds before the fade
  },

  surface: {
    sky: ['#bfeaf6', '#9fe1f2'],
    returningSky: ['#6d7479', '#596066'],
    sunX: 0.72,
    sunY: 0.16,
    sunRadius: 46,
    waveAmp: 7,
    waveSpeed: 0.7,
    diveSeconds: 2.4,
    diveDepth: 12,
    gullInterval: [5, 11],    // seconds between distant gull calls
    fadeInSeconds: 2.5,
  },

  godRays: {
    count: 6,
    fullUntil: 80,
    goneAt: 400,
    alpha: 0.1,
    sway: 0.06,               // radians
    swaySpeed: 0.18,
  },

  particles: {
    bubbles: 42,
    bubbleMaxDepth: 200,
    bubbleRise: [26, 70],     // px/s
    popRadius: 24,
    snow: 150,
    snowFromDepth: 30,
    snowGlowAlpha: 0.22,      // faint snow that still shows through darkness
    diveBurst: 140,
    goneBurst: 26,
  },

  fish: {
    count: 80,
    mobileCount: 40,
    maxSpeed: 95,
    minSpeed: 30,
    neighborDist: 70,
    separationDist: 20,
    separation: 1.6,
    alignment: 0.9,
    cohesion: 0.55,
    cursorAttract: 0.35,
    scatterCursorSpeed: 1100, // px/s of cursor movement that scatters the school
    scatterForce: 9,
    edgeForce: 1.2,
    fleeSpeed: 1100,
    colors: ['#ffb347', '#ff7a8a', '#ffe066', '#7be0ad', '#8fd3ff', '#f7a6ff'],
  },

  companion: {
    glow: '#ffe9a8',
    radius: 7,
    glowRadius: 46,
    lag: { CUTE: 1.4, NERVOUS: 3.6, MIMIC: 3.6, PREEMPT: 4.2, HAPPY: 2.2, LURE: 0.4 },
    offset: { CUTE: 70, NERVOUS: 34, MIMIC: 30, PREEMPT: 26, HAPPY: 90 },
    bob: 6,
    jitter: { NERVOUS: 2.2, MIMIC: 1.4, PREEMPT: 1 },
    pulse: { CUTE: 1.1, NERVOUS: 3.2, MIMIC: 2.6, PREEMPT: 2.2, HAPPY: 0.8, LURE: 0.5 },
    loopSeconds: 1.6,
    loopInterval: [6, 12],
    chirpCooldown: 0.12,
    mimicDelay: 0.8,
    preemptFrom: 260,         // cursor px/s that counts as "moving"
    preemptTo: 45,            // ... and as "slowing to click"
    preemptCooldown: 2.5,
    swimInSeconds: 2.2,
    lureApproachSeconds: 11,
  },

  creatures: {
    whale: { seconds: 18, resistance: 0.6, resistSeconds: 6, color: '#173f5c' },
    silhouette: { seconds: 1.35, scales: [0.55, 0.85, 1.25] },
    eyes: {
      max: 3,
      color: '#cfe8c8',
      fadeSeconds: 0.15,
      respawn: [1.2, 3.2],
      approach: 0.18,         // fraction of the distance to the cursor gained per respawn
      creep: 9,               // px/s toward the cursor while unlit (weeping-angel rule)
      size: 3.2,
    },
    tentacle: { interval: [9, 16], seconds: 5, endDepth: 4200 },
    giantEye: { openSeconds: 6, watchSeconds: 8, closeSeconds: 3, iris: '#cfe8c8' },
  },

  props: {
    suit: { depth: 1300, x: 0.72 },
    faceRock: { depth: 1600, x: 0.28 },
    seafloorLight: { depth: 2000, x: 0.66 },
    rope: { depth: 2300, x: 0.45, slackDistance: 45, fallSpeed: 900 },
  },

  scratches: [
    { depth: 1100, x: 0.3, text: 'turn back' },
    { depth: 1800, x: 0.62, text: "don't follow the light" },
    { depth: 2600, x: 0.35, text: "it's not a fish" },
    { depth: 3000, x: 0.58, text: '{timeOfDay}' },
    { depth: 6200, x: 0.42, text: 'it was never a fish' },
  ],
  scratchStyle: { size: 26, jitter: 1.6, color: 'rgba(196, 204, 200, 0.42)' },
  timeOfDay: { lateFrom: 23, lateUntil: 5 },

  garden: {
    start: 3520,
    end: 4160,
    plants: 34,
    colors: ['#5ef2e6', '#9a7bff'],
    darkness: 0.72,           // darkness overlay strength while the garden glows
    lightsOutGap: [0.45, 0.85],
  },

  light: {
    radius: 170,
    feather: 0.45,
    wobble: 4,
    darkness: 0.975,
    darkFrom: 780,            // depth where the darkness overlay starts closing in
    batteryStart: 4200,
    batteryEnd: 10000,
    lowBattery: 0.2,
    lowRadius: 0.55,          // radius multiplier at 0% battery
    dipRate: [0.04, 0.7],     // flicker dips per second, shallow → deep
    maxDipsPerSecond: 3,
    dipDepth: 0.55,           // brightness lost at the bottom of a dip
    dipSeconds: 0.12,
    reducedDim: 0.82,         // steady brightness when flicker is reduced
    afterBlackoutBattery: 0.05,
  },

  effects: {
    grain: { surface: 0.03, deep: 0.1 },
    vignette: { surface: 0.22, deep: 0.82 },
    aberration: { from: 4200, max: 4 },
    cracks: { start: 6500, end: 9000, branches: 7 },
    glitch: { from: 4200, chance: 0.05, seconds: [0.1, 0.3] }, // chance per second, grows with depth
    staticAlpha: 0.32,
    shakeDecay: 6,
  },

  ghost: { delay: 0.6, mirrorSeconds: 12, holdSeconds: 2.5, driftSpeed: 22, touchRadius: 14 },
  cursorVanishSeconds: 4,

  ui: {
    gauge: {
      margin: 20,             // px from the bottom-left corner
      fontSize: 15,
      color: 'rgba(225, 242, 248, 0.78)',
      shadowColor: 'rgba(0, 16, 30, 0.45)',
      shadowBlur: 6,
    },
    battery: { width: 64, height: 6, gap: 12 },
    radar: { radius: 38, margin: 22, sweepSeconds: 4, color: 'rgba(150, 230, 190, 0.75)' },
    endText: 'thank you for following.',
  },

  // Beat depths (spec §7)
  beats: {
    companionIn: 15,
    whale: 150,
    fishFlee: 250,
    detuneFrom: 300,
    detuneTo: 1000,
    silhouettes: [450, 700, 900],
    flashlight: 1000,
    suit: 1300,
    noUp: 1500,
    eyes: 1600,
    hum: 2000,
    mimic: 2800,
    preempt: 3300,
    garden: 3500,
    lightsOut: 4000,
    trauma: 4200,
    ghost: 4300,
    sonarLies: 4600,
    knocks: 5000,
    surfaceBelow: 5500,
    otherBreath: 6000,
    gaugeGlitch: 7000,
    gaugeError: 8500,
    gaugeDashes: 9500,
    cursorVanish: 7500,
    staticWhisper: 8000,
    blackout: 10000,
    bottom: 10900,
  },

  audio: {
    masterGain: 0.7,
    limiter: { threshold: -6, ratio: 20, attack: 0.003, release: 0.25, knee: 0 },
    buses: { ambience: 0.8, music: 0.6, sfx: 0.85, spatial: 0.9 },
    cutoff: { air: 20000, dive: 1400, deep: 600, deepAt: 3000 },
    reverb: { seconds: 4.5, decay: 2.4, wetMin: 0.12, wetMax: 0.55 },
    idleAfter: 3,             // B13: seconds without input before the ambience drops away
    silenceSeconds: { fishFlee: 2, blackout: 8 },
    lullaby: { bpm: 84, gain: 0.2, tempoMin: 0.7, detuneMax: 45, detuneDeep: 90, dropoutMax: 0.22 },
    hum: { gain: 0.12, far: 14, near: 1.2 },
    drone: { gain: 0.16 },
    shepard: { gain: 0.07, seconds: 14 },
    waves: { gain: 0.32 },
    heartbeat: { from: 60, to: 140, gain: 0.5 },
    breath: { gain: 0.08, rate: [0.25, 0.75] },
    whisperInterval: [10, 20],
    knockGap: 1.6,
    nearSilenceSeconds: 10,
  },
};
