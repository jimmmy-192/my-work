import assert from "node:assert/strict";
import test from "node:test";

import { shouldUseOpticalGlass } from "../app/os/use-liquid-glass.ts";

const supportedDesktop = {
  preferencesReady: true,
  glass: "standard",
  mobile: false,
  finePointer: true,
  reducedMotion: false,
  highContrast: false,
  forcedColors: false,
  webGL: true,
};

test("enables optical refraction on a supported desktop", () => {
  assert.equal(shouldUseOpticalGlass(supportedDesktop), true);
  assert.equal(shouldUseOpticalGlass({ ...supportedDesktop, glass: "clear" }), true);
});

test("keeps the CSS fallback for accessibility and mobile modes", () => {
  assert.equal(shouldUseOpticalGlass({ ...supportedDesktop, glass: "readable" }), false);
  assert.equal(shouldUseOpticalGlass({ ...supportedDesktop, mobile: true }), false);
  assert.equal(shouldUseOpticalGlass({ ...supportedDesktop, finePointer: false }), false);
  assert.equal(shouldUseOpticalGlass({ ...supportedDesktop, reducedMotion: true }), false);
  assert.equal(shouldUseOpticalGlass({ ...supportedDesktop, highContrast: true }), false);
  assert.equal(shouldUseOpticalGlass({ ...supportedDesktop, forcedColors: true }), false);
});

test("does not initialize before preferences or WebGL are available", () => {
  assert.equal(shouldUseOpticalGlass({ ...supportedDesktop, preferencesReady: false }), false);
  assert.equal(shouldUseOpticalGlass({ ...supportedDesktop, webGL: false }), false);
});
