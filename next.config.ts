import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages remains a static, browser-only fallback. ChatGPT Sites keeps
  // the Worker runtime so signed-in visitors can sync preferences and uploads.
  output: process.env.GITHUB_ACTIONS ? "export" : undefined,
};

export default nextConfig;
