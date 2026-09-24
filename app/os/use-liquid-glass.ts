"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import type { LiquidGLFactory, LiquidGLLens } from "liquid-gl";

export type OpticalGlassPreference = "clear" | "standard" | "readable";

export interface OpticalGlassEnvironment {
  preferencesReady: boolean;
  glass: OpticalGlassPreference;
  mobile: boolean;
  finePointer: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  forcedColors: boolean;
  webGL: boolean;
}

interface LiquidGLRenderer {
  canvas: HTMLCanvasElement;
  captureSnapshot?: () => Promise<unknown> | unknown;
}

interface MyOSLiquidRuntime {
  status: "idle" | "loading" | "ready" | "failed";
  target?: HTMLElement;
  canvas?: HTMLCanvasElement;
  renderer?: LiquidGLRenderer;
  lens?: LiquidGLLens;
  promise?: Promise<MyOSLiquidRuntime>;
}

declare global {
  interface Window {
    __liquidGLRenderer__?: LiquidGLRenderer;
    __myOSLiquidRuntime__?: MyOSLiquidRuntime;
    liquidGL?: LiquidGLFactory;
  }
}

interface UseLiquidGlassOptions {
  rootRef: RefObject<HTMLElement | null>;
  canvasHostRef: RefObject<HTMLDivElement | null>;
  targetRef: RefObject<HTMLSpanElement | null>;
  preferencesReady: boolean;
  glass: OpticalGlassPreference;
  sceneKey: string;
}

const DOCK_TARGET = "[data-liquid-target='dock']";
const READY_TIMEOUT = 5_000;
let cachedWebGLSupport: boolean | undefined;

export function shouldUseOpticalGlass(environment: OpticalGlassEnvironment) {
  return (
    environment.preferencesReady &&
    environment.glass !== "readable" &&
    !environment.mobile &&
    environment.finePointer &&
    !environment.reducedMotion &&
    !environment.highContrast &&
    !environment.forcedColors &&
    environment.webGL
  );
}

function supportsWebGL() {
  if (cachedWebGLSupport !== undefined) return cachedWebGLSupport;
  try {
    const canvas = document.createElement("canvas");
    cachedWebGLSupport = Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    cachedWebGLSupport = false;
  }
  return cachedWebGLSupport;
}

function setFallback(root: HTMLElement) {
  root.dataset.liquidWebgl = "off";
  const canvas = window.__myOSLiquidRuntime__?.canvas;
  if (canvas) canvas.style.display = "none";
}

function setReady(root: HTMLElement, runtime: MyOSLiquidRuntime) {
  if (!runtime.canvas) return;
  runtime.canvas.style.display = "block";
  root.dataset.liquidWebgl = "ready";
}

function markRuntimeFailed(root: HTMLElement, runtime: MyOSLiquidRuntime) {
  runtime.status = "failed";
  setFallback(root);
}

async function initializeLiquidGlass(
  root: HTMLElement,
  host: HTMLDivElement,
  target: HTMLSpanElement,
) {
  const existing = window.__myOSLiquidRuntime__;
  if (existing?.promise) return existing.promise;
  if (existing?.status === "ready" || existing?.status === "failed") return existing;

  const runtime: MyOSLiquidRuntime = existing ?? { status: "idle" };
  runtime.status = "loading";
  runtime.target = target;
  window.__myOSLiquidRuntime__ = runtime;

  runtime.promise = (async () => {
    const { default: liquidGL } = await import("liquid-gl");
    if (!target.isConnected || !host.isConnected) throw new Error("Liquid Glass target is no longer mounted.");

    let resolveReady: (ready: boolean) => void = () => undefined;
    const firstFrame = new Promise<boolean>((resolve) => {
      resolveReady = resolve;
    });

    const result = liquidGL({
      target: DOCK_TARGET,
      snapshot: ".os-shell",
      resolution: 1.25,
      refraction: 0.012,
      aberration: 0,
      bevelDepth: 0.075,
      bevelWidth: 0.18,
      // Clear refraction avoids the stochastic frost pass and its colored grain.
      frost: 0,
      shadow: false,
      specular: true,
      reveal: "none",
      tilt: false,
      magnify: 1.012,
      on: {
        init(instance) {
          runtime.lens = instance;
          resolveReady(true);
        },
      },
    });

    const renderer = window.__liquidGLRenderer__;
    if (!renderer?.canvas || !result || result instanceof Element || Array.isArray(result) && result.some((item) => item instanceof Element)) {
      throw new Error("Liquid Glass WebGL renderer could not start.");
    }

    runtime.renderer = renderer;
    runtime.canvas = renderer.canvas;
    host.append(renderer.canvas);
    renderer.canvas.classList.add("liquid-glass-canvas");
    renderer.canvas.setAttribute("aria-hidden", "true");

    renderer.canvas.addEventListener(
      "webglcontextlost",
      (event) => {
        event.preventDefault();
        markRuntimeFailed(root, runtime);
      },
      { once: true },
    );

    const initialized = await Promise.race([
      firstFrame,
      new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), READY_TIMEOUT)),
    ]);
    if (!initialized) throw new Error("Liquid Glass initialization timed out.");

    runtime.status = "ready";
    return runtime;
  })().catch(() => {
    markRuntimeFailed(root, runtime);
    return runtime;
  });

  return runtime.promise;
}

export function useLiquidGlass({
  rootRef,
  canvasHostRef,
  targetRef,
  preferencesReady,
  glass,
  sceneKey,
}: UseLiquidGlassOptions) {
  useEffect(() => {
    const root = rootRef.current;
    const host = canvasHostRef.current;
    const target = targetRef.current;
    if (!root || !host || !target) return;

    const mobile = window.matchMedia("(max-width: 767px)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const highContrast = window.matchMedia("(prefers-contrast: more)");
    const forcedColors = window.matchMedia("(forced-colors: active)");
    const queries = [mobile, finePointer, reducedMotion, highContrast, forcedColors];
    let cancelled = false;
    let startTimer: number | undefined;
    let captureTimer: number | undefined;

    const eligible = () =>
      shouldUseOpticalGlass({
        preferencesReady,
        glass,
        mobile: mobile.matches,
        finePointer: finePointer.matches,
        reducedMotion: reducedMotion.matches,
        highContrast: highContrast.matches,
        forcedColors: forcedColors.matches,
        webGL: supportsWebGL(),
      });

    const sync = () => {
      if (startTimer !== undefined) window.clearTimeout(startTimer);
      if (captureTimer !== undefined) window.clearTimeout(captureTimer);

      if (!eligible()) {
        setFallback(root);
        return;
      }

      const runtime = window.__myOSLiquidRuntime__;
      if (runtime?.status === "ready") {
        if (runtime.target !== target || !runtime.canvas) {
          setFallback(root);
          return;
        }
        if (runtime.canvas.parentElement !== host) host.append(runtime.canvas);
        setFallback(root);
        captureTimer = window.setTimeout(() => {
          if (cancelled || !eligible()) return;
          void Promise.resolve(runtime.renderer?.captureSnapshot?.())
            .then(() => {
              if (!cancelled && eligible()) setReady(root, runtime);
            })
            .catch(() => setFallback(root));
        }, 260);
        return;
      }
      if (runtime?.status === "failed") {
        setFallback(root);
        return;
      }

      setFallback(root);
      startTimer = window.setTimeout(() => {
        void initializeLiquidGlass(root, host, target).then((initializedRuntime) => {
          if (cancelled || !eligible() || initializedRuntime.status !== "ready") {
            setFallback(root);
            return;
          }
          setReady(root, initializedRuntime);
        });
      }, 100);
    };

    sync();
    queries.forEach((query) => query.addEventListener("change", sync));

    return () => {
      cancelled = true;
      if (startTimer !== undefined) window.clearTimeout(startTimer);
      if (captureTimer !== undefined) window.clearTimeout(captureTimer);
      queries.forEach((query) => query.removeEventListener("change", sync));
    };
  }, [canvasHostRef, glass, preferencesReady, rootRef, sceneKey, targetRef]);
}
