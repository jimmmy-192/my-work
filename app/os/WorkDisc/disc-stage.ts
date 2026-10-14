import * as THREE from "three";
import { createDiscModel, createDiscEnvironment, addDiscLights } from "./disc-model";
import { advanceSpring, createTween, startTween, advanceTween } from "./disc-motion";
import { DISC_COUNT, INITIAL_DISC_INDEX, clampDiscIndex, getDiscPose } from "./disc-gallery";
import { DiscWheelInput } from "./disc-wheel";
import { DiscProgress } from "./disc-progress";
import type { SpringValue } from "./disc-motion";

export interface DiscControls {
  previous(): void;
  next(): void;
  flip(): void;
  reset(): void;
  closePreview(): void;
  dispose(): void;
}

const spring = (value = 0): SpringValue => ({ value, velocity: 0 });
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const softAngle = (angle: number) => {
  const limit = Math.PI * 0.8;
  const excess = Math.max(0, Math.abs(angle) - limit);
  return Math.sign(angle) * Math.min(Math.PI, Math.min(Math.abs(angle), limit) + excess / (1 + excess * 3));
};

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

export interface DiscSelection {
  index: number;
  back: boolean;
  preview: boolean;
}

export function createDiscStage(
  mount: HTMLElement,
  onSelectionChange: (selection: DiscSelection) => void,
  onUnavailable: () => void,
  firstArtwork?: HTMLImageElement,
): DiscControls {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", { alpha: true, antialias: true, powerPreference: "low-power" });
  if (!context) throw new Error("WebGL is unavailable");
  canvas.setAttribute("aria-hidden", "true");
  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.setClearColor("#ffffff", 1);
  const models: ReturnType<typeof createDiscModel>[] = [];
  let environment: ReturnType<typeof createDiscEnvironment>;
  try {
    environment = createDiscEnvironment(renderer);
    try {
      for (let index = 0; index < DISC_COUNT; index += 1) {
        models.push(createDiscModel({ variant: index, artwork: index === 0 ? firstArtwork : undefined }));
      }
    } catch (error) {
      models.forEach((model) => model.dispose());
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
  scene.fog = new THREE.Fog("#ffffff", 7, 12);
  addDiscLights(scene);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
  const gallery = new THREE.Group();
  gallery.rotation.set(-Math.PI / 6, -Math.PI / 6, 0);
  gallery.scale.setScalar(1.08);
  scene.add(gallery);
  const pickGeometry = new THREE.RingGeometry(0.14, 1, 80);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  const entries = models.map((model, index) => {
    const pose = new THREE.Group();
    const spin = new THREE.Group();
    const ring = createHoverRing();
    const pick = new THREE.Mesh(pickGeometry, pickMaterial);
    pick.userData.index = index;
    pose.add(spin);
    spin.add(model.root, pick);
    gallery.add(pose, ring.root);
    const resting = getDiscPose(index - INITIAL_DISC_INDEX, 0);
    pose.position.set(resting.x, resting.y, resting.z);
    pose.rotation.set(resting.rotationX, resting.rotationY, resting.rotationZ);
    pose.scale.setScalar(resting.scale);
    ring.root.position.copy(pose.position);
    ring.root.quaternion.copy(pose.quaternion);
    ring.root.scale.copy(pose.scale);
    return {
      model, pose, spin, pick, ring, back: false, hoverAmount: 0, ringFrame: -1,
      hoverX: 0, hoverY: 0, pitch: createTween(), yaw: createTween(),
      tiltX: spring(resting.rotationX), tiltY: spring(resting.rotationY),
      pushX: spring(), pushY: spring(), pushZ: spring(), pushPitch: spring(), pushYaw: spring(),
    };
  });
  const picks = entries.map((entry) => entry.pick);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const localHit = new THREE.Vector3();
  const targetPosition = new THREE.Vector3();
  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = reducedQuery.matches;
  let disposed = false;
  let unavailable = false;
  let visible = true;
  let compact = false;
  let raf = 0;
  let scribbleTimer = 0;
  const wheelInput = new DiscWheelInput();
  let lastTime = 0;
  let selectedIndex = INITIAL_DISC_INDEX;
  let hoveredIndex = -1;
  let keyboardActive = false;
  let preview = false;
  const focus = createTween();
  let lastPointer: { clientX: number; clientY: number; time: number } | null = null;
  let flow = 0;
  let lastProgress = INITIAL_DISC_INDEX;
  const progress = new DiscProgress(DISC_COUNT, INITIAL_DISC_INDEX);
  type Drag = {
    id: number; mode: "gallery" | "disc"; index: number; touch: boolean;
    x: number; y: number; pitch: number; yaw: number; progress: number;
    lastX: number; lastTime: number; velocity: number; moved: boolean;
  };
  let dragging: Drag | null = null;

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
  function notify() {
    onSelectionChange({ index: selectedIndex, back: entries[selectedIndex].back, preview });
  }
  function closePreview() {
    if (!preview) return;
    finishDrag(true);
    preview = false;
    startTween(focus, 0, 0.65);
    leave();
    notify();
    wake();
  }
  function openPreview() {
    if (preview) return;
    finishDrag(true);
    progress.select(selectedIndex, "snap");
    preview = true;
    startTween(focus, 1, 0.65, "in-out");
    leave();
    notify();
    wake();
  }
  function select(index: number, source: "wheel" | "key" | "click" | "snap" = "key") {
    finishDrag(true);
    const next = clampDiscIndex(index);
    closePreview();
    wheelInput.reset();
    if (next !== progress.targetIndex || Math.abs(progress.value - next) > 0.001) {
      progress.select(next, source);
      if (!reduced) flow += Math.sign(next - progress.value) * (source === "key" ? 4 : source === "wheel" ? 2.5 : 1.4);
    }
    wake();
  }
  function draw(time: number) {
    raf = 0;
    if (disposed || unavailable || !visible || document.hidden) return;
    const dt = lastTime ? Math.min(0.05, (time - lastTime) / 1000) : 1 / 60;
    lastTime = time;
    let moving = false;
    if (!(dragging?.moved && dragging.mode === "gallery")) moving = progress.advance(dt, reduced);
    if (advanceTween(focus, dt, reduced)) moving = true;
    const nearest = clampDiscIndex(progress.value);
    if (nearest !== selectedIndex) { selectedIndex = nearest; notify(); }
    const speed = reduced ? 0 : clamp((progress.value - lastProgress) / dt, -12, 12);
    lastProgress = progress.value;
    flow += (speed - flow) * (1 - Math.exp(-dt * (Math.abs(speed) > Math.abs(flow) ? 14 : 6)));
    if (Math.abs(flow) < 0.01) flow = 0;
    gallery.rotation.set(
      THREE.MathUtils.lerp(-Math.PI / 6, -0.12, focus.value),
      THREE.MathUtils.lerp(-Math.PI / 6, -0.16, focus.value), 0,
    );
    const frame = reduced ? 0 : Math.floor(time / 100);
    entries.forEach((entry, index) => {
      const offset = index - progress.value;
      const active = index === selectedIndex;
      const path = getDiscPose(offset, flow, compact);
      const inspecting = focus.value > 0;
      if (inspecting) {
        path.scale *= active ? 1 + focus.value * 0.16 : 1 - focus.value;
        path.z -= active ? 0 : focus.value * 2.2;
        if (active) {
          path.x *= 1 - focus.value;
          path.y *= 1 - focus.value;
          path.rotationY *= 1 - focus.value;
        }
      }
      for (const value of [entry.pushX, entry.pushY, entry.pushZ, entry.pushPitch, entry.pushYaw]) {
        if (reduced) { value.value = 0; value.velocity = 0; }
        else if (advanceSpring(value, 0, dt, 12, 5)) moving = true;
      }
      const pitchMoving = advanceTween(entry.pitch, dt, reduced);
      const yawMoving = advanceTween(entry.yaw, dt, reduced);
      if (pitchMoving || yawMoving) moving = true;
      entry.pose.visible = Math.abs(offset) < 3.25 && (active || focus.value < 0.995);
      if (!entry.pose.visible) { entry.ring.root.visible = false; entry.hoverAmount = 0; return; }
      path.x += entry.pushX.value;
      path.y += entry.pushY.value;
      path.z += entry.pushZ.value;
      const following = reduced ? 1 : 1 - Math.exp(-dt * Math.max(6.5, (dragging?.moved ? 15 : 11) - Math.abs(offset) * 1.15));
      const displacement = Math.abs(path.x - entry.pose.position.x) + Math.abs(path.y - entry.pose.position.y) + Math.abs(path.z - entry.pose.position.z) + Math.abs(path.scale - entry.pose.scale.x) + Math.abs(path.rotationZ - entry.pose.rotation.z);
      entry.pose.position.lerp(targetPosition.set(path.x, path.y, path.z), following);
      entry.pose.scale.setScalar(entry.pose.scale.x + (path.scale - entry.pose.scale.x) * following);
      entry.pose.rotation.z += (path.rotationZ - entry.pose.rotation.z) * following;
      const hover = hoveredIndex === index && !dragging?.moved;
      const targetX = path.rotationX + (reduced || !hover ? 0 : entry.hoverY * 0.21);
      const targetY = path.rotationY + (reduced || !hover ? 0 : entry.hoverX * 0.21);
      for (const [value, target] of [[entry.tiltX, targetX], [entry.tiltY, targetY]] as const) {
        if (reduced) { value.value = target; value.velocity = 0; }
        else if (advanceSpring(value, target, dt)) moving = true;
      }
      entry.pose.rotation.x = entry.tiltX.value;
      entry.pose.rotation.y = entry.tiltY.value;
      entry.spin.rotation.set(entry.pitch.value + entry.pushPitch.value, entry.yaw.value + entry.pushYaw.value, 0);
      const amount = active && !preview && !dragging?.moved && (hover || keyboardActive) ? 1 : 0;
      entry.hoverAmount = reduced ? amount : entry.hoverAmount + (amount - entry.hoverAmount) * (1 - Math.exp(-dt * 13));
      if (Math.abs(entry.hoverAmount - amount) < 0.002) entry.hoverAmount = amount;
      const ringFollow = reduced || Math.abs(progress.velocity) > 0.02 || !entry.hoverAmount ? 1 : 1 - Math.exp(-dt * 15);
      entry.ring.root.position.lerp(entry.pose.position, ringFollow);
      entry.ring.root.quaternion.slerp(entry.pose.quaternion, ringFollow);
      entry.ring.root.scale.lerp(entry.pose.scale, ringFollow);
      if (entry.hoverAmount && entry.ring.root.quaternion.angleTo(entry.pose.quaternion) > 0.001) moving = true;
      if (frame !== entry.ringFrame || entry.hoverAmount !== amount || !entry.hoverAmount) {
        entry.ring.update(frame, entry.hoverAmount);
        entry.ringFrame = frame;
      }
      if (displacement > 0.0005 || entry.hoverAmount !== amount) moving = true;
    });
    // A stationary pointer must follow the disc passing beneath it, too.
    if (lastPointer && !dragging && (moving || flow !== 0) && updateHover(lastPointer)) moving = true;
    renderer.render(scene, camera);
    if (moving || flow !== 0) wake();
    else if (!reduced && !preview && (hoveredIndex === selectedIndex || keyboardActive)) scribbleTimer = window.setTimeout(wake, 100);
    else lastTime = 0;
  }
  function resize() {
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    compact = width / height < 1.25;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4_000_000 / (width * height))));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = Math.max(4.4, 1.3 / (Math.tan(THREE.MathUtils.degToRad(20)) * Math.min(1, camera.aspect)));
    camera.updateProjectionMatrix();
    wake();
  }
  function hit(event: Pick<PointerEvent, "clientX" | "clientY">) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / Math.max(1, rect.width) * 2 - 1, 1 - (event.clientY - rect.top) / Math.max(1, rect.height) * 2);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    const visiblePicks = picks.filter((_, index) => entries[index].pose.visible && (!preview || index === selectedIndex));
    return raycaster.intersectObjects(visiblePicks, false)[0];
  }
  function updateHover(event: Pick<PointerEvent, "clientX" | "clientY">) {
    const previousIndex = hoveredIndex;
    const previousX = previousIndex >= 0 ? entries[previousIndex].hoverX : 0;
    const previousY = previousIndex >= 0 ? entries[previousIndex].hoverY : 0;
    const intersection = hit(event);
    hoveredIndex = intersection ? intersection.object.userData.index : -1;
    entries.forEach((entry) => { entry.hoverX = 0; entry.hoverY = 0; });
    if (intersection) {
      const entry = entries[hoveredIndex];
      // Hover tilt follows the camera's screen axes; local hit coordinates are
      // reserved for pressing so the base perspective is not amplified.
      entry.hoverX = clamp(pointer.x, -1, 1);
      entry.hoverY = clamp(pointer.y, -1, 1);
    }
    mount.style.cursor = hoveredIndex >= 0 ? "pointer" : "grab";
    return previousIndex !== hoveredIndex || (hoveredIndex >= 0 && (
      Math.abs(previousX - entries[hoveredIndex].hoverX) > 0.001 || Math.abs(previousY - entries[hoveredIndex].hoverY) > 0.001
    ));
  }
  function hover(event: PointerEvent) {
    const previousIndex = hoveredIndex;
    const previous = lastPointer;
    const now = performance.now();
    keyboardActive = false;
    updateHover(event);
    if (!reduced && previous && hoveredIndex >= 0 && hoveredIndex !== previousIndex && now - previous.time < 120) {
      const factor = 16.667 / Math.max(8, now - previous.time);
      const vx = (event.clientX - previous.clientX) * factor;
      const vy = (event.clientY - previous.clientY) * factor;
      if (Math.hypot(vx, vy) > 9) {
        const entry = entries[hoveredIndex];
        entry.pushX.velocity += clamp(vx * 0.012, -0.5, 0.5);
        entry.pushY.velocity -= clamp(vy * 0.012, -0.5, 0.5);
        entry.pushYaw.velocity += clamp(vx * 0.009, -0.4, 0.4);
        entry.pushPitch.velocity += clamp(vy * 0.009, -0.4, 0.4);
      }
    }
    lastPointer = { clientX: event.clientX, clientY: event.clientY, time: now };
  }
  function press(index: number, x: number, y: number) {
    if (index < 0 || reduced) return;
    const entry = entries[index];
    entry.pushZ.velocity -= 0.35;
    entry.pushYaw.velocity += x * 0.7;
    entry.pushPitch.velocity -= y * 0.7;
  }
  function down(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0 || dragging) return;
    const intersection = hit(event);
    const index = intersection ? intersection.object.userData.index as number : -1;
    const entry = index >= 0 ? entries[index] : null;
    event.preventDefault();
    mount.focus({ preventScroll: true });
    mount.setPointerCapture(event.pointerId);
    keyboardActive = false;
    wheelInput.reset();
    dragging = {
      id: event.pointerId, mode: index === selectedIndex ? "disc" : "gallery", index, touch: event.pointerType === "touch",
      x: event.clientX, y: event.clientY, progress: progress.value,
      pitch: entry?.pitch.value ?? 0, yaw: entry ? entry.yaw.value - (entry.back ? Math.PI : 0) : 0,
      lastX: event.clientX, lastTime: performance.now(), velocity: 0, moved: false,
    };
    wake();
  }
  function move(event: PointerEvent) {
    if (dragging) {
      if (event.pointerId !== dragging.id) return;
      const dx = event.clientX - dragging.x;
      const dy = event.clientY - dragging.y;
      if (!dragging.moved) {
        if (Math.hypot(dx, dy) <= 5) return;
        dragging.moved = true;
        // A press may have waited while a switch or flip was still animating.
        dragging.progress = progress.value;
        if (dragging.index >= 0) {
          const entry = entries[dragging.index];
          dragging.pitch = entry.pitch.value;
          dragging.yaw = entry.yaw.value - (entry.back ? Math.PI : 0);
        }
        dragging.lastX = event.clientX;
        dragging.lastTime = performance.now();
        if (dragging.touch && !preview && Math.abs(dx) >= Math.abs(dy)) dragging.mode = "gallery";
        progress.dragTo(dragging.progress);
        mount.style.cursor = "grabbing";
      }
      if (dragging.mode === "disc") {
        const entry = entries[dragging.index];
        startTween(entry.pitch, softAngle(dragging.pitch + dy * 0.004275), 0);
        startTween(entry.yaw, (entry.back ? Math.PI : 0) + softAngle(dragging.yaw + dx * 0.004275), 0);
      } else {
        const width = Math.max(1, mount.clientWidth);
        const span = dragging.touch ? 2.2 : 5.7;
        const raw = dragging.progress - dx / width * span;
        const edge = clamp(raw, 0, DISC_COUNT - 1);
        progress.dragTo(edge + clamp((raw - edge) * 0.15, -0.05, 0.05));
        const now = performance.now();
        const velocity = -(event.clientX - dragging.lastX) / width * span / Math.max(0.008, (now - dragging.lastTime) / 1000);
        dragging.velocity += (clamp(velocity, -6, 6) - dragging.velocity) * 0.32;
        dragging.lastX = event.clientX;
        dragging.lastTime = now;
      }
    } else if (event.pointerType === "mouse" || event.pointerType === "pen") hover(event);
    wake();
  }
  function finishDrag(cancelled: boolean) {
    if (!dragging) return;
    const drag = dragging;
    dragging = null;
    if (mount.hasPointerCapture(drag.id)) mount.releasePointerCapture(drag.id);
    if (drag.moved && drag.mode === "disc") {
      const entry = entries[drag.index];
      startTween(entry.pitch, 0, 1.2);
      startTween(entry.yaw, entry.back ? Math.PI : 0, 1.2);
      progress.release(0, false, true);
    } else if (!drag.moved && drag.index >= 0 && !cancelled) {
      const entry = entries[drag.index];
      const intersection = hit({ clientX: drag.x, clientY: drag.y });
      if (intersection?.object.userData.index === drag.index) entry.pose.worldToLocal(localHit.copy(intersection.point));
      else localHit.set(0, 0, 0);
      press(drag.index, clamp(localHit.x, -1, 1), clamp(localHit.y, -1, 1));
      if (drag.index === selectedIndex) openPreview();
      else select(drag.index, "click");
    } else if (drag.moved) {
      const releaseVelocity = drag.velocity * Math.exp(-(performance.now() - drag.lastTime) / 120);
      progress.release(releaseVelocity, drag.touch, cancelled);
    }
    wake();
  }
  function end(event: PointerEvent) {
    if (!dragging || event.pointerId !== dragging.id) return;
    finishDrag(event.type !== "pointerup");
    if (event.type === "pointerup" && event.pointerType === "mouse") hover(event);
    else leave();
  }
  function leave() {
    if (dragging) return;
    lastPointer = null;
    hoveredIndex = -1;
    entries.forEach((entry) => { entry.hoverX = 0; entry.hoverY = 0; });
    wake();
  }
  function reset() {
    finishDrag(true);
    const entry = entries[selectedIndex];
    entry.back = false;
    startTween(entry.pitch, 0, 1.2);
    startTween(entry.yaw, 0, 1.2);
    leave();
    notify();
    wake();
  }
  function flip() {
    finishDrag(true);
    const entry = entries[selectedIndex];
    entry.back = !entry.back;
    startTween(entry.pitch, 0, 0.75, "in-out");
    startTween(entry.yaw, entry.back ? Math.PI : 0, 0.75, "in-out");
    notify();
    wake();
  }
  function key(event: KeyboardEvent) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault(); keyboardActive = true;
      select(progress.targetIndex + (event.key === "ArrowRight" ? 1 : -1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault(); keyboardActive = true; select(event.key === "Home" ? 0 : DISC_COUNT - 1);
    } else if (event.key === " ") {
      event.preventDefault(); flip();
    } else if (event.key === "Enter") {
      event.preventDefault(); openPreview();
    } else if (event.key === "Escape" && preview) {
      event.preventDefault(); event.stopPropagation(); closePreview();
    } else if (event.key.toLowerCase() === "r") { event.preventDefault(); reset(); }
  }
  function wheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey || dragging) return;
    event.preventDefault();
    event.stopPropagation();
    if (preview) return;
    keyboardActive = false;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.25 ? event.deltaX : event.deltaY;
    const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? mount.clientHeight : 1;
    const step = wheelInput.step(delta * factor, performance.now());
    if (step) {
      // Keep the wheel envelope: subsequent packets belong to this same gesture.
      const target = clampDiscIndex(progress.targetIndex + step);
      progress.select(target, "wheel");
      if (!reduced) flow += step * 2.5;
      wake();
    }
  }
  function blur() { finishDrag(true); wheelInput.reset(); leave(); }
  function visibility() { if (document.hidden) { blur(); stop(); } else wake(); }
  function preference() { reduced = reducedQuery.matches; wake(); }
  function lost(event: Event) {
    event.preventDefault(); unavailable = true; stop();
    canvas.style.display = "none";
    onUnavailable();
  }
  const observer = new ResizeObserver(resize);
  const intersectionObserver = new IntersectionObserver((records) => {
    visible = records.some((entry) => entry.isIntersecting);
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
  mount.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("webglcontextlost", lost);
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", visibility);
  reducedQuery.addEventListener("change", preference);
  observer.observe(mount);
  intersectionObserver.observe(mount);
  resize();
  notify();

  return {
    previous: () => select(progress.targetIndex - 1),
    next: () => select(progress.targetIndex + 1),
    flip, reset, closePreview,
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      if (dragging && mount.hasPointerCapture(dragging.id)) mount.releasePointerCapture(dragging.id);
      dragging = null;
      observer.disconnect();
      intersectionObserver.disconnect();
      mount.removeEventListener("pointerdown", down);
      mount.removeEventListener("pointermove", move);
      mount.removeEventListener("pointerup", end);
      mount.removeEventListener("pointercancel", end);
      mount.removeEventListener("lostpointercapture", end);
      mount.removeEventListener("pointerleave", leave);
      mount.removeEventListener("keydown", key);
      mount.removeEventListener("wheel", wheel);
      canvas.removeEventListener("webglcontextlost", lost);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      reducedQuery.removeEventListener("change", preference);
      scene.environment = null;
      scene.clear();
      entries.forEach((entry) => { entry.ring.dispose(); entry.model.dispose(); });
      pickGeometry.dispose();
      pickMaterial.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      mount.style.removeProperty("cursor");
    },
  };
}
