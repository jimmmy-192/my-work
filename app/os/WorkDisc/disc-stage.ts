import * as THREE from "three";
import { createDiscModel, createDiscEnvironment, addDiscLights } from "./disc-model";
import { advanceSpring } from "./disc-motion";
import type { SpringValue } from "./disc-motion";

export interface DiscControls {
  flip(): void;
  reset(): void;
  dispose(): void;
}

const spring = (value = 0): SpringValue => ({ value, velocity: 0 });
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

function createHoverRing() {
  const root = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: "#202329", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  const segments = 100;
  const geometries = [0, 1].map(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array((segments + 1) * 6), 3));
    const indices: number[] = [];
    for (let i = 0; i < segments; i += 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    root.add(mesh);
    return geometry;
  });
  return {
    root,
    update(frame: number, amount: number) {
      root.visible = amount > 0.002;
      material.opacity = amount * 0.8;
      geometries.forEach((geometry, loop) => {
        const positions = geometry.getAttribute("position");
        const phase = Math.sin(frame * 1.7 + loop * 4) * 0.15 + loop * 2.6;
        const span = Math.PI * (1.68 + loop * 0.08) * Math.min(1, amount * 1.8);
        for (let i = 0; i <= segments; i += 1) {
          const t = i / segments;
          const angle = phase + span * t;
          const jitter = Math.sin(angle * 9 + frame * 0.8 + loop) * 0.007 + Math.cos(angle * 17 - frame) * 0.003;
          const radius = 1.052 + loop * 0.027 + jitter;
          const thickness = 0.0028 * Math.min(1, t * 12 + 0.25, (1 - t) * 12 + 0.25);
          positions.setXYZ(i * 2, Math.cos(angle) * (radius - thickness), Math.sin(angle) * (radius - thickness), 0.035);
          positions.setXYZ(i * 2 + 1, Math.cos(angle) * (radius + thickness), Math.sin(angle) * (radius + thickness), 0.035);
        }
        positions.needsUpdate = true;
      });
    },
    dispose() {
      geometries.forEach((geometry) => geometry.dispose());
      material.dispose();
    },
  };
}

export function createDiscStage(
  mount: HTMLElement,
  onFaceChange: (back: boolean) => void,
  onUnavailable: () => void,
): DiscControls {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", { alpha: true, antialias: true, powerPreference: "low-power" });
  if (!context) throw new Error("WebGL is unavailable");
  canvas.setAttribute("aria-hidden", "true");
  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor("#ffffff", 1);
  let environment: ReturnType<typeof createDiscEnvironment>;
  let model: ReturnType<typeof createDiscModel>;
  try {
    environment = createDiscEnvironment(renderer);
    try {
      model = createDiscModel();
    } catch (error) {
      environment.dispose();
      throw error;
    }
  } catch (error) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }

  const scene = new THREE.Scene();
  scene.environment = environment.texture;
  scene.environmentIntensity = 1;
  addDiscLights(scene);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
  const pose = new THREE.Group();
  const spin = new THREE.Group();
  const ring = createHoverRing();
  pose.add(spin, ring.root);
  spin.add(model.root);
  scene.add(pose);
  const pickGeometry = new THREE.RingGeometry(0.14, 1, 80);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  const pick = new THREE.Mesh(pickGeometry, pickMaterial);
  spin.add(pick);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const localHit = new THREE.Vector3();
  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = reducedQuery.matches;
  let disposed = false;
  let unavailable = false;
  let visible = true;
  let raf = 0;
  let scribbleTimer = 0;
  let lastTime = 0;
  let ringFrame = -1;
  let back = false;
  let hovered = false;
  let hoverX = 0;
  let hoverY = 0;
  let hoverAmount = 0;
  let pitchTarget = 0;
  let yawTarget = 0;
  let dragging: { id: number; x: number; y: number; pitch: number; yaw: number; moved: boolean } | null = null;
  const tiltX = spring(-0.35);
  const tiltY = spring(-0.38);
  const pitch = spring();
  const yaw = spring();

  function stop() {
    window.cancelAnimationFrame(raf);
    window.clearTimeout(scribbleTimer);
    raf = 0;
    scribbleTimer = 0;
    lastTime = 0;
  }
  function wake() {
    if (disposed || unavailable || !visible || document.hidden || raf) return;
    window.clearTimeout(scribbleTimer);
    scribbleTimer = 0;
    raf = window.requestAnimationFrame(draw);
  }
  function draw(time: number) {
    raf = 0;
    if (disposed || unavailable || !visible || document.hidden) return;
    const dt = lastTime ? Math.min(0.05, (time - lastTime) / 1000) : 1 / 60;
    lastTime = time;
    const targetX = -0.35 + (reduced || dragging ? 0 : -hoverY * 0.2);
    const targetY = -0.38 + (reduced || dragging ? 0 : hoverX * 0.24);
    const targetYaw = (back ? Math.PI : 0) + yawTarget;
    const motion: boolean[] = [];
    for (const [value, target] of [[tiltX, targetX], [tiltY, targetY], [pitch, pitchTarget], [yaw, targetYaw]] as const) {
      if (reduced) { value.value = target; value.velocity = 0; }
      else motion.push(advanceSpring(value, target, dt));
    }
    pose.rotation.set(tiltX.value, tiltY.value, -0.06);
    spin.rotation.set(pitch.value, yaw.value, 0);
    const amount = hovered && !dragging ? 1 : 0;
    hoverAmount = reduced ? amount : hoverAmount + (amount - hoverAmount) * (1 - Math.exp(-dt * 13));
    if (Math.abs(hoverAmount - amount) < 0.002) hoverAmount = amount;
    const frame = reduced ? 0 : Math.floor(time / 100);
    if (frame !== ringFrame || hoverAmount !== amount || !hoverAmount) {
      ring.update(frame, hoverAmount);
      ringFrame = frame;
    }
    renderer.render(scene, camera);
    if (motion.some(Boolean) || hoverAmount !== amount) wake();
    else if (hovered && !reduced) scribbleTimer = window.setTimeout(wake, 100);
    else lastTime = 0;
  }
  function resize() {
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4_000_000 / (width * height)));
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = Math.max(3.8, 1.22 / (Math.tan(THREE.MathUtils.degToRad(18)) * Math.min(1, camera.aspect)));
    camera.updateProjectionMatrix();
    wake();
  }
  function hit(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / Math.max(1, rect.width) * 2 - 1, 1 - (event.clientY - rect.top) / Math.max(1, rect.height) * 2);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObject(pick)[0];
  }
  function hover(event: PointerEvent) {
    const intersection = hit(event);
    hovered = !!intersection;
    if (intersection) {
      pose.worldToLocal(localHit.copy(intersection.point));
      hoverX = clamp(localHit.x, -1, 1);
      hoverY = clamp(localHit.y, -1, 1);
    } else { hoverX = 0; hoverY = 0; }
    mount.style.cursor = hovered ? "grab" : "default";
  }
  function down(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0 || !hit(event)) return;
    event.preventDefault();
    mount.focus({ preventScroll: true });
    mount.setPointerCapture(event.pointerId);
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, pitch: pitch.value, yaw: yaw.value - (back ? Math.PI : 0), moved: false };
    mount.style.cursor = "grabbing";
    wake();
  }
  function move(event: PointerEvent) {
    if (dragging) {
      if (event.pointerId !== dragging.id) return;
      const dx = event.clientX - dragging.x;
      const dy = event.clientY - dragging.y;
      dragging.moved ||= Math.hypot(dx, dy) > 4;
      pitchTarget = clamp(dragging.pitch + dy * 0.005, -1.2, 1.2);
      yawTarget = clamp(dragging.yaw + dx * 0.006, -Math.PI, Math.PI);
    } else if (event.pointerType === "mouse" || event.pointerType === "pen") hover(event);
    wake();
  }
  function end(event: PointerEvent) {
    if (!dragging || event.pointerId !== dragging.id) return;
    const id = dragging.id;
    dragging = null;
    pitchTarget = 0;
    yawTarget = 0;
    if (mount.hasPointerCapture(id)) mount.releasePointerCapture(id);
    if (event.type === "pointerup" && event.pointerType === "mouse") hover(event);
    else { hovered = false; hoverX = 0; hoverY = 0; }
    mount.style.cursor = hovered ? "grab" : "default";
    wake();
  }
  function leave() {
    if (dragging) return;
    hovered = false;
    hoverX = 0;
    hoverY = 0;
    wake();
  }
  function reset() {
    back = false;
    pitchTarget = 0;
    yawTarget = 0;
    hovered = false;
    hoverX = 0;
    hoverY = 0;
    onFaceChange(false);
    wake();
  }
  function flip() {
    back = !back;
    pitchTarget = 0;
    yawTarget = 0;
    onFaceChange(back);
    wake();
  }
  function key(event: KeyboardEvent) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === " " || event.key === "Enter") { event.preventDefault(); flip(); }
    else if (event.key === "Home" || event.key.toLowerCase() === "r") { event.preventDefault(); reset(); }
  }
  function visibility() { if (document.hidden) stop(); else wake(); }
  function preference() { reduced = reducedQuery.matches; wake(); }
  function lost(event: Event) {
    event.preventDefault();
    unavailable = true;
    stop();
    canvas.style.display = "none";
    onUnavailable();
  }
  const observer = new ResizeObserver(resize);
  const intersectionObserver = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    if (visible) wake(); else stop();
  });
  mount.appendChild(canvas);
  mount.addEventListener("pointerdown", down);
  mount.addEventListener("pointermove", move);
  mount.addEventListener("pointerup", end);
  mount.addEventListener("pointercancel", end);
  mount.addEventListener("lostpointercapture", end);
  mount.addEventListener("pointerleave", leave);
  mount.addEventListener("keydown", key);
  canvas.addEventListener("webglcontextlost", lost);
  document.addEventListener("visibilitychange", visibility);
  reducedQuery.addEventListener("change", preference);
  observer.observe(mount);
  intersectionObserver.observe(mount);
  resize();

  return {
    flip,
    reset,
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      if (dragging && mount.hasPointerCapture(dragging.id)) mount.releasePointerCapture(dragging.id);
      observer.disconnect();
      intersectionObserver.disconnect();
      mount.removeEventListener("pointerdown", down);
      mount.removeEventListener("pointermove", move);
      mount.removeEventListener("pointerup", end);
      mount.removeEventListener("pointercancel", end);
      mount.removeEventListener("lostpointercapture", end);
      mount.removeEventListener("pointerleave", leave);
      mount.removeEventListener("keydown", key);
      canvas.removeEventListener("webglcontextlost", lost);
      document.removeEventListener("visibilitychange", visibility);
      reducedQuery.removeEventListener("change", preference);
      scene.environment = null;
      scene.clear();
      ring.dispose();
      pickGeometry.dispose();
      pickMaterial.dispose();
      model.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      mount.style.removeProperty("cursor");
    },
  };
}
