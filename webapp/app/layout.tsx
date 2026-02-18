import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🎲 VoiceBet Arena — Voice-Powered Micro-Bets on Monad",
  description: "Make bets just by talking. Settled on Monad in 800ms.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
