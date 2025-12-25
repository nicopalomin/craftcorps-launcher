import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import es from './locales/es.json';
import tr from './locales/tr.json';
import zh from './locales/zh.json';
import pl from './locales/pl.json';
import ptBR from './locales/pt-BR.json';
import ru from './locales/ru.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';

i18n
    // detect user language
    .use(LanguageDetector)
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // init i18next
    .init({
        resources: {
            en: {
                translation: en
            },
            es: {
                translation: es
            },
            tr: {
                translation: tr
            },
            zh: {
                translation: zh
            },
            pl: {
                translation: pl
            },
            'pt-BR': {
                translation: ptBR
            },
            ru: {
                translation: ru
            },
            de: {
                translation: de
            },
            fr: {
                translation: fr
            },
            ja: {
                translation: ja
            },
            ko: {
                translation: ko
            }
        },
        fallbackLng: 'en',
        debug: true,

        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },

        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'craftcrops_language',
            caches: ['localStorage']
        }
    });

export default i18n;
