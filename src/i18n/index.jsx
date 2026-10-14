import { useState, useEffect } from 'react';
import { I18nContext } from './context';
import { TRANSLATIONS } from './translations';


export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(() => {
    try {
      const saved = localStorage.getItem('pixeltruth_locale');
      if (saved && TRANSLATIONS[saved]) return saved;
      const navLang = navigator.language?.slice(0, 2)?.toLowerCase();
      if (navLang && TRANSLATIONS[navLang]) return navLang;
    } catch {
      // ignore localStorage errors
    }
    return 'en';
  });

  useEffect(() => {
    try {
      localStorage.setItem('pixeltruth_locale', locale);
      document.documentElement.lang = locale;
    } catch {
      // ignore
    }
  }, [locale]);

  const t = (key) => {
    return TRANSLATIONS[locale]?.[key] || TRANSLATIONS.en[key] || key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
