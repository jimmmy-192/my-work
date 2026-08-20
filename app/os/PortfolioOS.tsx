"use client";

/* eslint-disable react-hooks/refs -- gesture refs are only read inside pointer event handlers. */

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { appDefinitions, portfolioContent } from "../../content/portfolio";
import { AppContent } from "./apps";
import { getDockMagnification } from "./dock-magnification";
import { AppIcon, SystemIcon } from "./icons";
import type { SystemIconName } from "./icons";
import {
  isWallpaperPreference,
  readStoredPreference,
  resolveInitialWallpaper,
  writeStoredPreference,
} from "./preferences";
import type { WallpaperPreference } from "./preferences";
import { useLiquidGlass } from "./use-liquid-glass";
import { formatMenuBarTime } from "./time";
import {
  MIN_HEIGHT,
  MIN_WIDTH,
  clampBounds,
  createInitialOSState,
  osReducer,
} from "./window-manager";
import type { AppId, Bounds, WindowState } from "./window-manager";

type ThemePreference = "system" | "light" | "dark";
type GlassPreference = "clear" | "standard" | "readable";
type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface PointerGesture {
  appId: AppId;
  pointerId: number;
  mode: "move" | "resize";
  edge?: ResizeEdge;
  startX: number;
  startY: number;
  startBounds: Bounds;
}

interface MenuItem {
  label: string;
  action: () => void;
  icon: { kind: "system"; name: SystemIconName } | { kind: "app"; appId: AppId };
  shortcut?: string;
  disabled?: boolean;
  separatorBefore?: boolean;
}

interface DockRestingItem {
  element: HTMLElement;
  center: number;
  magnifies: boolean;
}

const DEFAULT_WORKSPACE: Bounds = { x: 8, y: 8, width: 1180, height: 690 };
const THEME_KEY = "myos-theme";
const GLASS_KEY = "myos-glass";
const WALLPAPER_KEY = "myos-wallpaper-v2";
const LEGACY_WALLPAPER_KEY = "myos-wallpaper";
const MOUNTAIN_WALLPAPER_URL = "/wallpapers/snow-mountain.jpg";
const MENU_ORDER = ["myos", "go", "window", "help"] as const;
type MenuId = (typeof MENU_ORDER)[number];
const MENU_LABELS: Record<MenuId, string> = {
  myos: "MyOS 菜单",
  go: "前往菜单",
  window: "窗口菜单",
  help: "帮助菜单",
};

function isTheme(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isGlass(value: string | null): value is GlassPreference {
  return value === "clear" || value === "standard" || value === "readable";
}

function getBrowserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function appStyle(accent: string): CSSProperties {
  return { "--app-accent": accent } as CSSProperties;
}

export function PortfolioOS() {
  const [state, dispatch] = useReducer(osReducer, undefined, createInitialOSState);
  const [clock, setClock] = useState("");
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [glass, setGlass] = useState<GlassPreference>("standard");
  const [wallpaper, setWallpaper] = useState<WallpaperPreference>("mountain");
  const [mountainImageReady, setMountainImageReady] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [systemDark, setSystemDark] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileActiveApp, setMobileActiveApp] = useState<AppId | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
  const [menuLeft, setMenuLeft] = useState(8);
  const [workspace, setWorkspace] = useState<Bounds>(DEFAULT_WORKSPACE);
  const osShellRef = useRef<HTMLElement>(null);
  const windowLayerRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const liquidCanvasHostRef = useRef<HTMLDivElement>(null);
  const dockLiquidTargetRef = useRef<HTMLSpanElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuPopoverRef = useRef<HTMLDivElement>(null);
  const menuTriggerRefs = useRef<Partial<Record<MenuId, HTMLButtonElement>>>({});
  const menuReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const menuInitialFocusRef = useRef<"first" | "last">("first");
  const searchReturnFocusRef = useRef<HTMLElement | null>(null);
  const searchWasOpenRef = useRef(false);
  const searchShouldRestoreFocusRef = useRef(true);
  const searchResultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const windowRefs = useRef<Partial<Record<AppId, HTMLElement>>>({});
  const dockAppRefs = useRef<Partial<Record<AppId, HTMLButtonElement>>>({});
  const minimizedWindowRefs = useRef<Partial<Record<AppId, HTMLButtonElement>>>({});
  const mobileBackButtonRef = useRef<HTMLButtonElement>(null);
  const launcherAppRefs = useRef<Partial<Record<AppId, HTMLButtonElement>>>({});
  const mobileReturnFocusRef = useRef<HTMLElement | null>(null);
  const mobileReturnAppIdRef = useRef<AppId | null>(null);
  const previousMobileAppRef = useRef<AppId | null>(null);
  const gestureRef = useRef<PointerGesture | null>(null);
  const dockPointerXRef = useRef<number | null>(null);
  const dockAnimationFrameRef = useRef<number | null>(null);
  const dockRestingItemsRef = useRef<DockRestingItem[]>([]);

  const definitions = useMemo(
    () => new Map(appDefinitions.map((app) => [app.id, app])),
    [],
  );
  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const activeAppId = isMobile ? mobileActiveApp : state.activeWindowId;
  const activeApp = activeAppId ? definitions.get(activeAppId) : undefined;

  useLiquidGlass({
    rootRef: osShellRef,
    canvasHostRef: liquidCanvasHostRef,
    targetRef: dockLiquidTargetRef,
    preferencesReady:
      preferencesReady && (wallpaper !== "mountain" || isMobile || mountainImageReady),
    glass,
    sceneKey: `${resolvedTheme}:${glass}:${wallpaper}`,
  });

  useEffect(() => {
    const update = () => setClock(formatMenuBarTime(new Date()));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (wallpaper !== "mountain" || window.matchMedia("(max-width: 767px)").matches) {
      return;
    }

    let cancelled = false;
    let frame: number | null = null;
    let preparing = false;
    const image = new Image();
    const prepareImage = () => {
      if (preparing) return;
      preparing = true;
      void image
        .decode()
        .catch(() => undefined)
        .then(() => {
          if (cancelled) return;
          frame = window.requestAnimationFrame(() => {
            frame = window.requestAnimationFrame(() => {
              if (!cancelled) setMountainImageReady(true);
            });
          });
        });
    };
    image.addEventListener("load", prepareImage, { once: true });
    image.addEventListener("error", prepareImage, { once: true });
    image.src = MOUNTAIN_WALLPAPER_URL;
    if (image.complete) prepareImage();

    return () => {
      cancelled = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      image.removeEventListener("load", prepareImage);
      image.removeEventListener("error", prepareImage);
    };
  }, [isMobile, wallpaper]);

  const resetDockMagnification = useCallback(() => {
    if (dockAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(dockAnimationFrameRef.current);
      dockAnimationFrameRef.current = null;
    }
    dockPointerXRef.current = null;
    dockRestingItemsRef.current = [];

    const dock = dockRef.current;
    if (!dock) return;
    dock.classList.remove("is-magnifying");
    dock.style.removeProperty("--dock-shell-expand");
    dock.querySelectorAll<HTMLElement>(".dock-magnify-item, .dock-divider").forEach((item) => {
      item.style.removeProperty("--dock-scale");
      item.style.removeProperty("--dock-shift");
      item.style.removeProperty("--dock-label-scale");
      item.style.removeProperty("--dock-label-bottom");
      item.style.removeProperty("--dock-layer");
    });
  }, []);

  const updateDockMagnification = useCallback(() => {
    dockAnimationFrameRef.current = null;
    const dock = dockRef.current;
    const pointerX = dockPointerXRef.current;
    if (!dock || pointerX === null) return;

    const measurements = dockRestingItemsRef.current.map((restingItem) => ({
      ...restingItem,
      magnification: restingItem.magnifies
        ? getDockMagnification(pointerX - restingItem.center)
        : null,
    }));
    const totalExpansion = measurements.reduce(
      (total, item) => total + (item.magnification?.expansion ?? 0),
      0,
    );
    let precedingExpansion = 0;

    dock.style.setProperty("--dock-shell-expand", `${(totalExpansion / 2).toFixed(2)}px`);
    measurements.forEach(({ element, magnification }) => {
      const expansion = magnification?.expansion ?? 0;
      const shift = -totalExpansion / 2 + precedingExpansion + expansion / 2;
      element.style.setProperty("--dock-shift", `${shift.toFixed(2)}px`);

      if (magnification) {
        element.style.setProperty("--dock-scale", magnification.scale.toFixed(4));
        element.style.setProperty("--dock-label-scale", magnification.labelScale.toFixed(4));
        element.style.setProperty("--dock-label-bottom", `${magnification.labelBottom.toFixed(2)}px`);
        element.style.setProperty("--dock-layer", `${1 + Math.round(magnification.proximity * 10)}`);
      }
      precedingExpansion += expansion;
    });
  }, []);

  const handleDockPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      if (
        window.matchMedia("(hover: none)").matches ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        resetDockMagnification();
        return;
      }

      const dock = dockRef.current;
      if (!dock) return;
      if (!dock.classList.contains("is-magnifying")) {
        dockRestingItemsRef.current = Array.from(
          dock.querySelectorAll<HTMLElement>(".dock-magnify-item, .dock-divider"),
        ).map((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            element,
            center: bounds.left + bounds.width / 2,
            magnifies: element.classList.contains("dock-magnify-item"),
          };
        });
        dock.classList.add("is-magnifying");
      }

      dockPointerXRef.current = event.clientX;
      if (dockAnimationFrameRef.current === null) {
        dockAnimationFrameRef.current = window.requestAnimationFrame(updateDockMagnification);
      }
    },
    [resetDockMagnification, updateDockMagnification],
  );

  useEffect(() => resetDockMagnification, [resetDockMagnification]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const noHover = window.matchMedia("(hover: none)");
    const reset = () => resetDockMagnification();
    window.addEventListener("resize", reset);
    reducedMotion.addEventListener("change", reset);
    noHover.addEventListener("change", reset);
    return () => {
      window.removeEventListener("resize", reset);
      reducedMotion.removeEventListener("change", reset);
      noHover.removeEventListener("change", reset);
    };
  }, [resetDockMagnification]);

  useEffect(() => {
    resetDockMagnification();
  }, [resetDockMagnification, state.windows]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storage = getBrowserStorage();
      if (storage) {
        const savedTheme = readStoredPreference(storage, THEME_KEY, isTheme);
        const savedGlass = readStoredPreference(storage, GLASS_KEY, isGlass);
        const savedWallpaper = resolveInitialWallpaper(
          readStoredPreference(storage, WALLPAPER_KEY, isWallpaperPreference),
          readStoredPreference(storage, LEGACY_WALLPAPER_KEY, isWallpaperPreference),
        );
        if (savedTheme) setTheme(savedTheme);
        if (savedGlass) setGlass(savedGlass);
        setWallpaper(savedWallpaper);
      }
      setPreferencesReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const storage = getBrowserStorage();
    if (preferencesReady && storage) writeStoredPreference(storage, THEME_KEY, theme);
  }, [preferencesReady, theme]);

  useEffect(() => {
    const storage = getBrowserStorage();
    if (preferencesReady && storage) writeStoredPreference(storage, GLASS_KEY, glass);
  }, [glass, preferencesReady]);

  useEffect(() => {
    const storage = getBrowserStorage();
    if (preferencesReady && storage) {
      writeStoredPreference(storage, WALLPAPER_KEY, wallpaper);
    }
  }, [preferencesReady, wallpaper]);

  useEffect(() => {
    const colorQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const syncColor = () => setSystemDark(colorQuery.matches);
    const syncMobile = () => {
      setIsMobile((current) => {
        if (current !== mobileQuery.matches) setMobileActiveApp(null);
        return mobileQuery.matches;
      });
    };
    syncColor();
    syncMobile();
    colorQuery.addEventListener("change", syncColor);
    mobileQuery.addEventListener("change", syncMobile);
    return () => {
      colorQuery.removeEventListener("change", syncColor);
      mobileQuery.removeEventListener("change", syncMobile);
    };
  }, []);

  useEffect(() => {
    const layer = windowLayerRef.current;
    if (!layer) return;
    const measure = () => {
      const rect = layer.getBoundingClientRect();
      setWorkspace({ x: 8, y: 8, width: Math.max(0, rect.width - 16), height: Math.max(0, rect.height - 16) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(layer);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isMobile]);

  useEffect(() => {
    const layer = windowLayerRef.current;
    if (!layer) return;
    const focusWindowFromPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const windowElement = target.closest<HTMLElement>("[data-window-app]");
      const appId = windowElement?.dataset.windowApp as AppId | undefined;
      if (appId && definitions.has(appId)) {
        dispatch({ type: "FOCUS_WINDOW", appId });
      }
    };
    layer.addEventListener("pointerdown", focusWindowFromPointer);
    return () => layer.removeEventListener("pointerdown", focusWindowFromPointer);
  }, [definitions, isMobile]);

  useEffect(() => {
    if (state.searchOpen) {
      searchWasOpenRef.current = true;
      const timer = window.setTimeout(() => searchInputRef.current?.focus(), 30);
      return () => window.clearTimeout(timer);
    }

    if (searchWasOpenRef.current) {
      searchWasOpenRef.current = false;
      if (!searchShouldRestoreFocusRef.current) {
        searchShouldRestoreFocusRef.current = true;
        return;
      }
      const timer = window.setTimeout(() => {
        const target = searchReturnFocusRef.current;
        if (target?.isConnected) target.focus();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [state.searchOpen]);

  useEffect(() => {
    if (!state.activeMenu) return;
    const timer = window.setTimeout(() => {
      const items = Array.from(
        menuPopoverRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
      );
      const target = menuInitialFocusRef.current === "last" ? items.at(-1) : items[0];
      menuInitialFocusRef.current = "first";
      target?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [state.activeMenu]);

  useEffect(() => {
    if (!state.activeMenu) return;
    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuPopoverRef.current?.contains(target)) return;
      if (Object.values(menuTriggerRefs.current).some((trigger) => trigger?.contains(target))) return;
      dispatch({ type: "CLOSE_OVERLAYS" });
    };
    document.addEventListener("pointerdown", closeFromOutside, true);
    return () => document.removeEventListener("pointerdown", closeFromOutside, true);
  }, [state.activeMenu]);

  useEffect(() => {
    const previousApp = previousMobileAppRef.current;
    previousMobileAppRef.current = mobileActiveApp;
    if (!isMobile) return;

    const timer = window.setTimeout(() => {
      if (mobileActiveApp) {
        mobileBackButtonRef.current?.focus();
      } else if (previousApp) {
        const appId = mobileReturnAppIdRef.current ?? previousApp;
        const originalTarget = mobileReturnFocusRef.current;
        if (originalTarget?.isConnected) originalTarget.focus();
        else if (launcherAppRefs.current[appId]) launcherAppRefs.current[appId]?.focus();
        else if (dockAppRefs.current[appId]) dockAppRefs.current[appId]?.focus();
        else menuTriggerRefs.current.myos?.focus();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isMobile, mobileActiveApp]);

  const openSearch = useCallback(() => {
    const activeElement = document.activeElement;
    searchReturnFocusRef.current =
      activeElement instanceof HTMLElement
        ? activeElement.closest(".menu-popover")
          ? menuReturnFocusRef.current
          : activeElement
        : null;
    searchShouldRestoreFocusRef.current = true;
    setSearchActiveIndex(0);
    dispatch({ type: "SET_SEARCH", open: true });
  }, []);

  const closeMenuAndRestoreFocus = useCallback(() => {
    dispatch({ type: "CLOSE_OVERLAYS" });
    window.setTimeout(() => {
      const target = menuReturnFocusRef.current;
      if (target?.isConnected) target.focus();
    }, 0);
  }, []);

  const toggleMenu = useCallback((
    menu: MenuId,
    trigger: HTMLButtonElement,
    initialFocus: "first" | "last" = "first",
  ) => {
    menuReturnFocusRef.current = trigger;
    menuInitialFocusRef.current = initialFocus;
    const triggerLeft = trigger.getBoundingClientRect().left;
    setMenuLeft(Math.max(8, Math.min(triggerLeft, window.innerWidth - 240)));
    dispatch({ type: "TOGGLE_MENU", menu });
  }, []);

  const openApp = useCallback(
    (appId: AppId) => {
      const definition = definitions.get(appId);
      if (!definition) return;
      const offset = Math.min(state.stack.length, 5) * 18;
      const requested = clampBounds(
        {
          ...definition.defaultBounds,
          x: definition.defaultBounds.x + offset,
          y: definition.defaultBounds.y + offset,
        },
        workspace,
        definition.minSize,
      );
      dispatch({ type: "OPEN_APP", appId, bounds: requested });
      if (isMobile) {
        const activeElement = document.activeElement;
        mobileReturnFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
        mobileReturnAppIdRef.current = appId;
        setMobileActiveApp(appId);
      }
      else {
        window.setTimeout(() => windowRefs.current[appId]?.focus(), 0);
      }
    },
    [definitions, isMobile, state.stack.length, workspace],
  );

  const minimizeApp = useCallback(
    (appId: AppId) => {
      dispatch({ type: "MINIMIZE_WINDOW", appId });
      if (isMobile) setMobileActiveApp(null);
      else {
        window.setTimeout(() => {
          const nextWindow = document.querySelector<HTMLElement>(
            ".os-window.is-active .window-title-control",
          );
          if (nextWindow) nextWindow.focus();
          else minimizedWindowRefs.current[appId]?.focus();
        }, 0);
      }
    },
    [isMobile],
  );

  const closeApp = useCallback(
    (appId: AppId) => {
      dispatch({ type: "CLOSE_WINDOW", appId });
      if (isMobile) setMobileActiveApp(null);
      else {
        window.setTimeout(() => {
          const nextWindow = document.querySelector<HTMLElement>(
            ".os-window.is-active .window-title-control",
          );
          if (nextWindow) nextWindow.focus();
          else if (dockAppRefs.current[appId]) dockAppRefs.current[appId]?.focus();
          else menuTriggerRefs.current.myos?.focus();
        }, 0);
      }
    },
    [isMobile],
  );

  const returnToMobileDesktop = useCallback(() => {
    setMobileActiveApp(null);
  }, []);

  const toggleMaximize = useCallback(
    (appId: AppId) => dispatch({ type: "TOGGLE_MAXIMIZE", appId, workspace }),
    [workspace],
  );

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const macLike = /Mac|iPhone|iPad|iPod/i.test(window.navigator.platform);
      const command = event.metaKey || (!macLike && event.ctrlKey);
      const key = event.key.toLowerCase();

      if (state.searchOpen) {
        if (event.key === "Escape" || (command && key === "w")) {
          event.preventDefault();
          dispatch({ type: "SET_SEARCH", open: false });
          return;
        }
        if (command && key === "m") {
          event.preventDefault();
          return;
        }
        if (command && key === "k") {
          event.preventDefault();
          searchInputRef.current?.focus();
          return;
        }
        if (command && (event.key === "?" || (event.shiftKey && event.key === "/"))) {
          event.preventDefault();
          return;
        }
      }

      if (command && key === "k") {
        event.preventDefault();
        openSearch();
        return;
      }
      if (command && key === "w" && state.activeWindowId) {
        event.preventDefault();
        closeApp(state.activeWindowId);
        return;
      }
      if (command && key === "m" && state.activeWindowId) {
        event.preventDefault();
        minimizeApp(state.activeWindowId);
        return;
      }
      if (command && (event.key === "?" || (event.shiftKey && event.key === "/"))) {
        event.preventDefault();
        openApp("welcome");
        return;
      }
      if (event.key === "Escape") {
        if (state.activeMenu) closeMenuAndRestoreFocus();
        else dispatch({ type: "CLOSE_OVERLAYS" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeApp, closeMenuAndRestoreFocus, minimizeApp, openApp, openSearch, state.activeMenu, state.activeWindowId, state.searchOpen]);

  const beginGesture = (
    event: ReactPointerEvent<HTMLElement>,
    appId: AppId,
    windowState: WindowState,
    mode: "move" | "resize",
    edge?: ResizeEdge,
  ) => {
    if (isMobile || windowState.status !== "normal") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const fitted = clampBounds(
      windowState.bounds,
      workspace,
      definitions.get(appId)?.minSize,
    );
    gestureRef.current = {
      appId,
      pointerId: event.pointerId,
      mode,
      edge,
      startX: event.clientX,
      startY: event.clientY,
      startBounds: fitted,
    };
    dispatch({ type: "FOCUS_WINDOW", appId });
  };

  const continueGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (gesture.mode === "move") {
      dispatch({
        type: "MOVE_WINDOW",
        appId: gesture.appId,
        bounds: clampBounds(
          { ...gesture.startBounds, x: gesture.startBounds.x + dx, y: gesture.startBounds.y + dy },
          workspace,
        ),
      });
      return;
    }

    const edge = gesture.edge ?? "se";
    const minimum = definitions.get(gesture.appId)?.minSize;
    const next = { ...gesture.startBounds };
    const minWidth = Math.max(MIN_WIDTH, minimum?.width ?? MIN_WIDTH);
    const minHeight = Math.max(MIN_HEIGHT, minimum?.height ?? MIN_HEIGHT);
    if (edge.includes("e")) next.width = Math.max(minWidth, gesture.startBounds.width + dx);
    if (edge.includes("s")) next.height = Math.max(minHeight, gesture.startBounds.height + dy);
    if (edge.includes("w")) {
      next.width = Math.max(minWidth, gesture.startBounds.width - dx);
      next.x = gesture.startBounds.x + (gesture.startBounds.width - next.width);
    }
    if (edge.includes("n")) {
      next.height = Math.max(minHeight, gesture.startBounds.height - dy);
      next.y = gesture.startBounds.y + (gesture.startBounds.height - next.height);
    }
    dispatch({
      type: "RESIZE_WINDOW",
      appId: gesture.appId,
      bounds: clampBounds(next, workspace, minimum),
    });
  };

  const endGesture = (event: ReactPointerEvent<HTMLElement>) => {
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    gestureRef.current = null;
  };

  const handleTitleKey = (event: KeyboardEvent<HTMLElement>, appId: AppId, windowState: WindowState) => {
    if (windowState.status !== "normal") {
      if (event.key === "Enter") toggleMaximize(appId);
      return;
    }
    const step = 16;
    const minimum = definitions.get(appId)?.minSize;
    const next = clampBounds(windowState.bounds, workspace, minimum);
    if (event.key === "Home") {
      event.preventDefault();
      dispatch({ type: "CENTER_WINDOW", appId, workspace });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      toggleMaximize(appId);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    if (event.shiftKey) {
      if (event.key === "ArrowLeft") next.width -= step;
      if (event.key === "ArrowRight") next.width += step;
      if (event.key === "ArrowUp") next.height -= step;
      if (event.key === "ArrowDown") next.height += step;
      dispatch({
        type: "RESIZE_WINDOW",
        appId,
        bounds: clampBounds(next, workspace, minimum),
      });
    } else {
      if (event.key === "ArrowLeft") next.x -= step;
      if (event.key === "ArrowRight") next.x += step;
      if (event.key === "ArrowUp") next.y -= step;
      if (event.key === "ArrowDown") next.y += step;
      dispatch({
        type: "MOVE_WINDOW",
        appId,
        bounds: clampBounds(next, workspace, minimum),
      });
    }
  };

  const activeWindow = state.activeWindowId ? state.windows[state.activeWindowId] : undefined;
  const searchedApps = appDefinitions.filter((app) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return `${app.title} ${app.description} ${app.id}`.toLowerCase().includes(query);
  });

  const selectSearchResult = (appId: AppId) => {
    searchShouldRestoreFocusRef.current = false;
    openApp(appId);
    setSearchTerm("");
    setSearchActiveIndex(0);
  };

  const moveSearchSelection = (nextIndex: number) => {
    if (searchedApps.length === 0) return;
    const index = (nextIndex + searchedApps.length) % searchedApps.length;
    setSearchActiveIndex(index);
    window.requestAnimationFrame(() => {
      searchResultRefs.current[index]?.scrollIntoView({ block: "nearest" });
    });
  };

  const handleSearchInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSearchSelection(searchActiveIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSearchSelection(searchActiveIndex - 1);
    } else if (event.key === "Enter" && searchedApps[searchActiveIndex]) {
      event.preventDefault();
      selectSearchResult(searchedApps[searchActiveIndex].id);
    }
  };

  const handleSearchDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    searchInputRef.current?.focus();
  };

  const handleMenuTriggerKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    menu: MenuId,
  ) => {
    const currentIndex = MENU_ORDER.indexOf(menu);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (state.activeMenu !== menu) {
        toggleMenu(
          menu,
          event.currentTarget,
          event.key === "ArrowUp" ? "last" : "first",
        );
      } else {
        const items = Array.from(
          menuPopoverRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
        );
        const targetIndex = event.key === "ArrowUp" ? items.length - 1 : 0;
        items[targetIndex]?.focus();
      }
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextMenu = MENU_ORDER[(currentIndex + direction + MENU_ORDER.length) % MENU_ORDER.length];
    const nextTrigger = menuTriggerRefs.current[nextMenu];
    if (!nextTrigger) return;
    nextTrigger.focus();
    if (state.activeMenu) toggleMenu(nextMenu, nextTrigger);
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const currentMenuIndex = MENU_ORDER.indexOf(state.activeMenu as MenuId);
      const direction = event.shiftKey ? -1 : 1;
      const nextMenu = MENU_ORDER[
        (currentMenuIndex + direction + MENU_ORDER.length) % MENU_ORDER.length
      ];
      dispatch({ type: "CLOSE_OVERLAYS" });
      window.setTimeout(() => menuTriggerRefs.current[nextMenu]?.focus(), 0);
      return;
    }
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | null = null;

    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex !== null) {
      event.preventDefault();
      items[nextIndex]?.focus();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenuAndRestoreFocus();
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const currentMenuIndex = MENU_ORDER.indexOf(state.activeMenu as MenuId);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextMenu = MENU_ORDER[
        (currentMenuIndex + direction + MENU_ORDER.length) % MENU_ORDER.length
      ];
      const trigger = menuTriggerRefs.current[nextMenu];
      if (trigger) toggleMenu(nextMenu, trigger);
    }
  };

  const menus: Record<MenuId, MenuItem[]> = {
        myos: [
          { label: "关于 MyOS", icon: { kind: "system", name: "info" }, action: () => openApp("about") },
          { label: "系统设置…", icon: { kind: "system", name: "settings" }, action: () => openApp("settings"), separatorBefore: true },
        ],
        go: [
          { label: "欢迎", icon: { kind: "app", appId: "welcome" }, action: () => openApp("welcome") },
          { label: "作品", icon: { kind: "app", appId: "work" }, action: () => openApp("work") },
          { label: "关于我", icon: { kind: "app", appId: "about" }, action: () => openApp("about") },
          { label: "实验室", icon: { kind: "app", appId: "lab" }, action: () => openApp("lab") },
          { label: "联系我", icon: { kind: "app", appId: "contact" }, action: () => openApp("contact") },
        ],
        window: [
          {
            label: "关闭当前窗口",
            icon: { kind: "system", name: "close" },
            action: () => {
              if (state.activeWindowId) closeApp(state.activeWindowId);
            },
            shortcut: "⌘W",
            disabled: !state.activeWindowId,
          },
          {
            label: "最小化",
            icon: { kind: "system", name: "minimize" },
            action: () => {
              if (state.activeWindowId) minimizeApp(state.activeWindowId);
            },
            shortcut: "⌘M",
            disabled: !activeWindow,
          },
          {
            label: activeWindow?.status === "maximized" ? "还原原始大小" : "缩放窗口",
            icon: { kind: "system", name: activeWindow?.status === "maximized" ? "restore" : "maximize" },
            action: () => {
              if (state.activeWindowId) toggleMaximize(state.activeWindowId);
            },
            disabled: !activeWindow,
            separatorBefore: true,
          },
          {
            label: "窗口居中",
            icon: { kind: "system", name: "move" },
            action: () => {
              if (state.activeWindowId) {
                dispatch({ type: "CENTER_WINDOW", appId: state.activeWindowId, workspace });
              }
            },
            disabled: !activeWindow || activeWindow.status !== "normal",
          },
        ],
        help: [
          { label: "MyOS 使用说明", icon: { kind: "system", name: "help" }, action: () => openApp("welcome"), shortcut: "⌘?" },
          { label: "快速打开…", icon: { kind: "system", name: "search" }, action: openSearch, shortcut: "⌘K" },
        ],
      };
  const menuItems = state.activeMenu ? menus[state.activeMenu as MenuId] : undefined;

  return (
    <main
      ref={osShellRef}
      className="os-shell"
      data-theme={resolvedTheme}
      data-glass={glass}
      data-wallpaper={wallpaper}
      aria-label="MyOS 个人作品桌面"
    >
      <div className="wallpaper-aurora wallpaper-aurora-one" aria-hidden="true" />
      <div className="wallpaper-aurora wallpaper-aurora-two" aria-hidden="true" />
      <div className="wallpaper-grain" aria-hidden="true" />
      <div
        ref={liquidCanvasHostRef}
        className="liquid-canvas-host"
        data-liquid-ignore=""
        aria-hidden="true"
      />

      <header className="menu-bar" data-liquid-ignore="" aria-label="系统菜单栏">
        <div className="menu-left">
          <button
            className="monogram"
            aria-label="打开 MyOS 菜单"
            aria-haspopup="menu"
            aria-expanded={state.activeMenu === "myos"}
            ref={(element) => {
              if (element) menuTriggerRefs.current.myos = element;
            }}
            onClick={(event) => toggleMenu("myos", event.currentTarget)}
            onKeyDown={(event) => handleMenuTriggerKeyDown(event, "myos")}
            onPointerEnter={(event) => {
              if (state.activeMenu && state.activeMenu !== "myos") {
                toggleMenu("myos", event.currentTarget);
              }
            }}
          >
            {portfolioContent.monogram}
          </button>
          <strong className="active-app-name">{activeApp?.title ?? "桌面"}</strong>
          {([{ id: "go", label: "前往" }, { id: "window", label: "窗口" }, { id: "help", label: "帮助" }] as const).map((menu) => (
            <button
              className="desktop-menu-button"
              key={menu.id}
              aria-haspopup="menu"
              aria-expanded={state.activeMenu === menu.id}
              ref={(element) => {
                if (element) menuTriggerRefs.current[menu.id] = element;
              }}
              onClick={(event) => toggleMenu(menu.id, event.currentTarget)}
              onKeyDown={(event) => handleMenuTriggerKeyDown(event, menu.id)}
              onPointerEnter={(event) => {
                if (state.activeMenu && state.activeMenu !== menu.id) {
                  toggleMenu(menu.id, event.currentTarget);
                }
              }}
            >
              {menu.label}
            </button>
          ))}
        </div>
        <div className="menu-right">
          <button
            className="status-button theme-toggle"
            aria-label={`切换外观，当前为${resolvedTheme === "dark" ? "深色" : "浅色"}`}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            <SystemIcon name="appearance" size={15} />
          </button>
          <button
            className="status-button"
            aria-label="快速打开应用"
            onClick={openSearch}
          >
            <SystemIcon name="search" size={15} />
          </button>
          <time suppressHydrationWarning>{clock}</time>
        </div>
      </header>

      {menuItems ? (
        <div
          ref={menuPopoverRef}
          className="menu-popover"
          data-menu={state.activeMenu}
          data-liquid-ignore=""
          role="menu"
          tabIndex={-1}
          style={{ left: menuLeft }}
          aria-label={MENU_LABELS[state.activeMenu as MenuId]}
          onKeyDown={handleMenuKeyDown}
        >
          {menuItems.map((item) => (
            <div className="menu-entry" role="none" key={item.label}>
              {item.separatorBefore ? <div className="menu-separator" role="separator" /> : null}
              <button
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  closeMenuAndRestoreFocus();
                  item.action();
                }}
              >
                <span className="menu-item-icon" aria-hidden="true">
                  {item.icon.kind === "system"
                    ? <SystemIcon name={item.icon.name} size={14} strokeWidth={1.6} />
                    : <AppIcon appId={item.icon.appId} size={14} strokeWidth={1.6} />}
                </span>
                <span className="menu-item-label">{item.label}</span>
                {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <section
        className="desktop"
        data-liquid-ignore=""
        aria-label="桌面"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            dispatch({ type: "ACTIVATE_DESKTOP" });
          }
        }}
      >
        {!isMobile ? (
          <div className="window-layer" ref={windowLayerRef} aria-live="polite">
            {state.stack.map((appId, stackIndex) => {
              const windowState = state.windows[appId];
              const definition = definitions.get(appId);
              if (!windowState || !definition || windowState.status === "minimized") return null;
              const fitted = windowState.status === "maximized"
                ? { ...workspace }
                : clampBounds(windowState.bounds, workspace, definition.minSize);
              const isActive = state.activeWindowId === appId;
              return (
                <section
                  className={`os-window${isActive ? " is-active" : ""}${windowState.status === "maximized" ? " is-maximized" : ""}`}
                  style={{ left: fitted.x, top: fitted.y, width: fitted.width, height: fitted.height, zIndex: 100 + stackIndex }}
                  aria-labelledby={`window-title-${appId}`}
                  data-window-app={appId}
                  key={appId}
                >
                  <div
                    className="window-titlebar"
                    role="group"
                    aria-label={`${definition.title}窗口标题栏`}
                    onDoubleClick={() => toggleMaximize(appId)}
                    onPointerDown={(event) => beginGesture(event, appId, windowState, "move")}
                    onPointerMove={continueGesture}
                    onPointerUp={endGesture}
                    onPointerCancel={endGesture}
                  >
                    <div className="traffic-lights" aria-label="窗口控制">
                      <button type="button" className="traffic close" aria-label={`关闭${definition.title}窗口`} onFocus={() => dispatch({ type: "FOCUS_WINDOW", appId })} onPointerDown={(event) => { event.stopPropagation(); dispatch({ type: "FOCUS_WINDOW", appId }); }} onClick={() => closeApp(appId)}>
                        <SystemIcon name="close" size={8} strokeWidth={1.25} />
                      </button>
                      <button type="button" className="traffic minimize" aria-label={`最小化${definition.title}窗口`} onFocus={() => dispatch({ type: "FOCUS_WINDOW", appId })} onPointerDown={(event) => { event.stopPropagation(); dispatch({ type: "FOCUS_WINDOW", appId }); }} onClick={() => minimizeApp(appId)}>
                        <SystemIcon name="minimize" size={8} strokeWidth={1.25} />
                      </button>
                      <button type="button" className="traffic maximize" aria-label={`${windowState.status === "maximized" ? "还原" : "缩放"}${definition.title}窗口`} onFocus={() => dispatch({ type: "FOCUS_WINDOW", appId })} onPointerDown={(event) => { event.stopPropagation(); dispatch({ type: "FOCUS_WINDOW", appId }); }} onClick={() => toggleMaximize(appId)}>
                        <SystemIcon name={windowState.status === "maximized" ? "restore" : "maximize"} size={8} strokeWidth={1.25} />
                      </button>
                    </div>
                    <button
                      className="window-title-control"
                      id={`window-title-${appId}`}
                      type="button"
                      ref={(element) => {
                        if (element) windowRefs.current[appId] = element;
                      }}
                      aria-label={`${definition.title}窗口。方向键移动，Shift 加方向键调整大小，回车缩放，Home 居中。`}
                      onKeyDown={(event) => handleTitleKey(event, appId, windowState)}
                    >
                      <span aria-hidden="true"><AppIcon appId={appId} size={14} /></span>
                      {definition.title}
                    </button>
                    <span className="titlebar-spacer" />
                  </div>
                  <div className="window-content">
                    <AppContent
                      appId={appId}
                      openApp={openApp}
                      theme={theme}
                      setTheme={setTheme}
                      glass={glass}
                      setGlass={setGlass}
                      wallpaper={wallpaper}
                      setWallpaper={setWallpaper}
                    />
                  </div>
                  {windowState.status === "normal"
                    ? (["n", "s", "e", "w", "ne", "nw", "se", "sw"] as ResizeEdge[]).map((edge) => (
                        <span
                          className={`resize-handle resize-${edge}`}
                          key={edge}
                          aria-hidden="true"
                          onPointerDown={(event) => beginGesture(event, appId, windowState, "resize", edge)}
                          onPointerMove={continueGesture}
                          onPointerUp={endGesture}
                          onPointerCancel={endGesture}
                        />
                      ))
                    : null}
                </section>
              );
            })}
          </div>
        ) : mobileActiveApp ? (
          <section className="mobile-app-panel" aria-labelledby={`mobile-title-${mobileActiveApp}`}>
            <header className="mobile-app-titlebar">
              <button ref={mobileBackButtonRef} className="mobile-back-button" aria-label="返回桌面" onClick={returnToMobileDesktop}>
                <SystemIcon name="back" size={20} />
                <span>桌面</span>
              </button>
              <strong id={`mobile-title-${mobileActiveApp}`}>{definitions.get(mobileActiveApp)?.title}</strong>
              <span aria-hidden="true" />
            </header>
            <div className="mobile-app-content">
              <AppContent
                appId={mobileActiveApp}
                openApp={openApp}
                theme={theme}
                setTheme={setTheme}
                glass={glass}
                setGlass={setGlass}
                wallpaper={wallpaper}
                setWallpaper={setWallpaper}
              />
            </div>
          </section>
        ) : (
          <section className="mobile-launcher" aria-labelledby="launcher-title">
            <div className="launcher-intro">
              <span>MYOS · PORTFOLIO</span>
              <h1 id="launcher-title">你好，我是<br />{portfolioContent.ownerName}。</h1>
              <p>选择一个应用，进入我的作品与想法。</p>
            </div>
            <div className="launcher-grid">
              {appDefinitions.filter((app) => app.id !== "trash").map((app) => (
                <button
                  key={app.id}
                  ref={(element) => {
                    if (element) launcherAppRefs.current[app.id] = element;
                  }}
                  onClick={() => openApp(app.id)}
                >
                  <span className="app-tile" style={appStyle(app.accent)} aria-hidden="true">
                    <AppIcon appId={app.id} size={30} />
                  </span>
                  <strong>{app.title}</strong>
                </button>
              ))}
            </div>
          </section>
        )}
      </section>

      {state.searchOpen ? (
        <div
          className="spotlight-backdrop"
          data-liquid-ignore=""
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              dispatch({ type: "SET_SEARCH", open: false });
            }
          }}
        >
          <section
            className="spotlight"
            role="dialog"
            aria-modal="true"
            aria-label="快速打开应用"
          >
            <label className="spotlight-input">
              <span aria-hidden="true"><SystemIcon name="search" size={22} /></span>
              <input
                ref={searchInputRef}
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setSearchActiveIndex(0);
                }}
                onKeyDown={(event) => {
                  handleSearchInputKeyDown(event);
                  handleSearchDialogKeyDown(event);
                }}
                placeholder="快速打开作品、关于我或设置…"
                aria-label="快速打开应用"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="search-results"
                aria-expanded="true"
                aria-activedescendant={searchedApps[searchActiveIndex] ? `search-result-${searchedApps[searchActiveIndex].id}` : undefined}
              />
              <kbd>ESC</kbd>
            </label>
            <div id="search-results" className="spotlight-results" role="listbox" aria-label="搜索结果">
              {searchedApps.map((app, index) => (
                <button
                  id={`search-result-${app.id}`}
                  className={index === searchActiveIndex ? "is-selected" : undefined}
                  role="option"
                  aria-selected={index === searchActiveIndex}
                  tabIndex={-1}
                  ref={(element) => {
                    searchResultRefs.current[index] = element;
                  }}
                  key={app.id}
                  onPointerEnter={() => setSearchActiveIndex(index)}
                  onFocus={() => setSearchActiveIndex(index)}
                  onKeyDown={handleSearchDialogKeyDown}
                  onClick={() => selectSearchResult(app.id)}
                >
                  <span className="search-app-icon" style={appStyle(app.accent)} aria-hidden="true">
                    <AppIcon appId={app.id} size={20} />
                  </span>
                  <span><strong>{app.title}</strong><small>{app.description}</small></span>
                  <i aria-hidden="true"><SystemIcon name="return" size={15} /></i>
                </button>
              ))}
              {searchedApps.length === 0 ? <p>没有找到匹配的应用。</p> : null}
            </div>
          </section>
        </div>
      ) : null}

      <nav
        ref={dockRef}
        className={`dock${isMobile && mobileActiveApp ? " is-mobile-hidden" : ""}`}
        data-liquid-ignore=""
        aria-label="应用程序 Dock"
        onPointerMove={handleDockPointerMove}
        onPointerLeave={resetDockMagnification}
        onPointerCancel={resetDockMagnification}
      >
        <span
          ref={dockLiquidTargetRef}
          className="dock-liquid-lens"
          data-liquid-target="dock"
          aria-hidden="true"
        />
        {appDefinitions.filter((app) => app.dock && app.id !== "trash").map((app) => {
          const running = Boolean(state.windows[app.id]);
          const active = activeAppId === app.id;
          return (
            <button
              className={`dock-app dock-magnify-item${active ? " is-active" : ""}`}
              style={appStyle(app.accent)}
              aria-label={`${app.title}${running ? "，正在运行" : ""}`}
              key={app.id}
              ref={(element) => {
                if (element) dockAppRefs.current[app.id] = element;
              }}
              onClick={() => openApp(app.id)}
            >
              <span aria-hidden="true"><AppIcon appId={app.id} size={24} /></span>
              <small>{app.title}</small>
              {running ? <i className="running-dot" /> : null}
            </button>
          );
        })}
        {Object.values(state.windows).some((windowState) => windowState?.status === "minimized") ? <span className="dock-divider" /> : null}
        {Object.values(state.windows).filter((windowState) => windowState?.status === "minimized").map((windowState) => {
          if (!windowState) return null;
          const app = definitions.get(windowState.appId);
          if (!app) return null;
          return (
            <button
              className="minimized-window dock-magnify-item"
              key={`min-${app.id}`}
              aria-label={`恢复${app.title}窗口`}
              ref={(element) => {
                if (element) minimizedWindowRefs.current[app.id] = element;
              }}
              onClick={() => openApp(app.id)}
            >
              <span style={appStyle(app.accent)} aria-hidden="true">
                <AppIcon appId={app.id} size={16} />
              </span>
              <small>{app.title}</small>
            </button>
          );
        })}
        <span className="dock-divider" />
        <button
          className="dock-app dock-trash dock-magnify-item"
          style={appStyle(definitions.get("trash")?.accent ?? "#789b91")}
          aria-label="废纸篓"
          ref={(element) => {
            if (element) dockAppRefs.current.trash = element;
          }}
          onClick={() => openApp("trash")}
        >
          <span aria-hidden="true"><AppIcon appId="trash" size={24} /></span>
          <small>废纸篓</small>
          {state.windows.trash ? <i className="running-dot" /> : null}
        </button>
      </nav>

      <span className="sr-only" aria-live="polite">{activeApp ? `当前应用：${activeApp.title}` : "当前位于桌面"}</span>
    </main>
  );
}
