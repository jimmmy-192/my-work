import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function renderSite() {
  const outputRoot = new URL("../dist/client/", import.meta.url);
  try {
    return {
      html: await readFile(new URL("index.html", outputRoot), "utf8"),
      outputRoot,
    };
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
  }

  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  return { html: await response.text(), outputRoot: null };
}

test("renders the complete MyOS portfolio shell", async () => {
  const { html, outputRoot } = await renderSite();
  assert.match(html, /<html[^>]*lang="zh-CN"/i);
  assert.match(html, /<title>MyOS · 你的个人作品桌面<\/title>/i);
  assert.match(html, /Liquid Glass 为灵感的个人作品网站/i);
  assert.match(html, /aria-label="MyOS 个人作品桌面"/i);
  assert.match(html, /data-wallpaper="mountain"/i);
  assert.match(html, /data-liquid-target="dock"/i);
  assert.match(html, /系统菜单栏/);
  assert.match(html, /应用程序 Dock/);
  assert.match(html, /浏览作品/);
  assert.match(html, /关于我/);
  assert.doesNotMatch(html, /桌面快捷方式/);
  assert.doesNotMatch(html, /单击打开 · 拖动窗口 · ⌘K 搜索/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Building your site/i);

  if (outputRoot) {
    const portfolioBundlePath = html.match(/(?:\/my-work)?\/_next\/static\/chunks\/(PortfolioOS-[^"/]+\.js)/)?.[1];
    assert.ok(portfolioBundlePath, "the interactive portfolio bundle is linked from the exported page");

    const bundle = await readFile(
      new URL(`_next/static/chunks/${portfolioBundlePath}`, outputRoot),
      "utf8",
    );
    assert.match(bundle, /实验室/);
    assert.match(bundle, /联系我/);
    assert.match(bundle, /设置/);
    assert.match(bundle, /废纸篓/);

    for (const asset of [
      "og.png",
      "icons/about-character.png",
      "icons/contact-bubble.png",
      "icons/contact-envelope.png",
      "icons/trash-wireframes.png",
      "icons/welcome-finder.png",
      "icons/works-folder.png",
      "wallpapers/blue-folds.png",
      "wallpapers/garden-canopy-upright.jpg",
      "wallpapers/snow-mountain.jpg",
    ]) {
      const file = await readFile(new URL(asset, outputRoot));
      assert.ok(file.byteLength > 0, `${asset} is included in the static export`);
    }
  }
});
