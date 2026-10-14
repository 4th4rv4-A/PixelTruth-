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
let cachedDeferredPrompt = typeof window !== 'undefined' ? (window.__pt_prompt || null) : null;
const listeners = new Set();

if (typeof window !== 'undefined') {
  // Connect to early capture from public/pwa-install.js if present
  if (Array.isArray(window.__pt_prompt_listeners)) {
    window.__pt_prompt_listeners.push((prompt) => {
      cachedDeferredPrompt = prompt;
      listeners.forEach((fn) => fn(prompt));
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    cachedDeferredPrompt = e;
    window.__pt_prompt = e;
    listeners.forEach((fn) => fn(cachedDeferredPrompt));
  });

  window.addEventListener('appinstalled', () => {
    cachedDeferredPrompt = null;
    window.__pt_prompt = null;
    listeners.forEach((fn) => fn(null));
  });
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(
    () => cachedDeferredPrompt || (typeof window !== 'undefined' ? window.__pt_prompt : null)
  );
  const [isStandalone, setIsStandalone] = useState(checkIsStandalone);
  const [isInstalled, setIsInstalled] = useState(checkIsStandalone);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);
  const platform = getClientPlatform();

  useEffect(() => {
    const promptHandler = (prompt) => {
      setDeferredPrompt(prompt);
    };

    listeners.add(promptHandler);

    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      if (typeof window !== 'undefined') window.__pt_prompt = null;
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

    // Modern Chrome: check if already installed via getInstalledRelatedApps
    if (typeof navigator !== 'undefined' && 'getInstalledRelatedApps' in navigator) {
      navigator.getInstalledRelatedApps().then((apps) => {
        if (apps && apps.length > 0) {
          setIsInstalled(true);
        }
      }).catch(() => {});
    }

    return () => {
      listeners.delete(promptHandler);
      window.removeEventListener('appinstalled', installedHandler);
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener('change', mediaChangeHandler);
      }
    };
  }, [deferredPrompt]);

  const promptInstall = useCallback(async () => {
    // 1. Resolve prompt: state -> module cache -> global window cache
    let prompt = deferredPrompt || cachedDeferredPrompt || (typeof window !== 'undefined' ? window.__pt_prompt : null);

    // 2. If prompt has not fired yet and we are on a platform that supports it, wait up to 1500ms
    if (!prompt && platform !== 'ios') {
      setIsPrompting(true);
      prompt = await new Promise((resolve) => {
        const timer = setTimeout(() => {
          listeners.delete(checkHandler);
          resolve(null);
        }, 1500);

        const checkHandler = (p) => {
          if (p) {
            clearTimeout(timer);
            listeners.delete(checkHandler);
            resolve(p);
          }
        };
        listeners.add(checkHandler);
      });
      setIsPrompting(false);
    }

    // 3. Direct 1-Click Native OS Install
    if (prompt && typeof prompt.prompt === 'function') {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        cachedDeferredPrompt = null;
        if (typeof window !== 'undefined') window.__pt_prompt = null;
        setDeferredPrompt(null);
        return { outcome: choice ? choice.outcome : 'accepted' };
      } catch (err) {
        console.error('Failed to trigger PWA install prompt:', err);
        cachedDeferredPrompt = null;
        if (typeof window !== 'undefined') window.__pt_prompt = null;
        setDeferredPrompt(null);
        return { outcome: 'dismissed' };
      }
    }

    // 4. Fallback guide only for iOS Safari or unsupported browsers
    setIsGuideOpen(true);
    return { outcome: 'guide_opened' };
  }, [deferredPrompt, platform]);

  const openGuide = useCallback(() => setIsGuideOpen(true), []);
  const closeGuide = useCallback(() => setIsGuideOpen(false), []);

  return {
    canPromptDirectly: Boolean(deferredPrompt || cachedDeferredPrompt || (typeof window !== 'undefined' && window.__pt_prompt)),
    isInstalled: isInstalled || isStandalone,
    isStandalone,
    isPrompting,
    platform,
    isGuideOpen,
    openGuide,
    closeGuide,
    promptInstall,
  };
}
