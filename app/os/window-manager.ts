export type AppId =
  | "welcome"
  | "work"
  | "about"
  | "lab"
  | "contact"
  | "settings"
  | "trash";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MinimumSize {
  width: number;
  height: number;
}

export type WindowStatus = "normal" | "minimized" | "maximized";

export interface WindowState {
  appId: AppId;
  status: WindowStatus;
  bounds: Bounds;
  restoreBounds: Bounds | null;
}

export interface OSState {
  windows: Partial<Record<AppId, WindowState>>;
  /** Window IDs ordered from the back of the desktop to the front. */
  stack: AppId[];
  activeWindowId: AppId | null;
  activeMenu: string | null;
  searchOpen: boolean;
}

export type OSAction =
  | { type: "OPEN_APP"; appId: AppId; bounds: Bounds }
  | { type: "FOCUS_WINDOW"; appId: AppId }
  | { type: "MOVE_WINDOW"; appId: AppId; bounds: Bounds }
  | { type: "RESIZE_WINDOW"; appId: AppId; bounds: Bounds }
  | { type: "MINIMIZE_WINDOW"; appId: AppId }
  | { type: "TOGGLE_MAXIMIZE"; appId: AppId; workspace: Bounds }
  | { type: "CLOSE_WINDOW"; appId: AppId }
  | { type: "CENTER_WINDOW"; appId: AppId; workspace: Bounds }
  | { type: "ACTIVATE_DESKTOP" }
  | { type: "TOGGLE_MENU"; menu: string }
  | { type: "CLOSE_OVERLAYS" }
  | { type: "SET_SEARCH"; open: boolean };

export const MIN_WIDTH = 360;
export const MIN_HEIGHT = 260;

const INITIAL_WELCOME_BOUNDS: Bounds = {
  x: 64,
  y: 72,
  width: 640,
  height: 480,
};

function copyBounds(bounds: Bounds): Bounds {
  return { ...bounds };
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeBounds(bounds: Bounds): Bounds {
  return {
    x: finiteOr(bounds.x, 0),
    y: finiteOr(bounds.y, 0),
    width: Math.max(MIN_WIDTH, finiteOr(bounds.width, MIN_WIDTH)),
    height: Math.max(MIN_HEIGHT, finiteOr(bounds.height, MIN_HEIGHT)),
  };
}

function workspaceBounds(workspace: Bounds): Bounds {
  return {
    x: finiteOr(workspace.x, 0),
    y: finiteOr(workspace.y, 0),
    width: Math.max(0, finiteOr(workspace.width, 0)),
    height: Math.max(0, finiteOr(workspace.height, 0)),
  };
}

/**
 * Fits a window wholly inside a desktop workspace. On an exceptionally small
 * workspace, staying visible takes precedence over the desktop minimum size.
 */
export function clampBounds(
  bounds: Bounds,
  workspace: Bounds,
  minimum: MinimumSize = { width: MIN_WIDTH, height: MIN_HEIGHT },
): Bounds {
  const area = workspaceBounds(workspace);
  const minWidth = Math.min(
    Math.max(MIN_WIDTH, finiteOr(minimum.width, MIN_WIDTH)),
    area.width,
  );
  const minHeight = Math.min(
    Math.max(MIN_HEIGHT, finiteOr(minimum.height, MIN_HEIGHT)),
    area.height,
  );
  const width = Math.min(
    area.width,
    Math.max(minWidth, finiteOr(bounds.width, minWidth)),
  );
  const height = Math.min(
    area.height,
    Math.max(minHeight, finiteOr(bounds.height, minHeight)),
  );
  const maxX = area.x + area.width - width;
  const maxY = area.y + area.height - height;

  return {
    x: Math.min(maxX, Math.max(area.x, finiteOr(bounds.x, area.x))),
    y: Math.min(maxY, Math.max(area.y, finiteOr(bounds.y, area.y))),
    width,
    height,
  };
}

export function createInitialOSState(): OSState {
  return {
    windows: {
      welcome: {
        appId: "welcome",
        status: "normal",
        bounds: copyBounds(INITIAL_WELCOME_BOUNDS),
        restoreBounds: null,
      },
    },
    stack: ["welcome"],
    activeWindowId: "welcome",
    activeMenu: null,
    searchOpen: false,
  };
}

function bringToFront(stack: AppId[], appId: AppId): AppId[] {
  return [...stack.filter((id) => id !== appId), appId];
}

function topVisibleWindow(
  stack: AppId[],
  windows: OSState["windows"],
): AppId | null {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const id = stack[index];
    if (windows[id]?.status !== "minimized") {
      return id;
    }
  }

  return null;
}

function updateWindow(
  state: OSState,
  appId: AppId,
  update: (window: WindowState) => WindowState,
): OSState {
  const current = state.windows[appId];
  if (!current) {
    return state;
  }

  return {
    ...state,
    windows: {
      ...state.windows,
      [appId]: update(current),
    },
  };
}

export function osReducer(state: OSState, action: OSAction): OSState {
  switch (action.type) {
    case "OPEN_APP": {
      const current = state.windows[action.appId];
      const stack = bringToFront(state.stack, action.appId);

      if (current) {
        const restoredStatus: WindowStatus = current.restoreBounds
          ? "maximized"
          : "normal";
        return {
          ...state,
          windows:
            current.status === "minimized"
              ? {
                  ...state.windows,
                  [action.appId]: {
                    ...current,
                    status: restoredStatus,
                  },
                }
              : state.windows,
          stack,
          activeWindowId: action.appId,
          activeMenu: null,
          searchOpen: false,
        };
      }

      return {
        ...state,
        windows: {
          ...state.windows,
          [action.appId]: {
            appId: action.appId,
            status: "normal",
            bounds: normalizeBounds(action.bounds),
            restoreBounds: null,
          },
        },
        stack,
        activeWindowId: action.appId,
        activeMenu: null,
        searchOpen: false,
      };
    }

    case "FOCUS_WINDOW": {
      const current = state.windows[action.appId];
      if (!current || current.status === "minimized") {
        return state;
      }

      return {
        ...state,
        stack: bringToFront(state.stack, action.appId),
        activeWindowId: action.appId,
        activeMenu: null,
        searchOpen: false,
      };
    }

    case "MOVE_WINDOW":
    case "RESIZE_WINDOW": {
      const current = state.windows[action.appId];
      if (!current || current.status !== "normal") {
        return state;
      }

      return updateWindow(state, action.appId, (window) => ({
        ...window,
        bounds: normalizeBounds(action.bounds),
      }));
    }

    case "MINIMIZE_WINDOW": {
      const current = state.windows[action.appId];
      if (!current || current.status === "minimized") {
        return state;
      }

      const windows: OSState["windows"] = {
        ...state.windows,
        [action.appId]: { ...current, status: "minimized" },
      };

      return {
        ...state,
        windows,
        activeWindowId:
          state.activeWindowId === action.appId
            ? topVisibleWindow(state.stack, windows)
            : state.activeWindowId,
      };
    }

    case "TOGGLE_MAXIMIZE": {
      const current = state.windows[action.appId];
      if (!current || current.status === "minimized") {
        return state;
      }

      if (current.status === "maximized") {
        return updateWindow(state, action.appId, (window) => ({
          ...window,
          status: "normal",
          bounds: clampBounds(
            window.restoreBounds ?? window.bounds,
            action.workspace,
          ),
          restoreBounds: null,
        }));
      }

      return updateWindow(state, action.appId, (window) => ({
        ...window,
        status: "maximized",
        bounds: workspaceBounds(action.workspace),
        restoreBounds: copyBounds(window.bounds),
      }));
    }

    case "CLOSE_WINDOW": {
      if (!state.windows[action.appId]) {
        return state;
      }

      const windows = { ...state.windows };
      delete windows[action.appId];
      const stack = state.stack.filter((id) => id !== action.appId);

      return {
        ...state,
        windows,
        stack,
        activeWindowId:
          state.activeWindowId === action.appId
            ? topVisibleWindow(stack, windows)
            : state.activeWindowId,
      };
    }

    case "CENTER_WINDOW": {
      const current = state.windows[action.appId];
      if (!current || current.status !== "normal") {
        return state;
      }

      const area = workspaceBounds(action.workspace);
      const fitted = clampBounds(current.bounds, area);
      return updateWindow(state, action.appId, (window) => ({
        ...window,
        bounds: {
          ...fitted,
          x: area.x + (area.width - fitted.width) / 2,
          y: area.y + (area.height - fitted.height) / 2,
        },
      }));
    }

    case "ACTIVATE_DESKTOP":
      return {
        ...state,
        activeWindowId: null,
        activeMenu: null,
        searchOpen: false,
      };

    case "TOGGLE_MENU":
      return {
        ...state,
        activeMenu: state.activeMenu === action.menu ? null : action.menu,
        searchOpen: false,
      };

    case "CLOSE_OVERLAYS":
      if (state.activeMenu === null && !state.searchOpen) {
        return state;
      }
      return { ...state, activeMenu: null, searchOpen: false };

    case "SET_SEARCH":
      return {
        ...state,
        searchOpen: action.open,
        activeMenu: action.open ? null : state.activeMenu,
      };
  }
}
