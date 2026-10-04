import type { Metadata } from "next";
import localFont from "next/font/local";
import "@chrisoakman/chessboardjs/dist/chessboard-1.0.0.min.css";
import "./globals.css";

const display = localFont({ src: "./fonts/rajdhani.woff2", variable: "--font-display", display: "swap" });
const body = localFont({ src: "./fonts/space-grotesk.woff2", variable: "--font-body", display: "swap" });
export const metadata: Metadata = { title: "JEV / ARENA — Autonomous Chess", description: "Two independent Jev players. One chessboard. Set their objectives and watch every decision unfold." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${display.variable} ${body.variable}`}><body>{children}</body></html>;
}
