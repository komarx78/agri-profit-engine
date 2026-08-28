import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "アグリプロフィット - 農業収益エンジン",
  description: "農業現場の作業記録・勤怠打刻・出荷管理・収益分析システム",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "アグリ現場",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="アグリ現場" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        <div className="flex-1 flex flex-col w-full h-full">
          {children}
        </div>
      </body>
    </html>
  );
}
