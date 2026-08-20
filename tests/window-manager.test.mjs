import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_HEIGHT,
  MIN_WIDTH,
  clampBounds,
  createInitialOSState,
  osReducer,
} from "../app/os/window-manager.ts";

const workBounds = { x: 120, y: 96, width: 620, height: 420 };
const aboutBounds = { x: 180, y: 120, width: 540, height: 380 };
const workspace = { x: 0, y: 36, width: 1024, height: 640 };

function open(state, appId, bounds) {
  return osReducer(state, { type: "OPEN_APP", appId, bounds });
}

test("starts with one active welcome window and closed overlays", () => {
  const state = createInitialOSState();

  assert.deepEqual(state.stack, ["welcome"]);
  assert.equal(state.activeWindowId, "welcome");
  assert.equal(state.windows.welcome?.status, "normal");
  assert.equal(state.activeMenu, null);
  assert.equal(state.searchOpen, false);
});

test("opens each app once, focuses repeats, and restores minimized apps", () => {
  let state = createInitialOSState();
  state = open(state, "work", workBounds);
  state = open(state, "about", aboutBounds);
  state = open(state, "work", { x: 1, y: 1, width: 999, height: 999 });

  assert.deepEqual(state.stack, ["welcome", "about", "work"]);
  assert.equal(state.activeWindowId, "work");
  assert.deepEqual(state.windows.work?.bounds, workBounds);

  state = osReducer(state, { type: "MINIMIZE_WINDOW", appId: "work" });
  assert.equal(state.windows.work?.status, "minimized");
  assert.equal(state.activeWindowId, "about");

  state = open(state, "work", workBounds);
  assert.equal(state.windows.work?.status, "normal");
  assert.equal(state.activeWindowId, "work");
  assert.deepEqual(state.stack, ["welcome", "about", "work"]);
});

test("focus raises a visible window without creating duplicates", () => {
  let state = open(createInitialOSState(), "work", workBounds);
  state = open(state, "about", aboutBounds);
  state = osReducer(state, { type: "FOCUS_WINDOW", appId: "welcome" });

  assert.deepEqual(state.stack, ["work", "about", "welcome"]);
  assert.equal(state.activeWindowId, "welcome");
  assert.equal(new Set(state.stack).size, state.stack.length);
});

test("clamps position and size inside a workspace", () => {
  assert.deepEqual(
    clampBounds(
      { x: -50, y: 900, width: 2000, height: 100 },
      workspace,
    ),
    { x: 0, y: 416, width: 1024, height: MIN_HEIGHT },
  );

  assert.deepEqual(
    clampBounds(
      { x: 900, y: 600, width: 100, height: 100 },
      workspace,
    ),
    {
      x: 1024 - MIN_WIDTH,
      y: 36 + 640 - MIN_HEIGHT,
      width: MIN_WIDTH,
      height: MIN_HEIGHT,
    },
  );

  assert.deepEqual(
    clampBounds(
      { x: 10, y: 10, width: 500, height: 500 },
      { x: 4, y: 8, width: 280, height: 200 },
    ),
    { x: 4, y: 8, width: 280, height: 200 },
  );

  assert.deepEqual(
    clampBounds(
      { x: 900, y: 600, width: 360, height: 260 },
      workspace,
      { width: 620, height: 460 },
    ),
    { x: 404, y: 216, width: 620, height: 460 },
  );
});

test("move and resize enforce minimum dimensions and ignore maximized windows", () => {
  let state = open(createInitialOSState(), "work", workBounds);
  state = osReducer(state, {
    type: "MOVE_WINDOW",
    appId: "work",
    bounds: { x: 30, y: 40, width: 620, height: 420 },
  });
  assert.deepEqual(state.windows.work?.bounds, {
    x: 30,
    y: 40,
    width: 620,
    height: 420,
  });

  state = osReducer(state, {
    type: "RESIZE_WINDOW",
    appId: "work",
    bounds: { x: 30, y: 40, width: 20, height: 10 },
  });
  assert.equal(state.windows.work?.bounds.width, MIN_WIDTH);
  assert.equal(state.windows.work?.bounds.height, MIN_HEIGHT);

  state = osReducer(state, {
    type: "TOGGLE_MAXIMIZE",
    appId: "work",
    workspace,
  });
  const maximized = state;
  state = osReducer(state, {
    type: "MOVE_WINDOW",
    appId: "work",
    bounds: workBounds,
  });
  assert.strictEqual(state, maximized);
});

test("maximize preserves restore bounds and re-opening a minimized maximum restores it", () => {
  let state = open(createInitialOSState(), "work", workBounds);
  state = osReducer(state, {
    type: "TOGGLE_MAXIMIZE",
    appId: "work",
    workspace,
  });

  assert.equal(state.windows.work?.status, "maximized");
  assert.deepEqual(state.windows.work?.bounds, workspace);
  assert.deepEqual(state.windows.work?.restoreBounds, workBounds);

  state = osReducer(state, { type: "MINIMIZE_WINDOW", appId: "work" });
  state = open(state, "work", workBounds);
  assert.equal(state.windows.work?.status, "maximized");

  state = osReducer(state, {
    type: "TOGGLE_MAXIMIZE",
    appId: "work",
    workspace,
  });
  assert.equal(state.windows.work?.status, "normal");
  assert.deepEqual(state.windows.work?.bounds, workBounds);
  assert.equal(state.windows.work?.restoreBounds, null);
});

test("minimize and close fall back to the next visible window", () => {
  let state = open(createInitialOSState(), "work", workBounds);
  state = open(state, "about", aboutBounds);
  state = osReducer(state, { type: "MINIMIZE_WINDOW", appId: "work" });
  state = osReducer(state, { type: "CLOSE_WINDOW", appId: "about" });

  assert.equal(state.activeWindowId, "welcome");
  assert.equal(state.windows.about, undefined);
  assert.deepEqual(state.stack, ["welcome", "work"]);

  state = osReducer(state, { type: "CLOSE_WINDOW", appId: "welcome" });
  assert.equal(state.activeWindowId, null);
});

test("centers a normal window in an offset workspace", () => {
  let state = open(createInitialOSState(), "work", workBounds);
  state = osReducer(state, {
    type: "CENTER_WINDOW",
    appId: "work",
    workspace,
  });

  assert.deepEqual(state.windows.work?.bounds, {
    x: (1024 - 620) / 2,
    y: 36 + (640 - 420) / 2,
    width: 620,
    height: 420,
  });
});

test("menus and search are mutually exclusive and close together", () => {
  let state = createInitialOSState();
  state = osReducer(state, { type: "TOGGLE_MENU", menu: "go" });
  assert.equal(state.activeMenu, "go");

  state = osReducer(state, { type: "SET_SEARCH", open: true });
  assert.equal(state.activeMenu, null);
  assert.equal(state.searchOpen, true);

  state = osReducer(state, { type: "TOGGLE_MENU", menu: "window" });
  assert.equal(state.activeMenu, "window");
  assert.equal(state.searchOpen, false);

  state = osReducer(state, { type: "TOGGLE_MENU", menu: "window" });
  assert.equal(state.activeMenu, null);

  state = osReducer(state, { type: "SET_SEARCH", open: true });
  state = osReducer(state, { type: "CLOSE_OVERLAYS" });
  assert.equal(state.activeMenu, null);
  assert.equal(state.searchOpen, false);
});

test("activating the desktop keeps windows open and clears the active app", () => {
  let state = open(createInitialOSState(), "work", workBounds);
  state = osReducer(state, { type: "TOGGLE_MENU", menu: "window" });
  state = osReducer(state, { type: "ACTIVATE_DESKTOP" });

  assert.equal(state.activeWindowId, null);
  assert.equal(state.activeMenu, null);
  assert.equal(state.searchOpen, false);
  assert.deepEqual(state.stack, ["welcome", "work"]);
  assert.equal(state.windows.work?.status, "normal");
});
