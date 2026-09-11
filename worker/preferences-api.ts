const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const MAX_WALLPAPERS = 5;
const MAX_WALLPAPER_BYTES = 4 * 1024 * 1024;
const BUILTIN_WALLPAPER_IDS = ["lake", "garden", "blue-folds"];
const VALID_THEMES = new Set(["system", "light", "dark"]);
const VALID_GLASS = new Set(["clear", "standard", "readable"]);
const VALID_WALLPAPERS = new Set(["mountain"]);
const VALID_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export interface PreferencesEnv {
  DB: D1Database;
  WALLPAPERS: R2Bucket;
}

interface AuthenticatedUser {
  userId: string;
  email: string;
  displayName: string;
}

interface PreferenceRow {
  theme: string;
  glass: string;
  wallpaper: string;
  wallpaper_order: string;
  updated_at: string;
}

interface WallpaperRow {
  id: string;
  name: string;
  object_key: string;
  content_type: string;
  size_bytes: number;
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function getUser(request: Request): AuthenticatedUser | null {
  const userId = request.headers.get(USER_ID_HEADER);
  const email = request.headers.get(USER_EMAIL_HEADER);
  if (!userId || !email) return null;

  const encodedName = request.headers.get(USER_FULL_NAME_HEADER);
  let displayName = email;
  if (
    encodedName &&
    request.headers.get(USER_FULL_NAME_ENCODING_HEADER) === "percent-encoded-utf-8"
  ) {
    try {
      displayName = decodeURIComponent(encodedName);
    } catch {
      displayName = email;
    }
  }

  return { userId, email, displayName };
}

function parseOrder(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function listWallpapers(env: PreferencesEnv, userId: string) {
  const result = await env.DB.prepare(
    `SELECT id, name, object_key, content_type, size_bytes
     FROM custom_wallpapers
     WHERE user_id = ?
     ORDER BY created_at ASC, id ASC`,
  )
    .bind(userId)
    .all<WallpaperRow>();

  return result.results ?? [];
}

async function getPreferences(request: Request, env: PreferencesEnv, user: AuthenticatedUser) {
  const [preferences, wallpapers] = await Promise.all([
    env.DB.prepare(
      `SELECT theme, glass, wallpaper, wallpaper_order, updated_at
       FROM user_preferences
       WHERE user_id = ?`,
    )
      .bind(user.userId)
      .first<PreferenceRow>(),
    listWallpapers(env, user.userId),
  ]);

  const origin = new URL(request.url).origin;
  return json({
    account: { displayName: user.displayName, email: user.email },
    preferences: preferences
      ? {
          theme: preferences.theme,
          glass: preferences.glass,
          wallpaper: preferences.wallpaper,
          wallpaperOrder: parseOrder(preferences.wallpaper_order),
          updatedAt: preferences.updated_at,
        }
      : null,
    wallpapers: wallpapers.map((item) => ({
      id: item.id,
      name: item.name,
      url: `${origin}/api/wallpapers/${encodeURIComponent(item.id)}`,
      custom: true,
    })),
  });
}

async function putPreferences(request: Request, env: PreferencesEnv, user: AuthenticatedUser) {
  const payload = (await request.json().catch(() => null)) as unknown;
  if (!isPlainObject(payload)) return json({ error: "Invalid preferences" }, 400);

  const theme = typeof payload.theme === "string" ? payload.theme : "";
  const glass = typeof payload.glass === "string" ? payload.glass : "";
  const wallpaper = typeof payload.wallpaper === "string" ? payload.wallpaper : "";
  if (!VALID_THEMES.has(theme) || !VALID_GLASS.has(glass) || !VALID_WALLPAPERS.has(wallpaper)) {
    return json({ error: "Invalid preferences" }, 400);
  }

  const wallpapers = await listWallpapers(env, user.userId);
  const allowedIds = new Set([
    ...BUILTIN_WALLPAPER_IDS,
    ...wallpapers.map((item) => item.id),
  ]);
  const submittedOrder = Array.isArray(payload.wallpaperOrder)
    ? payload.wallpaperOrder.filter((item): item is string => typeof item === "string")
    : [];
  const wallpaperOrder = [...new Set(submittedOrder)].filter((id) => allowedIds.has(id));

  await env.DB.prepare(
    `INSERT INTO user_preferences
       (user_id, theme, glass, wallpaper, wallpaper_order, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       theme = excluded.theme,
       glass = excluded.glass,
       wallpaper = excluded.wallpaper,
       wallpaper_order = excluded.wallpaper_order,
       updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(user.userId, theme, glass, wallpaper, JSON.stringify(wallpaperOrder))
    .run();

  return json({ ok: true, wallpaperOrder });
}

async function hashUserId(userId: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function uploadWallpaper(request: Request, env: PreferencesEnv, user: AuthenticatedUser) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ error: "Wallpaper file is required" }, 400);
  if (!VALID_IMAGE_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_WALLPAPER_BYTES) {
    return json({ error: "Wallpaper must be an image smaller than 4 MB" }, 400);
  }

  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM custom_wallpapers WHERE user_id = ?",
  )
    .bind(user.userId)
    .first<{ count: number }>();
  if (Number(countRow?.count ?? 0) >= MAX_WALLPAPERS) {
    return json({ error: "You can save up to 5 custom wallpapers" }, 409);
  }

  const id = crypto.randomUUID();
  const userHash = await hashUserId(user.userId);
  const objectKey = `users/${userHash}/wallpapers/${id}`;
  const submittedName = form?.get("name");
  const name =
    typeof submittedName === "string" && submittedName.trim()
      ? submittedName.trim().slice(0, 80)
      : "自定义壁纸";

  await env.WALLPAPERS.put(objectKey, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  try {
    await env.DB.prepare(
      `INSERT INTO custom_wallpapers
         (id, user_id, name, object_key, content_type, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, user.userId, name, objectKey, file.type, file.size)
      .run();
  } catch (error) {
    await env.WALLPAPERS.delete(objectKey).catch(() => undefined);
    throw error;
  }

  return json(
    {
      photo: {
        id,
        name,
        url: `${new URL(request.url).origin}/api/wallpapers/${encodeURIComponent(id)}`,
        custom: true,
      },
    },
    201,
  );
}

async function findWallpaper(env: PreferencesEnv, userId: string, id: string) {
  return env.DB.prepare(
    `SELECT id, name, object_key, content_type, size_bytes
     FROM custom_wallpapers
     WHERE id = ? AND user_id = ?`,
  )
    .bind(id, userId)
    .first<WallpaperRow>();
}

async function getWallpaper(env: PreferencesEnv, user: AuthenticatedUser, id: string) {
  const metadata = await findWallpaper(env, user.userId, id);
  if (!metadata) return json({ error: "Wallpaper not found" }, 404);

  const object = await env.WALLPAPERS.get(metadata.object_key);
  if (!object) return json({ error: "Wallpaper not found" }, 404);

  return new Response(object.body, {
    headers: {
      "Cache-Control": "private, max-age=3600, immutable",
      "Content-Type": object.httpMetadata?.contentType ?? metadata.content_type,
      ETag: object.etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function deleteWallpaper(env: PreferencesEnv, user: AuthenticatedUser, id: string) {
  const metadata = await findWallpaper(env, user.userId, id);
  if (!metadata) return json({ ok: true });

  await env.DB.prepare("DELETE FROM custom_wallpapers WHERE id = ? AND user_id = ?")
    .bind(id, user.userId)
    .run();
  await env.WALLPAPERS.delete(metadata.object_key).catch(() => undefined);
  return json({ ok: true });
}

export async function handlePreferencesApi(request: Request, env: PreferencesEnv) {
  const user = getUser(request);
  if (!user) return json({ error: "Sign in with ChatGPT to sync preferences" }, 401);

  const url = new URL(request.url);
  if (url.pathname === "/api/preferences") {
    if (request.method === "GET") return getPreferences(request, env, user);
    if (request.method === "PUT") return putPreferences(request, env, user);
    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/wallpapers" && request.method === "POST") {
    return uploadWallpaper(request, env, user);
  }

  const match = url.pathname.match(/^\/api\/wallpapers\/([0-9a-f-]{36})$/i);
  if (match) {
    if (request.method === "GET") return getWallpaper(env, user, match[1]);
    if (request.method === "DELETE") return deleteWallpaper(env, user, match[1]);
  }

  return json({ error: "Not found" }, 404);
}
