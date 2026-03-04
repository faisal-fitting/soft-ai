import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DirectionProvider } from "@/components/ui/direction"
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CBO — تحليل الأعمال",
  description: "تحليل أعمال المطاعم والكافيهات بالذكاء الاصطناعي",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
         <DirectionProvider direction="rtl">
        {children}
        </DirectionProvider>
      </body>
    </html>
  );
}
