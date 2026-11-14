import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "StayPunch360 | Hotel Management",
  description: "StayPunch360 property management and distribution platform",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
