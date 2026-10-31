import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Brian’s Dash", description: "Your private, connected personal dashboard" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
