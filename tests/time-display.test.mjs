import assert from "node:assert/strict";
import test from "node:test";

import { formatMenuBarTime } from "../app/os/time.ts";

test("formats the menu clock like macOS in Simplified Chinese", () => {
  const localTime = new Date(2026, 7, 20, 14, 7);
  assert.equal(formatMenuBarTime(localTime), "8月20日 周四 14:07");
});
