import { useState, useEffect } from 'react';
import LanguageSelector from './LanguageSelector';
import InstallModal from './InstallModal';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useI18n } from '../i18n/useI18n';

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
  const { t } = useI18n();
  const {
    canPromptDirectly,
    isInstalled,
    isPrompting,
    platform,
    isGuideOpen,
    closeGuide,
    promptInstall,
  } = usePwaInstall();

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

            {/* Right controls: Install App + Language Selector + Dark Mode Toggle */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Dedicated Universal Install Button */}
              {isInstalled ? (
                <div
                  className="hidden sm:flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-safelight-500/30 bg-safelight-500/10 text-safelight-400 text-xs font-semibold select-none"
                  title="PixelTruth is installed as a PWA on your device"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{t('appInstalled') || 'App Installed'}</span>
                </div>
              ) : (
                <button
                  id="install-app-button"
                  onClick={promptInstall}
                  disabled={isPrompting}
                  className="flex items-center gap-1.5 py-1.5 px-2.5 sm:px-3 rounded-lg border border-safelight-500/40 bg-safelight-500 hover:bg-safelight-400 text-white text-xs font-semibold shadow-sm transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-80"
                  aria-label={t('installApp') || 'Install App'}
                >
                  {isPrompting ? (
                    <svg className="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  )}
                  <span className="hidden sm:inline">
                    {isPrompting ? 'Preparing...' : (t('installApp') || 'Install App')}
                  </span>
                  <span className="inline sm:hidden">
                    {isPrompting ? '...' : 'Install'}
                  </span>
                </button>
              )}

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

      {/* Universal PWA installation guidance modal */}
      <InstallModal
        isOpen={isGuideOpen}
        onClose={closeGuide}
        platform={platform}
        canPromptDirectly={canPromptDirectly}
        onPromptInstall={promptInstall}
      />
    </>
  );
}

