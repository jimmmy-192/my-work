import assert from "node:assert/strict";
import test from "node:test";
import { DiscWheelInput } from "../app/os/WorkDisc/disc-wheel.ts";

test("a wheel flick advances once despite a long decaying momentum tail", () => {
  const input = new DiscWheelInput();
  const steps = [];
  for (let frame = 0; frame < 70; frame += 1) steps.push(input.step(60 * Math.exp(-frame / 12), frame * 16));
  assert.deepEqual(steps.filter(Boolean), [1]);
});

test("fresh gestures and reversing direction can navigate again", () => {
  const input = new DiscWheelInput();
  assert.equal(input.step(45, 0), 1);
  assert.equal(input.step(25, 16), 0);
  assert.equal(input.step(-40, 32), -1);
  assert.equal(input.step(-40, 400), -1);
});

test("continuous deliberate scrolling progresses and invalid noise does not", () => {
  const input = new DiscWheelInput();
  assert.equal(input.step(NaN, 0), 0);
  assert.equal(input.step(0.01, 1), 0);
  const steps = [];
  for (let frame = 0; frame < 90; frame += 1) steps.push(input.step(30, frame * 16));
  assert.ok(steps.filter(Boolean).length > 1);
});

test("separate mouse-wheel notches respond without a long gesture cooldown", () => {
  const input = new DiscWheelInput();
  assert.deepEqual([0, 105, 210, 315].map((time) => input.step(100, time)), [1, 1, 1, 1]);
  assert.equal(input.step(-100, 325), -1, "reversal need not wait for the previous notch");
});

test("a light trackpad gesture accumulates promptly, then ignores its dense tail", () => {
  const input = new DiscWheelInput();
  assert.equal(input.step(3, 0), 0);
  assert.equal(input.step(3, 16), 1);
  const tail = [2.8, 2.6, 2.2, 1.8, 1.3, 0.8, 0.4, 0.2];
  assert.ok(tail.every((delta, index) => input.step(delta, 32 + index * 16) === 0));
});

test("a new trackpad flick is recognized before the old momentum has fully stopped", () => {
  const input = new DiscWheelInput();
  assert.equal(input.step(55, 0), 1);
  for (let frame = 1; frame < 15; frame += 1) {
    assert.equal(input.step(55 * Math.exp(-frame / 8), frame * 16), 0);
  }
  assert.equal(input.step(60, 240), 1);
  for (let frame = 1; frame < 30; frame += 1) {
    assert.equal(input.step(60 * Math.exp(-frame / 8), 240 + frame * 16), 0);
  }
});

test("small rebounds in a decaying trackpad tail do not look like fresh gestures", () => {
  const input = new DiscWheelInput();
  assert.equal(input.step(80, 0), 1);
  for (let frame = 1; frame <= 60; frame += 1) {
    const rebound = frame % 9 === 0 ? 1.18 : 1;
    assert.equal(input.step(80 * Math.exp(-frame / 10) * rebound, frame * 16), 0);
  }
});

test("direction reversal discards uncommitted distance and responds to the new direction", () => {
  const input = new DiscWheelInput();
  assert.equal(input.step(4, 0), 0);
  assert.equal(input.step(-3, 16), 0);
  assert.equal(input.step(-3, 32), -1);
  assert.equal(input.step(20, 40), 1);
});

test("huge events emit a single step, and a reset starts a fresh gesture", () => {
  const input = new DiscWheelInput();
  assert.equal(input.step(Number.MAX_VALUE, 0), 1);
  assert.equal(input.step(Number.MAX_VALUE, 16), 0);
  input.reset();
  assert.equal(input.step(20, 24), 1);
  assert.equal(input.step(20, Infinity), 0);
  assert.equal(input.step(Infinity, 32), 0);
});
