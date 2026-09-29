const publicBaseUrl =
  (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

export const PHOTO_WALLPAPERS = [
  { id: "lake", name: "湖山倒影", url: `${publicBaseUrl}wallpapers/snow-mountain.jpg` },
  { id: "garden", name: "庭院绿荫", url: `${publicBaseUrl}wallpapers/garden-canopy-upright.jpg` },
  { id: "blue-folds", name: "深蓝折光", url: `${publicBaseUrl}wallpapers/blue-folds.png` },
  { id: "palm-stars", name: "椰影星空", url: `${publicBaseUrl}wallpapers/palm-starry-night.jpg` },
  { id: "tropical-shore", name: "碧海椰风", url: `${publicBaseUrl}wallpapers/tropical-shore.jpg` },
] as const;

export interface WallpaperPhoto {
  id: string;
  name: string;
  url: string;
  custom?: boolean;
  localAssetId?: string;
  width?: number;
  height?: number;
}

export const WALLPAPER_SLIDE_INTERVAL_MS = 120_000;

export function getWallpaperPhotos(custom: WallpaperPhoto[], order: string[], hidden: string[] = []): WallpaperPhoto[] {
  const hiddenIds = new Set(hidden);
  const all = [...PHOTO_WALLPAPERS, ...custom].filter((photo) => !hiddenIds.has(photo.id));
  const byId = new Map(all.map((photo) => [photo.id, photo]));
  const ordered = order.flatMap((id) => {
    const photo = byId.get(id);
    if (!photo) return [];
    byId.delete(id);
    return [photo];
  });
  const photos = [...ordered, ...byId.values()];
  return photos.length ? photos : [PHOTO_WALLPAPERS[0]];
}

export function canRemoveWallpaper(photos: readonly WallpaperPhoto[], id: string) {
  return photos.findIndex((photo) => photo.id === id) > 0;
}

export function getNextWallpaperSlide(currentIndex: number, photoCount: number = PHOTO_WALLPAPERS.length) {
  return photoCount > 0 ? (currentIndex + 1) % photoCount : 0;
}
