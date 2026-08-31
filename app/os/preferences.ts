export const WALLPAPER_OPTIONS = [
  {
    value: "mountain",
    label: "照片轮播",
    description: "每 2 分钟切换，可上传与排序",
  },
] as const;

export type WallpaperPreference = (typeof WALLPAPER_OPTIONS)[number]["value"];

interface ReadableStorage {
  getItem: (key: string) => string | null;
}

interface WritableStorage {
  setItem: (key: string, value: string) => void;
}

export function isWallpaperPreference(value: string | null): value is WallpaperPreference {
  return WALLPAPER_OPTIONS.some((option) => option.value === value);
}

export function resolveInitialWallpaper(
  currentValue: string | null,
  legacyValue: string | null,
): WallpaperPreference {
  if (isWallpaperPreference(currentValue)) return currentValue;
  if (isWallpaperPreference(legacyValue)) return legacyValue;
  return "mountain";
}

export function readStoredPreference<T extends string>(
  storage: ReadableStorage,
  key: string,
  isValid: (value: string | null) => value is T,
) {
  try {
    const value = storage.getItem(key);
    return isValid(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredPreference(storage: WritableStorage, key: string, value: string) {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
