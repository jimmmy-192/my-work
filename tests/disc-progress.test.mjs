import assert from "node:assert/strict";
import test from "node:test";
import { DiscProgress } from "../app/os/WorkDisc/disc-progress.ts";

function run(progress, duration, rate = 60) {
  for (let frame = 0; frame < Math.round(duration * rate); frame += 1) {
    progress.advance(1 / rate);
    assert.ok(Number.isFinite(progress.value) && Number.isFinite(progress.velocity));
    assert.ok(progress.value >= -0.05000001 && progress.value <= 4.05000001);
  }
  return progress;
}

test("navigation has a nonlinear glide with source-specific timing and exact stops", () => {
  for (const [source, duration] of [["key", 0.47], ["wheel", 0.51], ["click", 0.56], ["snap", 0.46]]) {
    const progress = new DiscProgress(5);
    progress.select(1, source);
    assert.equal(progress.value, 0);
    assert.equal(progress.targetIndex, 1);
    assert.equal(progress.advance(duration / 2), true);
    assert.ok(progress.value > 0.65 && progress.value < 1, "glide leads, then decelerates");
    assert.equal(progress.advance(duration / 2), false);
    assert.equal(progress.value, 1);
    assert.equal(progress.velocity, 0);
  }
  const longerClick = new DiscProgress(5);
  longerClick.select(4, "click");
  assert.equal(longerClick.advance(0.56), true);
  assert.equal(longerClick.advance(0.34), false);
  assert.equal(longerClick.value, 4);
});

test("repeated navigation uses the pending index and redirects without a position jump", () => {
  const progress = new DiscProgress(5);
  progress.select(1);
  progress.advance(0.1);
  const before = progress.value;
  progress.select(progress.targetIndex + 1);
  assert.equal(progress.value, before);
  assert.equal(progress.targetIndex, 2);
  progress.advance(0.12);
  const redirected = progress.value;
  progress.select(0, "click");
  assert.equal(progress.value, redirected);
  assert.equal(progress.targetIndex, 0);
  run(progress, 2);
  assert.equal(progress.value, 0);
  assert.equal(progress.velocity, 0);
});

test("dragging interrupts navigation and remains stationary until release", () => {
  const progress = new DiscProgress(5);
  progress.select(4);
  progress.advance(0.1);
  progress.dragTo(1.34);
  assert.equal(progress.value, 1.34);
  assert.equal(progress.targetIndex, 1);
  assert.equal(progress.advance(1), false);
  assert.equal(progress.value, 1.34);
  progress.release(0);
  run(progress, 2);
  assert.equal(progress.value, 1);
  assert.equal(progress.velocity, 0);
});

test("mouse release glides freely with decreasing velocity before snapping", () => {
  const progress = new DiscProgress(5);
  progress.dragTo(1.45);
  progress.release(2);
  const initialVelocity = progress.velocity;
  progress.advance(0.1);
  assert.ok(progress.value > 1.45 && progress.value < 2);
  assert.ok(progress.velocity > 0 && progress.velocity < initialVelocity);
  progress.advance(0.1);
  assert.ok(progress.value > 1.6 && progress.value < 2, "release does not jump straight to its predicted integer");
  run(progress, 3);
  assert.equal(progress.value, 2);
  assert.equal(progress.targetIndex, 2);
  assert.equal(progress.velocity, 0);
});

test("touch flick chooses the next integer in its direction; cancellation adds no inertia", () => {
  for (const [value, speed, target] of [[1.1, 0.4, 2], [1.9, -0.4, 1], [2, 0.4, 3], [2, -0.4, 1], [1.2, 0.1, 1]]) {
    const progress = new DiscProgress(5);
    progress.dragTo(value);
    progress.release(speed, true);
    assert.equal(progress.targetIndex, target);
    run(progress, 1);
    assert.equal(progress.value, target);
    assert.equal(progress.velocity, 0);
  }
  const cancelled = new DiscProgress(5);
  cancelled.dragTo(1.4);
  cancelled.release(6, false, true);
  assert.equal(cancelled.targetIndex, 1);
  assert.equal(cancelled.velocity, 0);
  cancelled.advance(0.05);
  assert.ok(cancelled.value < 1.4, "cancelled swipe immediately returns instead of flicking onward");
  run(cancelled, 2);
  assert.equal(cancelled.value, 1);
});

test("elastic edges stay controlled and settle at the same integer across refresh rates", () => {
  for (const rate of [30, 60, 120, 144]) {
    for (const [value, speed, target] of [[-100, -6, 0], [100, 6, 4], [3.9, 6, 4], [0.1, -6, 0], [1.45, 2, 2]]) {
      const progress = new DiscProgress(5);
      progress.dragTo(value);
      assert.ok(progress.value >= -0.05 && progress.value <= 4.05);
      progress.release(speed);
      run(progress, 4, rate);
      assert.equal(progress.value, target);
      assert.equal(progress.targetIndex, target);
      assert.equal(progress.velocity, 0);
    }
  }
});

test("inertia and spring trajectories are independent of frame size", () => {
  const slow = new DiscProgress(5);
  const fast = new DiscProgress(5);
  for (const progress of [slow, fast]) {
    progress.dragTo(1.45);
    progress.release(2);
  }
  for (let frame = 0; frame < 15; frame += 1) {
    slow.advance(1 / 30);
    for (let part = 0; part < 4; part += 1) fast.advance(1 / 120);
    assert.ok(Math.abs(slow.value - fast.value) < 1e-9);
    assert.ok(Math.abs(slow.velocity - fast.velocity) < 1e-9);
  }
  run(slow, 2, 30);
  run(fast, 2, 120);
  assert.equal(slow.value, fast.value);
});

test("an inertial stop exactly between discs chooses the same side at every refresh rate", () => {
  const releaseSpeed = 2;
  const exactHalfwayStart = 1.5 - (releaseSpeed - 0.024) / (-Math.log(0.89) * 60);
  for (const rate of [30, 60, 120, 144]) {
    const progress = new DiscProgress(5);
    progress.dragTo(exactHalfwayStart);
    progress.release(releaseSpeed);
    run(progress, 4, rate);
    assert.equal(progress.value, 2);
    assert.equal(progress.targetIndex, 2);
    assert.equal(progress.velocity, 0);
  }
});

test("reduced motion stops each phase exactly and bad input cannot poison state", () => {
  for (const prepare of [
    progress => progress.select(3),
    progress => progress.dragTo(2.4),
    progress => { progress.dragTo(1.45); progress.release(2); },
    progress => { progress.dragTo(1.2); progress.release(0); },
  ]) {
    const progress = new DiscProgress(5);
    prepare(progress);
    assert.equal(progress.advance(1 / 60, true), false);
    assert.equal(progress.value, progress.targetIndex);
    assert.equal(progress.velocity, 0);
  }
  const progress = new DiscProgress(5, 100);
  assert.equal(progress.value, 4);
  for (const invalid of [NaN, Infinity, -Infinity]) {
    progress.dragTo(invalid);
    progress.select(invalid);
    progress.release(invalid);
    progress.advance(invalid);
    assert.equal(progress.value, 4);
    assert.equal(progress.velocity, 0);
  }
  progress.dragTo(0.8);
  progress.release(6);
  progress.advance(100);
  assert.ok(Number.isFinite(progress.value) && Number.isFinite(progress.velocity));
  run(progress, 2);
  assert.equal(progress.velocity, 0);
  const empty = new DiscProgress(0, 3);
  empty.select(99);
  assert.equal(empty.value, 0);
  assert.equal(empty.advance(1), false);
});
