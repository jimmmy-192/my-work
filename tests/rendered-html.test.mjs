import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import wallpaperCatalog from "../content/wallpapers.json" with { type: "json" };

async function renderSite() {
  const outputRoot = new URL("../dist/client/", import.meta.url);
  try {
    return {
      html: await readFile(new URL("index.html", outputRoot), "utf8"),
      outputRoot,
    };
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    assert.ok(
      !process.env.GITHUB_ACTIONS && process.env.VERCEL !== "1",
      "static deployments must generate dist/client/index.html instead of relying on a Worker",
    );
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
  const assetPrefix = process.env.GITHUB_ACTIONS && process.env.VERCEL !== "1" ? "/my-work/" : "/";
  assert.match(html, /<html[^>]*lang="zh-CN"/i);
  assert.match(html, /<title>Sixxxx<\/title>/i);
  assert.match(html, /Liquid Glass 为灵感的个人作品网站/i);
  assert.match(html, /aria-label="MyOS 个人作品桌面"/i);
  assert.match(html, /data-wallpaper="mountain"/i);
  assert.match(html, /data-liquid-target="dock"/i);
  assert.match(html, /系统菜单栏/);
  assert.match(html, /应用程序 Dock/);
  const welcomeView = html.match(/<article\b[^>]*class="welcome-tech-view"[^>]*>[\s\S]*?<\/article>/)?.[0];
  assert.ok(welcomeView, "the welcome window contains the full-size TechText greeting");
  assert.match(welcomeView, /aria-label="Hi, I&#x27;m Sixxxx"/);
  assert.match(welcomeView, /<canvas\b/);
  assert.match(welcomeView, /class="light-rays-container"/);
  assert.match(welcomeView, /了解我/);
  assert.match(welcomeView, /查看作品/);
  assert.doesNotMatch(welcomeView, /<h[1-6]|<dl|welcome-portrait/);
  assert.match(html, /关于我/);
  assert.doesNotMatch(html, /桌面快捷方式/);
  assert.doesNotMatch(html, /单击打开 · 拖动窗口 · ⌘K 搜索/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Building your site/i);

  const slides = [...html.matchAll(/<span\b[^>]*class="wallpaper-photo-slide(?: [^"]*)?"[^>]*>/g)].map((match) => match[0]);
  const visibleWallpapers = wallpaperCatalog.photos.filter((photo) => !photo.concealed);
  assert.equal(slides.length, 5, "initial HTML contains only the five visible published wallpapers");
  assert.deepEqual(
    slides.map((slide) => slide.match(/background-image:url\(&quot;([^&]+)&quot;\)/)?.[1]),
    visibleWallpapers.map((photo) => `${assetPrefix}${photo.path}`),
  );
  assert.doesNotMatch(slides.join(""), /data:|snow-mountain\.jpg/);
  assert.doesNotMatch(html, /snow-mountain\.jpg/);
  assert.match(html, /data-wallpaper-fallback="false"/);
  assert.match(slides[0], /class="wallpaper-photo-slide is-active"/);
  for (const [index, slide] of slides.entries()) {
    assert.ok(slide.includes(`data-fit="${visibleWallpapers[index].fit}"`), "published photos retain their intended composition");
    assert.doesNotMatch(slide, /data-custom="true"/);
  }

  const publishedAssetRoot = outputRoot ?? new URL("../dist/client/", import.meta.url);
  for (const photo of wallpaperCatalog.photos) {
    const file = await readFile(new URL(photo.path, publishedAssetRoot));
    assert.ok(file.byteLength > 0, `${photo.path} is included in the build, including hidden defaults`);
  }

  if (outputRoot) {
    const assetPaths = [...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css))"/g)].map((match) => match[1]);
    assert.ok(assetPaths.length > 0, "the exported page links its scripts and stylesheets");
    for (const assetPath of assetPaths) {
      assert.ok(assetPath.startsWith(`${assetPrefix}_next/`), `${assetPath} uses the deployment's asset prefix`);
      await readFile(new URL(assetPath.slice(assetPrefix.length), outputRoot));
    }

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
      "icons/about-portrait.png",
      "icons/contact-bubble.png",
      "icons/contact-envelope.png",
      "icons/trash-wireframes.png",
      "icons/welcome-finder.png",
      "icons/works-folder.png",
    ]) {
      const file = await readFile(new URL(asset, outputRoot));
      assert.ok(file.byteLength > 0, `${asset} is included in the static export`);
    }
  }
});
