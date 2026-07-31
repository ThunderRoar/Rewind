"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const THEMES = [
  { id: "midnight", label: "Midnight", swatch: "#6ea8fe" },
  { id: "kraken", label: "Kraken", swatch: "#2fd6a6" },
  { id: "sand", label: "Sand", swatch: "#d5593c" },
  { id: "paper", label: "Paper", swatch: "#2f6fe0" },
] as const;
type ThemeId = (typeof THEMES)[number]["id"];

export function Menu() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("midnight");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme((localStorage.getItem("rewind-theme") as ThemeId) ?? "midnight");
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function applyTheme(id: ThemeId) {
    setTheme(id);
    document.documentElement.setAttribute("data-theme", id);
    localStorage.setItem("rewind-theme", id);
  }

  return (
    <div className="menu" ref={ref}>
      <button
        className="menu-btn"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden>
          <path d="M2 4.5h13M2 8.5h13M2 12.5h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="menu-panel">
          <div className="menu-label">Theme</div>
          <div className="theme-switch" style={{ margin: "0 4px 6px" }}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                title={t.label}
                aria-label={t.label}
                aria-pressed={theme === t.id}
                onClick={() => applyTheme(t.id)}
              >
                <span className="dot" style={{ background: t.swatch }} />
              </button>
            ))}
          </div>
          <div className="menu-sep" />
          <Link href="/timelines" className="menu-item" onClick={() => setOpen(false)}>
            <span className="mi-ic">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="4" cy="12" r="2" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="12" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M4 6v4M4 8h4c1.5 0 2-.7 2.5-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
            Timelines
          </Link>
          <Link href="/about" className="menu-item" onClick={() => setOpen(false)}>
            <span className="mi-ic">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 7.2v3.4M8 5.2v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            How it works
          </Link>
          <Link href="/mcp" className="menu-item" onClick={() => setOpen(false)}>
            <span className="mi-ic">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M2 11l4-6 3 4 2-3 3 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            MCP server setup
          </Link>
        </div>
      )}
    </div>
  );
}
