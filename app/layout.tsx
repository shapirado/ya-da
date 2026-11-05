import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const heebo = Heebo({
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heebo",
  display: "swap", // Ensures fallback displays while loading
});

export const metadata: Metadata = {
  title: "Ya-Da",
  description: "מעקב תשלומים לחוג האומנות",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="he" dir="rtl">
        {/* Pass both className and variable directly */}
        <body className={`${heebo.variable} ${heebo.className}`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}