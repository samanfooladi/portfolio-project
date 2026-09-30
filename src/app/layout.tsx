import type { Metadata, Viewport } from "next";
import { Alfa_Slab_One, Inter } from "next/font/google";
import "./globals.css";

// The character names, and nothing else. A slab this heavy is what lets the
// gradient fill and the pixel-step extrusion read at all -- thinner strokes
// leave neither enough glyph to work with.
const slab = Alfa_Slab_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-slab",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Character Select",
  description: "Choose your fighter.",
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${slab.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
