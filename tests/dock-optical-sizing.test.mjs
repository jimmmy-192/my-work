import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("keeps every custom Dock artwork inside the same 48px frame", () => {
  assert.match(
    css,
    /\.dock-welcome-art,[\s\S]*?\.dock-contact-art \{[\s\S]*?width: 48px;[\s\S]*?height: 48px;[\s\S]*?transform: scale\(var\(--dock-art-optical-scale\)\)/,
  );
  assert.match(css, /\.dock-trash-art \{[\s\S]*?width: 48px;[\s\S]*?height: 48px;/);
});

test("applies the reviewed optical corrections without changing hit areas", () => {
  assert.match(css, /\.dock-character-art \{\s*--dock-art-optical-scale: 1\.1;/);
  assert.match(css, /\.dock-works-art \{\s*--dock-art-optical-scale: 0\.88;/);
  assert.match(css, /\.dock-contact-art \{\s*--dock-art-optical-scale: 0\.95;/);
  assert.match(css, /\.dock-trash-art \{[\s\S]*?transform: scale\(0\.98\);/);
});
