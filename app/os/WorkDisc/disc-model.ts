import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

const RADIUS = 1;
const HALF_THICKNESS = 0.007;
const HOLE_RADIUS = 0.14;
const HUB_RADIUS = 0.242;

function canvas(size: number, height = size) {
  const element = document.createElement("canvas");
  element.width = size;
  element.height = height;
  const context = element.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable.");
  return { element, context };
}

function randomGenerator(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function textureFromCanvas(element: HTMLCanvasElement, color = true) {
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Original printed artwork, rather than a placeholder photograph on a circle. */
function createCoverTexture() {
  const size = 2048;
  const { element, context: ctx } = canvas(size);
  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, "#23313f");
  base.addColorStop(0.55, "#101c29");
  base.addColorStop(1, "#17202b");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Two continuous folds of printed silver, with ample space around the hub.
  const silver = ctx.createLinearGradient(380, 230, 1630, 1760);
  silver.addColorStop(0, "#edf0ee");
  silver.addColorStop(0.28, "#bdc7cd");
  silver.addColorStop(0.55, "#eff0ed");
  silver.addColorStop(0.78, "#718999");
  silver.addColorStop(1, "#bac4c8");
  ctx.fillStyle = silver;
  ctx.beginPath();
  ctx.moveTo(-280, 1290);
  ctx.bezierCurveTo(230, 670, 715, 1800, 1190, 1170);
  ctx.bezierCurveTo(1550, 680, 1410, 180, 2040, -220);
  ctx.lineTo(2430, 10);
  ctx.bezierCurveTo(1770, 365, 1800, 1240, 1260, 1600);
  ctx.bezierCurveTo(750, 1940, 265, 1020, -250, 1610);
  ctx.closePath();
  ctx.fill();

  const fold = ctx.createLinearGradient(420, 1410, 1950, 400);
  fold.addColorStop(0, "#526b80");
  fold.addColorStop(0.48, "#a8b7c2");
  fold.addColorStop(0.7, "#dce2e1");
  fold.addColorStop(1, "#527188");
  ctx.fillStyle = fold;
  ctx.beginPath();
  ctx.moveTo(140, 1940);
  ctx.bezierCurveTo(270, 1470, 920, 1670, 1290, 1310);
  ctx.bezierCurveTo(1790, 820, 1510, 510, 2100, 60);
  ctx.bezierCurveTo(1770, 685, 2110, 955, 1490, 1630);
  ctx.bezierCurveTo(1040, 2060, 485, 1725, 370, 2250);
  ctx.closePath();
  ctx.fill();

  // Fine printing lines are part of the cover; lighting comes from the material.
  ctx.strokeStyle = "rgba(236,242,241,0.18)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 12; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-80, 1340 + i * 15);
    ctx.bezierCurveTo(280, 870 + i * 10, 730, 1730 + i * 10, 1180, 1300 + i * 13);
    ctx.bezierCurveTo(1640, 860 + i * 10, 1490, 350, 2070, 40 + i * 10);
    ctx.stroke();
  }

  ctx.fillStyle = "#e4e9e9";
  ctx.font = "500 144px Arial, Helvetica, sans-serif";
  ctx.fillText("Sixxxx", 500, 495);
  ctx.font = "500 40px Arial, Helvetica, sans-serif";
  ctx.letterSpacing = "7px";
  ctx.fillText("SELECTED WORK", 507, 565);
  ctx.letterSpacing = "0px";
  ctx.strokeStyle = "rgba(234,241,240,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(508, 613);
  ctx.lineTo(762, 613);
  ctx.stroke();
  ctx.font = "400 72px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "#ecf0ef";
  ctx.fillText("01", 1480, 1445);

  const random = randomGenerator(2741);
  const grain = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < grain.data.length; i += 4) {
    const noise = (random() - 0.5) * 8;
    grain.data[i] += noise;
    grain.data[i + 1] += noise;
    grain.data[i + 2] += noise;
  }
  ctx.putImageData(grain, 0, 0);
  return textureFromCanvas(element);
}

function createSurfaceTextures() {
  const size = 768;
  const rough = canvas(size);
  const normal = canvas(size);
  const roughPixels = rough.context.createImageData(size, size);
  const normalPixels = normal.context.createImageData(size, size);
  const random = randomGenerator(8609);
  const center = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const dx = x - center;
      const dy = y - center;
      const radius = Math.hypot(dx, dy);
      const groove = Math.sin(radius * 2.8);
      const noise = random() - 0.5;
      const value = 207 + noise * 18 + groove * 3;
      roughPixels.data.set([value, value, value, 255], index);
      const radial = Math.cos(radius * 2.8) * 2.3;
      const length = Math.max(1, radius);
      normalPixels.data.set([
        128 + noise * 2 + radial * dx / length,
        128 + noise * 2 - radial * dy / length,
        255,
        255,
      ], index);
    }
  }
  rough.context.putImageData(roughPixels, 0, 0);
  normal.context.putImageData(normalPixels, 0, 0);
  return {
    roughness: textureFromCanvas(rough.element, false),
    normal: textureFromCanvas(normal.element, false),
  };
}

function createBackTexture() {
  const size = 1536;
  const { element, context: ctx } = canvas(size);
  const center = size / 2;
  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, "#e5e7e6");
  base.addColorStop(0.45, "#c5cbd0");
  base.addColorStop(1, "#dce0df");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const random = randomGenerator(9871);
  for (let radius = 194; radius < center; radius += 1.9) {
    ctx.strokeStyle = `rgba(74,88,98,${0.025 + random() * 0.025})`;
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(43,51,59,0.46)";
  ctx.textAlign = "center";
  ctx.font = "500 25px Arial, Helvetica, sans-serif";
  ctx.fillText("SIXXXX / 01", center, center - 210);
  return textureFromCanvas(element);
}

/** RingGeometry's default UVs depend on its outer radius; all layers share disc UVs. */
function annulus(inner: number, outer: number) {
  const geometry = new THREE.RingGeometry(inner, outer, 192, 1);
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < position.count; i += 1) {
    uv.setXY(i, position.getX(i) * 0.5 + 0.5, position.getY(i) * 0.5 + 0.5);
  }
  return geometry;
}

export function createDiscModel(): { root: THREE.Group; dispose(): void } {
  const root = new THREE.Group();
  root.name = "Sixxxx physical disc";
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const cover = createCoverTexture();
  const back = createBackTexture();
  const surface = createSurfaceTextures();
  const textures = [cover, back, surface.roughness, surface.normal];

  const addRing = (inner: number, outer: number, z: number, material: THREE.Material, rear = false) => {
    const geometry = annulus(inner, outer);
    geometries.add(geometry);
    materials.add(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = z;
    if (rear) mesh.rotation.y = Math.PI;
    root.add(mesh);
    return mesh;
  };

  const printed = new THREE.MeshPhysicalMaterial({
    map: cover,
    metalness: 0.25,
    roughness: 0.43,
    roughnessMap: surface.roughness,
    normalMap: surface.normal,
    normalScale: new THREE.Vector2(0.16, 0.16),
    clearcoat: 0.65,
    clearcoatRoughness: 0.26,
    envMapIntensity: 0.48,
    iridescence: 0.06,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [140, 240],
  });
  addRing(HUB_RADIUS, 0.991, HALF_THICKNESS, printed);

  const recorded = new THREE.MeshPhysicalMaterial({
    map: back,
    metalness: 0.98,
    roughness: 0.23,
    roughnessMap: surface.roughness,
    normalMap: surface.normal,
    normalScale: new THREE.Vector2(0.13, 0.13),
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
    iridescence: 0.48,
    iridescenceIOR: 1.32,
    iridescenceThicknessRange: [120, 390],
    envMapIntensity: 0.95,
  });
  addRing(HUB_RADIUS, 0.991, -HALF_THICKNESS, recorded, true);

  const rimMaterial = new THREE.MeshPhysicalMaterial({
    color: "#b8c1c7",
    metalness: 0.9,
    roughness: 0.21,
    clearcoat: 0.65,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.8,
    side: THREE.DoubleSide,
  });
  const rimProfile = [
    new THREE.Vector2(0.991, -HALF_THICKNESS),
    new THREE.Vector2(0.997, -0.0056),
    new THREE.Vector2(RADIUS, -0.0024),
    new THREE.Vector2(RADIUS, 0.0024),
    new THREE.Vector2(0.997, 0.0056),
    new THREE.Vector2(0.991, HALF_THICKNESS),
  ];
  const rimGeometry = new THREE.LatheGeometry(rimProfile, 192);
  rimGeometry.rotateX(Math.PI / 2);
  geometries.add(rimGeometry);
  materials.add(rimMaterial);
  root.add(new THREE.Mesh(rimGeometry, rimMaterial));

  const reflectiveHub = new THREE.MeshPhysicalMaterial({
    color: "#aeb7bd", metalness: 0.94, roughness: 0.2,
    clearcoat: 0.8, clearcoatRoughness: 0.11, envMapIntensity: 0.9,
  });
  const frostedHub = new THREE.MeshPhysicalMaterial({
    color: "#d3d9dc", metalness: 0.22, roughness: 0.46,
    clearcoat: 0.65, clearcoatRoughness: 0.24, envMapIntensity: 0.7,
  });
  const plasticHub = new THREE.MeshPhysicalMaterial({
    color: "#dbe2e4", metalness: 0, roughness: 0.22,
    transmission: 0.55, thickness: 0.018, ior: 1.47,
    transparent: true, opacity: 0.54, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.8,
    side: THREE.DoubleSide,
  });
  const fineEdge = new THREE.MeshPhysicalMaterial({
    color: "#d3dadd", metalness: 0.92, roughness: 0.16,
    clearcoat: 1, envMapIntensity: 0.85,
  });

  for (const rear of [false, true]) {
    const sign = rear ? -1 : 1;
    addRing(0.188, HUB_RADIUS, sign * 0.0058, reflectiveHub, rear);
    addRing(0.17, 0.188, sign * 0.0065, frostedHub, rear);
    addRing(HOLE_RADIUS, 0.17, sign * 0.0065, plasticHub, rear);
    addRing(0.237, 0.242, sign * 0.0073, fineEdge, rear);
    addRing(0.186, 0.189, sign * 0.0073, fineEdge, rear);
    addRing(HOLE_RADIUS, 0.144, sign * 0.0073, fineEdge, rear);
  }

  const holeGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(0.144, -0.007),
    new THREE.Vector2(HOLE_RADIUS, -0.004),
    new THREE.Vector2(HOLE_RADIUS, 0.004),
    new THREE.Vector2(0.144, 0.007),
  ], 128);
  holeGeometry.rotateX(Math.PI / 2);
  geometries.add(holeGeometry);
  root.add(new THREE.Mesh(holeGeometry, rimMaterial));

  let disposed = false;
  return {
    root,
    dispose() {
      if (disposed) return;
      disposed = true;
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      root.clear();
    },
  };
}

/** Broad studio reflections make lacquer and hub edges react to the disc's angle. */
export function createDiscEnvironment(renderer: THREE.WebGLRenderer): {
  texture: THREE.Texture;
  dispose(): void;
} {
  const { element, context: ctx } = canvas(1024, 512);
  const base = ctx.createLinearGradient(0, 0, 0, 512);
  base.addColorStop(0, "#4b515b");
  base.addColorStop(0.4, "#202732");
  base.addColorStop(0.75, "#141a24");
  base.addColorStop(1, "#06090e");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 512);

  const panel = (x: number, y: number, width: number, height: number, color: string) => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 30;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  };
  panel(110, 105, 86, 195, "#e4e5df");
  panel(380, 64, 290, 30, "#eceeec");
  panel(715, 180, 54, 212, "#abbecf");
  panel(928, 110, 120, 148, "#8d9eae");

  const source = textureFromCanvas(element);
  source.mapping = THREE.EquirectangularReflectionMapping;
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromEquirectangular(source);
  generator.dispose();
  source.dispose();
  let disposed = false;
  return {
    texture: target.texture,
    dispose() {
      if (disposed) return;
      disposed = true;
      target.dispose();
    },
  };
}

export function addDiscLights(scene: THREE.Scene): void {
  RectAreaLightUniformsLib.init();
  scene.add(new THREE.HemisphereLight("#f4f6f7", "#71808e", 0.65));

  const key = new THREE.DirectionalLight("#fff1dd", 1.5);
  key.position.set(-3, 4, 5);
  scene.add(key);

  const fill = new THREE.DirectionalLight("#eaf2fa", 0.8);
  fill.position.set(4, 1, 3);
  scene.add(fill);

  const rim = new THREE.DirectionalLight("#b6cde6", 1.0);
  rim.position.set(-3, 1, -3);
  scene.add(rim);

  const strip = new THREE.RectAreaLight("#ffffff", 2.0, 3.6, 0.42);
  strip.position.set(0.4, 3.5, 2.8);
  strip.lookAt(0, 0, 0);
  scene.add(strip);
}
