import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Sixxxx";
const description = "一个以 Liquid Glass 为灵感的个人作品网站。";

export const viewport: Viewport = {
  width: 1024,
};

const siteUrl = "https://jimmmy-192.github.io/my-work";
const imageUrl = `${siteUrl}/og.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: siteUrl,
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
