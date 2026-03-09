import type { Metadata } from "next";
import { Noto_Sans_Arabic } from "next/font/google";
import { DirectionProvider } from "@/components/ui/direction";
import "./globals.css";

const fontSans = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto",
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
    <html lang="ar" dir="rtl" className={`${fontSans.variable} font-sans`}>
      <body className="antialiased">
        <DirectionProvider direction="rtl">{children}</DirectionProvider>
      </body>
    </html>
  );
}
