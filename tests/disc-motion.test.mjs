import assert from "node:assert/strict";
import test from "node:test";
import { advanceSpring } from "../app/os/WorkDisc/disc-motion.ts";

function settle(rate, initial = 0, target = Math.PI) {
  const spring = { value: initial, velocity: 0 };
  for (let frame = 0; frame < rate * 3; frame += 1) {
    advanceSpring(spring, target, 1 / rate);
    assert.ok(Number.isFinite(spring.value) && Number.isFinite(spring.velocity));
    assert.ok(spring.value >= -0.01 && spring.value <= Math.PI + 0.04, "flips remain controlled");
  }
  return spring;
}

test("disc flipping settles at the same face across refresh rates", () => {
  for (const rate of [30, 60, 120, 144]) {
    const spring = settle(rate);
    assert.equal(spring.value, Math.PI);
    assert.equal(spring.velocity, 0);
    assert.deepEqual(settle(rate, Math.PI, 0), { value: 0, velocity: 0 });
  }
});

test("changing flip direction mid-motion settles without losing control", () => {
  const spring = { value: 0, velocity: 0 };
  for (let frame = 0; frame < 12; frame += 1) advanceSpring(spring, Math.PI, 1 / 60);
  assert.ok(spring.value > 0 && spring.value < Math.PI);
  for (let frame = 0; frame < 180; frame += 1) advanceSpring(spring, 0, 1 / 60);
  assert.deepEqual(spring, { value: 0, velocity: 0 });
});

test("a delayed frame cannot throw the disc far past its target", () => {
  const spring = { value: 0, velocity: 0 };
  advanceSpring(spring, Math.PI, 10);
  assert.ok(spring.value > 0 && spring.value < Math.PI);
  for (let frame = 0; frame < 360; frame += 1) advanceSpring(spring, Math.PI, 1 / 120);
  assert.deepEqual(spring, { value: Math.PI, velocity: 0 });
});
