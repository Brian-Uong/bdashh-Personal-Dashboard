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
      <head>
<link rel="icon" href="/favicon.ico?v=bd1" sizes="16x16 32x32 48x48" />
<link rel="icon" href="/icons/brians-dash-v1-16.png" type="image/png" sizes="16x16" />
<link rel="icon" href="/icons/brians-dash-v1-32.png" type="image/png" sizes="32x32" />
<link rel="icon" href="/favicon.svg?v=bd1" type="image/svg+xml" sizes="any" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=bd1" sizes="180x180" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
