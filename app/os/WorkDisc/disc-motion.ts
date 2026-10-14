export interface SpringValue {
  value: number;
  velocity: number;
}

export interface TweenValue {
  value: number;
  from: number;
  target: number;
  elapsed: number;
  duration: number;
  easing: "out" | "in-out";
}

export const createTween = (value = 0): TweenValue => ({
  value, from: value, target: value, elapsed: 0, duration: 0, easing: "out",
});

export function startTween(tween: TweenValue, target: number, duration: number, easing: TweenValue["easing"] = "out") {
  tween.from = tween.value;
  tween.target = target;
  tween.elapsed = 0;
  tween.duration = Math.max(0, duration);
  tween.easing = easing;
  if (!tween.duration) tween.value = target;
}

/** Flips have a measured start and finish; dragging can interrupt them at any angle. */
export function advanceTween(tween: TweenValue, elapsed: number, reduced = false): boolean {
  if (reduced || !tween.duration) {
    tween.value = tween.target;
    tween.duration = 0;
    return false;
  }
  tween.elapsed = Math.min(tween.duration, tween.elapsed + Math.max(0, Math.min(0.05, elapsed)));
  const t = tween.elapsed / tween.duration;
  const eased = tween.easing === "out" ? 1 - (1 - t) ** 4 : t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2;
  tween.value = tween.from + (tween.target - tween.from) * eased;
  if (t >= 1 - 1e-9) {
    tween.value = tween.target;
    tween.duration = 0;
    return false;
  }
  return true;
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
