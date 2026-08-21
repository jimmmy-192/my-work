export const PHOTO_WALLPAPERS = [
  { id: "lake", url: "/wallpapers/snow-mountain.jpg" },
  { id: "garden", url: "/wallpapers/garden-canopy-upright.jpg" },
] as const;

export const WALLPAPER_SLIDE_INTERVAL_MS = 120_000;

export function getNextWallpaperSlide(currentIndex: number) {
  return (currentIndex + 1) % PHOTO_WALLPAPERS.length;
}
