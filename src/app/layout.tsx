import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoPlanner — Map Measurement & Equipment Layout Tool",
  description: "Measure distances on Google Maps and calculate equipment/product placement capacity in any selected area.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
