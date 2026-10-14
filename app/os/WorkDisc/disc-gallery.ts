export const DISC_COUNT = 5;
export const INITIAL_DISC_INDEX = 0;

export interface DiscPose {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scale: number;
}

export function clampDiscIndex(index: number, count = DISC_COUNT): number {
  const lastIndex = Math.max(0, Math.floor(Number.isFinite(count) ? count : DISC_COUNT) - 1);
  return Math.min(lastIndex, Math.max(0, Number.isFinite(index) ? Math.round(index) : 0));
}

/** A continuous arc lets every disc keep its place while selection passes between them. */
export function getDiscPose(offset: number, flow: number, compact = false): DiscPose {
  const position = Number.isFinite(offset) ? offset : 0;
  const speed = Number.isFinite(flow) ? Math.max(-6, Math.min(6, flow)) : 0;
  const theta = position * 0.35;
  const distanceSquared = position * position;
  const motionWeight = Math.exp(-distanceSquared * 0.14);
  const minimumScale = compact ? 0.76 : 0.8;
  const lean = Math.sign(speed) * Math.sqrt(Math.abs(speed)) * 0.055;
  const dip = Math.min(0.09, Math.abs(speed) * 0.014);

  return {
    x: Math.sin(theta) * (compact ? 4.7 : 5.52) * 1.08,
    y: 0.06 * Math.exp(-distanceSquared * 3) - dip * motionWeight,
    z: (1 - Math.cos(theta)) * 2.4,
    rotationX: 0,
    rotationY: -theta + lean * motionWeight,
    rotationZ: -lean * 0.32 * motionWeight,
    scale: Math.max(minimumScale, 1 - Math.abs(position) * (1 - minimumScale) * 0.6),
  };
}
