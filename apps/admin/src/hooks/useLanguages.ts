/**
 * useLanguages — returns the list of languages for use in translation tab UIs.
 *
 * Admin forms use `allLocales` — every configured language (published + draft)
 * appears as a tab so editors can prepare translations regardless of publish status.
 *
 * The frontend (public) app should use `publishedLocales` to show only
 * languages that are ready for users.
 */

import { useLanguagesStore, KNOWN_LANGUAGES } from '@/store/languages';
import type { Language } from '@/store/languages';

export interface UseLanguagesResult {
  /** All languages (published + draft). */
  all: Language[];
  /** Only published languages — use for public-facing frontends. */
  published: Language[];
  /** The default language (always exactly one). */
  defaultLanguage: Language | undefined;
  /** All locale codes (published + draft) — use in admin form tabs. */
  allLocales: string[];
  /** Locale codes for published languages only — use in public-facing frontends. */
  publishedLocales: string[];
  /** Label map: locale → display name. Falls back to KNOWN_LANGUAGES catalogue, then the locale code itself. */
  localeLabels: Record<string, string>;
  /**
   * Resolves the display name for any locale code, falling back to the KNOWN_LANGUAGES
   * catalogue and finally to the uppercased locale code itself.
   */
  getLocaleLabel: (locale: string) => string;
}

export function useLanguages(): UseLanguagesResult {
  const languages = useLanguagesStore((s) => s.languages);

  const published = languages.filter((l) => l.status === 'published');
  const defaultLanguage = languages.find((l) => l.isDefault);
  const allLocales = languages.map((l) => l.locale);
  const publishedLocales = published.map((l) => l.locale);

  const localeLabels: Record<string, string> = {};
  for (const l of languages) {
    localeLabels[l.locale] = l.name;
  }

  function getLocaleLabel(locale: string): string {
    if (localeLabels[locale]) return localeLabels[locale]!;
    const known = KNOWN_LANGUAGES.find((k) => k.locale === locale);
    if (known) return known.name;
    return locale.toUpperCase();
  }

  return {
    all: languages,
    published,
    defaultLanguage,
    allLocales,
    publishedLocales,
    localeLabels,
    getLocaleLabel,
  };
}
