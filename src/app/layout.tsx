import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bill Agent",
  description: "Shared household budget & expense manager",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
