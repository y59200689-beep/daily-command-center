import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = { title: { default: "Daily Command Center", template: "%s · Daily Command" }, description: "A calm, intelligent personal operating system.", applicationName: "Daily Command Center", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "Daily Command", statusBarStyle: "black-translucent" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F4F5F1" }, { media: "(prefers-color-scheme: dark)", color: "#10110F" }] };
const themeInitializer = `
try {
  var savedTheme = localStorage.getItem("dcc-theme");
  var initialTheme = savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = initialTheme;
} catch (_) {
  document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
      <body>
        <Script id="theme-initializer" strategy="beforeInteractive">{themeInitializer}</Script>
        {children}
      </body>
    </html>
  );
}
