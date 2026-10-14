/** Give wheel notches and trackpad gestures one controlled selection at a time. */
export class DiscWheelInput {
  private lastEvent = -Infinity;
  private lastStep = -Infinity;
  private lastMagnitude = 0;
  private envelope = 0;
  private gesturePeak = 0;
  private stepMagnitude = 0;
  private eventsSinceStep = 0;
  private direction = 0;
  private distance = 0;
  private armed = true;

  reset(): void {
    this.lastEvent = -Infinity;
    this.lastStep = -Infinity;
    this.lastMagnitude = 0;
    this.envelope = 0;
    this.gesturePeak = 0;
    this.stepMagnitude = 0;
    this.eventsSinceStep = 0;
    this.direction = 0;
    this.distance = 0;
    this.armed = true;
  }

  step(delta: number, time: number): number {
    if (!Number.isFinite(delta) || !Number.isFinite(time)) return 0;
    if (time < this.lastEvent) this.reset();
    const gap = time - this.lastEvent;
    const previousEnvelope = this.envelope * Math.exp(-gap / 500);
    this.lastEvent = time;
    const magnitude = Math.abs(delta);
    this.envelope = Math.max(magnitude, previousEnvelope);
    // Even tiny momentum events keep the current gesture alive.
    if (magnitude < 0.3) return 0;

    const direction = Math.sign(delta);
    const fresh = gap >= 140 || direction !== this.direction;
    let contribution = magnitude;
    if (fresh) {
      this.gesturePeak = magnitude;
      this.distance = 0;
      this.armed = true;
    } else if (!this.armed) {
      this.eventsSinceStep += 1;
      const sinceStep = time - this.lastStep;
      // Mouse wheels produce sparse, similarly sized notches; a dense touchpad
      // burst cannot turn every repeated event into another selection.
      const notch = gap >= 32 && sinceStep >= 86 && this.eventsSinceStep <= 2
        && magnitude >= this.lastMagnitude * 0.96 && magnitude >= this.stepMagnitude * 0.9;
      const newFlick = sinceStep >= 170 && magnitude > previousEnvelope * 1.3
        && magnitude > this.lastMagnitude * 1.45;
      // Long, steady intentional scrolling may continue; decaying momentum may not.
      const sustained = sinceStep >= 520 && magnitude >= this.gesturePeak * 0.86
        && magnitude >= this.lastMagnitude * 0.97;
      if (notch || newFlick || sustained) {
        this.armed = true;
        this.distance = 0;
        if (newFlick && !notch && !sustained) contribution = magnitude - previousEnvelope;
      }
    }
    this.gesturePeak = Math.max(this.gesturePeak, magnitude);
    this.lastMagnitude = magnitude;
    this.direction = direction;
    if (!this.armed) return 0;
    this.distance += Math.min(contribution, 28);
    if (this.distance < 6) return 0;

    this.armed = false;
    this.distance = 0;
    this.lastStep = time;
    this.stepMagnitude = magnitude;
    this.eventsSinceStep = 0;
    return direction;
  }
}
