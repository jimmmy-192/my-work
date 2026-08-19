import assert from "node:assert/strict";
import test from "node:test";

import {
  DOCK_MAGNIFICATION_RADIUS,
  DOCK_MAX_SCALE,
  getDockMagnification,
} from "../app/os/dock-magnification.ts";

test("peaks under the pointer and keeps the tooltip visually stable", () => {
  const center = getDockMagnification(0);

  assert.equal(center.scale, DOCK_MAX_SCALE);
  assert.equal(center.proximity, 1);
  assert.ok(center.expansion > 30 && center.expansion < 31);
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
