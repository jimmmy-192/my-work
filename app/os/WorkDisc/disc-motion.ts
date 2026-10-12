export interface SpringValue {
  value: number;
  velocity: number;
}

/** Substeps keep dragging and flipping consistent across display refresh rates. */
export function advanceSpring(
  spring: SpringValue,
  target: number,
  elapsed: number,
  stiffness = 140,
  damping = 22,
): boolean {
  const duration = Math.min(0.05, Math.max(0, elapsed));
  const steps = Math.max(1, Math.ceil(duration / (1 / 120)));
  const dt = duration / steps;
  for (let step = 0; step < steps; step += 1) {
    spring.velocity += (target - spring.value) * stiffness * dt;
    spring.velocity *= Math.exp(-damping * dt);
    spring.value += spring.velocity * dt;
  }
  const moving = Math.abs(target - spring.value) > 0.0002 || Math.abs(spring.velocity) > 0.002;
  if (!moving) {
    spring.value = target;
    spring.velocity = 0;
  }
  return moving;
}
