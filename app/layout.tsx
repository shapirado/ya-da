import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

// Single unified font for both Hebrew and Latin text (Heebo supports both;
// Open Sans/Inter were considered but neither ships a Hebrew subset).
const heebo = Heebo({
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heebo",
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
        <body className={heebo.variable}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
