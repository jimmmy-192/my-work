import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const os = readFileSync(new URL("../app/os/PortfolioOS.tsx", import.meta.url), "utf8");
const icons = readFileSync(new URL("../app/os/icons.tsx", import.meta.url), "utf8");

test("uses a single AppKit-aligned control scale", () => {
  assert.match(css, /--menu-height:\s*calc\(28px \+ env\(safe-area-inset-top\)\)/);
  assert.match(css, /--menu-control-height:\s*24px/);
  assert.match(css, /--menu-item-height:\s*28px/);
  assert.match(css, /--window-titlebar-height:\s*28px/);
  assert.match(css, /--dock-icon-size:\s*49px/);
});

test("keeps system focus and menu selection in the macOS accent family", () => {
  assert.match(css, /--system-accent:\s*#0a84ff/);
  assert.match(css, /--focus:\s*#0066cc/);
  assert.match(css, /--menu-selection:\s*var\(--system-accent\)/);
});

test("uses one aligned symbol column in command menus", () => {
  assert.match(os, /className="menu-item-icon"/);
  assert.match(css, /grid-template-columns:\s*18px minmax\(0, 1fr\) auto/);
});

test("uses white menu-bar content and pill-shaped top-level controls", () => {
  assert.match(css, /--menu-bar-ink:\s*#fff/);
  assert.match(css, /--menu-bar-text-shadow:\s*none/);
  assert.match(css, /--menu-control-hover:\s*rgba\(0, 0, 0,/);
  assert.match(css, /--menu-control-active:\s*rgba\(0, 0, 0,/);
  assert.match(css, /\.menu-bar button \{[\s\S]*?border-radius:\s*999px/);
  assert.match(css, /\.menu-bar \.monogram \{[\s\S]*?border-radius:\s*999px/);
});

test("uses optical icon weights and one Dock running-state indicator", () => {
  assert.match(icons, /function opticalStrokeWidth/);
  assert.doesNotMatch(css, /\.dock-app\.is-active::after/);
  assert.match(css, /\.dock-app\.is-active \.running-dot/);
});
