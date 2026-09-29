import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PHOTO_WALLPAPERS,
  WALLPAPER_SLIDE_INTERVAL_MS,
  getNextWallpaperSlide,
  getWallpaperPhotos,
  canRemoveWallpaper,
} from "../app/os/wallpaper-carousel.ts";

test("rotates the ordered photo wallpapers every two minutes", () => {
  assert.equal(WALLPAPER_SLIDE_INTERVAL_MS, 120_000);
  assert.deepEqual(
    PHOTO_WALLPAPERS.map((photo) => photo.url),
    ["/wallpapers/snow-mountain.jpg", "/wallpapers/garden-canopy-upright.jpg", "/wallpapers/blue-folds.png", "/wallpapers/palm-starry-night.jpg", "/wallpapers/tropical-shore.jpg"],
  );
  assert.equal(getNextWallpaperSlide(0), 1);
  assert.equal(getNextWallpaperSlide(1), 2);
  assert.equal(getNextWallpaperSlide(4), 0);
  assert.equal(getNextWallpaperSlide(3, 5), 4);
});

test("keeps deleted built-in wallpapers out after restoring saved preferences", () => {
  const photos = getWallpaperPhotos([], ["garden", "lake", "blue-folds"], ["lake"]);
  assert.deepEqual(photos.map((photo) => photo.id), ["garden", "blue-folds", "palm-stars", "tropical-shore"]);
  assert.equal(canRemoveWallpaper(photos, "garden"), false);
  assert.equal(canRemoveWallpaper(photos, "blue-folds"), true);
  assert.equal(canRemoveWallpaper(photos, "missing"), false);
  const reordered = getWallpaperPhotos([], ["blue-folds", "garden"], ["lake"]);
  assert.equal(canRemoveWallpaper(reordered, "blue-folds"), false);
  assert.equal(canRemoveWallpaper(reordered, "garden"), true);
});

test("always retains a wallpaper and protects a custom photo when it is first", () => {
  const hidden = PHOTO_WALLPAPERS.map((photo) => photo.id);
  const fallback = getWallpaperPhotos([], [], hidden);
  assert.equal(fallback.length, 1);
  assert.equal(canRemoveWallpaper(fallback, fallback[0].id), false);
  const custom = { id: "custom-test", name: "Test", url: "data:image/jpeg,test", custom: true };
  const photos = getWallpaperPhotos([custom], [custom.id], []);
  assert.equal(canRemoveWallpaper(photos, custom.id), false);
  assert.equal(canRemoveWallpaper(photos, "lake"), true);
});

test("keeps the displayed photo and Liquid Glass snapshot in sync", async () => {
  const source = await readFile(new URL("../app/os/PortfolioOS.tsx", import.meta.url), "utf8");

  assert.match(source, /sceneKey:.*displayedPhotoSlideIndex/);
  assert.match(source, /wallpaper-photo-carousel/);
  assert.match(source, /displayedPhotoSlideIndex === index/);
  assert.match(source, /prefers-reduced-motion: reduce/);
});

test("keeps built-in composition while uploaded photos fit the actual viewport", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.doesNotMatch(css, /snow-mountain-mobile\.jpg/);
  assert.match(css, /\.wallpaper-photo-slide[\s\S]*background-position: center 58%/);
  assert.match(css, /\.wallpaper-photo-slide\.is-active[\s\S]*opacity: 1/);
  assert.match(css, /\.wallpaper-photo-slide\[data-custom="true"\] \{\s*inset-inline: 0;\s*background-position: center;/);
});
