import type { Metadata } from "next";
import "./globals.css";
import { APP } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${APP.name} · ${APP.subtitle}`,
  description: APP.issuer,
};

// System fonts only: the app runs on the municipal LAN and must not depend on downloading web fonts.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
