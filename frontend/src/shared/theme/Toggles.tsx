import type { Language } from "@/shared/i18n/translations";
import { LANGUAGES } from "@/shared/i18n/translations";
import { useI18n } from "@/shared/i18n/I18nProvider";
import { useTheme } from "@/shared/theme/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-sm transition hover:bg-accent"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

export function LanguageToggle() {
  const { language, setLanguage } = useI18n();
  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as Language)}
      className="h-8 rounded-lg border border-border bg-card px-2 text-xs outline-none transition hover:bg-accent"
      aria-label="Language"
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
