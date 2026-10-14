import { useEffect, useRef, useState } from "react";
import type { DiscControls } from "./disc-stage";
import { DISC_COUNT, INITIAL_DISC_INDEX } from "./disc-gallery";
import "./WorkDisc.css";

export default function WorkDisc() {
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<DiscControls | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [selection, setSelection] = useState({ index: INITIAL_DISC_INDEX, back: false, preview: false });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let release: (() => void) | undefined;

    // Decode the artwork before the first frame, alongside loading the renderer.
    const artwork = new Image();
    artwork.src = "/works/muse-disc.png";
    Promise.all([import("./disc-stage"), artwork.decode()]).then(([{ createDiscStage }]) => {
      if (disposed) return;
      try {
        const controls = createDiscStage(mount, setSelection, () => setStatus("fallback"), artwork);
        controlsRef.current = controls;
        release = controls.dispose;
        setStatus("ready");
      } catch {
        setStatus("fallback");
      }
    }).catch(() => {
      if (!disposed) setStatus("fallback");
    });

    return () => {
      disposed = true;
      release?.();
      controlsRef.current = null;
    };
  }, []);

  return (
    <article className="work-disc-view" aria-label="作品圆盘">
      <div
        ref={mountRef}
        className="work-disc-canvas"
        role="group"
        tabIndex={0}
        aria-label="交互圆盘画廊"
        aria-roledescription="轮播画廊"
        aria-keyshortcuts="ArrowLeft ArrowRight Home End Space Enter Escape R"
        aria-describedby="work-disc-help"
        aria-busy={status === "loading"}
        data-disc-status={status}
      >
        {status === "fallback" ? <div className="work-disc-fallback" role="img" aria-label="银色作品圆盘" /> : null}
      </div>
      <div className="work-disc-caption" aria-hidden="true">
        <span>{selection.preview ? "DISC PREVIEW" : "SELECTED WORK"}</span>
        <strong>{String(selection.index + 1).padStart(2, "0")}</strong>
      </div>
      <footer className="work-disc-controls">
        <span id="work-disc-help">{selection.preview ? "拖动旋转 · 空格翻面 · Esc 返回" : "滚动 / 拖动浏览 · 点击查看 · 空格翻面"}</span>
        {selection.preview ? <button type="button" onClick={() => { controlsRef.current?.closePreview(); mountRef.current?.focus({ preventScroll: true }); }}>返回画廊</button> : null}
        <div className="work-disc-navigation" role="group" aria-label="切换圆盘">
          <button type="button" aria-label="上一张圆盘" disabled={status !== "ready" || selection.index === 0} onClick={() => controlsRef.current?.previous()}>←</button>
          <span className="work-disc-counter" aria-live="polite" aria-atomic="true">{String(selection.index + 1).padStart(2, "0")} / {String(DISC_COUNT).padStart(2, "0")}</span>
          <button type="button" aria-label="下一张圆盘" disabled={status !== "ready" || selection.index === DISC_COUNT - 1} onClick={() => controlsRef.current?.next()}>→</button>
        </div>
        <button
          type="button"
          aria-pressed={selection.back}
          disabled={status !== "ready"}
          onClick={() => controlsRef.current?.flip()}
        >翻面</button>
        <button
          type="button"
          disabled={status !== "ready"}
          onClick={() => controlsRef.current?.reset()}
        >复位</button>
      </footer>
    </article>
  );
}
