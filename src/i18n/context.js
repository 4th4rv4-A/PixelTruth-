import { createContext } from 'react';

export const I18nContext = createContext({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});
