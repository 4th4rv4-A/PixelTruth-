import { useState, useEffect } from 'react';
import { useI18n } from '../i18n/useI18n';

export default function InstallModal({
  isOpen,
  onClose,
  platform = 'desktop',
  canPromptDirectly = false,
  onPromptInstall,
}) {
  const { t } = useI18n();

  const defaultTab = platform === 'ios' ? 'ios' : platform === 'android' ? 'android' : 'desktop';
  const [userTab, setUserTab] = useState(null);
  const activeTab = userTab || defaultTab;

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-modal-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 bg-ink-950/70 backdrop-blur-sm cursor-default"
        onClick={onClose}
        aria-label={t('close') || 'Close dialog'}
      />

      <div
        className="relative z-10 w-full max-w-lg bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-ink-100 dark:border-ink-800/80 bg-ink-50/50 dark:bg-ink-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-safelight-500/15 border border-safelight-500/30 flex items-center justify-center text-safelight-500">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div>
              <h2 id="install-modal-title" className="text-base font-bold text-ink-900 dark:text-white">
                {t('installTitle') || 'Install PixelTruth'}
              </h2>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                {t('installSubtitle') || 'Install on your device for fast, 100% offline access.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors cursor-pointer"
            aria-label={t('close') || 'Close'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Device selector tabs */}
        <div className="flex border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-950/30 px-3 pt-2 gap-1">
          <button
            onClick={() => setUserTab('ios')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-t-lg transition-colors cursor-pointer border-b-2 ${
              activeTab === 'ios'
                ? 'border-safelight-500 text-ink-900 dark:text-white font-bold bg-white dark:bg-ink-900 shadow-xs'
                : 'border-transparent text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-200 font-medium'
            }`}
          >
            <span>📱</span> iPhone / iPad
          </button>
          <button
            onClick={() => setUserTab('android')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-t-lg transition-colors cursor-pointer border-b-2 ${
              activeTab === 'android'
                ? 'border-safelight-500 text-ink-900 dark:text-white font-bold bg-white dark:bg-ink-900 shadow-xs'
                : 'border-transparent text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-200 font-medium'
            }`}
          >
            <span>🤖</span> Android
          </button>
          <button
            onClick={() => setUserTab('desktop')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-t-lg transition-colors cursor-pointer border-b-2 ${
              activeTab === 'desktop'
                ? 'border-safelight-500 text-ink-900 dark:text-white font-bold bg-white dark:bg-ink-900 shadow-xs'
                : 'border-transparent text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-200 font-medium'
            }`}
          >
            <span>💻</span> Laptop & Desktop
          </button>
        </div>

        {/* Tab content */}
        <div className="p-5 space-y-4">
          {/* iOS Safari Instructions */}
          {activeTab === 'ios' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>Please make sure you are viewing this page in <strong>Apple Safari</strong>.</span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-ink-50 dark:bg-ink-800/40 border border-ink-100 dark:border-ink-800">
                  <div className="w-6 h-6 rounded-full bg-safelight-500 text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
                  <div className="text-xs text-ink-700 dark:text-ink-300">
                    <p className="font-semibold text-ink-900 dark:text-white">Tap the Share button</p>
                    <p className="mt-0.5 text-ink-500 dark:text-ink-400 flex items-center gap-1">
                      Located in Safari's bottom toolbar
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline text-safelight-500">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                        <polyline points="16 6 12 2 8 6" />
                        <line x1="12" y1="2" x2="12" y2="15" />
                      </svg>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-ink-50 dark:bg-ink-800/40 border border-ink-100 dark:border-ink-800">
                  <div className="w-6 h-6 rounded-full bg-safelight-500 text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
                  <div className="text-xs text-ink-700 dark:text-ink-300">
                    <p className="font-semibold text-ink-900 dark:text-white">Select "Add to Home Screen"</p>
                    <p className="mt-0.5 text-ink-500 dark:text-ink-400">
                      Scroll down in the share sheet and tap the <strong>+</strong> icon.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-ink-50 dark:bg-ink-800/40 border border-ink-100 dark:border-ink-800">
                  <div className="w-6 h-6 rounded-full bg-safelight-500 text-white text-xs font-bold flex items-center justify-center shrink-0">3</div>
                  <div className="text-xs text-ink-700 dark:text-ink-300">
                    <p className="font-semibold text-ink-900 dark:text-white">Tap "Add"</p>
                    <p className="mt-0.5 text-ink-500 dark:text-ink-400">
                      Tap Add in the top-right corner. PixelTruth will now appear on your home screen like a native app.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Android Instructions */}
          {activeTab === 'android' && (
            <div className="space-y-3">
              {canPromptDirectly && onPromptInstall ? (
                <div className="p-4 bg-safelight-500/10 border border-safelight-500/30 rounded-xl space-y-3">
                  <p className="text-xs text-ink-700 dark:text-ink-300 font-medium">
                    Your browser supports 1-click installation!
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onPromptInstall();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-safelight-500 hover:bg-safelight-400 text-white text-sm font-semibold shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Install App Now
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-ink-50 dark:bg-ink-800/40 border border-ink-100 dark:border-ink-800">
                    <div className="w-6 h-6 rounded-full bg-safelight-500 text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
                    <div className="text-xs text-ink-700 dark:text-ink-300">
                      <p className="font-semibold text-ink-900 dark:text-white">Open the Chrome menu</p>
                      <p className="mt-0.5 text-ink-500 dark:text-ink-400">
                        Tap the three dots (<strong>⋮</strong>) in the top-right corner.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-ink-50 dark:bg-ink-800/40 border border-ink-100 dark:border-ink-800">
                    <div className="w-6 h-6 rounded-full bg-safelight-500 text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
                    <div className="text-xs text-ink-700 dark:text-ink-300">
                      <p className="font-semibold text-ink-900 dark:text-white">Tap "Install app" or "Add to Home screen"</p>
                      <p className="mt-0.5 text-ink-500 dark:text-ink-400">
                        Select the install option and follow the quick confirmation prompt.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Laptop & Desktop Instructions */}
          {activeTab === 'desktop' && (
            <div className="space-y-3">
              {canPromptDirectly && onPromptInstall ? (
                <div className="p-4 bg-safelight-500/10 border border-safelight-500/30 rounded-xl space-y-3">
                  <p className="text-xs text-ink-700 dark:text-ink-300 font-medium">
                    Direct installation is available for your browser.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onPromptInstall();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-safelight-500 hover:bg-safelight-400 text-white text-sm font-semibold shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Install App on Desktop
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-ink-50 dark:bg-ink-800/40 border border-ink-100 dark:border-ink-800">
                    <div className="w-6 h-6 rounded-full bg-safelight-500 text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
                    <div className="text-xs text-ink-700 dark:text-ink-300">
                      <p className="font-semibold text-ink-900 dark:text-white">Check your Browser Address Bar</p>
                      <p className="mt-0.5 text-ink-500 dark:text-ink-400">
                        In Chrome, Edge, or Brave, click the <strong>Install PixelTruth</strong> icon (computer with down arrow or <strong>⊕</strong>) on the right side of the address bar.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-ink-50 dark:bg-ink-800/40 border border-ink-100 dark:border-ink-800">
                    <div className="w-6 h-6 rounded-full bg-safelight-500 text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
                    <div className="text-xs text-ink-700 dark:text-ink-300">
                      <p className="font-semibold text-ink-900 dark:text-white">For macOS Safari (Sonoma+)</p>
                      <p className="mt-0.5 text-ink-500 dark:text-ink-400">
                        Click <strong>File</strong> in the top menu bar &gt; select <strong>Add to Dock...</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer assurance badge */}
          <div className="pt-2 border-t border-ink-100 dark:border-ink-800/80 flex items-center justify-between text-xs text-ink-600 dark:text-ink-400 font-medium">
            <span className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-safelight-500 shrink-0">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              100% Client-Side &amp; Offline Ready
            </span>
            <button
              onClick={onClose}
              className="text-ink-600 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white font-medium hover:underline cursor-pointer"
            >
              {t('close') || 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
