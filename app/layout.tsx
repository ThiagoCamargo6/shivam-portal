import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MobileNav from "./components/MobileNav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "shivam", template: "%s | shivam" },
  description: "Portal do clã SHIVAM — guerras, membros e planejamento.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased text-white`}>
        {/* BG global */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[#08080b]" />
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_10%_0%,rgba(139,92,246,0.18),transparent),radial-gradient(60%_50%_at_90%_0%,rgba(236,72,153,0.12),transparent)]" />
        </div>

        {/* NAV */}
        <MobileNav />

        {children}

        <footer className="border-t border-white/10 text-white/60 text-xs">
          <div className="max-w-7xl mx-auto px-4 py-8 text-center">
            © {new Date().getFullYear()} Developed from KING.
          </div>
        </footer>
      </body>
    </html>
  );
}
