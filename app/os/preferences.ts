export const WALLPAPER_OPTIONS = [
  {
    value: "mountain",
    label: "湖山与庭院",
    description: "两张摄影作品，每 20 秒切换",
  },
  { value: "aurora", label: "青岚晨雾", description: "柔和绿意与清晨光线" },
  { value: "iris", label: "鸢尾暮光", description: "粉紫色的安静暮光" },
  { value: "sunset", label: "珊瑚落日", description: "温暖、柔软的晚霞" },
  { value: "tide", label: "深海潮汐", description: "清透蓝色与海面微光" },
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
  if (isWallpaperPreference(legacyValue) && legacyValue !== "aurora") return legacyValue;
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
