const publicBaseUrl =
  (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

export const PHOTO_WALLPAPERS = [
  { id: "lake", name: "湖山倒影", url: `${publicBaseUrl}wallpapers/snow-mountain.jpg` },
  { id: "garden", name: "庭院绿荫", url: `${publicBaseUrl}wallpapers/garden-canopy-upright.jpg` },
  { id: "blue-folds", name: "深蓝折光", url: `${publicBaseUrl}wallpapers/blue-folds.png` },
] as const;

export interface WallpaperPhoto {
  id: string;
  name: string;
  url: string;
  custom?: boolean;
}

export const WALLPAPER_SLIDE_INTERVAL_MS = 120_000;

export function getNextWallpaperSlide(currentIndex: number, photoCount: number = PHOTO_WALLPAPERS.length) {
  return photoCount > 0 ? (currentIndex + 1) % photoCount : 0;
}
