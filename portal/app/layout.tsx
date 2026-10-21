import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhatsLead | Sutor Digital",
  description: "AI-powered WhatsApp lead management workspace by Sutor Digital.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-Hant-HK"><body>{children}</body></html>;
}
