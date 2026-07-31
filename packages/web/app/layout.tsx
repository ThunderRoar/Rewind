import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import { Menu } from "./Menu";

export const metadata = {
  title: "Rewind — time-travel debugging for AI agents",
  description: "Fork any decision an agent made, edit the memory it had, and replay.",
};

// Set the saved theme before first paint to avoid a flash of the default.
const themeBootstrap = `(function(){try{var t=localStorage.getItem('rewind-theme')||'midnight';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

function BranchMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="4.5" cy="4" r="2.2" stroke="var(--accent)" strokeWidth="1.6" />
      <circle cx="4.5" cy="14" r="2.2" stroke="var(--accent)" strokeWidth="1.6" />
      <circle cx="13.5" cy="9" r="2.2" stroke="var(--k-memory_write)" strokeWidth="1.6" />
      <path
        d="M4.5 6.2v5.6M4.5 9h4.2c1.6 0 2.2-.8 3-1.6"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="midnight" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <header className="site-header">
          <div className="inner">
            <Link href="/" className="brand">
              <BranchMark />
              Rewind
              <span className="tag">Time-travel debugging for AI agents</span>
            </Link>
            <span className="spacer" />
            <Menu />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
