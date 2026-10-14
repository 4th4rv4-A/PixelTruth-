import { useState, useEffect } from 'react';
import LanguageSelector from './LanguageSelector';

function getInitialTheme() {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem('pixeltruth-theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export default function Header() {
  const [dark, setDark] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('pixeltruth-theme', dark ? 'dark' : 'light');
    } catch {
      // ignore storage access errors in private/sandboxed mode
    }
  }, [dark]);

  return (
    <header className="sticky top-0 z-50 bg-ink-950 border-b border-ink-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center text-ink-100">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-ink-100">
              PixelTruth
            </h1>
          </div>

          {/* Right controls: Language Selector + Dark Mode Toggle */}
          <div className="flex items-center gap-3">
            <LanguageSelector />

            <button
              id="theme-toggle"
              onClick={() => setDark(!dark)}
              className="w-9 h-9 flex items-center justify-center rounded-md border border-ink-800 text-ink-400 hover:text-ink-200 hover:bg-ink-900 transition-colors cursor-pointer"
              aria-label="Toggle dark mode"
            >
              {dark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
