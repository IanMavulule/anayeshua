import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enTranslations from './en/translations.json'
import ptTranslations from './pt/translations.json'

/**
 * Traduções no mesmo modelo do dhis2-semis-core (d2-i18n): a chave é o texto
 * em inglês e cada língua tem o seu `translations.json`. Para acrescentar um
 * texto, use `i18n.t('English text')` e corra `npm run i18n:check`.
 */
export const LANGUAGES = ['pt', 'en'] as const
export type AppLanguage = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'ana-yeshua-language'

function initialLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'pt' || stored === 'en') return stored
  } catch {
    /* armazenamento indisponível */
  }
  // Por omissão a app abre sempre em português; o inglês escolhe-se no seletor.
  return 'pt'
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslations },
    pt: { translation: ptTranslations },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  // As chaves são frases: não usar '.' nem ':' como separadores.
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnEmptyString: false,
})

export function setLanguage(language: AppLanguage): void {
  void i18n.changeLanguage(language)
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    /* idem */
  }
}

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language === 'en' ? 'en' : 'pt-MZ'
})

export default i18n
