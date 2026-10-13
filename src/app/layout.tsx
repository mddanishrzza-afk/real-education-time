import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { PwaRegistration } from "@/components/pwa-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Real Education Time", template: "%s | Real Education Time" },
  description: "Personalized learning, smart practice and performance analytics for every student.",
  applicationName: "Real Education Time",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "RET Learn" },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  openGraph: {
    type: "website",
    siteName: "Real Education Time",
    title: "Real Education Time — AI tutor, real tests, real analysis",
    description:
      "Class 6-12 learning for CBSE, Bihar Board and ICSE students: original lessons, timed tests, an AI tutor in Hindi, English or Hinglish, and honest performance analysis.",
    url: "/",
    locale: "en_IN",
    images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: "Real Education Time — RET emblem" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Real Education Time — AI tutor, real tests, real analysis",
    description: "Original lessons, timed tests, AI tutor and performance analysis for Class 6-12 students.",
    images: ["/brand/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#000e30" },
    { media: "(prefers-color-scheme: dark)", color: "#000e30" },
  ],
};

const themeInitScript = `
(function () {
  var dark = false;
  try {
    var saved = localStorage.getItem("ret-theme");
    dark = saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
  } catch (_) {
    dark = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  document.documentElement.classList.toggle("dark", dark);
})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head><script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body>{children}<PwaRegistration /></body>
    </html>
  );
}
