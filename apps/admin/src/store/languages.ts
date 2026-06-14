/**
 * Languages store — manages the system-wide list of available translation languages.
 *
 * Each language has:
 * - locale: BCP-47 code (e.g. "en", "pl", "fr")
 * - name: Display name (e.g. "English")
 * - status: "published" = visible to frontend users; "draft" = admin-only
 * - isDefault: exactly one language is the default (always "en" initially)
 * - createdAt: ISO timestamp for sorting/display
 *
 * Persisted to localStorage so settings survive page reloads.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type LanguageStatus = 'published' | 'draft';

export interface Language {
  locale: string;
  name: string;
  nativeName: string;
  status: LanguageStatus;
  isDefault: boolean;
  createdAt: string;
}

/** Well-known language catalogue — used to populate the "add language" picker. */
export const KNOWN_LANGUAGES: Omit<Language, 'status' | 'isDefault' | 'createdAt'>[] = [
  { locale: 'en', name: 'English', nativeName: 'English' },
  { locale: 'pl', name: 'Polish', nativeName: 'Polski' },
  { locale: 'fr', name: 'French', nativeName: 'Français' },
  { locale: 'de', name: 'German', nativeName: 'Deutsch' },
  { locale: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { locale: 'es', name: 'Spanish', nativeName: 'Español' },
  { locale: 'it', name: 'Italian', nativeName: 'Italiano' },
  { locale: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { locale: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { locale: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { locale: 'da', name: 'Danish', nativeName: 'Dansk' },
  { locale: 'fi', name: 'Finnish', nativeName: 'Suomi' },
];

interface LanguagesState {
  languages: Language[];

  /** Add a new language. No-op if locale already exists. */
  addLanguage: (locale: string) => void;

  /** Update status of an existing language. */
  updateLanguageStatus: (locale: string, status: LanguageStatus) => void;

  /** Remove a language. Cannot remove the default language. */
  removeLanguage: (locale: string) => void;

  /** Set a language as the default. Clears isDefault on all others. */
  setDefault: (locale: string) => void;
}

const DEFAULT_LANGUAGES: Language[] = [
  {
    locale: 'en',
    name: 'English',
    nativeName: 'English',
    status: 'published',
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
];

export const useLanguagesStore = create<LanguagesState>()(
  persist(
    (set, get) => ({
      languages: DEFAULT_LANGUAGES,

      addLanguage: (locale: string) => {
        const { languages } = get();
        if (languages.some((l) => l.locale === locale)) return;

        const known = KNOWN_LANGUAGES.find((l) => l.locale === locale);
        const newLang: Language = {
          locale,
          name: known?.name ?? locale.toUpperCase(),
          nativeName: known?.nativeName ?? locale,
          status: 'draft',
          isDefault: false,
          createdAt: new Date().toISOString(),
        };
        set({ languages: [...languages, newLang] });
      },

      updateLanguageStatus: (locale: string, status: LanguageStatus) => {
        set((state) => ({
          languages: state.languages.map((l) =>
            l.locale === locale ? { ...l, status } : l,
          ),
        }));
      },

      removeLanguage: (locale: string) => {
        const { languages } = get();
        const target = languages.find((l) => l.locale === locale);
        if (!target || target.isDefault) return; // cannot remove default
        set({ languages: languages.filter((l) => l.locale !== locale) });
      },

      setDefault: (locale: string) => {
        set((state) => ({
          languages: state.languages.map((l) => ({
            ...l,
            isDefault: l.locale === locale,
          })),
        }));
      },
    }),
    {
      name: 'knitting-admin-languages',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
    },
  ),
);
