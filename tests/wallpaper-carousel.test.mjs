import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PHOTO_WALLPAPERS,
  DEFAULT_CONCEALED_WALLPAPER_IDS,
  WALLPAPER_CATALOG_REVISION,
  WALLPAPER_SLIDE_INTERVAL_MS,
  resolveWallpaperCatalogState,
  getNextWallpaperSlide,
  getWallpaperPhotos,
  getVisibleWallpaperPhotos,
  canRemoveWallpaper,
} from "../app/os/wallpaper-carousel.ts";

const catalogIds = PHOTO_WALLPAPERS.map((photo) => photo.id);
const emptySavedState = () => ({ custom: [], order: [], hidden: [], concealed: [] });

test("rotates the ordered photo wallpapers every minute", () => {
  assert.equal(WALLPAPER_SLIDE_INTERVAL_MS, 60_000);
  assert.equal(getNextWallpaperSlide(0), 1);
  assert.equal(getNextWallpaperSlide(1), 2);
  assert.equal(getNextWallpaperSlide(PHOTO_WALLPAPERS.length - 1), 0);
  assert.equal(getNextWallpaperSlide(4, 5), 0);
  assert.equal(getNextWallpaperSlide(3, 5), 4);
});

test("starts a fresh browser with seven managed wallpapers and five visible static photos", () => {
  const state = resolveWallpaperCatalogState(emptySavedState(), null);
  const managed = getWallpaperPhotos(state.custom, state.order, state.hidden);
  const visible = getVisibleWallpaperPhotos(managed, state.concealed);

  assert.equal(managed.length, 7);
  assert.equal(visible.length, 5);
  assert.equal(state.concealed.length, 2);
  assert.deepEqual(managed.map((photo) => photo.id), catalogIds);
  assert.deepEqual(state.concealed, DEFAULT_CONCEALED_WALLPAPER_IDS);
  for (const photo of managed) {
    assert.match(photo.url, /^\/wallpapers\//);
    assert.notEqual(photo.custom, true);
    if (photo.id.startsWith("custom-")) assert.equal(photo.fit, "viewport");
  }
});

test("migrates obsolete browser wallpaper IDs to the published defaults once", () => {
  const saved = {
    custom: [],
    order: ["lake", "garden", "blue-folds", "palm-stars", "tropical-shore"],
    hidden: ["blue-folds", "garden"],
    concealed: ["lake", "palm-stars"],
  };

  for (const revision of [null, "retired-catalog"]) {
    const state = resolveWallpaperCatalogState(saved, revision);
    assert.deepEqual(state.order, catalogIds);
    assert.deepEqual(state.hidden, []);
    assert.deepEqual(state.concealed, DEFAULT_CONCEALED_WALLPAPER_IDS);
    assert.deepEqual(getWallpaperPhotos(state.custom, state.order, state.hidden).map((photo) => photo.id), catalogIds);
  }
});

test("uses the published static entry when a saved custom image has the same ID", () => {
  const published = PHOTO_WALLPAPERS[0];
  const duplicate = { ...published, url: "data:image/jpeg,old-local-copy", custom: true, localAssetId: published.id };
  const photos = getWallpaperPhotos([duplicate], [published.id, published.id]);

  assert.equal(photos.length, 7);
  assert.equal(photos.filter((photo) => photo.id === published.id).length, 1);
  assert.equal(photos[0], published);
  assert.equal(photos[0].url, published.url);
  assert.notEqual(photos[0].custom, true);
});

test("removes promoted source-browser uploads before local image restoration or cloud upload", () => {
  const saved = {
    custom: PHOTO_WALLPAPERS.filter((photo) => photo.id.startsWith("custom-")).map((photo) => ({
      ...photo,
      custom: true,
      url: "",
      localAssetId: photo.id,
    })),
    order: [...catalogIds],
    hidden: ["lake", "garden", "palm-stars", "tropical-shore"],
    concealed: [...DEFAULT_CONCEALED_WALLPAPER_IDS],
  };
  const state = resolveWallpaperCatalogState(saved, null);

  assert.equal(saved.custom.length, 6);
  assert.deepEqual(state.custom, []);
  assert.deepEqual(state.order, catalogIds);
  assert.deepEqual(state.hidden, []);
  assert.deepEqual(state.concealed, DEFAULT_CONCEALED_WALLPAPER_IDS);
  assert.equal(getWallpaperPhotos(state.custom, state.order, state.hidden).length, 7);
});

test("keeps unrelated private uploads and their relative order and visibility during migration", () => {
  const first = { id: "private-first", name: "First", url: "", localAssetId: "private-first", custom: true };
  const second = { id: "private-second", name: "Second", url: "data:image/jpeg,second", custom: true };
  const saved = {
    custom: [first, second],
    order: [second.id, "lake", first.id],
    hidden: [second.id, "garden"],
    concealed: [first.id, "lake"],
  };
  const state = resolveWallpaperCatalogState(saved, null);

  assert.deepEqual(state.custom, [first, second]);
  assert.equal(state.custom[0], first);
  assert.deepEqual(state.order, [...catalogIds, second.id, first.id]);
  assert.deepEqual(state.hidden, [second.id]);
  assert.deepEqual(state.concealed, [...DEFAULT_CONCEALED_WALLPAPER_IDS, first.id]);
  const managed = getWallpaperPhotos(state.custom, state.order, state.hidden);
  assert.equal(managed.at(-1), first);
  assert.ok(!managed.some((photo) => photo.id === second.id));
  assert.equal(getVisibleWallpaperPhotos(managed, state.concealed).length, 5);
});

test("preserves saved empty visibility, reordering and deletion after adopting this revision", () => {
  const saved = {
    custom: [],
    order: [...catalogIds].reverse(),
    hidden: [catalogIds[1]],
    concealed: [],
  };
  const state = resolveWallpaperCatalogState(saved, WALLPAPER_CATALOG_REVISION);
  const managed = getWallpaperPhotos(state.custom, state.order, state.hidden);

  assert.deepEqual(state, saved);
  assert.deepEqual(managed.map((photo) => photo.id), saved.order.filter((id) => id !== catalogIds[1]));
  assert.deepEqual(getVisibleWallpaperPhotos(managed, state.concealed), managed);
  assert.equal(managed.length, 6);
});

test("keeps deleted built-in wallpapers out after restoring saved preferences", () => {
  const [firstId, secondId] = catalogIds;
  const photos = getWallpaperPhotos([], [secondId, firstId, "blue-folds"], [firstId]);
  assert.deepEqual(photos.map((photo) => photo.id), catalogIds.slice(1));
  assert.equal(canRemoveWallpaper(photos, secondId), false);
  assert.equal(canRemoveWallpaper(photos, "blue-folds"), true);
  assert.equal(canRemoveWallpaper(photos, "missing"), false);
  const reordered = getWallpaperPhotos([], ["blue-folds", secondId], [firstId]);
  assert.equal(canRemoveWallpaper(reordered, "blue-folds"), false);
  assert.equal(canRemoveWallpaper(reordered, secondId), true);
});

test("always retains a wallpaper and protects a custom photo when it is first", () => {
  const hidden = PHOTO_WALLPAPERS.map((photo) => photo.id);
  const fallback = getWallpaperPhotos([], [], hidden);
  assert.equal(fallback.length, 1);
  assert.equal(canRemoveWallpaper(fallback, fallback[0].id), false);
  const custom = { id: "custom-test", name: "Test", url: "data:image/jpeg,test", custom: true };
  const photos = getWallpaperPhotos([custom], [custom.id], []);
  assert.equal(canRemoveWallpaper(photos, custom.id), false);
  assert.equal(canRemoveWallpaper(photos, catalogIds[0]), true);
});

test("conceals built-in and custom photos without changing the managed list or order", () => {
  const firstCustom = Object.freeze({ id: "custom-first", name: "First", url: "data:image/jpeg,first", custom: true });
  const secondCustom = Object.freeze({ id: "custom-second", name: "Second", url: "data:image/jpeg,second", custom: true });
  const photos = Object.freeze([PHOTO_WALLPAPERS[1], firstCustom, PHOTO_WALLPAPERS[0], secondCustom]);
  const concealedIds = Object.freeze([catalogIds[1], secondCustom.id, "missing-id"]);

  const visible = getVisibleWallpaperPhotos(photos, concealedIds);

  assert.deepEqual(visible, [firstCustom, PHOTO_WALLPAPERS[0]]);
  assert.equal(visible[0], photos[1]);
  assert.equal(visible[1], photos[2]);
  assert.deepEqual(photos.map((photo) => photo.id), [catalogIds[1], "custom-first", catalogIds[0], "custom-second"]);
});

test("showing concealed photos restores their original managed positions", () => {
  const custom = { id: "custom-middle", name: "Middle", url: "data:image/jpeg,middle", custom: true };
  const photos = [PHOTO_WALLPAPERS[1], custom, PHOTO_WALLPAPERS[0]];

  assert.deepEqual(getVisibleWallpaperPhotos(photos, [catalogIds[1], custom.id]), [PHOTO_WALLPAPERS[0]]);
  assert.deepEqual(getVisibleWallpaperPhotos(photos, [custom.id]), [PHOTO_WALLPAPERS[1], PHOTO_WALLPAPERS[0]]);
  assert.deepEqual(getVisibleWallpaperPhotos(photos, []), photos);
});

test("all concealed photos leave an empty carousel without reviving a fallback", () => {
  const custom = { id: "custom-only", name: "Only", url: "data:image/jpeg,only", custom: true };
  const photos = [...PHOTO_WALLPAPERS, custom];

  assert.deepEqual(getVisibleWallpaperPhotos(photos, photos.map((photo) => photo.id)), []);
  assert.deepEqual(getVisibleWallpaperPhotos([], []), []);
});

test("keeps the displayed photo and Liquid Glass snapshot in sync", async () => {
  const source = await readFile(new URL("../app/os/PortfolioOS.tsx", import.meta.url), "utf8");

  assert.match(source, /sceneKey:.*displayedPhotoSlideIndex/);
  assert.match(source, /wallpaper-photo-carousel/);
  assert.match(source, /displayedPhotoSlideIndex === index/);
  assert.match(source, /prefers-reduced-motion: reduce/);
});

test("uses viewport fit independently of whether a wallpaper is privately uploaded", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.doesNotMatch(css, /snow-mountain-mobile\.jpg/);
  assert.match(css, /\.wallpaper-photo-slide[\s\S]*background-position: center 58%/);
  assert.match(css, /\.wallpaper-photo-slide\.is-active[\s\S]*opacity: 1/);
  assert.match(css, /\.wallpaper-photo-slide\[data-fit="viewport"\] \{\s*inset-inline: 0;\s*background-position: center;/);
  assert.doesNotMatch(css, /\.wallpaper-photo-slide\[data-custom=/);
});
