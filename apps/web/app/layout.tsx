import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Agent Services Marketplace",
  description: "Payment-aware research agents with MCP, x402, and MPP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="mx-auto min-h-screen max-w-6xl px-6 py-8">
          <header className="mb-10 flex items-center justify-between">
            <a href="/" className="text-slate-100 no-underline">
              <div className="text-xs uppercase tracking-[0.24em] text-gold">ASM</div>
              <div className="text-lg font-semibold">Agent Services Marketplace</div>
            </a>
            <nav className="flex gap-5 text-sm text-slate-300">
              <a href="/services">Catalog</a>
              <a href="/">New task</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
