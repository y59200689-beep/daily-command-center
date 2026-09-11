import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import "./teamhub-redesign.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: { default: "Daily Command Center", template: "%s · Daily Command" }, description: "A calm, intelligent personal operating system.", applicationName: "Daily Command Center", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "Daily Command", statusBarStyle: "black-translucent" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#E7F0EC" }, { media: "(prefers-color-scheme: dark)", color: "#12211D" }] };
const themeInitializer = `
try {
  var savedTheme = localStorage.getItem("dcc-theme-teamhub");
  var initialTheme = savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : "light";
  document.documentElement.dataset.theme = initialTheme;
} catch (_) {
  document.documentElement.dataset.theme = "light";
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Script id="theme-initializer" strategy="beforeInteractive">{themeInitializer}</Script>
        {children}
      </body>
    </html>
  );
}
