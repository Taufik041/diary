import type { Metadata, Viewport } from "next";
import { Caveat, Cormorant_Garamond, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// display: 'block' — page text is laid out in these faces at fixed sizes. A
// first paint in a fallback font would wrap differently, then jump.
const caveat = Caveat({
  subsets: ["latin"],
  display: "block",
  variable: "--font-caveat",
  fallback: ["cursive"],
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "block",
  variable: "--font-cormorant",
  fallback: ["Georgia", "serif"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "block",
  variable: "--font-plex-mono",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "Diary",
};

export const viewport: Viewport = {
  themeColor: "#efe6d9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${caveat.variable} ${cormorant.variable} ${plexMono.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
