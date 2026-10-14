import assert from "node:assert/strict";
import test from "node:test";
import { clampDiscIndex, DISC_COUNT, getDiscPose, INITIAL_DISC_INDEX } from "../app/os/WorkDisc/disc-gallery.ts";

test("the gallery opens at the first of five discs", () => {
  assert.equal(DISC_COUNT, 5);
  assert.equal(INITIAL_DISC_INDEX, 0);
});

test("the selected disc faces forward, with maximum scale and a small lift", () => {
  const center = getDiscPose(0, 0);
  assert.equal(center.x, 0);
  assert.equal(center.z, 0);
  assert.equal(center.rotationY, 0);
  assert.ok(center.y > 0 && center.y < 0.1);
  assert.equal(center.scale, 1);
  assert.ok(getDiscPose(1, 0).scale < center.scale);
  assert.ok(getDiscPose(2, 0).scale < getDiscPose(1, 0).scale);
});

test("discs on either side follow a symmetric curved path", () => {
  for (const offset of [0.25, 0.5, 1, 2, 2.7]) {
    const left = getDiscPose(-offset, 0);
    const right = getDiscPose(offset, 0);
    assert.equal(left.x, -right.x);
    assert.equal(left.z, right.z);
    assert.equal(left.scale, right.scale);
    assert.equal(left.rotationY, -right.rotationY);
    assert.ok(right.x > 0 && right.z > 0);
  }
  assert.ok(getDiscPose(2, 0).z > getDiscPose(1, 0).z);
});

test("selection and fractional dragging do not introduce jumps between discs", () => {
  for (const offset of [-2, -1, -0.5, 0, 0.5, 1, 2]) {
    for (const compact of [false, true]) {
      const before = getDiscPose(offset - 0.00001, 1.5, compact);
      const after = getDiscPose(offset + 0.00001, 1.5, compact);
      for (const key of Object.keys(before)) {
        assert.ok(Math.abs(before[key] - after[key]) < 0.001, `${key} stays continuous at ${offset}`);
      }
    }
  }
});

test("motion leans with direction, dips with speed and stays bounded", () => {
  const resting = getDiscPose(0, 0);
  const forward = getDiscPose(0, 3);
  const backward = getDiscPose(0, -3);
  assert.ok(forward.y < resting.y);
  assert.equal(forward.y, backward.y);
  assert.equal(forward.rotationY, -backward.rotationY);
  assert.equal(forward.rotationZ, -backward.rotationZ);
  for (const flow of [-Number.MAX_VALUE, -1000, 1000, Number.MAX_VALUE, NaN, Infinity]) {
    for (const offset of [-2.7, 0, 2.7, Number.MAX_VALUE, NaN]) {
      const pose = getDiscPose(offset, flow);
      assert.ok(Object.values(pose).every(Number.isFinite));
      assert.ok(Math.abs(pose.rotationX) < 0.2);
      assert.ok(Math.abs(pose.rotationZ) < 0.2);
      assert.ok(pose.y > -0.25);
      assert.ok(pose.scale >= 0.7 && pose.scale <= 1);
    }
  }
});

test("compact layouts reduce spacing without shrinking the selected disc", () => {
  const regular = getDiscPose(1, 0);
  const compact = getDiscPose(1, 0, true);
  assert.ok(Math.abs(compact.x) < Math.abs(regular.x));
  assert.ok(compact.scale < regular.scale);
  assert.equal(compact.z, regular.z);
  assert.equal(getDiscPose(0, 0, true).scale, 1);
});

test("selection indices are rounded, bounded and safe for invalid input", () => {
  assert.equal(clampDiscIndex(1.6), 2);
  assert.equal(clampDiscIndex(-100), 0);
  assert.equal(clampDiscIndex(100), DISC_COUNT - 1);
  assert.equal(clampDiscIndex(100, 3), 2);
  assert.equal(clampDiscIndex(2, 0), 0);
  assert.equal(clampDiscIndex(2, -1), 0);
  assert.equal(clampDiscIndex(100, NaN), DISC_COUNT - 1);
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(clampDiscIndex(value), 0);
});
