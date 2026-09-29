import type { WallpaperPhoto } from "./wallpaper-carousel";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Preserve the source ratio and detail without inventing pixels by upscaling. */
export function getWallpaperOutputSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("图片尺寸无效，请换一张图片");
  }
  const scale = Math.min(1, 4096 / Math.max(width, height), Math.sqrt(12_000_000 / (width * height)));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function encode(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片优化失败，请重试")), "image/jpeg", quality);
  });
}

function readDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("图片读取失败"));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(blob);
  });
}

export async function prepareWallpaper(file: File): Promise<WallpaperPhoto> {
  if (!file.size || file.size > 50 * 1024 * 1024) throw new Error("请选择小于 50 MB 的图片");
  const sourceUrl = URL.createObjectURL(file);
  try {
    // Browser image decoding applies the photo's EXIF orientation before drawing.
    const source = new Image();
    source.src = sourceUrl;
    await source.decode();
    const size = getWallpaperOutputSize(source.naturalWidth, source.naturalHeight);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器暂时无法处理图片，请重试");
    let blob: Blob | undefined;
    // Bound both memory and cloud upload size; keep high quality before reducing dimensions.
    for (let attempt = 0; attempt < 4; attempt++) {
      canvas.width = Math.max(1, Math.round(size.width * 0.85 ** attempt));
      canvas.height = Math.max(1, Math.round(size.height * 0.85 ** attempt));
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#101820";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      blob = await encode(canvas, 0.92);
      if (blob.size <= MAX_IMAGE_BYTES) break;
      blob = await encode(canvas, 0.86);
      if (blob.size <= MAX_IMAGE_BYTES) break;
    }
    if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error("图片过于复杂，暂时无法优化，请换一张图片");
    const url = await readDataUrl(blob);
    const ready = new Image();
    ready.src = url;
    await ready.decode();
    return {
      id: `custom-${crypto.randomUUID()}`,
      name: file.name.replace(/\.[^.]+$/, "") || "自定义壁纸",
      url,
      custom: true,
      width: ready.naturalWidth,
      height: ready.naturalHeight,
    };
  } catch (error) {
    if (error instanceof Error && !(error instanceof DOMException)) throw error;
    throw new Error("图片无法读取，请选择 JPG、PNG 或 WebP 图片");
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
