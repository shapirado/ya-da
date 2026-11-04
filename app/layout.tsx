import type { Metadata } from "next";
import { Varela_Round, Rubik } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

// tokens.json `type.families.display` is "Varela Round", "Rubik", ...
// tokens.json `type.families.sans` is "Rubik", "Assistant", ...
const varelaRound = Varela_Round({
  subsets: ["latin", "hebrew"],
  weight: "400",
  variable: "--font-varela-round",
});

const rubik = Rubik({
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rubik",
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
        <body className={`${varelaRound.variable} ${rubik.variable}`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
