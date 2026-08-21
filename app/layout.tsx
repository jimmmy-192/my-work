import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "MyOS · 你的个人作品桌面";
const description = "一个以 Liquid Glass 为灵感的个人作品网站。";

export const viewport: Viewport = {
  width: 1024,
};

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host") ?? "localhost:3000";
  const protocol = incomingHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const imageUrl = new URL("/og.png", origin).toString();

  return {
    title,
    description,
    openGraph: {
      type: "website",
      locale: "zh_CN",
      url: origin,
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "MyOS 个人作品桌面预览" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
