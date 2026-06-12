import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  axes: ["opsz"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Hoot Teacher Console",
  description: "Upload weekly notes and slides for AI-TA context.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
