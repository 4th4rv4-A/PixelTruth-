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
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-surface-950/70 border-b border-surface-200/60 dark:border-surface-700/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-lg shadow-accent-500/25">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-surface-900 dark:text-white">
              Pixel<span className="text-accent-600 dark:text-accent-400">Truth</span>
            </h1>
          </div>

          {/* Tabs */}
          <nav className="hidden sm:flex items-center gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
            <button
              id="tab-clean"
              onClick={() => onTabChange('clean')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'clean'
                  ? 'bg-white dark:bg-surface-700 text-accent-700 dark:text-accent-400 shadow-sm'
                  : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
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
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'detect'
                  ? 'bg-white dark:bg-surface-700 text-violet-700 dark:text-violet-400 shadow-sm'
                  : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
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
            className="w-10 h-10 rounded-xl flex items-center justify-center text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all duration-200"
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
      <div className="sm:hidden flex border-b border-surface-200/60 dark:border-surface-700/40 bg-white/70 dark:bg-surface-950/70 backdrop-blur-xl">
        <button
          onClick={() => onTabChange('clean')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'clean'
              ? 'text-accent-700 dark:text-accent-400 border-b-2 border-accent-500'
              : 'text-surface-500 dark:text-surface-400'
          }`}
        >
          Clean Metadata
        </button>
        <button
          onClick={() => onTabChange('detect')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'detect'
              ? 'text-violet-700 dark:text-violet-400 border-b-2 border-violet-500'
              : 'text-surface-500 dark:text-surface-400'
          }`}
        >
          Detect
        </button>
      </div>
    </>
  );
}
