export interface Language {
  code: string;
  name: string;
  label: string;
}

export const AVAILABLE_LANGUAGES: Language[] = [
  { code: 'es', name: 'spanish', label: 'Español' },
  { code: 'ca', name: 'valencian', label: 'Valencià' },
  { code: 'en', name: 'english', label: 'English' },
];

/**
 * Obtiene el idioma por defecto basándose en el idioma del navegador
 * @returns El código del idioma detectado o 'en' como fallback
 */
function getDefaultLanguage(): string {
  const fallbackLang = 'en';
  if (typeof navigator === 'undefined') {
    return fallbackLang; // Fallback para SSR
  }

  const browserLang = navigator.language || navigator.languages?.[0];
  if (!browserLang) {
    return fallbackLang;
  }

  // Obtener solo el código de idioma (ej: 'es-ES' -> 'es')
  const langCode = browserLang.split('-')[0].toLowerCase();

  // Verificar si el idioma está disponible
  const availableCodes = AVAILABLE_LANGUAGES.map((lang) => lang.code);
  if (availableCodes.includes(langCode)) {
    return langCode;
  }

  // Fallback a inglés si no se encuentra el idioma
  return fallbackLang;
}

export const DEFAULT_LANGUAGE = getDefaultLanguage();
