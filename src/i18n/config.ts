import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import it from './locales/it';
import en from './locales/en';

const STORAGE_KEY = 'hr_lang';

const savedLang = localStorage.getItem(STORAGE_KEY);
const defaultLang = (savedLang === 'it' || savedLang === 'en') ? savedLang : 'it';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      it: { translation: it },
      en: { translation: en },
    },
    lng: defaultLang,
    fallbackLng: 'it',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

// Persist language change to localStorage
i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
