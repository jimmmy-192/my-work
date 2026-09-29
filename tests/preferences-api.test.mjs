import assert from "node:assert/strict";
import test from "node:test";
import { handlePreferencesApi } from "../worker/preferences-api.ts";

test("uploads and persists another wallpaper when the user already has more than five", async () => {
  const userId = "wallpaper-test-user";
  const rows = Array.from({ length: 6 }, (_, index) => ({
    id: `existing-${index}`,
    user_id: userId,
  }));
  const objects = new Map();
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              async first() {
                assert.match(sql, /SELECT COUNT\(\*\)/);
                return { count: rows.filter((row) => row.user_id === values[0]).length };
              },
              async run() {
                assert.match(sql, /INSERT INTO custom_wallpapers/);
                const [id, user_id, name, object_key, content_type, size_bytes] = values;
                rows.push({ id, user_id, name, object_key, content_type, size_bytes });
                return { success: true };
              },
            };
          },
        };
      },
    },
    WALLPAPERS: {
      async put(key, body, options) {
        objects.set(key, {
          bytes: Buffer.from(await new Response(body).arrayBuffer()),
          contentType: options.httpMetadata.contentType,
        });
      },
      async delete(key) {
        objects.delete(key);
      },
    },
  };
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=",
    "base64",
  );
  const form = new FormData();
  form.set("name", "Seventh wallpaper");
  form.set("file", new File([image], "wallpaper.png", { type: "image/png" }));

  const response = await handlePreferencesApi(new Request("https://example.test/api/wallpapers", {
    method: "POST",
    headers: {
      "oai-authenticated-user-id": userId,
      "oai-authenticated-user-email": "wallpaper-test@example.test",
    },
    body: form,
  }), env);

  assert.equal(response.status, 201);
  const { photo } = await response.json();
  assert.equal(rows.length, 7);
  const saved = rows.find((row) => row.id === photo.id);
  assert.equal(saved.user_id, userId);
  assert.equal(saved.name, "Seventh wallpaper");
  assert.equal(saved.content_type, "image/png");
  assert.equal(saved.size_bytes, image.byteLength);
  assert.deepEqual(objects.get(saved.object_key), { bytes: image, contentType: "image/png" });
  assert.equal(photo.url, `https://example.test/api/wallpapers/${photo.id}`);
  assert.equal(photo.custom, true);
});
