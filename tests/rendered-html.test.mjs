import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the MyOS portfolio shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="zh-CN"/i);
  assert.match(html, /<title>MyOS · 你的个人作品桌面<\/title>/i);
  assert.match(html, /Liquid Glass 为灵感的个人作品网站/i);
  assert.match(html, /aria-label="MyOS 个人作品桌面"/i);
  assert.match(html, /data-wallpaper="aurora"/i);
  assert.match(html, /data-liquid-target="dock"/i);
  assert.match(html, /系统菜单栏/);
  assert.match(html, /应用程序 Dock/);
  assert.match(html, /浏览作品/);
  assert.match(html, /关于我/);
  assert.match(html, /实验室/);
  assert.match(html, /联系我/);
  assert.doesNotMatch(html, /单击打开 · 拖动窗口 · ⌘K 搜索/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Building your site/i);
});
