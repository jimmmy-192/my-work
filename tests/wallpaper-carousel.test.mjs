import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PHOTO_WALLPAPERS,
  WALLPAPER_SLIDE_INTERVAL_MS,
  getNextWallpaperSlide,
} from "../app/os/wallpaper-carousel.ts";

test("rotates two photo wallpapers every twenty seconds", () => {
  assert.equal(WALLPAPER_SLIDE_INTERVAL_MS, 20_000);
  assert.deepEqual(
    PHOTO_WALLPAPERS.map((photo) => photo.url),
    ["/wallpapers/snow-mountain.jpg", "/wallpapers/garden-canopy.jpg"],
  );
  assert.equal(getNextWallpaperSlide(0), 1);
  assert.equal(getNextWallpaperSlide(1), 0);
});

test("keeps the displayed photo and Liquid Glass snapshot in sync", async () => {
  const source = await readFile(new URL("../app/os/PortfolioOS.tsx", import.meta.url), "utf8");

  assert.match(source, /sceneKey:.*displayedPhotoSlideIndex/);
  assert.match(source, /wallpaper-photo-carousel/);
  assert.match(source, /displayedPhotoSlideIndex === index/);
  assert.match(source, /prefers-reduced-motion: reduce/);
});

test("uses one shared horizontal composition on every viewport", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.doesNotMatch(css, /snow-mountain-mobile\.jpg/);
  assert.match(css, /\.wallpaper-photo-slide[\s\S]*background-position: center 58%/);
  assert.match(css, /\.wallpaper-photo-slide\.is-active[\s\S]*opacity: 1/);
});
