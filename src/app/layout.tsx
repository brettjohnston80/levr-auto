import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DriveTransitionProvider } from "@/components/drive-transition-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
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
  title: "LEVR Auto — Car buying, with the leverage on your side.",
  description:
    "Tell us the exact car you want. We'll search every dealer in the country and negotiate your price — so you never have to haggle.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-x-hidden bg-zinc-950">
        <DriveTransitionProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </DriveTransitionProvider>
      </body>
    </html>
  );
}
