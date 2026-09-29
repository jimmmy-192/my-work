export const DOCK_MAGNIFICATION_RADIUS = 145;
export const DOCK_MAX_SCALE = 1.9;
export const DOCK_ICON_SIZE = 56;
export const DOCK_MIN_SIZE = 40;
export const DOCK_MAX_SIZE = 72;

export interface DockMagnification {
  scale: number;
  expansion: number;
  labelScale: number;
  labelBottom: number;
  proximity: number;
}

export interface DockMotion {
  value: number;
  velocity: number;
}

/** Critically damped motion, integrated analytically for any display refresh rate. */
export function advanceDockMotion(
  current: DockMotion,
  target: number,
  elapsedSeconds: number,
  returning = false,
): DockMotion {
  // Reach ~95% in 300ms on entry and 430ms on exit. Preserve velocity
  // when the pointer changes direction so a quick reentry never snaps.
  const frequency = returning ? 11 : 16;
  const elapsed = Math.max(0, Math.min(elapsedSeconds, 0.064));
  const displacement = current.value - target;
  const momentum = current.velocity + frequency * displacement;
  const decay = Math.exp(-frequency * elapsed);
  const value = target + (displacement + momentum * elapsed) * decay;
  const velocity = (current.velocity - frequency * momentum * elapsed) * decay;

  if (value < 0 || value > 1) return { value: Math.max(0, Math.min(1, value)), velocity: 0 };
  if (Math.abs(value - target) < 0.0001 && Math.abs(velocity) < 0.001) {
    return { value: target, velocity: 0 };
  }
  return { value, velocity };
}

export function getDockMagnificationForProximity(value: number, iconSize = DOCK_ICON_SIZE): DockMagnification {
  const proximity = Math.max(0, Math.min(1, value));
  const scale = 1 + (DOCK_MAX_SCALE - 1) * proximity;
  return {
    scale,
    expansion: (scale - 1) * iconSize,
    labelScale: 1 / scale,
    labelBottom: iconSize + 10 / scale,
    proximity,
  };
}

/**
 * Maps pointer distance to a cosine-shaped Dock magnification curve.
 * The smooth ends keep the center stable and prevent neighboring icons
 * from snapping as they enter or leave the active radius.
 */
export function getDockMagnification(distance: number, iconSize = DOCK_ICON_SIZE): DockMagnification {
  const normalized = Math.max(
    0,
    Math.min(1, 1 - Math.abs(distance) / (DOCK_MAGNIFICATION_RADIUS * iconSize / DOCK_ICON_SIZE)),
  );
  const proximity = (1 - Math.cos(normalized * Math.PI)) / 2;
  return getDockMagnificationForProximity(proximity, iconSize);
}
