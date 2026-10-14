import { useState, useEffect, useCallback } from 'react';

/**
 * Detect client platform for tailored installation instructions.
 */
function getClientPlatform() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'desktop';
  }

  const userAgent = navigator.userAgent || navigator.vendor || window.opera || '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStreamNet;
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  if (isIOS || isIPadOS) return 'ios';
  if (/android/i.test(userAgent)) return 'android';
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'mac';
  if (/Windows/i.test(userAgent)) return 'windows';
  return 'desktop';
}

/**
 * Check if the app is currently running in standalone (PWA) mode.
 */
function checkIsStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

// Module-level cache so beforeinstallprompt is not lost across re-renders
let cachedDeferredPrompt = null;
const listeners = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    cachedDeferredPrompt = e;
    listeners.forEach((fn) => fn(cachedDeferredPrompt));
  });

  window.addEventListener('appinstalled', () => {
    cachedDeferredPrompt = null;
    listeners.forEach((fn) => fn(null));
  });
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(cachedDeferredPrompt);
  const [isStandalone, setIsStandalone] = useState(checkIsStandalone);
  const [isInstalled, setIsInstalled] = useState(checkIsStandalone);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const platform = getClientPlatform();

  useEffect(() => {

    const promptHandler = (prompt) => {
      setDeferredPrompt(prompt);
    };

    listeners.add(promptHandler);

    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const mediaChangeHandler = (e) => {
      setIsStandalone(e.matches);
      if (e.matches) setIsInstalled(true);
    };

    window.addEventListener('appinstalled', installedHandler);
    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener('change', mediaChangeHandler);
    }

    return () => {
      listeners.delete(promptHandler);
      window.removeEventListener('appinstalled', installedHandler);
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener('change', mediaChangeHandler);
      }
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        cachedDeferredPrompt = null;
        setDeferredPrompt(null);
        return { outcome: choice.outcome };
      } catch {
        cachedDeferredPrompt = null;
        setDeferredPrompt(null);
        return { outcome: 'dismissed' };
      }
    }

    // On iOS Safari, macOS Safari, or browsers where beforeinstallprompt isn't fired
    setIsGuideOpen(true);
    return { outcome: 'guide_opened' };
  }, [deferredPrompt]);

  const openGuide = useCallback(() => setIsGuideOpen(true), []);
  const closeGuide = useCallback(() => setIsGuideOpen(false), []);

  return {
    canPromptDirectly: Boolean(deferredPrompt),
    isInstalled: isInstalled || isStandalone,
    isStandalone,
    platform,
    isGuideOpen,
    openGuide,
    closeGuide,
    promptInstall,
  };
}
