import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static hosts publish the exported browser app. ChatGPT Sites keeps the
  // Worker runtime for signed-in preference and wallpaper synchronization.
  output: process.env.GITHUB_ACTIONS || process.env.VERCEL === "1" ? "export" : undefined,
};

export default nextConfig;
