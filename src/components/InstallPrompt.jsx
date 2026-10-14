import { useState, useCallback } from 'react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useI18n } from '../i18n/useI18n';

export default function InstallPrompt() {
  const { canPromptDirectly, isInstalled, promptInstall } = usePwaInstall();
  const { t } = useI18n();

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('pixeltruth-install-dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem('pixeltruth-install-dismissed', 'true');
    } catch {
      // storage unavailable
    }
  }, []);

  // Don't show floating card if: already installed, user dismissed, or no direct prompt available
  if (isInstalled || dismissed || !canPromptDirectly) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-fade-in-up">
      <div className="frame p-4 shadow-xl shadow-ink-950/20 dark:shadow-black/40 border border-ink-300 dark:border-ink-700 bg-white/95 dark:bg-ink-900/95 backdrop-blur-md">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-10 h-10 rounded-lg bg-safelight-500 text-ink-50 flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
              {t('installTitle') || 'Install PixelTruth'}
            </p>
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
              {t('installSubtitle') || 'Add to your device for offline access'}
            </p>
          </div>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="w-7 h-7 rounded-md flex items-center justify-center text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors flex-shrink-0 cursor-pointer"
            aria-label="Dismiss install prompt"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Install button */}
        <button
          onClick={promptInstall}
          className="mt-3 w-full py-2 px-4 rounded-md bg-safelight-500 hover:bg-safelight-400 text-ink-50 text-sm font-semibold shadow-sm transition-all duration-200 active:scale-[0.98] cursor-pointer"
        >
          {t('installApp') || 'Install'}
        </button>
      </div>
    </div>
  );
}

