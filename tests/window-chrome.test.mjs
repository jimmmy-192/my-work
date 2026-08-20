import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("keeps the window chrome aligned with AppKit standard metrics", () => {
  assert.match(css, /--window-titlebar-height:\s*28px/);
  assert.match(css, /--traffic-control-width:\s*20px/);
  assert.match(css, /--traffic-light-size:\s*14px/);
  assert.match(css, /--traffic-titlebar-inset:\s*4px/);
});

test("uses the standard macOS traffic-light color roles", () => {
  assert.match(css, /--traffic-color:\s*#ff5f57/);
  assert.match(css, /--traffic-color:\s*#febc2e/);
  assert.match(css, /--traffic-color:\s*#28c840/);
});
