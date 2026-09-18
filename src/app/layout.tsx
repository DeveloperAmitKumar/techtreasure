import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TechTreasure — Bulk Pinterest Pin Generator",
  description:
    "Generate bulk Pinterest pins with AI-written SEO metadata, render them in-browser, and export a Pinterest-ready CSV.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
