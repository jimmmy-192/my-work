import assert from "node:assert/strict";
import test from "node:test";

import {
  WALLPAPER_OPTIONS,
  isWallpaperPreference,
  readStoredPreference,
  resolveInitialWallpaper,
  writeStoredPreference,
} from "../app/os/preferences.ts";

test("keeps only the photo carousel wallpaper option", () => {
  const values = WALLPAPER_OPTIONS.map((option) => option.value);

  assert.deepEqual(values, ["mountain"]);
  assert.equal(new Set(values).size, values.length);
  values.forEach((value) => assert.equal(isWallpaperPreference(value), true));
  assert.equal(isWallpaperPreference("unknown"), false);
  assert.equal(isWallpaperPreference(null), false);
});

test("migrates every retired wallpaper choice to the photo carousel", () => {
  assert.equal(resolveInitialWallpaper(null, "aurora"), "mountain");
  assert.equal(resolveInitialWallpaper(null, null), "mountain");
  assert.equal(resolveInitialWallpaper(null, "tide"), "mountain");
  assert.equal(resolveInitialWallpaper("aurora", "tide"), "mountain");
  assert.equal(resolveInitialWallpaper("sunset", "aurora"), "mountain");
});

test("reads only valid stored wallpaper values", () => {
  assert.equal(
    readStoredPreference({ getItem: () => "mountain" }, "myos-wallpaper", isWallpaperPreference),
    "mountain",
  );
  assert.equal(
    readStoredPreference({ getItem: () => "retired-preset" }, "myos-wallpaper", isWallpaperPreference),
    null,
  );
});

test("keeps the interface usable when browser storage is unavailable", () => {
  const unavailable = {
    getItem() {
      throw new Error("Storage blocked");
    },
    setItem() {
      throw new Error("Storage blocked");
    },
  };

  assert.equal(readStoredPreference(unavailable, "myos-wallpaper", isWallpaperPreference), null);
  assert.equal(writeStoredPreference(unavailable, "myos-wallpaper", "mountain"), false);
});

test("writes a selected wallpaper identifier without extra data", () => {
  const writes = [];
  const storage = { setItem: (key, value) => writes.push([key, value]) };

  assert.equal(writeStoredPreference(storage, "myos-wallpaper", "mountain"), true);
  assert.deepEqual(writes, [["myos-wallpaper", "mountain"]]);
});
