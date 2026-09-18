import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revivo Admin",
  description: "Secure license management and analytics dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
