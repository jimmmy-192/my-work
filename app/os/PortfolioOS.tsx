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
  action: () => void | null;
  shortcut?: string;
  disabled?: boolean;
}

const DEFAULT_WORKSPACE: Bounds = { x: 8, y: 8, width: 1180, height: 690 };
const THEME_KEY = "myos-theme";
const GLASS_KEY = "myos-glass";

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function isTheme(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isGlass(value: string | null): value is GlassPreference {
  return value === "clear" || value === "standard" || value === "readable";
}

function appStyle(accent: string): CSSProperties {
  return { "--app-accent": accent } as CSSProperties;
}

export function PortfolioOS() {
  const [state, dispatch] = useReducer(osReducer, undefined, createInitialOSState);
  const [clock, setClock] = useState("");
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [glass, setGlass] = useState<GlassPreference>("standard");
  const [systemDark, setSystemDark] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileActiveApp, setMobileActiveApp] = useState<AppId | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [workspace, setWorkspace] = useState<Bounds>(DEFAULT_WORKSPACE);
  const windowLayerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gestureRef = useRef<PointerGesture | null>(null);

  const definitions = useMemo(
    () => new Map(appDefinitions.map((app) => [app.id, app])),
    [],
  );
  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const activeAppId = isMobile ? mobileActiveApp : state.activeWindowId;
  const activeApp = activeAppId ? definitions.get(activeAppId) : undefined;

  useEffect(() => {
    const update = () => setClock(formatTime(new Date()));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedTheme = window.localStorage.getItem(THEME_KEY);
      const savedGlass = window.localStorage.getItem(GLASS_KEY);
      if (isTheme(savedTheme)) setTheme(savedTheme);
      if (isGlass(savedGlass)) setGlass(savedGlass);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(GLASS_KEY, glass);
  }, [glass]);

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
  }, []);

  useEffect(() => {
    if (!state.searchOpen) return;
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [state.searchOpen]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        dispatch({ type: "SET_SEARCH", open: true });
        return;
      }
      if (event.key === "Escape") {
        dispatch({ type: "CLOSE_OVERLAYS" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
      );
      dispatch({ type: "OPEN_APP", appId, bounds: requested });
      if (isMobile) setMobileActiveApp(appId);
    },
    [definitions, isMobile, state.stack.length, workspace],
  );

  const minimizeApp = useCallback(
    (appId: AppId) => {
      dispatch({ type: "MINIMIZE_WINDOW", appId });
      if (isMobile) setMobileActiveApp(null);
    },
    [isMobile],
  );

  const closeApp = useCallback(
    (appId: AppId) => {
      dispatch({ type: "CLOSE_WINDOW", appId });
      if (isMobile) setMobileActiveApp(null);
    },
    [isMobile],
  );

  const toggleMaximize = useCallback(
    (appId: AppId) => dispatch({ type: "TOGGLE_MAXIMIZE", appId, workspace }),
    [workspace],
  );

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
    const fitted = clampBounds(windowState.bounds, workspace);
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
    const next = { ...gesture.startBounds };
    if (edge.includes("e")) next.width = Math.max(MIN_WIDTH, gesture.startBounds.width + dx);
    if (edge.includes("s")) next.height = Math.max(MIN_HEIGHT, gesture.startBounds.height + dy);
    if (edge.includes("w")) {
      next.width = Math.max(MIN_WIDTH, gesture.startBounds.width - dx);
      next.x = gesture.startBounds.x + (gesture.startBounds.width - next.width);
    }
    if (edge.includes("n")) {
      next.height = Math.max(MIN_HEIGHT, gesture.startBounds.height - dy);
      next.y = gesture.startBounds.y + (gesture.startBounds.height - next.height);
    }
    dispatch({ type: "RESIZE_WINDOW", appId: gesture.appId, bounds: clampBounds(next, workspace) });
  };

  const endGesture = (event: ReactPointerEvent<HTMLElement>) => {
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    gestureRef.current = null;
  };

  const handleTitleKey = (event: KeyboardEvent<HTMLDivElement>, appId: AppId, windowState: WindowState) => {
    if (windowState.status !== "normal") {
      if (event.key === "Enter") toggleMaximize(appId);
      return;
    }
    const step = 16;
    const next = clampBounds(windowState.bounds, workspace);
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
      dispatch({ type: "RESIZE_WINDOW", appId, bounds: clampBounds(next, workspace) });
    } else {
      if (event.key === "ArrowLeft") next.x -= step;
      if (event.key === "ArrowRight") next.x += step;
      if (event.key === "ArrowUp") next.y -= step;
      if (event.key === "ArrowDown") next.y += step;
      dispatch({ type: "MOVE_WINDOW", appId, bounds: clampBounds(next, workspace) });
    }
  };

  const activeWindow = state.activeWindowId ? state.windows[state.activeWindowId] : undefined;
  const searchedApps = appDefinitions.filter((app) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return `${app.title} ${app.description} ${app.id}`.toLowerCase().includes(query);
  });

  const menus: Record<string, MenuItem[]> = {
        myos: [
          { label: "关于 MyOS", action: () => openApp("about") },
          { label: "系统设置…", action: () => openApp("settings"), shortcut: "⌘," },
        ],
        file: [
          { label: "打开作品", action: () => openApp("work"), shortcut: "↵" },
          {
            label: "关闭当前窗口",
            action: () => state.activeWindowId && closeApp(state.activeWindowId),
            disabled: !state.activeWindowId,
          },
        ],
        window: [
          {
            label: "最小化",
            action: () => state.activeWindowId && minimizeApp(state.activeWindowId),
            disabled: !activeWindow,
          },
          {
            label: activeWindow?.status === "maximized" ? "还原窗口" : "最大化",
            action: () => state.activeWindowId && toggleMaximize(state.activeWindowId),
            disabled: !activeWindow,
          },
          {
            label: "窗口居中",
            action: () => state.activeWindowId && dispatch({ type: "CENTER_WINDOW", appId: state.activeWindowId, workspace }),
            disabled: !activeWindow || activeWindow.status !== "normal",
          },
        ],
        help: [
          { label: "打开使用说明", action: () => openApp("welcome") },
          { label: "搜索应用", action: () => dispatch({ type: "SET_SEARCH", open: true }), shortcut: "⌘K" },
        ],
      };
  const menuItems = state.activeMenu ? menus[state.activeMenu] : undefined;

  return (
    <main
      className="os-shell"
      data-theme={resolvedTheme}
      data-glass={glass}
      aria-label="MyOS 个人作品桌面"
    >
      <div className="wallpaper-aurora wallpaper-aurora-one" aria-hidden="true" />
      <div className="wallpaper-aurora wallpaper-aurora-two" aria-hidden="true" />
      <div className="wallpaper-grain" aria-hidden="true" />

      <header className="menu-bar" aria-label="系统菜单栏">
        <div className="menu-left">
          <button
            className="monogram"
            aria-label="打开 MyOS 菜单"
            aria-expanded={state.activeMenu === "myos"}
            onClick={() => dispatch({ type: "TOGGLE_MENU", menu: "myos" })}
          >
            {portfolioContent.monogram}
          </button>
          <strong className="active-app-name">{activeApp?.title ?? "桌面"}</strong>
          {[{ id: "file", label: "文件" }, { id: "window", label: "窗口" }, { id: "help", label: "帮助" }].map((menu) => (
            <button
              className="desktop-menu-button"
              key={menu.id}
              aria-haspopup="menu"
              aria-expanded={state.activeMenu === menu.id}
              onClick={() => dispatch({ type: "TOGGLE_MENU", menu: menu.id })}
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
            ◐
          </button>
          <button
            className="status-button"
            aria-label="搜索应用"
            onClick={() => dispatch({ type: "SET_SEARCH", open: true })}
          >
            ⌕
          </button>
          <time suppressHydrationWarning>{clock}</time>
        </div>
      </header>

      {menuItems ? (
        <div className="menu-popover" data-menu={state.activeMenu} role="menu">
          {menuItems.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.action();
                dispatch({ type: "CLOSE_OVERLAYS" });
              }}
            >
              <span>{item.label}</span>
              {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
            </button>
          ))}
        </div>
      ) : null}

      <section
        className="desktop"
        aria-label="桌面"
        onPointerDown={() => dispatch({ type: "CLOSE_OVERLAYS" })}
      >
        {!isMobile ? (
          <div className="desktop-icons" aria-label="桌面快捷方式">
            {appDefinitions.filter((app) => app.desktop && app.id !== "welcome").map((app) => (
              <button className="desktop-shortcut" key={app.id} onClick={() => openApp(app.id)}>
                <span className="app-tile" style={appStyle(app.accent)} aria-hidden="true">{app.icon}</span>
                <span>{app.title}</span>
              </button>
            ))}
          </div>
        ) : null}

        {!isMobile ? (
          <div className="window-layer" ref={windowLayerRef} aria-live="polite">
            {state.stack.map((appId, stackIndex) => {
              const windowState = state.windows[appId];
              const definition = definitions.get(appId);
              if (!windowState || !definition || windowState.status === "minimized") return null;
              const fitted = windowState.status === "maximized"
                ? { ...workspace }
                : clampBounds(windowState.bounds, workspace);
              const isActive = state.activeWindowId === appId;
              return (
                <section
                  className={`os-window${isActive ? " is-active" : ""}${windowState.status === "maximized" ? " is-maximized" : ""}`}
                  style={{ left: fitted.x, top: fitted.y, width: fitted.width, height: fitted.height, zIndex: 100 + stackIndex }}
                  aria-labelledby={`window-title-${appId}`}
                  key={appId}
                  onPointerDown={() => dispatch({ type: "FOCUS_WINDOW", appId })}
                >
                  <div
                    className="window-titlebar"
                    role="toolbar"
                    tabIndex={0}
                    aria-label={`${definition.title}窗口标题栏。方向键移动，Shift 加方向键调整大小，回车最大化，Home 居中。`}
                    onDoubleClick={() => toggleMaximize(appId)}
                    onPointerDown={(event) => beginGesture(event, appId, windowState, "move")}
                    onPointerMove={continueGesture}
                    onPointerUp={endGesture}
                    onPointerCancel={endGesture}
                    onKeyDown={(event) => handleTitleKey(event, appId, windowState)}
                  >
                    <div className="traffic-lights" aria-label="窗口控制">
                      <button className="traffic close" title="关闭" aria-label={`关闭${definition.title}窗口`} onPointerDown={(event) => event.stopPropagation()} onClick={() => closeApp(appId)} />
                      <button className="traffic minimize" title="最小化" aria-label={`最小化${definition.title}窗口`} onPointerDown={(event) => event.stopPropagation()} onClick={() => minimizeApp(appId)} />
                      <button className="traffic maximize" title="最大化或还原" aria-label={`最大化或还原${definition.title}窗口`} onPointerDown={(event) => event.stopPropagation()} onClick={() => toggleMaximize(appId)} />
                    </div>
                    <strong id={`window-title-${appId}`}><span aria-hidden="true">{definition.icon}</span>{definition.title}</strong>
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
              <button aria-label="最小化并返回桌面" onClick={() => minimizeApp(mobileActiveApp)}>—</button>
              <strong id={`mobile-title-${mobileActiveApp}`}>{definitions.get(mobileActiveApp)?.title}</strong>
              <button aria-label="关闭并返回桌面" onClick={() => closeApp(mobileActiveApp)}>×</button>
            </header>
            <div className="mobile-app-content">
              <AppContent
                appId={mobileActiveApp}
                openApp={openApp}
                theme={theme}
                setTheme={setTheme}
                glass={glass}
                setGlass={setGlass}
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
                <button key={app.id} onClick={() => openApp(app.id)}>
                  <span className="app-tile" style={appStyle(app.accent)} aria-hidden="true">{app.icon}</span>
                  <strong>{app.title}</strong>
                </button>
              ))}
            </div>
          </section>
        )}
      </section>

      {state.searchOpen ? (
        <div className="spotlight-backdrop" role="presentation" onPointerDown={() => dispatch({ type: "SET_SEARCH", open: false })}>
          <section className="spotlight" role="dialog" aria-modal="true" aria-label="搜索应用" onPointerDown={(event) => event.stopPropagation()}>
            <label className="spotlight-input">
              <span aria-hidden="true">⌕</span>
              <input
                ref={searchInputRef}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="搜索作品、关于我或设置…"
                aria-label="搜索应用"
              />
              <kbd>ESC</kbd>
            </label>
            <div className="spotlight-results" aria-label="搜索结果">
              {searchedApps.map((app) => (
                <button key={app.id} onClick={() => { openApp(app.id); setSearchTerm(""); }}>
                  <span className="search-app-icon" style={appStyle(app.accent)} aria-hidden="true">{app.icon}</span>
                  <span><strong>{app.title}</strong><small>{app.description}</small></span>
                  <i aria-hidden="true">↵</i>
                </button>
              ))}
              {searchedApps.length === 0 ? <p>没有找到匹配的应用。</p> : null}
            </div>
          </section>
        </div>
      ) : null}

      <nav className="dock" aria-label="应用程序 Dock">
        {appDefinitions.filter((app) => app.dock && app.id !== "trash").map((app) => {
          const running = Boolean(state.windows[app.id]);
          const active = activeAppId === app.id;
          return (
            <button
              className={`dock-app${active ? " is-active" : ""}`}
              style={appStyle(app.accent)}
              aria-label={`${app.title}${running ? "，正在运行" : ""}`}
              key={app.id}
              onClick={() => openApp(app.id)}
            >
              <span aria-hidden="true">{app.icon}</span>
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
            <button className="minimized-window" key={`min-${app.id}`} aria-label={`恢复${app.title}窗口`} onClick={() => openApp(app.id)}>
              <span style={appStyle(app.accent)}>{app.icon}</span>
              <small>{app.title}</small>
            </button>
          );
        })}
        <span className="dock-divider" />
        <button className="dock-app dock-trash" style={appStyle(definitions.get("trash")?.accent ?? "#789b91")} aria-label="废纸篓" onClick={() => openApp("trash")}>
          <span aria-hidden="true">⌫</span>
          <small>废纸篓</small>
          {state.windows.trash ? <i className="running-dot" /> : null}
        </button>
      </nav>

      <p className="desktop-hint">单击打开 · 拖动窗口 · ⌘K 搜索</p>
      <span className="sr-only" aria-live="polite">{activeApp ? `当前应用：${activeApp.title}` : "当前位于桌面"}</span>
    </main>
  );
}
