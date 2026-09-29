import type { WallpaperPhoto } from "./wallpaper-carousel";

const DATABASE_NAME = "myos-wallpaper-images-v1";
const STORE_NAME = "images";

function openImageDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Local wallpaper storage is unavailable"));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, 1);
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    request.onupgradeneeded = () => {
      const database = request.result;
      if (settled) {
        request.transaction?.abort();
        database.close();
        return;
      }
      try {
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      } catch (error) {
        request.transaction?.abort();
        database.close();
        fail(error);
      }
    };
    request.onerror = () => fail(request.error ?? new Error("Could not open local wallpaper storage"));
    request.onblocked = () => fail(new Error("Local wallpaper storage is blocked by another tab"));
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

async function withImageStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => T,
): Promise<T> {
  const database = await openImageDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      let result: T;
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not access local wallpaper storage"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Local wallpaper storage transaction was aborted"));
      try {
        result = operation(transaction.objectStore(STORE_NAME));
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  } finally {
    database.close();
  }
}

export async function saveLocalWallpaperImages(photos: WallpaperPhoto[]): Promise<WallpaperPhoto[]> {
  if (!photos.some((photo) => photo.url.startsWith("data:"))) return photos;

  return withImageStore("readwrite", (store) =>
    photos.map((photo) => {
      if (!photo.url.startsWith("data:")) return photo;
      store.put(photo.url, photo.id);
      return { ...photo, localAssetId: photo.id };
    }),
  );
}

export async function restoreLocalWallpaperImages(photos: WallpaperPhoto[]): Promise<WallpaperPhoto[]> {
  const pending = photos.filter((photo) => photo.localAssetId && photo.url === "");
  if (!pending.length) return photos;

  const images = await withImageStore("readonly", (store) => {
    const restored = new Map<string, string>();
    for (const photo of pending) {
      const id = photo.localAssetId!;
      const request = store.get(id);
      request.onsuccess = () => {
        if (typeof request.result === "string" && request.result.startsWith("data:")) {
          restored.set(id, request.result);
        }
      };
    }
    return restored;
  });

  return photos.flatMap((photo) => {
    if (!photo.localAssetId || photo.url !== "") return [photo];
    const url = images.get(photo.localAssetId);
    return url ? [{ ...photo, url }] : [];
  });
}

export function serializeLocalWallpaperImages(photos: WallpaperPhoto[]): string {
  return JSON.stringify(
    photos.map((photo) =>
      photo.localAssetId && photo.url.startsWith("data:") ? { ...photo, url: "" } : photo,
    ),
  );
}

export async function deleteLocalWallpaperImage(id: string): Promise<void> {
  await withImageStore("readwrite", (store) => {
    store.delete(id);
  });
}
