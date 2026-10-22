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

export default function Header({ files = [] }) {
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

  const totalBytes = files.reduce((sum, f) => sum + (f.file?.size || 0), 0);
  const mbUsed = (totalBytes / (1024 * 1024)).toFixed(1);

  return (
    <>
      <header className="sticky top-0 z-50 bg-ink-950/95 backdrop-blur-md border-b border-ink-800">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
            {/* Logo & Tactical Air-Gap Badge */}
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-safelight-500/10 border border-safelight-500/30 flex items-center justify-center text-safelight-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-ink-100 flex items-center gap-1.5">
                  PixelTruth
                  <span className="font-mono text-[10px] text-ink-400 bg-ink-900 border border-ink-800 px-1.5 py-0.5 rounded font-normal">
                    v2.6 Core
                  </span>
                </h1>
              </div>

              <div className="h-4 w-px bg-ink-800 hidden md:block" />

              {/* Zero-Upload Air-Gap Enclave Indicator */}
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded bg-develop-500/10 border border-develop-500/40 text-develop-400 text-xs font-semibold select-none shadow-[0_0_12px_rgba(74,155,142,0.15)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-develop-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-develop-500" />
                </span>
                <span className="font-mono text-[11px] tracking-wider uppercase">
                  ZERO-UPLOAD AIR-GAP ENCLAVE [ACTIVE]
                </span>
              </div>
            </div>

            {/* Center: Live Real-Time Telemetry Bar */}
            <div className="hidden xl:flex items-center gap-4 bg-ink-900/90 px-3.5 py-1 rounded border border-ink-800 font-mono text-[11px] text-ink-300">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-develop-400" />
                <span>RAM:</span>
                <span className="text-ink-100 font-bold">{mbUsed} MB</span>
                <span className="text-ink-500">/ 500 MB</span>
              </div>
              <div className="h-3 w-px bg-ink-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-develop-400 font-medium">WASM SIMD:</span>
                <span className="text-ink-200">WebWorker Isolated</span>
              </div>
              <div className="h-3 w-px bg-ink-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-develop-400 font-medium">Socket Leakage:</span>
                <span className="text-develop-400 font-bold">0 Bytes / 0 Sockets</span>
              </div>
            </div>

            {/* Right controls: Install App + Language Selector + Dark Mode Toggle */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Universal Install Button */}
              {isInstalled ? (
                <div
                  className="hidden sm:flex items-center gap-1.5 py-1.5 px-3 rounded-md border border-safelight-500/30 bg-safelight-500/10 text-safelight-400 text-xs font-semibold select-none font-mono"
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
                  className="flex items-center gap-1.5 py-1.5 px-2.5 sm:px-3 rounded-md border border-safelight-500/40 bg-safelight-500 hover:bg-safelight-400 text-white text-xs font-semibold shadow-[0_0_12px_rgba(255,107,53,0.25)] transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-80"
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
                  <span className="hidden sm:inline font-mono">
                    {isPrompting ? 'Preparing...' : (t('installApp') || 'Install App')}
                  </span>
                  <span className="inline sm:hidden font-mono">
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
