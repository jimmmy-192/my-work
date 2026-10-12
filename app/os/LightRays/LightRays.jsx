'use client';

import { useRef, useEffect, useState } from 'react';
import { Renderer, Program, Triangle, Mesh } from 'ogl';
import './LightRays.css';

const DEFAULT_COLOR = '#ffffff';

const hexToRgb = hex => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1];
};

const getAnchorAndDir = (origin, w, h) => {
  const outside = 0.2;
  switch (origin) {
    case 'top-left':
      return { anchor: [0, -outside * h], dir: [0, 1] };
    case 'top-right':
      return { anchor: [w, -outside * h], dir: [0, 1] };
    case 'left':
      return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] };
    case 'right':
      return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] };
    case 'bottom-left':
      return { anchor: [0, (1 + outside) * h], dir: [0, -1] };
    case 'bottom-center':
      return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] };
    case 'bottom-right':
      return { anchor: [w, (1 + outside) * h], dir: [0, -1] };
    default: // "top-center"
      return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
  }
};

const LightRays = ({
  raysOrigin = 'top-center',
  raysColor = DEFAULT_COLOR,
  raysSpeed = 1,
  lightSpread = 1,
  rayLength = 2,
  pulsating = false,
  fadeDistance = 1.0,
  saturation = 1.0,
  followMouse = true,
  mouseInfluence = 0.1,
  noiseAmount = 0.0,
  distortion = 0.0,
  lightMode = false,
  className = ''
}) => {
  const containerRef = useRef(null);
  const uniformsRef = useRef(null);
  const rendererRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });
  const meshRef = useRef(null);
  const staticFrameRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    let active = true;
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (active && entry) setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(container);

    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!isVisible || !container) return;

    let cancelled = false;
    let failed = false;
    let hasSize = false;
    let renderer = null;
    let geometry = null;
    let program = null;
    let mesh = null;
    let uniforms = null;
    let resizeObserver = null;
    let animationId = null;
    let previousTime = null;
    let elapsedTime = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const stopAnimation = () => {
      if (animationId !== null) cancelAnimationFrame(animationId);
      animationId = null;
      previousTime = null;
    };

    const canRender = () => !cancelled && !failed && hasSize && !document.hidden
      && renderer && uniforms && mesh;

    const renderFrame = () => {
      if (!canRender()) return false;
      uniforms.iTime.value = elapsedTime;

      if (followMouse && mouseInfluence > 0.0) {
        const smoothing = reducedMotion.matches ? 0 : 0.92;
        smoothMouseRef.current.x = smoothMouseRef.current.x * smoothing + mouseRef.current.x * (1 - smoothing);
        smoothMouseRef.current.y = smoothMouseRef.current.y * smoothing + mouseRef.current.y * (1 - smoothing);
        uniforms.mousePos.value = [smoothMouseRef.current.x, smoothMouseRef.current.y];
      }

      try {
        renderer.render({ scene: mesh });
        return true;
      } catch {
        failed = true;
        stopAnimation();
        renderer.gl.canvas.style.opacity = '0';
        return false;
      }
    };

    const loop = time => {
      animationId = null;
      if (!canRender() || reducedMotion.matches) {
        previousTime = null;
        return;
      }
      if (previousTime !== null) elapsedTime += Math.min((time - previousTime) * 0.001, 0.05);
      previousTime = time;
      if (renderFrame()) animationId = requestAnimationFrame(loop);
    };

    const syncPlayback = () => {
      if (!canRender()) {
        stopAnimation();
        return;
      }
      if (reducedMotion.matches) {
        stopAnimation();
        renderFrame();
      } else if (animationId === null && renderFrame()) {
        animationId = requestAnimationFrame(loop);
      }
    };

    const updatePlacement = () => {
      if (cancelled || !renderer || !uniforms) return;
      const { clientWidth: wCSS, clientHeight: hCSS } = container;
      hasSize = wCSS > 0 && hCSS > 0;
      if (!hasSize) {
        stopAnimation();
        return;
      }

      renderer.dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setSize(wCSS, hCSS);
      const w = renderer.gl.canvas.width;
      const h = renderer.gl.canvas.height;
      uniforms.iResolution.value = [w, h];
      const { anchor, dir } = getAnchorAndDir(raysOrigin, w, h);
      uniforms.rayPos.value = anchor;
      uniforms.rayDir.value = dir;
      renderFrame();
      syncPlayback();
    };

    const renderStaticFrame = () => {
      if (reducedMotion.matches) renderFrame();
    };

    const onContextLost = event => {
      event.preventDefault();
      failed = true;
      stopAnimation();
      if (renderer) renderer.gl.canvas.style.opacity = '0';
    };

    const cleanup = () => {
      stopAnimation();
      resizeObserver?.disconnect();
      resizeObserver = null;
      window.removeEventListener('resize', updatePlacement);
      document.removeEventListener('visibilitychange', syncPlayback);
      reducedMotion.removeEventListener('change', syncPlayback);

      const gl = renderer?.gl;
      if (gl) {
        gl.canvas.removeEventListener('webglcontextlost', onContextLost);
        try { geometry?.remove(); } catch { /* The context may already be lost. */ }
        try { program?.remove(); } catch { /* The context may already be lost. */ }
        try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* Already released. */ }
        gl.canvas.remove();
      }

      if (rendererRef.current === renderer) rendererRef.current = null;
      if (uniformsRef.current === uniforms) uniformsRef.current = null;
      if (meshRef.current === mesh) meshRef.current = null;
      if (staticFrameRef.current === renderStaticFrame) staticFrameRef.current = null;
      renderer = null;
      uniforms = null;
      mesh = null;
      geometry = null;
      program = null;
    };

    const initializeWebGL = () => {
      if (cancelled || containerRef.current !== container || !container.isConnected) return;

      renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio || 1, 2),
        alpha: true
      });
      rendererRef.current = renderer;

      const gl = renderer.gl;
      if (!gl || gl.isContextLost()) throw new Error('WebGL is unavailable');
      gl.canvas.style.width = '100%';
      gl.canvas.style.height = '100%';

      container.appendChild(gl.canvas);

      const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

      const frag = `precision highp float;

uniform float iTime;
uniform vec2  iResolution;

uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;
uniform float lightMode;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);

  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
  
  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  
  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0, 1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  
  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 rays1 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349,
                           1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234,
                           1.1 * raysSpeed);

  fragColor = rays1 * 0.5 + rays2 * 0.4;

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
  }

  float brightness = 1.0 - (coord.y / iResolution.y);
  fragColor.x *= 0.1 + brightness * 0.8;
  fragColor.y *= 0.3 + brightness * 0.6;
  fragColor.z *= 0.5 + brightness * 0.5;

  if (saturation != 1.0) {
    float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
    fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
  }

  fragColor.rgb *= raysColor;

  if (lightMode > 0.5) {
    vec3 mapped = vec3(1.0) - exp(-max(fragColor.rgb, vec3(0.0)) * 1.35);
    float energy = clamp(max(mapped.r, max(mapped.g, mapped.b)), 0.0, 1.0);
    vec3 hue = mapped / max(energy, 0.0001);
    vec3 ink = mix(hue * 0.25, hue * 0.72, energy);
    fragColor = vec4(mix(vec3(1.0), ink, energy), 1.0);
  }
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor  = color;
}`;

      uniforms = {
        iTime: { value: 0 },
        iResolution: { value: [1, 1] },

        rayPos: { value: [0, 0] },
        rayDir: { value: [0, 1] },

        raysColor: { value: hexToRgb(raysColor) },
        raysSpeed: { value: raysSpeed },
        lightSpread: { value: lightSpread },
        rayLength: { value: rayLength },
        pulsating: { value: pulsating ? 1.0 : 0.0 },
        fadeDistance: { value: fadeDistance },
        saturation: { value: saturation },
        mousePos: { value: [0.5, 0.5] },
        mouseInfluence: { value: mouseInfluence },
        noiseAmount: { value: noiseAmount },
        distortion: { value: distortion },
        lightMode: { value: lightMode ? 1.0 : 0.0 }
      };
      uniformsRef.current = uniforms;

      geometry = new Triangle(gl);
      program = new Program(gl, {
        vertex: vert,
        fragment: frag,
        uniforms
      });
      mesh = new Mesh(gl, { geometry, program });
      meshRef.current = mesh;
      staticFrameRef.current = renderStaticFrame;

      gl.canvas.addEventListener('webglcontextlost', onContextLost);
      window.addEventListener('resize', updatePlacement);
      document.addEventListener('visibilitychange', syncPlayback);
      reducedMotion.addEventListener('change', syncPlayback);
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(updatePlacement);
        resizeObserver.observe(container);
      }
      updatePlacement();
    };

    // Keep the original short layout delay, scoped to this effect's lifetime.
    const initializationTimer = window.setTimeout(() => {
      if (cancelled) return;
      try {
        initializeWebGL();
      } catch {
        failed = true;
        cleanup();
      }
    }, 10);

    return () => {
      cancelled = true;
      window.clearTimeout(initializationTimer);
      cleanup();
    };
  }, [
    isVisible,
    raysOrigin,
    raysColor,
    raysSpeed,
    lightSpread,
    rayLength,
    pulsating,
    fadeDistance,
    saturation,
    followMouse,
    mouseInfluence,
    noiseAmount,
    distortion,
    lightMode
  ]);

  useEffect(() => {
    if (!uniformsRef.current || !containerRef.current || !rendererRef.current) return;

    const u = uniformsRef.current;
    const renderer = rendererRef.current;

    u.raysColor.value = hexToRgb(raysColor);
    u.raysSpeed.value = raysSpeed;
    u.lightSpread.value = lightSpread;
    u.rayLength.value = rayLength;
    u.pulsating.value = pulsating ? 1.0 : 0.0;
    u.fadeDistance.value = fadeDistance;
    u.saturation.value = saturation;
    u.mouseInfluence.value = mouseInfluence;
    u.noiseAmount.value = noiseAmount;
    u.distortion.value = distortion;
    u.lightMode.value = lightMode ? 1.0 : 0.0;

    const { clientWidth: wCSS, clientHeight: hCSS } = containerRef.current;
    const dpr = renderer.dpr;
    const { anchor, dir } = getAnchorAndDir(raysOrigin, wCSS * dpr, hCSS * dpr);
    u.rayPos.value = anchor;
    u.rayDir.value = dir;
  }, [
    raysColor,
    raysSpeed,
    lightSpread,
    raysOrigin,
    rayLength,
    pulsating,
    fadeDistance,
    saturation,
    mouseInfluence,
    noiseAmount,
    distortion,
    lightMode
  ]);

  useEffect(() => {
    const handleMouseMove = e => {
      if (!containerRef.current || !rendererRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      mouseRef.current = { x, y };
      staticFrameRef.current?.();
    };

    if (followMouse) {
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }
  }, [followMouse]);

  return <div ref={containerRef} className={`light-rays-container ${className}`.trim()} />;
};

export default LightRays;
