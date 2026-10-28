// HRTF positioning: sounds from below, behind, around the head (spec §9.2).

export const POSITIONS = {
  below: [0, -4, -0.6],
  behind: [0, 0, 3],
  left: [-3, 0, 0],
  right: [3, 0, 0],
  front: [0, 0, -3],
  close: [0, 0.1, -0.35],
};

export function createPanner(ctx, position, out) {
  const panner = ctx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 1;
  panner.rolloffFactor = 1;
  setPosition(ctx, panner, position);
  panner.connect(out);
  return panner;
}

export function setPosition(ctx, panner, position) {
  const [x, y, z] = typeof position === 'string' ? POSITIONS[position] : position;
  if (panner.positionX) {
    const t = ctx.currentTime;
    panner.positionX.setTargetAtTime(x, t, 0.05);
    panner.positionY.setTargetAtTime(y, t, 0.05);
    panner.positionZ.setTargetAtTime(z, t, 0.05);
  } else {
    panner.setPosition(x, y, z);
  }
}

// Position on a circle around the head, for whispers that circle the listener.
export function orbitPosition(angle, radius, height = 0) {
  return [Math.sin(angle) * radius, height, -Math.cos(angle) * radius];
}
