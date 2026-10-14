import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/useI18n';
import { SUPPORTED_LOCALES } from '../i18n/translations';

export default function LanguageSelector() {
  const { locale, setLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentLocale = SUPPORTED_LOCALES.find((l) => l.code === locale) || SUPPORTED_LOCALES[0];

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-ink-700 dark:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 border border-ink-200 dark:border-ink-800 transition-colors cursor-pointer"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Select language"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-ink-500"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span>{currentLocale.name}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-44 rounded-md bg-white dark:bg-ink-900 shadow-lg border border-ink-200 dark:border-ink-800 py-1 z-50 max-h-64 overflow-y-auto animate-fade-in">
          {SUPPORTED_LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setLocale(l.code);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors cursor-pointer ${
                l.code === locale
                  ? 'font-bold text-safelight-600 dark:text-safelight-400 bg-safelight-50 dark:bg-safelight-950/30'
                  : 'text-ink-700 dark:text-ink-300'
              }`}
            >
              <span>{l.name}</span>
              {l.code === locale && <span className="text-safelight-600">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
