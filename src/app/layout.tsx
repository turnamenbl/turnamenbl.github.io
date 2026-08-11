import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Billiard Bracket Maker",
  description: "Buat bagan turnamen billiard sistem liga atau gugur",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: "/favicon-48.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen flex flex-col relative overflow-x-hidden bg-[#05150d] text-white">
        {/* Ambient background effects */}
        <div className="fixed inset-0 pointer-events-none -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-green-950 to-slate-950" />
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-emerald-600/20 blur-[120px] animate-pulse" style={{ animationDuration: "8s" }} />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-green-800/15 blur-[100px] animate-pulse" style={{ animationDuration: "10s", animationDelay: "2s" }} />
          <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full bg-teal-700/10 blur-[90px]" />
        </div>

        <header className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-md supports-[backdrop-filter]:bg-black/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-green-700 flex items-center justify-center shadow-lg shadow-emerald-900/50 group-hover:shadow-emerald-500/40 group-hover:scale-105 transition-all duration-300">
                <span className="text-lg">🎱</span>
                <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">
                  Billiard Bracket
                </span>
                <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase">
                  Tournament Maker
                </span>
              </div>
            </Link>
          </div>
        </header>

        <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          {children}
        </main>

        <footer className="relative z-10 border-t border-white/5 bg-black/30 backdrop-blur-md py-4">
          <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-1.5">
            <p className="text-white/40 text-xs text-center">
              Billiard Bracket Maker &copy; {new Date().getFullYear()}
            </p>
            <Link
              href="/admin"
              className="text-[9px] text-white/15 hover:text-white/40 transition-colors select-none leading-none"
              aria-label="Admin panel"
              title="Admin"
            >
              •
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
