import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("sizes every custom Dock artwork from the adjustable shared frame", () => {
  assert.match(
    css,
    /\.dock-welcome-art,[\s\S]*?\.dock-contact-art \{[\s\S]*?width: calc\(var\(--dock-icon-size\) \* 48 \/ 49\);[\s\S]*?height: calc\(var\(--dock-icon-size\) \* 48 \/ 49\);[\s\S]*?transform: translateX\(var\(--dock-art-offset-x\)\) scale\(var\(--dock-art-optical-scale\)\)/,
  );
  assert.match(css, /\.dock-trash-art \{[\s\S]*?width: calc\(var\(--dock-icon-size\) \* 48 \/ 49\);[\s\S]*?height: calc\(var\(--dock-icon-size\) \* 48 \/ 49\);/);
});

test("applies the reviewed optical corrections without changing hit areas", () => {
  assert.match(css, /\.dock-character-art \{[^}]*--dock-art-optical-scale: 1\.18;/);
  assert.match(css, /\.dock-works-art \{\s*--dock-art-optical-scale: 0\.84;/);
  assert.match(css, /\.dock-contact-art \{\s*--dock-art-optical-scale: 0\.93;/);
  assert.match(css, /\.dock-trash-art \{\s*--dock-art-optical-scale: 0\.98;[^}]*transform: scale\(var\(--dock-art-optical-scale\)\);/);
});
