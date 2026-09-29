import assert from "node:assert/strict";
import test from "node:test";
import { getWallpaperOutputSize } from "../app/os/prepare-wallpaper.ts";

test("preserves landscape, portrait and panoramic proportions at high resolution", () => {
  for (const [width, height] of [[4032, 3024], [3024, 4032], [8000, 2000], [6000, 4000], [3992, 2755]]) {
    const output = getWallpaperOutputSize(width, height);
    assert.ok(output.width <= width && output.height <= height);
    assert.ok(Math.max(output.width, output.height) <= 4096);
    assert.ok(Math.abs(output.width / output.height - width / height) < 0.002);
    assert.ok(output.width * output.height <= 12_010_000);
  }
  assert.deepEqual(getWallpaperOutputSize(4032, 3024), { width: 4000, height: 3000 });
});

test("never enlarges a small source or accepts invalid image dimensions", () => {
  assert.deepEqual(getWallpaperOutputSize(800, 600), { width: 800, height: 600 });
  for (const dimensions of [[0, 100], [100, -1], [NaN, 200], [200, Infinity]]) {
    assert.throws(() => getWallpaperOutputSize(...dimensions));
  }
});
