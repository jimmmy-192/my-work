export const DOCK_MAGNIFICATION_RADIUS = 145;
export const DOCK_MAX_SCALE = 1.72;
export const DOCK_ICON_SIZE = 49;

export interface DockMagnification {
  scale: number;
  expansion: number;
  labelScale: number;
  labelBottom: number;
  proximity: number;
}

/**
 * Maps pointer distance to a cosine-shaped Dock magnification curve.
 * The smooth ends keep the center stable and prevent neighboring icons
 * from snapping as they enter or leave the active radius.
 */
export function getDockMagnification(distance: number): DockMagnification {
  const normalized = Math.max(
    0,
    Math.min(1, 1 - Math.abs(distance) / DOCK_MAGNIFICATION_RADIUS),
  );
  const proximity = (1 - Math.cos(normalized * Math.PI)) / 2;
  const scale = 1 + (DOCK_MAX_SCALE - 1) * proximity;

  return {
    scale,
    expansion: (scale - 1) * DOCK_ICON_SIZE,
    labelScale: 1 / scale,
    labelBottom: DOCK_ICON_SIZE + 10 / scale,
    proximity,
  };
}
