export const PHOTO_WALLPAPERS = [
  { id: "lake", name: "湖山倒影", url: "/wallpapers/snow-mountain.jpg" },
  { id: "garden", name: "庭院绿荫", url: "/wallpapers/garden-canopy-upright.jpg" },
  { id: "blue-folds", name: "深蓝折光", url: "/wallpapers/blue-folds.png" },
] as const;

export interface WallpaperPhoto {
  id: string;
  name: string;
  url: string;
  custom?: boolean;
}

export const WALLPAPER_SLIDE_INTERVAL_MS = 120_000;

export function getNextWallpaperSlide(currentIndex: number, photoCount = PHOTO_WALLPAPERS.length) {
  return photoCount > 0 ? (currentIndex + 1) % photoCount : 0;
}
