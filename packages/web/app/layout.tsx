import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import { Menu } from "./Menu";

export const metadata = {
  title: "Rewind - Time travel debugging for AI agents",
  description: "Fork any decision an agent made, edit the memory it had, and replay.",
};

// Set the saved theme before first paint to avoid a flash of the default.
const themeBootstrap = `(function(){try{var t=localStorage.getItem('rewind-theme')||'midnight';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

function BranchMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M22.5 8.5 L15 16 L22.5 23.5"
        stroke="#6ea8fe"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 8.5 L7.5 16 L15 23.5"
        stroke="#6ea8fe"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22.5" cy="8.5" r="2.6" fill="#6ea8fe" />
      <circle cx="22.5" cy="23.5" r="2.6" fill="#6ea8fe" />
      <circle cx="15" cy="16" r="3" fill="#6ea8fe" />
      <circle cx="7.5" cy="16" r="3.2" fill="#f2617a" />
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
