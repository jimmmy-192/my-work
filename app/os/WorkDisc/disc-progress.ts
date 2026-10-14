export type DiscNavigationSource = "wheel" | "key" | "click" | "snap";

type ProgressMode = "idle" | "tween" | "drag" | "inertia" | "snap";

const ELASTIC_EDGE = 0.05;
const INERTIA_DAMPING = -Math.log(0.89) * 60;
const INERTIA_END_SPEED = 0.024;
const TOUCH_FLICK_SPEED = 0.35;
const SNAP_FREQUENCY = 9.5;
const SNAP_DAMPING = 12;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Solve the original glide curve in time, rather than treating its handles as samples. */
function glide(progress: number): { value: number; slope: number } {
  if (progress <= 0) return { value: 0, slope: 2.25 };
  if (progress >= 1) return { value: 1, slope: 0 };
  let lower = 0;
  let upper = 1;
  let parameter = progress;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const x = parameter * (0.96 + parameter * (-1.92 + parameter * 1.96));
    const difference = x - progress;
    if (Math.abs(difference) < 1e-8) break;
    if (difference < 0) lower = parameter; else upper = parameter;
    const derivative = 0.96 + parameter * (-3.84 + parameter * 5.88);
    const candidate = parameter - difference / derivative;
    parameter = candidate > lower && candidate < upper ? candidate : (lower + upper) / 2;
  }
  return {
    value: parameter * (2.16 + parameter * (-1.32 + parameter * 0.16)),
    slope: (2.16 + parameter * (-2.64 + parameter * 0.48))
      / (0.96 + parameter * (-3.84 + parameter * 5.88)),
  };
}

/** Position is measured in disc indices; velocity is measured in indices per second. */
export class DiscProgress {
  value: number;
  velocity = 0;
  targetIndex: number;
  private readonly lastIndex: number;
  private mode: ProgressMode = "idle";
  private tweenFrom = 0;
  private tweenDuration = 0;
  private tweenElapsed = 0;

  constructor(count: number, initial = 0) {
    this.lastIndex = Math.max(0, Math.floor(Number.isFinite(count) ? count : 1) - 1);
    this.targetIndex = this.index(initial);
    this.value = this.targetIndex;
  }

  private index(value: number): number {
    // Resolve exact half-index stops consistently despite floating-point accumulation.
    return clamp(Number.isFinite(value) ? Math.floor(value + 0.5 + 1e-9) : 0, 0, this.lastIndex);
  }

  private finish(): void {
    this.value = this.targetIndex;
    this.velocity = 0;
    this.mode = "idle";
  }

  private startTween(index: number, duration: number): void {
    this.targetIndex = this.index(index);
    this.tweenFrom = this.value;
    this.tweenDuration = duration;
    this.tweenElapsed = 0;
    this.velocity = 0;
    this.mode = "tween";
    if (Math.abs(this.value - this.targetIndex) < 1e-8) this.finish();
  }

  select(index: number, source: DiscNavigationSource = "key"): void {
    const target = this.index(Number.isFinite(index) ? index : this.targetIndex);
    const distance = Math.abs(target - this.value);
    const duration = source === "wheel" ? 0.51
      : source === "click" ? clamp(0.45 + distance * 0.11, 0.46, 1.05)
      : source === "key" ? clamp(0.42 + distance * 0.05, 0.47, 0.6)
      : 0.46;
    this.startTween(target, duration);
  }

  dragTo(value: number): void {
    if (!Number.isFinite(value)) return;
    this.value = clamp(value, -ELASTIC_EDGE, this.lastIndex + ELASTIC_EDGE);
    this.velocity = 0;
    this.targetIndex = this.index(this.value);
    this.mode = "drag";
  }

  private startSnap(velocity = this.velocity): void {
    this.targetIndex = this.index(this.value);
    this.velocity = velocity;
    this.mode = "snap";
    if (Math.abs(this.value - this.targetIndex) < 0.0008 && Math.abs(this.velocity) < 0.004) this.finish();
  }

  release(velocity: number, touch = false, cancelled = false): void {
    const speed = clamp(Number.isFinite(velocity) ? velocity : 0, -6, 6);
    if (cancelled) {
      this.startSnap(0);
    } else if (touch) {
      const next = speed >= TOUCH_FLICK_SPEED ? Math.floor(this.value) + 1
        : speed <= -TOUCH_FLICK_SPEED ? Math.ceil(this.value) - 1
        : Math.round(this.value);
      this.startTween(next, 0.56);
    } else if (Math.abs(speed) > INERTIA_END_SPEED) {
      this.velocity = speed;
      this.targetIndex = this.index(this.value);
      this.mode = "inertia";
    } else {
      this.startSnap(0);
    }
  }

  advance(dt: number, reduced = false): boolean {
    if (reduced) {
      this.finish();
      return false;
    }
    if (!Number.isFinite(dt) || dt <= 0) return this.mode !== "idle" && this.mode !== "drag";
    let remaining = dt;

    // A frame may finish inertia and start snapping; consume the remainder in its new phase.
    for (let phase = 0; phase < 3 && remaining > 0; phase += 1) {
      if (this.mode === "idle" || this.mode === "drag") break;

      if (this.mode === "tween") {
        const step = Math.min(remaining, this.tweenDuration - this.tweenElapsed);
        this.tweenElapsed += step;
        remaining -= step;
        const curve = glide(this.tweenElapsed / this.tweenDuration);
        const distance = this.targetIndex - this.tweenFrom;
        this.value = this.tweenFrom + distance * curve.value;
        this.velocity = distance * curve.slope / this.tweenDuration;
        if (this.tweenElapsed >= this.tweenDuration - 1e-9) this.finish();
        continue;
      }

      if (this.mode === "inertia") {
        const slowTime = Math.max(0, Math.log(Math.abs(this.velocity) / INERTIA_END_SPEED) / INERTIA_DAMPING);
        const boundary = this.velocity > 0 ? this.lastIndex + ELASTIC_EDGE : -ELASTIC_EDGE;
        const fraction = (boundary - this.value) * INERTIA_DAMPING / this.velocity;
        const boundaryTime = fraction <= 0 ? 0
          : fraction < 1 ? -Math.log1p(-fraction) / INERTIA_DAMPING : Infinity;
        const step = Math.min(remaining, slowTime, boundaryTime);
        const decay = Math.exp(-INERTIA_DAMPING * step);
        this.value = clamp(
          this.value + this.velocity * (1 - decay) / INERTIA_DAMPING,
          -ELASTIC_EDGE, this.lastIndex + ELASTIC_EDGE,
        );
        this.velocity *= decay;
        this.targetIndex = this.index(this.value);
        remaining -= step;
        if (step >= boundaryTime - 1e-9) this.startSnap(0);
        else if (step >= slowTime - 1e-9) this.startSnap();
        continue;
      }

      // The closed-form underdamped spring gives the same feel at every refresh rate.
      const damping = SNAP_DAMPING / 2;
      const frequency = Math.sqrt(SNAP_FREQUENCY * SNAP_FREQUENCY - damping * damping);
      const decay = Math.exp(-damping * remaining);
      const cosine = Math.cos(frequency * remaining);
      const sine = Math.sin(frequency * remaining);
      const displacement = this.value - this.targetIndex;
      const speed = this.velocity;
      this.value = this.targetIndex + decay * (
        displacement * cosine + (speed + damping * displacement) / frequency * sine
      );
      this.velocity = decay * (
        speed * cosine - (damping * speed + SNAP_FREQUENCY * SNAP_FREQUENCY * displacement) / frequency * sine
      );
      const bounded = clamp(this.value, -ELASTIC_EDGE, this.lastIndex + ELASTIC_EDGE);
      if (bounded !== this.value) {
        this.value = bounded;
        this.velocity = 0;
      }
      remaining = 0;
      if (Math.abs(this.value - this.targetIndex) < 0.0008 && Math.abs(this.velocity) < 0.004) this.finish();
    }
    return this.mode !== "idle" && this.mode !== "drag";
  }
}
