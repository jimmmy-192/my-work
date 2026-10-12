import wallpaperCatalog from "../../content/wallpapers.json" with { type: "json" };

const publicBaseUrl =
  (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";

export interface WallpaperPhoto {
  id: string;
  name: string;
  url: string;
  custom?: boolean;
  localAssetId?: string;
  width?: number;
  height?: number;
  fit?: "viewport" | "wide";
}

export const WALLPAPER_CATALOG_REVISION = wallpaperCatalog.revision;
export const PHOTO_WALLPAPERS: readonly WallpaperPhoto[] = wallpaperCatalog.photos.map((photo) => ({
  id: photo.id,
  name: photo.name,
  url: `${publicBaseUrl}${photo.path}`,
  width: photo.width,
  height: photo.height,
  fit: photo.fit === "viewport" ? "viewport" : "wide",
}));
export const DEFAULT_CONCEALED_WALLPAPER_IDS = wallpaperCatalog.photos.filter((photo) => photo.concealed).map((photo) => photo.id);
const publishedIds = new Set(PHOTO_WALLPAPERS.map((photo) => photo.id));

interface SavedWallpaperState {
  custom: WallpaperPhoto[];
  order: string[];
  hidden: string[];
  concealed: string[];
}

/** Adopt a published collection once, retaining unrelated personal uploads. */
export function resolveWallpaperCatalogState(saved: SavedWallpaperState, revision: string | null): SavedWallpaperState {
  const custom = saved.custom.filter((photo) => !publishedIds.has(photo.id));
  if (revision === WALLPAPER_CATALOG_REVISION) return { ...saved, custom };
  const personalIds = new Set(custom.map((photo) => photo.id));
  return {
    custom,
    order: [...PHOTO_WALLPAPERS.map((photo) => photo.id), ...saved.order.filter((id) => personalIds.has(id))],
    hidden: saved.hidden.filter((id) => personalIds.has(id)),
    concealed: [...DEFAULT_CONCEALED_WALLPAPER_IDS, ...saved.concealed.filter((id) => personalIds.has(id))],
  };
}

export const WALLPAPER_SLIDE_INTERVAL_MS = 60_000;

export function getWallpaperPhotos(custom: WallpaperPhoto[], order: string[], hidden: string[] = []): WallpaperPhoto[] {
  const hiddenIds = new Set(hidden);
  const all = [...PHOTO_WALLPAPERS, ...custom.filter((photo) => !publishedIds.has(photo.id))].filter((photo) => !hiddenIds.has(photo.id));
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

export function getVisibleWallpaperPhotos(
  photos: readonly WallpaperPhoto[],
  concealedIds: readonly string[],
): WallpaperPhoto[] {
  const concealed = new Set(concealedIds);
  return photos.filter((photo) => !concealed.has(photo.id));
}

export function canRemoveWallpaper(photos: readonly WallpaperPhoto[], id: string) {
  return photos.findIndex((photo) => photo.id === id) > 0;
}

export function getNextWallpaperSlide(currentIndex: number, photoCount: number = PHOTO_WALLPAPERS.length) {
  return photoCount > 0 ? (currentIndex + 1) % photoCount : 0;
}
