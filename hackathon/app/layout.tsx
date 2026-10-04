import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AppSidebar } from "@/components/AppSidebar";
import "./globals.css";
import Header from "./Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tailor · personal CV agent",
  description:
    "Turn a Big CV into a tailored application. Capabilities routed by JevRouter.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-dvh flex-col overflow-hidden">
        <Header />
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col md:flex-row">
          <AppSidebar />
          <div className="flex min-h-0 min-w-0 flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
