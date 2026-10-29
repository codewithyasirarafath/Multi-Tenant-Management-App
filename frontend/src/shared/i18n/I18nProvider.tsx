import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LANGUAGES, translations, type Language } from "@/shared/i18n/translations";

const LANGUAGE_KEY = "appLanguage";

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  languages: typeof LANGUAGES;
}

const I18nContext = createContext<I18nState | null>(null);

function detectInitialLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_KEY) as Language | null;
  if (stored && translations[stored]) return stored;
  const browser = navigator.language.slice(0, 2) as Language;
  if (translations[browser]) return browser;
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_KEY, lang);
  }, []);

  const t = useCallback(
    (key: string) => translations[language][key] ?? translations.en[key] ?? key,
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t, languages: LANGUAGES }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
