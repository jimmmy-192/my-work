import type { WallpaperPhoto } from "./wallpaper-carousel";
import type { WallpaperPreference } from "./preferences";

export type ThemePreference = "system" | "light" | "dark";
export type GlassPreference = "clear" | "standard" | "readable";
export type CloudSyncStatus =
  | "checking"
  | "signed-out"
  | "unavailable"
  | "saving"
  | "synced"
  | "error";

export interface CloudAccount {
  displayName: string;
  email: string;
}

export interface PreferenceSnapshot {
  theme: ThemePreference;
  glass: GlassPreference;
  wallpaper: WallpaperPreference;
  wallpaperOrder: string[];
}

export interface CloudPreferencesResponse {
  account: CloudAccount;
  preferences: (PreferenceSnapshot & { updatedAt: string }) | null;
  wallpapers: WallpaperPhoto[];
}

const publicBaseUrl = import.meta.env?.BASE_URL ?? "/";

function apiUrl(path: string) {
  return `${publicBaseUrl}api/${path}`;
}

async function responseError(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return new Error(payload?.error ?? `Request failed (${response.status})`);
}

export async function loadCloudPreferences() {
  const response = await fetch(apiUrl("preferences"), {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (response.status === 401) return { kind: "signed-out" as const };
  if (response.status === 404) return { kind: "unavailable" as const };
  if (!response.ok) throw await responseError(response);
  return {
    kind: "ready" as const,
    data: (await response.json()) as CloudPreferencesResponse,
  };
}

export async function saveCloudPreferences(snapshot: PreferenceSnapshot) {
  const response = await fetch(apiUrl("preferences"), {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  });
  if (!response.ok) throw await responseError(response);
}

export async function uploadCloudWallpaper(photo: WallpaperPhoto) {
  const imageResponse = await fetch(photo.url);
  if (!imageResponse.ok) throw new Error("Could not read the local wallpaper");
  const blob = await imageResponse.blob();
  const form = new FormData();
  form.set("name", photo.name);
  form.set("file", blob, "wallpaper.jpg");

  const response = await fetch(apiUrl("wallpapers"), {
    method: "POST",
    credentials: "same-origin",
    body: form,
  });
  if (!response.ok) throw await responseError(response);
  const payload = (await response.json()) as { photo: WallpaperPhoto };
  return payload.photo;
}

export async function deleteCloudWallpaper(id: string) {
  const response = await fetch(apiUrl(`wallpapers/${encodeURIComponent(id)}`), {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) throw await responseError(response);
}

export function isCloudWallpaper(photo: WallpaperPhoto) {
  try {
    return new URL(photo.url, window.location.href).pathname.startsWith("/api/wallpapers/");
  } catch {
    return false;
  }
}
