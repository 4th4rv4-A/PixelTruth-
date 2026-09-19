import { useState, useEffect } from 'react';

export default function Header({ activeTab, onTabChange }) {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pixeltruth-theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('pixeltruth-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <>
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

          {/* Tabs */}
          <nav className="hidden sm:flex items-center gap-6 h-full">
            <button
              id="tab-clean"
              onClick={() => onTabChange('clean')}
              className={`h-full flex items-center text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'clean'
                  ? 'border-safelight-500 text-ink-100'
                  : 'border-transparent text-ink-400 hover:text-ink-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 7h-7m7 10h-7M10 5l-6 7 6 7" />
                </svg>
                Clean Metadata
              </span>
            </button>
            <button
              id="tab-detect"
              onClick={() => onTabChange('detect')}
              className={`h-full flex items-center text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'detect'
                  ? 'border-develop-500 text-ink-100'
                  : 'border-transparent text-ink-400 hover:text-ink-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                Detect
              </span>
            </button>
          </nav>

          {/* Dark mode toggle */}
          <button
            id="theme-toggle"
            onClick={() => setDark(!dark)}
            className="w-10 h-10 flex items-center justify-end text-ink-400 hover:text-ink-300 transition-colors"
            aria-label="Toggle dark mode"
          >
            {dark ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>

      {/* Mobile tab bar */}
      <div className="sm:hidden flex border-b border-ink-800 bg-ink-950">
        <button
          onClick={() => onTabChange('clean')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'clean'
              ? 'text-ink-100 border-b-2 border-safelight-500'
              : 'text-ink-400'
          }`}
        >
          Clean Metadata
        </button>
        <button
          onClick={() => onTabChange('detect')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'detect'
              ? 'text-ink-100 border-b-2 border-develop-500'
              : 'text-ink-400'
          }`}
        >
          Detect
        </button>
      </div>
    </>
  );
}
