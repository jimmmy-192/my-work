import assert from "node:assert/strict";
import test from "node:test";

import {
  DOCK_MAGNIFICATION_RADIUS,
  DOCK_ICON_SIZE,
  DOCK_MAX_SCALE,
  advanceDockMotion,
  getDockMagnification,
  getDockMagnificationForProximity,
} from "../app/os/dock-magnification.ts";

test("peaks under the pointer and keeps the tooltip visually stable", () => {
  const center = getDockMagnification(0);

  assert.equal(center.scale, DOCK_MAX_SCALE);
  assert.equal(center.proximity, 1);
  assert.ok(Math.abs(center.expansion - DOCK_ICON_SIZE * (DOCK_MAX_SCALE - 1)) < 0.000001);
  assert.ok(Math.abs(center.labelScale * center.scale - 1) < 0.000001);
});

test("falls off smoothly and symmetrically across neighboring icons", () => {
  const center = getDockMagnification(0);
  const neighbor = getDockMagnification(56);
  const secondNeighbor = getDockMagnification(112);

  assert.ok(center.scale > neighbor.scale);
  assert.ok(neighbor.scale > secondNeighbor.scale);
  assert.deepEqual(neighbor, getDockMagnification(-56));
  assert.deepEqual(secondNeighbor, getDockMagnification(-112));
});

test("returns to the resting state outside the active radius", () => {
  const edge = getDockMagnification(DOCK_MAGNIFICATION_RADIUS);
  const outside = getDockMagnification(DOCK_MAGNIFICATION_RADIUS * 3);

  assert.deepEqual(edge, outside);
  assert.equal(edge.scale, 1);
  assert.equal(edge.expansion, 0);
  assert.equal(edge.proximity, 0);
});

test("motion feels the same at 60 Hz and 120 Hz", () => {
  const sample = (fps) => {
    let motion = { value: 0, velocity: 0 };
    for (let frame = 0; frame < fps / 5; frame++) {
      motion = advanceDockMotion(motion, 1, 1 / fps);
    }
    return motion;
  };
  const standard = sample(60);
  const highRefresh = sample(120);
  assert.ok(standard.value > 0.8 && standard.value < 0.88);
  assert.ok(Math.abs(standard.value - highRefresh.value) < 1e-10);
  assert.ok(Math.abs(standard.velocity - highRefresh.velocity) < 1e-10);
});

test("entry eases into enlargement and exit has a longer, monotonic settling tail", () => {
  let entering = { value: 0, velocity: 0 };
  let leaving = { value: 1, velocity: 0 };
  const entry = [];
  const exit = [];
  for (let frame = 0; frame < 60; frame++) {
    const nextEntry = advanceDockMotion(entering, 1, 1 / 60);
    const nextExit = advanceDockMotion(leaving, 0, 1 / 60, true);
    assert.ok(nextEntry.value >= entering.value && nextEntry.value <= 1);
    assert.ok(nextExit.value <= leaving.value && nextExit.value >= 0);
    entering = nextEntry;
    leaving = nextExit;
    entry.push(entering.value);
    exit.push(leaving.value);
  }
  assert.ok(entry[0] < 0.05, "entry starts gently instead of jumping");
  assert.ok(entry[5] > 0.35 && entry[5] < 0.55, "the first 100ms visibly ramps up");
  assert.ok(entry[17] > 0.94 && entry[17] < 0.98, "entry settles at about 300ms");
  assert.ok(exit[5] > 0.65, "exit keeps most of its size during the first 100ms");
  assert.ok(exit[23] > 0.04 && exit[23] < 0.09, "exit eases through a longer tail");
  assert.ok(exit[47] < 0.002, "exit returns completely without oscillation");
});

test("quick departure and reentry retain continuity and settle exactly", () => {
  let motion = { value: 0, velocity: 0 };
  for (const target of [1, 0, 0.75, 0, 1, 0.3]) {
    for (let frame = 0; frame < 5; frame++) {
      const next = advanceDockMotion(motion, target, 1 / 60, target === 0);
      assert.ok(Math.abs(next.value - motion.value) < 0.2);
      assert.ok(next.value >= 0 && next.value <= 1);
      const geometry = getDockMagnificationForProximity(next.value);
      assert.ok(Math.abs(geometry.scale * geometry.labelScale - 1) < 1e-10);
      motion = next;
    }
  }
  for (let frame = 0; frame < 120; frame++) {
    motion = advanceDockMotion(motion, 0, 1 / 60, true);
  }
  assert.deepEqual(motion, { value: 0, velocity: 0 });
});
