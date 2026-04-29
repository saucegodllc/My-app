import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en";
import es from "./locales/es";
import fr from "./locales/fr";
import ht from "./locales/ht";
import pt from "./locales/pt";

export const LANGUAGE_STORAGE_KEY = "@connectsphere_language";

export const LANGUAGE_MAP: Record<string, string> = {
  "English":            "en",
  "Spanish":            "es",
  "Haitian Creole":     "ht",
  "Portuguese":         "pt",
  "French":             "fr",
  "Italian":            "it",
  "German":             "de",
  "Arabic":             "ar",
  "Hindi":              "hi",
  "Chinese (Mandarin)": "zh",
  "Chinese (Cantonese)":"zh-HK",
  "Japanese":           "ja",
  "Korean":             "ko",
  "Russian":            "ru",
  "Polish":             "pl",
  "Vietnamese":         "vi",
  "Tagalog":            "tl",
  "Somali":             "so",
  "Swahili":            "sw",
  "Other":              "en",
};

const SUPPORTED_LOCALES = new Set(["en", "es", "fr", "ht", "pt"]);

export function resolveLocale(language: string): string {
  const code = LANGUAGE_MAP[language] ?? "en";
  return SUPPORTED_LOCALES.has(code) ? code : "en";
}

export function isLanguageFullySupported(language: string): boolean {
  const code = LANGUAGE_MAP[language] ?? "en";
  return SUPPORTED_LOCALES.has(code);
}

export async function getSavedLanguage(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved ?? "en";
  } catch {
    return "en";
  }
}

export async function saveLanguage(locale: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
  } catch {
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      ht: { translation: ht },
      pt: { translation: pt },
    },
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: "v4",
  });

export default i18n;
