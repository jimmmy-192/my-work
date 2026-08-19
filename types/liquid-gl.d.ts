declare module "liquid-gl" {
  export interface LiquidGLLens {
    options?: Record<string, unknown>;
  }

  export interface LiquidGLOptions {
    target: string;
    snapshot?: string;
    resolution?: number;
    refraction?: number;
    aberration?: number;
    bevelDepth?: number;
    bevelWidth?: number;
    frost?: number;
    shadow?: boolean;
    specular?: boolean;
    reveal?: "none" | "fade";
    tilt?: boolean;
    tiltFactor?: number;
    tiltEase?: number;
    magnify?: number;
    on?: {
      init?: (instance: LiquidGLLens) => void;
    };
  }

  export interface LiquidGLFactory {
    (options: LiquidGLOptions): LiquidGLLens | LiquidGLLens[] | Element | Element[] | undefined;
    registerDynamic?: (elements: string | Element | Element[]) => void;
  }

  const liquidGL: LiquidGLFactory;
  export default liquidGL;
}
