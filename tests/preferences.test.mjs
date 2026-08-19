import assert from "node:assert/strict";
import test from "node:test";

import {
  WALLPAPER_OPTIONS,
  isWallpaperPreference,
  readStoredPreference,
  writeStoredPreference,
} from "../app/os/preferences.ts";

test("defines four unique wallpaper presets and validates their identifiers", () => {
  const values = WALLPAPER_OPTIONS.map((option) => option.value);

  assert.equal(values.length, 4);
  assert.equal(new Set(values).size, values.length);
  values.forEach((value) => assert.equal(isWallpaperPreference(value), true));
  assert.equal(isWallpaperPreference("unknown"), false);
  assert.equal(isWallpaperPreference(null), false);
});

test("reads only valid stored wallpaper values", () => {
  assert.equal(
    readStoredPreference({ getItem: () => "sunset" }, "myos-wallpaper", isWallpaperPreference),
    "sunset",
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
  assert.equal(writeStoredPreference(unavailable, "myos-wallpaper", "iris"), false);
});

test("writes a selected wallpaper identifier without extra data", () => {
  const writes = [];
  const storage = { setItem: (key, value) => writes.push([key, value]) };

  assert.equal(writeStoredPreference(storage, "myos-wallpaper", "tide"), true);
  assert.deepEqual(writes, [["myos-wallpaper", "tide"]]);
});
