import { useEffect, useRef, useState } from "react";
import type { DiscControls } from "./disc-stage";
import "./WorkDisc.css";

export default function WorkDisc() {
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<DiscControls | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [back, setBack] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let release: (() => void) | undefined;

    // The renderer is loaded only when the work window is opened.
    import("./disc-stage").then(({ createDiscStage }) => {
      if (disposed) return;
      try {
        const controls = createDiscStage(mount, setBack, () => setStatus("fallback"));
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
        aria-label="交互圆盘"
        aria-describedby="work-disc-help"
        aria-busy={status === "loading"}
        data-disc-status={status}
      >
        {status === "fallback" ? <div className="work-disc-fallback" role="img" aria-label="银色作品圆盘" /> : null}
      </div>
      <footer className="work-disc-controls">
        <span id="work-disc-help">拖动转动 · 空格翻面</span>
        <button
          type="button"
          aria-pressed={back}
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
