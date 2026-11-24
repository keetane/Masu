import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  isLanguage,
  languageKey,
  readLanguage,
  translate,
  type Language,
} from "./i18n";
const Context = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
} | null>(null);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(readLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === "ja"
        ? "Masu | 筆算の練習帳"
        : "Masu | Written arithmetic practice";
    try {
      localStorage.setItem(languageKey, language);
    } catch {
      /* Practice remains available without storage. */
    }
  }, [language]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === languageKey && isLanguage(event.newValue))
        setLanguage(event.newValue);
    };
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) setLanguage(readLanguage());
    };
    window.addEventListener("storage", changed);
    window.addEventListener("pageshow", restored);
    return () => {
      window.removeEventListener("storage", changed);
      window.removeEventListener("pageshow", restored);
    };
  }, []);
  return (
    <Context.Provider value={{ language, setLanguage }}>
      {children}
    </Context.Provider>
  );
}
export function useI18n() {
  const value = useContext(Context);
  if (!value) throw Error("LanguageProvider is required");
  return { ...value, t: (text: string) => translate(text, value.language) };
}
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();
  return (
    <div className="language-switch" role="group" aria-label={t("言語")}>
      {(["ja", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          aria-label={code === "ja" ? "日本語" : "English"}
          title={code === "ja" ? "日本語" : "English"}
          aria-pressed={language === code}
          onClick={() => setLanguage(code)}
        >
          <img src={"./flag-" + code + ".svg"} alt="" width="30" height="20" />
        </button>
      ))}
    </div>
  );
}
